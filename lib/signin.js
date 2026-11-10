/**
 * Mistral Vibe browser sign-in.
 *
 * The same first-party flow `vibe --setup` runs, replayed with plain HTTPS
 * calls: create a process with a PKCE challenge, let the user approve it in a
 * browser, poll until approved, then exchange the token pair for an API key
 * provisioned on the Vibe counter.
 *
 *   1. POST {console}/api/vibe/sign-in  {code_challenge, code_challenge_method}
 *        -> {process_id, sign_in_url, poll_url, expires_at}
 *   2. user opens sign_in_url and approves
 *   3. GET  {poll_url}                  -> pending | completed+exchange_token
 *   4. POST {console}/api/vibe/sign-in/{process_id}/exchange
 *        {exchange_token, code_verifier} -> {api_key}
 *
 * Polling is deliberately slow: the service treats fast polling as abuse, so
 * one request every 15 s is the documented-safe cadence.
 */
import { createHash, randomBytes } from "node:crypto";

/** Poll cadence the service tolerates. */
export const POLL_INTERVAL_MS = 15_000;
/** A sign-in link lives about twenty minutes. */
export const SIGN_IN_TIMEOUT_MS = 20 * 60_000;

/**
 * Build a PKCE verifier/challenge pair.
 * @param {Function} [random] - injectable byte source.
 * @returns {{verifier: string, challenge: string}} the pair.
 */
export function pkce(random = randomBytes) {
  const verifier = random(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Create a sign-in process.
 * @param {object} options - inputs.
 * @param {string} options.consoleBase - console origin.
 * @param {string} options.challenge - PKCE challenge.
 * @param {Function} [options.fetchImpl] - injectable fetch.
 * @param {AbortSignal} [options.signal] - cancellation.
 * @returns {Promise<{processId: string, signInUrl: string, pollUrl: string, expiresAt: string}>} the process.
 */
export async function createProcess({ consoleBase, challenge, fetchImpl = fetch, signal }) {
  const response = await fetchImpl(`${consoleBase}/api/vibe/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code_challenge: challenge, code_challenge_method: "S256" }),
    signal,
  });
  if (!response.ok) {
    await response.text();
    throw new Error(`sign-in could not start (HTTP ${response.status})`);
  }
  const body = await response.json();
  if (typeof body?.process_id !== "string" || typeof body?.sign_in_url !== "string" || typeof body?.poll_url !== "string") {
    throw new Error("sign-in returned an unexpected payload");
  }
  return {
    processId: body.process_id,
    signInUrl: body.sign_in_url,
    pollUrl: body.poll_url,
    expiresAt: body.expires_at,
  };
}

/**
 * Read one poll result.
 * @param {object} options - inputs.
 * @param {string} options.pollUrl - URL from the create step.
 * @param {Function} [options.fetchImpl] - injectable fetch.
 * @param {AbortSignal} [options.signal] - cancellation.
 * @returns {Promise<{status: string, exchangeToken?: string, message?: string}>} the state.
 */
export async function poll({ pollUrl, fetchImpl = fetch, signal }) {
  const response = await fetchImpl(pollUrl, { headers: { accept: "application/json" }, signal });
  if (response.status === 410) {
    await response.text();
    return { status: "expired" };
  }
  if (!response.ok) {
    await response.text();
    throw new Error(`sign-in status unavailable (HTTP ${response.status})`);
  }
  const body = await response.json();
  const status = body?.status;
  if (!["pending", "completed", "expired", "denied", "error"].includes(status)) {
    throw new Error("sign-in returned an unknown state");
  }
  return {
    status,
    ...(typeof body.exchange_token === "string" ? { exchangeToken: body.exchange_token } : {}),
    ...(typeof body.message === "string" ? { message: body.message } : {}),
  };
}

/**
 * Exchange an approved process for an API key.
 * @param {object} options - inputs.
 * @param {string} options.consoleBase - console origin.
 * @param {string} options.processId - process id.
 * @param {string} options.exchangeToken - token from the poll.
 * @param {string} options.verifier - PKCE verifier from the create step.
 * @param {Function} [options.fetchImpl] - injectable fetch.
 * @returns {Promise<string>} the API key.
 */
export async function exchange({ consoleBase, processId, exchangeToken, verifier, fetchImpl = fetch }) {
  const response = await fetchImpl(`${consoleBase}/api/vibe/sign-in/${processId}/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ exchange_token: exchangeToken, code_verifier: verifier }),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403 && text.includes("9004")) {
      throw new Error(
        "this workspace cannot issue a Vibe key; sign in again and pick another workspace in the browser",
      );
    }
    throw new Error(`sign-in exchange failed (HTTP ${response.status})`);
  }
  const body = await response.json();
  if (typeof body?.api_key !== "string" || body.api_key.length === 0) {
    throw new Error("sign-in exchange returned no API key");
  }
  return body.api_key;
}

