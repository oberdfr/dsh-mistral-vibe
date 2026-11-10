/**
 * Model discovery and descriptor building for the Mistral Vibe route.
 *
 * Two sources, one descriptor:
 *
 *  - `/v1/models` says which models exist and whether they take images;
 *    `/v1/models/<id>` adds the real context window, the aliases and the
 *    deprecation state. Both are live and cheap, so the catalog refreshes.
 *  - The curated table (`capabilities.js`) says which thinking levels each
 *    model accepts. The API does not publish that, so it comes from the
 *    61-probe verification and can be re-derived per model with `probe`.
 *
 * The result is pi-ai `Model` descriptors, which is what `PiAiAdapter` reads to
 * answer `resolveModel` — the call the model picker renders its effort pane
 * from. A model whose levels are declared here therefore shows exactly those
 * levels, and nothing else.
 */
import { CAPABILITIES, THINKING_LEVELS, WIRE } from "./capabilities.js";

/** Published per-million-token prices, used for `calculateCost`. */
const PRICES = {
  "deepseek-v4-1-flash-1017": { input: 0.3, output: 1.2, cacheRead: 0.007, cacheWrite: 0 },
  "mistral-large-4": { input: 0.7, output: 2.1, cacheRead: 0.07, cacheWrite: 0 },
  "glm-5-2": { input: 1.4, output: 4.4, cacheRead: 0.14, cacheWrite: 0 },
  "zai-glm-5-3": { input: 1.4, output: 4.4, cacheRead: 0.14, cacheWrite: 0 },
  "zai-glm-5-3-flash": { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0 },
  "mistral-small-2603": { input: 0.1, output: 0.3, cacheRead: 0.01, cacheWrite: 0 },
  "mistral-medium-3-5": { input: 0.4, output: 2, cacheRead: 0.04, cacheWrite: 0 },
};

const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** Levels in escalation order, filtered to a set. */
function ordered(levels) {
  return THINKING_LEVELS.filter((level) => levels.includes(level));
}

/**
 * Translate a level set into pi-ai's `thinkingLevelMap`.
 *
 * Declared levels carry their wire spelling; undeclared ones are pinned to
 * `null` (unsupported). `off` is the one exception: with no wire value it stays
 * *absent* from the map, which pi-ai reads as "supported, send nothing" — the
 * correct dispatch when not thinking is the parameter's absence.
 * @param {string[]} levels - accepted levels.
 * @returns {Record<string, string|null>} the map.
 */
export function thinkingLevelMapFor(levels) {
  const accepted = new Set(levels);
  const map = {};
  for (const level of THINKING_LEVELS) {
    if (level === "off" && accepted.has("off")) continue;
    map[level] = accepted.has(level) ? WIRE[level] : null;
  }
  return map;
}

/**
 * Build one pi-ai model descriptor.
 * @param {object} input - id, name, contextWindow, maxTokens, input, levels, deprecated.
 * @param {string} provider - route id.
 * @param {string} baseUrl - API root.
 * @returns {object} the descriptor.
 */
export function descriptor(input, provider, baseUrl) {
  const levels = ordered(input.levels ?? []);
  return {
    id: input.id,
    name: input.name ?? input.id,
    api: "mistral-conversations",
    provider,
    baseUrl,
    reasoning: levels.length > 0,
    thinkingLevelMap: thinkingLevelMapFor(levels),
    input: input.input ?? ["text"],
    cost: PRICES[input.id] ?? NO_COST,
    contextWindow: input.contextWindow ?? 128000,
    maxTokens: input.maxTokens ?? 8192,
    ...(input.deprecated === true ? { deprecated: true } : {}),
  };
}

