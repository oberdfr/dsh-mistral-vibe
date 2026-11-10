/**
 * Mistral Vibe provider for DeepSeek Harness.
 *
 * Registers the `mistral-vibe` route with its own adapter, its own settings
 * namespace and its own quota panel, so the route is independent of the
 * generic pi-ai route and can carry per-model capabilities, model visibility,
 * live discovery and browser sign-in.
 *
 * The adapter is not written from scratch: it is `PiAiAdapter` from
 * `@deepseek-ai/dsh-llm-pi-ai` driven by a profile this plugin builds, and the
 * wire protocol is `mistralConversationsApi` from pi-ai. That keeps streaming,
 * tool calls, images, replay and the idle watchdog exactly as the stock route
 * has them, while the catalog, the credentials and the quota are ours.
 *
 * @module dsh-mistral-vibe-provider
 */
import z from "@deepseek-ai/schemastery";
import { LlmError } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { mistralConversationsApi } from "@earendil-works/pi-ai/api/mistral-conversations.lazy";
import { join } from "node:path";
import { homedir } from "node:os";

import { CAPABILITIES } from "./capabilities.js";
import { buildCatalog, discover, probeLevels } from "./catalog.js";
import { SignInAttempt } from "./signin.js";
import { billing, Ledger, whoami } from "./quota.js";

/** Provider route this plugin owns. */
export const ROUTE = "mistral-vibe";
/** Plugin name; the settings namespace is the loader entry id instead. */
export const name = "dsh-mistral-vibe";
/** Host services this plugin needs. */
export const inject = ["llm", "webServer", "credentials"];

const DEFAULT_API_BASE = "https://api.mistral.ai";
const DEFAULT_CONSOLE_BASE = "https://console.mistral.ai";
const DEFAULT_KEY_ENV = "MISTRAL_VIBE_API_KEY";
const BRIDGE = "/api/mistral-vibe";
const DISCOVERY_INTERVAL_MS = 10 * 60_000;

/** Plugin configuration, editable from Settings. */
export const Config = z.object({
  apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_KEY_ENV),
  apiBase: z.string().default(DEFAULT_API_BASE),
  consoleBase: z.string().default(DEFAULT_CONSOLE_BASE),
  hidden: z.array(z.string()).default([]).volatile(),
  names: z.dict(z.string()).default({}).volatile(),
  barBudget: z.union(["vibe", "api"]).default("vibe").volatile(),
  currency: z.string().default("EUR"),
  discoveryMinutes: z.number().step(1).min(0).default(10),
});

/** DSH home, for the ledger cache. */
function dshHome() {
  const home = process.env.DSH_HOME;
  return home !== undefined && home.length > 0 ? home : join(homedir(), ".dsh");
}

/** Same-origin guard for the bridge, mirroring the other local plugins. */
function bridgeAllowed(req) {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.length === 0) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** Read a JSON body with a small cap. */
function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/** Write one JSON answer. */
function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

/**
 * Mount the provider.
 * @param {object} ctx - plugin context.
 * @param {object} config - resolved plugin configuration.
 */
