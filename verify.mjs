// Verify the plugin's pure halves without a running Harness.
//
//   node verify.mjs
//
// Covers the parts that must be right for the route to behave: PKCE, the
// per-model capability table, the thinking-level map, the catalog builder
// (visibility and display names), the sign-in state machine and the budget
// normalization. The adapter wiring and the bridge are exercised against a real
// server by `verify-apply.mjs` and `probe-bridge.mjs`.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { CAPABILITIES, THINKING_LEVELS } from "./lib/capabilities.js";
import { buildCatalog, probeLevels, thinkingLevelMapFor } from "./lib/catalog.js";
import { pkce, SignInAttempt } from "./lib/signin.js";
import { billing, Ledger } from "./lib/quota.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`ok ${name}`);
}

// --- PKCE -----------------------------------------------------------------

check("pkce challenge is base64url(sha256(verifier))", () => {
  const { verifier, challenge } = pkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,}$/);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.ok(!challenge.includes("="));
});

// --- capabilities ---------------------------------------------------------

check("capability table covers the verified models", () => {
  assert.equal(Object.keys(CAPABILITIES).length, 38);
  assert.deepEqual(CAPABILITIES["deepseek-v4-1-flash-1017"].levels, ["off", "low", "high", "xhigh", "max"]);
  assert.deepEqual(CAPABILITIES["mistral-large-4"].levels, ["low", "medium", "high"]);
  assert.deepEqual(CAPABILITIES["mistral-small-2603"].levels, ["off", "high"]);
  assert.deepEqual(CAPABILITIES["codestral-2508"].levels, []);
});

check("reasoning models are a minority", () => {
  const reasoning = Object.values(CAPABILITIES).filter((entry) => entry.levels.length > 0);
  assert.equal(reasoning.length, 22);
  assert.equal(Object.keys(CAPABILITIES).length - reasoning.length, 16);
});

// --- thinking level map ---------------------------------------------------

check("off is absent when it sends nothing", () => {
  const map = thinkingLevelMapFor(["off", "high"]);
  assert.equal("off" in map, false);
  assert.equal(map.high, "high");
  assert.equal(map.low, null);
  assert.equal(map.medium, null);
  assert.equal(map.xhigh, null);
  assert.equal(map.max, null);
});

check("a non-reasoning model pins every level", () => {
  const map = thinkingLevelMapFor([]);
  for (const level of THINKING_LEVELS) assert.equal(map[level], null);
});

check("xhigh and max keep their wire spelling", () => {
  const map = thinkingLevelMapFor(["low", "high", "max"]);
  assert.equal(map.max, "max");
  assert.equal(map.xhigh, null);
  assert.equal(map.off, null);
});

// --- catalog --------------------------------------------------------------

check("catalog builds per-model descriptors", () => {
  const models = buildCatalog({});
  assert.equal(models.length, 38);
  const deepseek = models.find((model) => model.id === "deepseek-v4-1-flash-1017");
  const large = models.find((model) => model.id === "mistral-large-4");
  const codestral = models.find((model) => model.id === "codestral-2508");
  assert.equal(deepseek.reasoning, true);
  assert.equal(deepseek.thinkingLevelMap.low, "low");
  assert.equal(deepseek.thinkingLevelMap.medium, null);
  assert.equal(large.thinkingLevelMap.medium, "medium");
  assert.equal(large.thinkingLevelMap.off, null);
  assert.equal(codestral.reasoning, false);
  assert.equal(codestral.thinkingLevelMap.high, null);
});

check("hidden models leave the catalog", () => {
  const models = buildCatalog({ hidden: ["codestral-2508", "voxtral-small-latest"] });
  assert.equal(models.length, 36);
  assert.equal(models.some((model) => model.id === "codestral-2508"), false);
});

check("a display name overrides only the label", () => {
  const models = buildCatalog({ names: { "mistral-large-4": "Large (coding)" } });
  const renamed = models.find((model) => model.id === "mistral-large-4");
  assert.equal(renamed.name, "Large (coding)");
  assert.equal(renamed.id, "mistral-large-4");
  assert.equal(renamed.thinkingLevelMap.medium, "medium");
  const other = models.find((model) => model.id === "deepseek-v4-1-flash-1017");
  assert.equal(other.name, "deepseek-v4-1-flash-1017");
});

check("an empty name falls back to the discovered one", () => {
  const models = buildCatalog({
    discovered: [{ id: "mistral-large-4", name: "Mistral Large 4.0", contextWindow: 1048576, input: ["text", "image"] }],
    names: { "mistral-large-4": "" },
  });
  assert.equal(models[0].name, "Mistral Large 4.0");
});