/**
 * Merge discovery into the curated table and produce the served catalog.
 *
 * Discovery wins on facts the API owns (existence, context window, modalities,
 * deprecation); the curated table wins on thinking levels, which the API does
 * not publish. A model the table does not know is served as non-reasoning until
 * `probe` measures it, so an unknown id can never advertise a level it rejects.
 * `names` overrides only the display name, which is what the picker shows.
 * @param {object} options - inputs.
 * @param {Array<object>|undefined} options.discovered - `/v1/models/<id>` rows.
 * @param {Record<string, object>} [options.capabilities] - curated table.
 * @param {string[]} [options.hidden] - ids to leave out.
 * @param {Record<string, string>} [options.names] - display names by model id.
 * @param {string} [options.provider] - route id.
 * @param {string} [options.baseUrl] - API root.
 * @returns {Array<object>} descriptors in discovery order.
 */
export function buildCatalog({
  discovered,
  capabilities = CAPABILITIES,
  hidden = [],
  names = {},
  provider = "mistral-vibe",
  baseUrl = "https://api.mistral.ai",
}) {
  const rows = discovered ?? Object.entries(capabilities).map(([id, entry]) => ({ id, ...entry }));
  const hiddenSet = new Set(hidden);
  const out = [];
  for (const row of rows) {
    if (hiddenSet.has(row.id)) continue;
    const known = capabilities[row.id];
    const renamed = names[row.id];
    out.push(
      descriptor(
        {
          id: row.id,
          name: typeof renamed === "string" && renamed.length > 0 ? renamed : (row.name ?? row.id),
          contextWindow: row.contextWindow ?? known?.contextWindow,
          maxTokens: row.maxTokens ?? known?.maxTokens,
          input: row.input ?? known?.input,
          levels: known?.levels ?? row.levels ?? [],
          deprecated: row.deprecated,
        },
        provider,
        baseUrl,
      ),
    );
  }
  return out;
}

/**
 * Fetch the live catalog.
 * @param {object} options - inputs.
 * @param {string} options.apiBase - API root.
 * @param {Function} options.getKey - resolves the API key.
 * @param {Function} [options.fetchImpl] - injectable fetch.
 * @param {AbortSignal} [options.signal] - cancellation.
 * @returns {Promise<Array<object>>} chat-capable rows with per-model detail.
 */
export async function discover({ apiBase, getKey, fetchImpl = fetch, signal }) {
  const key = await getKey();
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  const listing = await fetchImpl(`${apiBase}/v1/models`, { headers, signal });
  if (!listing.ok) throw new Error(`model listing answered ${listing.status}`);
  const { data } = await listing.json();
  const chat = (data ?? []).filter((model) => model.capabilities?.completion_chat === true);

  const rows = await Promise.all(
    chat.map(async (model) => {
      let detail;
      try {
        const response = await fetchImpl(`${apiBase}/v1/models/${encodeURIComponent(model.id)}`, {
          headers,
          signal,
        });
        if (response.ok) detail = await response.json();
        else await response.text();
      } catch {
        /* detail is optional: the listing already names the model */
      }
      return {
        id: model.id,
        name: detail?.name ?? model.id,
        contextWindow: detail?.max_context_length,
        input: model.capabilities?.vision === true ? ["text", "image"] : ["text"],
        deprecated: detail?.deprecation != null,
        replacement: detail?.deprecation_replacement_model ?? undefined,
        aliases: detail?.aliases ?? [],
      };
    }),
  );
  return rows;
}

/**
 * Probe one model's accepted levels with tiny completions.
 *
 * The API publishes no capability for this, so the only authority is a request:
 * one minimal completion per candidate level, `none` for `off`. Costs a few
 * tokens per level and is therefore an explicit user action, never automatic.
 * @param {object} options - inputs.
 * @param {string} options.apiBase - API root.
 * @param {string} options.model - model id.
 * @param {Function} options.getKey - resolves the API key.
 * @param {Function} [options.fetchImpl] - injectable fetch.
 * @returns {Promise<string[]>} accepted levels in escalation order.
 */
export async function probeLevels({ apiBase, model, getKey, fetchImpl = fetch }) {
  const key = await getKey();
  const accepted = [];
  for (const level of THINKING_LEVELS) {
    const response = await fetchImpl(`${apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 16,
        reasoning_effort: WIRE[level],
      }),
    });
    if (response.ok) {
      accepted.push(level);
      await response.text();
    } else {
      await response.text();
    }
  }
  return accepted;
}
