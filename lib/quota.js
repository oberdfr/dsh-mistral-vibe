/**
 * Plan, budgets and local spend for the Mistral Vibe route.
 *
 * Three sources, three questions:
 *
 *  - `/api/vibe/whoami` (console) — which plan this key belongs to, and which
 *    API/chat hosts the tenant uses. Answers to an ordinary API key.
 *  - `/v1/billing/subscription` + `/v1/billing/budget` — the plan name and both
 *    monthly counters (Vibe allowance and API budget) with their reset date.
 *  - The local ledger — how much *this* Harness spent on the route, priced per
 *    model, which the account endpoints cannot attribute.
 *
 * Any of the three may be unavailable: a key without the billing permission
 * answers 403, and an offline host answers nothing. Each is reported as its own
 * status so the panel can degrade instead of disappearing.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Plan and tenant facts for one key. */
export async function whoami({ consoleBase, getKey, fetchImpl = fetch, signal }) {
  const key = await getKey();
  const response = await fetchImpl(`${consoleBase}/api/vibe/whoami`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    await response.text();
    return { status: "unavailable", httpStatus: response.status };
  }
  const body = await response.json();
  return {
    status: "ok",
    planType: body.plan_type,
    planName: body.plan_name,
    organizationKind: body.organization_kind,
    customerId: body.customer_id,
    apiBase: body.api_base,
    vibeBase: body.vibe_base,
    accessScope: body.primitive_access_scope,
    paidVibe: body.has_paid_vibe_entitlement === true,
  };
}

/** Normalize one budget counter. */
function budget(raw, kind) {
  if (raw === null || typeof raw !== "object") return undefined;
  const limit = Number(raw.initial_budget);
  const percent = Number(raw.usage_percentage);
  if (!Number.isFinite(limit) || limit <= 0) return undefined;
  const spent = Number.isFinite(percent) ? (percent / 100) * limit : undefined;
  return {
    kind,
    limit,
    percent: Number.isFinite(percent) ? percent : undefined,
    spent,
    remaining: spent === undefined ? undefined : Math.max(0, limit - spent),
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
    resetAt: typeof raw.reset_at === "string" ? raw.reset_at : undefined,
    payg: raw.payg_enabled === true,
  };
}

/** Plan name and both budgets. */
export async function billing({ apiBase, getKey, fetchImpl = fetch, signal }) {
  const key = await getKey();
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  const [subscriptionResponse, budgetResponse] = await Promise.all([
    fetchImpl(`${apiBase}/v1/billing/subscription`, { headers, signal }),
    fetchImpl(`${apiBase}/v1/billing/budget`, { headers, signal }),
  ]);

  let subscription;
  if (subscriptionResponse.ok) {
    const body = await subscriptionResponse.json();
    subscription = {
      planName: body.plan_name,
      payg: body.payg_enabled === true,
      vibePayg: body.vibe_payg_enabled === true,
      enterprise: body.enterprise === true,
    };
  } else {
    await subscriptionResponse.text();
  }

  let budgets;
  if (budgetResponse.ok) {
    const body = await budgetResponse.json();
    budgets = {
      vibe: budget(body.vibe_budget, "vibe"),
      api: budget(body.api_budget, "api"),
    };
  } else {
    await budgetResponse.text();
  }

  return {
    status: subscription === undefined && budgets === undefined ? "unavailable" : "ok",
    subscription,
    budgets,
  };
}

/**
 * Per-model token and cost ledger for this Harness, persisted as JSON.
 *
 * The account endpoints report the whole organization; this reports what the
 * route itself spent, which is what a user can act on.
 */
export class Ledger {
  /**
   * @param {object} options - inputs.
   * @param {string} options.path - cache file.
   * @param {Function} [options.readFileImpl] - injectable reader.
   * @param {Function} [options.writeFileImpl] - injectable writer.
   */
  constructor({ path, readFileImpl = readFileSync, writeFileImpl = writeFileSync }) {
    this.path = path;
    this.readFileImpl = readFileImpl;
    this.writeFileImpl = writeFileImpl;
    this.state = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, byModel: {}, lastAt: undefined };
    this.#load();
  }

  #load() {
    try {
      const parsed = JSON.parse(this.readFileImpl(this.path, "utf8"));
      if (parsed !== null && typeof parsed === "object" && typeof parsed.byModel === "object") {
        this.state = { ...this.state, ...parsed };
      }
    } catch {
      /* a missing or unreadable cache starts empty */
    }
  }

  #save() {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      this.writeFileImpl(this.path, JSON.stringify(this.state));
    } catch {
      /* best effort: the figure is a convenience, not a record */
    }
  }

  /**
   * Fold one usage report in.
   * @param {string} model - model id.
   * @param {object} usage - harness usage counts.
   * @param {object} prices - per-million prices.
   */
  record(model, usage, prices) {
    const input = Number(usage.inputTokens ?? 0);
    const output = Number(usage.outputTokens ?? 0);
    const cacheRead = Number(usage.cacheReadTokens ?? 0);
    const cacheWrite = Number(usage.cacheWriteTokens ?? 0);
    const cost =
      (input * prices.input + output * prices.output + cacheRead * prices.cacheRead + cacheWrite * prices.cacheWrite) /
      1e6;
    const entry = (this.state.byModel[model] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
    entry.calls += 1;
    entry.input += input;
    entry.output += output;
    entry.cacheRead += cacheRead;
    entry.cacheWrite += cacheWrite;
    entry.cost += cost;
    this.state.calls += 1;
    this.state.input += input;
    this.state.output += output;
    this.state.cacheRead += cacheRead;
    this.state.cacheWrite += cacheWrite;
    this.state.cost += cost;
    this.state.lastAt = Date.now();
    this.#save();
  }

  /** Detached view, models sorted by cost. */
  view() {
    return {
      ...this.state,
      byModel: Object.entries(this.state.byModel)
        .map(([model, entry]) => ({ model, ...entry }))
        .sort((left, right) => right.cost - left.cost),
    };
  }
}