/**
 * One sign-in attempt: create, expose the URL, poll to completion, exchange.
 *
 * The attempt owns no storage. `onKey` is the caller's hook, so the credential
 * write stays in the plugin entry where the credentials service lives.
 */
export class SignInAttempt {
  /** @type {"idle"|"waiting"|"completed"|"expired"|"denied"|"error"} */
  status = "idle";
  signInUrl;
  error;
  #verifier;
  #processId;
  #pollUrl;
  #timer;
  #deadline;
  #listeners = new Set();

  /**
   * @param {object} options - inputs.
   * @param {string} options.consoleBase - console origin.
   * @param {Function} options.onKey - receives the provisioned API key.
   * @param {Function} [options.fetchImpl] - injectable fetch.
   * @param {Function} [options.setTimeoutImpl] - injectable timer.
   * @param {Function} [options.clearTimeoutImpl] - injectable timer.
   */
  constructor({ consoleBase, onKey, fetchImpl = fetch, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout }) {
    this.consoleBase = consoleBase;
    this.onKey = onKey;
    this.fetchImpl = fetchImpl;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
  }

  /** Subscribe to state changes. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener(this.snapshot());
  }

  /** Detached state for the UI. */
  snapshot() {
    return {
      status: this.status,
      signInUrl: this.signInUrl,
      error: this.error,
      expiresAt: this.#deadline === undefined ? undefined : new Date(this.#deadline).toISOString(),
    };
  }

  /**
   * Start the flow and return as soon as the URL exists; polling continues in
   * the background and reports through {@link subscribe}.
   * @returns {Promise<{signInUrl: string}>} the URL to open.
   */
  async start() {
    if (this.status === "waiting") return { signInUrl: this.signInUrl };
    const { verifier, challenge } = pkce();
    this.#verifier = verifier;
    const process = await createProcess({
      consoleBase: this.consoleBase,
      challenge,
      fetchImpl: this.fetchImpl,
    });
    this.#processId = process.processId;
    this.#pollUrl = process.pollUrl;
    this.signInUrl = process.signInUrl;
    this.status = "waiting";
    this.#deadline = Date.now() + SIGN_IN_TIMEOUT_MS;
    this.#emit();
    this.#schedule();
    return { signInUrl: process.signInUrl };
  }

  #schedule() {
    this.#timer = this.setTimeoutImpl(() => {
      void this.#tick();
    }, POLL_INTERVAL_MS);
    if (typeof this.#timer?.unref === "function") this.#timer.unref();
  }

  async #tick() {
    if (this.status !== "waiting") return;
    if (Date.now() > this.#deadline) {
      this.status = "expired";
      this.error = "the sign-in link expired; start again";
      this.#emit();
      return;
    }
    try {
      const result = await poll({ pollUrl: this.#pollUrl, fetchImpl: this.fetchImpl });
      if (result.status === "completed" && result.exchangeToken !== undefined) {
        const key = await exchange({
          consoleBase: this.consoleBase,
          processId: this.#processId,
          exchangeToken: result.exchangeToken,
          verifier: this.#verifier,
          fetchImpl: this.fetchImpl,
        });
        await this.onKey(key);
        this.status = "completed";
        this.#emit();
        return;
      }
      if (result.status !== "pending") {
        this.status = result.status;
        this.error = result.message ?? `sign-in ${result.status}`;
        this.#emit();
        return;
      }
    } catch (error) {
      this.status = "error";
      this.error = error instanceof Error ? error.message : String(error);
      this.#emit();
      return;
    }
    this.#schedule();
  }

  /** Stop polling; the link stays valid until it expires. */
  cancel() {
    if (this.#timer !== undefined) this.clearTimeoutImpl(this.#timer);
    this.#timer = undefined;
    if (this.status === "waiting") {
      this.status = "idle";
      this.#emit();
    }
  }
}