check("discovery wins on the facts the API owns", () => {
  const models = buildCatalog({
    discovered: [
      { id: "mistral-large-4", name: "Mistral Large 4.0", contextWindow: 1048576, input: ["text", "image"], deprecated: false },
      { id: "brand-new-model", name: "Brand New", contextWindow: 32768, input: ["text"], deprecated: false },
    ],
  });
  assert.equal(models.length, 2);
  assert.equal(models[0].contextWindow, 1048576);
  assert.equal(models[0].thinkingLevelMap.medium, "medium");
  // An unknown id never advertises a level it has not been measured for.
  assert.equal(models[1].reasoning, false);
  assert.equal(models[1].contextWindow, 32768);
});

// --- probe ----------------------------------------------------------------

check("probeLevels keeps only accepted levels", async () => {
  const accepted = new Set(["none", "low", "high"]);
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    return accepted.has(body.reasoning_effort)
      ? { ok: true, text: async () => "{}" }
      : { ok: false, text: async () => "{}" };
  };
  const levels = await probeLevels({ apiBase: "https://example.test", model: "m", getKey: async () => "k", fetchImpl });
  assert.deepEqual(levels, ["off", "low", "high"]);
});

// --- quota ----------------------------------------------------------------

check("budget normalization derives spend and remaining", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/billing/subscription")) {
      return { ok: true, json: async () => ({ plan_name: "EDU", payg_enabled: false, vibe_payg_enabled: false, enterprise: false }) };
    }
    return {
      ok: true,
      json: async () => ({
        vibe_budget: { usage_percentage: 5, initial_budget: 127.5, currency: "EUR", reset_at: "2026-12-01T00:00:00Z", payg_enabled: false },
        api_budget: { usage_percentage: 0, initial_budget: 12.75, currency: "EUR", reset_at: "2026-12-01T00:00:00Z", payg_enabled: false },
      }),
    };
  };
  const result = await billing({ apiBase: "https://example.test", getKey: async () => "k", fetchImpl });
  assert.equal(result.status, "ok");
  assert.equal(result.subscription.planName, "EDU");
  assert.equal(result.budgets.vibe.limit, 127.5);
  assert.ok(Math.abs(result.budgets.vibe.spent - 6.375) < 1e-6);
  assert.ok(Math.abs(result.budgets.vibe.remaining - 121.125) < 1e-6);
  assert.equal(result.budgets.api.spent, 0);
});

check("ledger folds usage and persists", () => {
  let written;
  const ledger = new Ledger({
    path: "unused.json",
    readFileImpl: () => {
      throw new Error("missing");
    },
    writeFileImpl: (_path, content) => {
      written = content;
    },
  });
  ledger.record("m", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 }, { input: 0.3, output: 1.2, cacheRead: 0.007, cacheWrite: 0 });
  assert.ok(Math.abs(ledger.view().cost - 0.3) < 1e-9);
  assert.equal(ledger.view().calls, 1);
  assert.equal(JSON.parse(written).byModel.m.calls, 1);
});

// --- sign-in state machine ------------------------------------------------

check("attempt completes and hands the key over", async () => {
  let stored;
  const attempt = new SignInAttempt({
    consoleBase: "https://console.test",
    onKey: async (key) => {
      stored = key;
    },
    fetchImpl: async (url) => {
      if (url.endsWith("/api/vibe/sign-in")) {
        return {
          ok: true,
          json: async () => ({
            process_id: "p1",
            sign_in_url: "https://console.test/approve",
            poll_url: "https://console.test/api/vibe/sign-in/poll/t",
            expires_at: "2026-01-01T00:00:00Z",
          }),
        };
      }
      if (url.includes("/poll/")) return { ok: true, status: 200, json: async () => ({ status: "completed", exchange_token: "x" }) };
      return { ok: true, status: 200, json: async () => ({ api_key: "mstrl_test" }) };
    },
    setTimeoutImpl: (fn) => {
      void fn();
      return 0;
    },
    clearTimeoutImpl: () => undefined,
  });
  const started = await attempt.start();
  assert.equal(started.signInUrl, "https://console.test/approve");
  for (let i = 0; i < 10 && stored === undefined; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored, "mstrl_test");
  assert.equal(attempt.snapshot().status, "completed");
});

check("a denied attempt stops without a key", async () => {
  let stored;
  const attempt = new SignInAttempt({
    consoleBase: "https://console.test",
    onKey: async (key) => {
      stored = key;
    },
    fetchImpl: async (url) => {
      if (url.endsWith("/api/vibe/sign-in")) {
        return {
          ok: true,
          json: async () => ({ process_id: "p1", sign_in_url: "u", poll_url: "https://console.test/api/vibe/sign-in/poll/t", expires_at: "x" }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ status: "denied" }) };
    },
    setTimeoutImpl: (fn) => {
      void fn();
      return 0;
    },
    clearTimeoutImpl: () => undefined,
  });
  await attempt.start();
  for (let i = 0; i < 10 && attempt.snapshot().status === "waiting"; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored, undefined);
  assert.equal(attempt.snapshot().status, "denied");
});

console.log(`\n${checks} checks passed`);