export function apply(ctx, config) {
  const logger = ctx.logger;
  const api = mistralConversationsApi();
  // The settings namespace is the loader entry id, which the profile patch owns;
  // the plugin name is only the fallback when no entry is attached.
  const settingsNs = () => ctx.fiber?.entry?.options?.id ?? name;
  const apiBase = () => config.apiBase ?? DEFAULT_API_BASE;
  const consoleBase = () => config.consoleBase ?? DEFAULT_CONSOLE_BASE;
  const keyRef = () => config.apiKeyEnv ?? DEFAULT_KEY_ENV;

  /** Resolve the API key through the credential service, then the environment. */
  const getKey = async () => {
    const credentials = ctx.get("credentials");
    const ref = keyRef();
    if (credentials !== undefined) {
      try {
        const hit = await credentials.resolve(ref);
        if (typeof hit?.value === "string" && hit.value.length > 0) return hit.value;
      } catch (error) {
        logger.warn(`mistral-vibe: credential lookup for ${ref} failed: ${String(error)}`);
      }
    }
    const ambient = process.env[ref];
    if (typeof ambient === "string" && ambient.length > 0) return ambient;
    throw new LlmError(
      `mistral-vibe: no API key; store ${ref} through the credentials service (Settings → Mistral Vibe writes it), sign in with the browser, or export it in the launching environment`,
      "MISSING_CREDENTIAL",
    );
  };

  const ledger = new Ledger({ path: join(dshHome(), "mistral-vibe-ledger.json") });

  // Volatile fields arrive as live references (`{ get() }`) that the loader
  // updates when the settings document changes. A local override keeps the UI
  // responsive between the write and that update.
  const readVolatile = (field, fallback) => {
    const ref = config[field];
    if (ref !== null && typeof ref === "object" && typeof ref.get === "function") return ref.get() ?? fallback;
    return ref ?? fallback;
  };
  let hiddenOverride;
  const readHidden = () => hiddenOverride ?? readVolatile("hidden", []);
  let namesOverride;
  const readNames = () => namesOverride ?? readVolatile("names", {});
  const readBarBudget = () => readVolatile("barBudget", "vibe");
  ctx.on("loader/volatile-update", () => {
    hiddenOverride = undefined;
    namesOverride = undefined;
    rebuild();
  });

  // --- catalog ------------------------------------------------------------

  /** Live rows from the last discovery, or undefined before the first one. */
  let discovered;
  let discoveredAt;
  let discoveryError;

  /** Build the served descriptors from discovery (or the curated table). */
  const rebuild = () => {
    models = buildCatalog({
      discovered,
      capabilities: CAPABILITIES,
      hidden: readHidden(),
      names: readNames(),
      provider: ROUTE,
      baseUrl: apiBase(),
    });
    profilesCache = undefined;
  };

  let models = buildCatalog({ capabilities: CAPABILITIES, provider: ROUTE, baseUrl: apiBase() });

  const provider = {
    id: ROUTE,
    name: "Mistral Vibe",
    baseUrl: apiBase(),
    auth: {
      apiKey: {
        name: "Mistral Vibe",
        resolve: ({ credential }) =>
          Promise.resolve({
            auth: credential?.key === undefined ? {} : { apiKey: credential.key },
            source: "Mistral Vibe",
          }),
      },
    },
    getModels: () => models,
    stream: (model, context, options) => api.stream(model, context, options),
    streamSimple: (model, context, options) => api.streamSimple(model, context, options),
  };

  /** One resolved profile, as `PiAiAdapter` expects it. */
  const profile = {
    provider: ROUTE,
    displayName: "Mistral Vibe",
    piProvider: provider,
    configuredMaxTokens: new Map(),
    modelErrors: new Map(),
    streamIdleTimeoutMs: 300_000,
    maxRequestImageBytes: 20 * 1024 * 1024,
    maxRequestImages: 50,
    imageOffloadCountQuantum: 10,
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
    retryPolicy: undefined,
  };

  let profilesCache;
  const profiles = () => (profilesCache ??= new Map([[ROUTE, profile]]));

  const adapter = new PiAiAdapter({
    profiles,
    resolveApiKey: () => getKey(),
    auth: {},
    prepareHeaders: (_request, headers) => headers,
    resolveAttachments: () => ctx.get("attachments"),
    resolveImageAccess: () => undefined,
    onReplayDegrade: ({ model, reason }) => {
      logger.warn(`mistral-vibe: unusable replay state for "${model}"; sending provider-neutral content (${reason})`);
    },
  });

  ctx.llm.registerAdapter([ROUTE], adapter);
  ctx.llm.registerConfigurableProviders([
    { provider: ROUTE, displayName: "Mistral Vibe", settingsNs: settingsNs(), settingsPath: [] },
  ]);

  // --- discovery ----------------------------------------------------------

  const refreshCatalog = async () => {
    try {
      const rows = await discover({ apiBase: apiBase(), getKey });
      discovered = rows;
      discoveredAt = Date.now();
      discoveryError = undefined;
      rebuild();
      logger.info(`mistral-vibe: discovered ${rows.length} chat models`);
      return rows;
    } catch (error) {
      discoveryError = error instanceof Error ? error.message : String(error);
      logger.warn(`mistral-vibe: discovery failed: ${discoveryError}`);
      throw error;
    }
  };

  ctx.effect(() => {
    let disposed = false;
    void refreshCatalog().catch(() => undefined);
    const minutes = Number(config.discoveryMinutes ?? 10);
    if (!(minutes > 0)) return () => undefined;
    const timer = setInterval(() => {
      if (!disposed) void refreshCatalog().catch(() => undefined);
    }, Math.min(minutes * 60_000, DISCOVERY_INTERVAL_MS));
    if (typeof timer.unref === "function") timer.unref();
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, "mistral-vibe: discovery");

  // --- usage accounting ---------------------------------------------------

  ctx.effect(() => {
    const dispose = ctx.on("llm/stream", (options, next) => {
      if (String(options?.provider ?? "") !== ROUTE) return next();
      const model = String(options?.model ?? "unknown");
      const inner = next();
      return (async function* accounted() {
        for await (const chunk of inner) {
          if (chunk?.type === "usage" && chunk.usage !== undefined) {
            const price = models.find((entry) => entry.id === model)?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
            ledger.record(model, chunk.usage, price);
          }
          yield chunk;
        }
      })();
    });
    return () => {
      dispose();
    };
  }, "mistral-vibe: usage accounting");

  // --- sign-in ------------------------------------------------------------

  let attempt;
  const currentAttempt = () => {
    attempt ??= new SignInAttempt({
      consoleBase: consoleBase(),
      onKey: async (key) => {
        const credentials = ctx.get("credentials");
        if (credentials === undefined) throw new Error("this Harness has no credentials service");
        await credentials.set(keyRef(), key);
        logger.info(`mistral-vibe: browser sign-in stored ${keyRef()}`);
        void refreshCatalog().catch(() => undefined);
      },
    });
    return attempt;
  };

  // --- quota view ---------------------------------------------------------

  /** Everything the panel and the tool report. */
  const summary = async ({ refresh = false } = {}) => {
    const ref = keyRef();
    let credential = { ref, configured: false };
    const credentials = ctx.get("credentials");
    if (credentials !== undefined) {
      try {
        const info = await credentials.describe(ref);
        credential = { ref, configured: info.configured === true, source: info.source, writable: info.writable === true };
      } catch {
        /* fall through to the environment probe */
      }
    }
    if (!credential.configured && typeof process.env[ref] === "string") {
      credential = { ref, configured: true, source: "environment", writable: false };
    }

    let plan;
    let budgets;
    if (credential.configured) {
      const [whoamiResult, billingResult] = await Promise.all([
        whoami({ consoleBase: consoleBase(), getKey }).catch((error) => ({ status: "error", message: String(error) })),
        billing({ apiBase: apiBase(), getKey }).catch((error) => ({ status: "error", message: String(error) })),
      ]);
      plan = whoamiResult;
      budgets = billingResult;
      if (refresh) void refreshCatalog().catch(() => undefined);
    }

    const chosen = readBarBudget() === "api" ? budgets?.budgets?.api : budgets?.budgets?.vibe;
    const bar =
      chosen === undefined
        ? { source: "harness", value: ledger.view().cost, max: 0, currency: config.currency ?? "EUR" }
        : {
            source: "account",
            budget: chosen.kind,
            value: chosen.spent ?? 0,
            max: chosen.limit,
            percent: chosen.percent,
            currency: chosen.currency ?? config.currency ?? "EUR",
            resetAt: chosen.resetAt,
          };

    return {
      credential,
      plan,
      billing: budgets,
      bar,
      ledger: ledger.view(),
      catalog: {
        models: models.length,
        hidden: readHidden(),
        discoveredAt,
        error: discoveryError,
      },
      signIn: currentAttempt().snapshot(),
      updatedAt: new Date().toISOString(),
    };
  };

  // --- bridge -------------------------------------------------------------

  const routes = [
    {
      kind: "exact",
      path: `${BRIDGE}/summary`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const body = await readJson(req);
          send(res, 200, await summary({ refresh: body?.refresh === true }));
        } catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/signin/start`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const started = await currentAttempt().start();
          send(res, 200, started);
        } catch (error) {
          send(res, 502, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/signin/status`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        send(res, 200, currentAttempt().snapshot());
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/signin/cancel`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        currentAttempt().cancel();
        send(res, 200, { ok: true });
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/key`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const body = await readJson(req);
          const credentials = ctx.get("credentials");
          if (credentials === undefined) return send(res, 500, { error: "this Harness has no credentials service" });
          if (body?.action === "set") {
            const value = typeof body?.value === "string" ? body.value.trim() : "";
            if (value.length === 0) return send(res, 400, { error: "a non-empty key is required" });
            await credentials.set(keyRef(), value);
            void refreshCatalog().catch(() => undefined);
            return send(res, 200, { ok: true });
          }
          if (body?.action === "clear") {
            await credentials.unset(keyRef());
            return send(res, 200, { ok: true });
          }
          send(res, 400, { error: `unknown action: ${String(body?.action)}` });
        } catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/models`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const body = await readJson(req);
          if (body?.refresh === true) await refreshCatalog();
          const hidden = new Set(readHidden());
          const names = readNames();
          send(res, 200, {
            hidden: [...hidden],
            names,
            discoveredAt,
            error: discoveryError,
            models: models.map((model) => ({
              id: model.id,
              name: model.name,
              // The name discovery reported, so the editor can offer a reset.
              discoveredName: discovered?.find((row) => row.id === model.id)?.name ?? model.id,
              renamed: typeof names[model.id] === "string" && names[model.id].length > 0,
              contextWindow: model.contextWindow,
              input: model.input,
              levels: Object.entries(model.thinkingLevelMap ?? {})
                .filter(([, wire]) => wire !== null)
                .map(([level]) => level),
              hidden: hidden.has(model.id),
              deprecated: model.deprecated === true,
            })),
          });
        } catch (error) {
          send(res, 502, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/models/visibility`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const body = await readJson(req);
          if (!Array.isArray(body?.hidden)) return send(res, 400, { error: "hidden must be an array of model ids" });
          const hidden = body.hidden.filter((id) => typeof id === "string");
          // The settings document owns the value; write through the service so
          // the change survives a restart and reaches every reader.
          const settings = ctx.get("settings");
          if (settings === undefined) return send(res, 500, { error: "this Harness has no settings service" });
          await settings.update(settingsNs(), { hidden });
          hiddenOverride = hidden;
          rebuild();
          send(res, 200, { ok: true, hidden });
        } catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/models/rename`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const body = await readJson(req);
          const model = typeof body?.model === "string" ? body.model.trim() : "";
          if (model.length === 0) return send(res, 400, { error: "model is required" });
          const raw = typeof body?.name === "string" ? body.name.trim() : "";
          if (raw.length > 120) return send(res, 400, { error: "a display name is limited to 120 characters" });
          const settings = ctx.get("settings");
          if (settings === undefined) return send(res, 500, { error: "this Harness has no settings service" });
          // An empty name clears the override and restores the discovered one.
          // It is stored as an empty string rather than deleted: the settings
          // service drops an empty dict, which would leave the previous name in
          // place, while an empty value is a normal entry the catalog ignores.
          const next = { ...readNames(), [model]: raw };
          await settings.update(settingsNs(), { names: next });
          namesOverride = next;
          rebuild();
          send(res, 200, { ok: true, model, name: raw.length === 0 ? undefined : raw, names: next });
        } catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${BRIDGE}/models/probe`,
      handler: async (req, res) => {
        if (!bridgeAllowed(req)) return send(res, 403, { error: "cross-origin request refused" });
        try {
          const body = await readJson(req);
          const model = typeof body?.model === "string" ? body.model : "";
          if (model.length === 0) return send(res, 400, { error: "model is required" });
          const levels = await probeLevels({ apiBase: apiBase(), model, getKey });
          send(res, 200, { model, levels });
        } catch (error) {
          send(res, 502, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
  ];

  ctx.inject(["webServer"], (sctx) => {
    const disposers = routes.map((route) => sctx.webServer.register(route));
    sctx.effect(() => () => {
      for (const dispose of disposers) dispose();
    }, "mistral-vibe: bridge routes");
  });

  // --- agent tool ---------------------------------------------------------

  ctx.inject(["tools"], (sctx) => {
    sctx.effect(
      () =>
        sctx.tools.register({
          name: "mistral_vibe",
          description:
            "Report the Mistral Vibe plan, the monthly Vibe and API budgets, and what this Harness spent on the mistral-vibe route.",
          parameters: {
            type: "object",
            properties: { refresh: { type: "boolean", description: "Re-probe Mistral instead of using the last answer." } },
          },
          output: {
            schema: { type: "object", properties: { text: { type: "string" } } },
            render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
          },
          async execute(args) {
            const view = await summary({ refresh: args?.refresh === true });
            const currency = view.bar.currency ?? "EUR";
            const money = (value) =>
              typeof value === "number"
                ? new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value)
                : "—";
            const lines = [];
            if (view.plan?.status === "ok") lines.push(`Plan: ${view.plan.planName} (${view.plan.planType})`);
            if (view.billing?.budgets?.vibe) {
              const vibe = view.billing.budgets.vibe;
              lines.push(`Vibe budget: ${money(vibe.spent)} of ${money(vibe.limit)} (${vibe.percent?.toFixed(2)}%)`);
            }
            if (view.billing?.budgets?.api) {
              const apiBudget = view.billing.budgets.api;
              lines.push(`API budget: ${money(apiBudget.spent)} of ${money(apiBudget.limit)} (${apiBudget.percent?.toFixed(2)}%)`);
            }
            lines.push(`This Harness: ${view.ledger.calls} calls, ${money(view.ledger.cost)}`);
            lines.push(`Catalog: ${view.catalog.models} models served, ${view.catalog.hidden.length} hidden`);
            if (view.credential.configured !== true) lines.push(`Key ${view.credential.ref} is not configured.`);
            return { text: lines.join("\n") };
          },
        }),
      "mistral-vibe: tool",
    );
  });
}
