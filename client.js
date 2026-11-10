function definePlugin(require) {
  const React = require("react");
  const h = React.createElement;

    /** Bridge prefix served by the Host half; keep in sync with `index.js`. */
    const BRIDGE_PREFIX = "/api/mistral-vibe";
    /** Locale namespace owned by this plugin. */
    const NS = "mistral-vibe";
    /** Panel id; the matching `main` key renders the panel. */
    const PANEL_ID = "mistral-vibe";
    /** How often the card refreshes itself. */
    const REFRESH_MS = 30_000;

    // #region copy

    const en = {
      nav: "Mistral Vibe",
      title: "Mistral Vibe",
      intro: "Plan, budgets and this Harness's own spend on the Mistral Vibe route.",
      planTitle: "Plan",
      budgetTitle: "Budgets",
      vibeBudget: "Vibe allowance",
      apiBudget: "API budget",
      used: "{value} of {max}",
      remaining: "{value} left",
      resets: "Resets {date}",
      harnessTitle: "This Harness",
      calls: "Calls",
      input: "Input tokens",
      output: "Output tokens",
      cacheRead: "Cached tokens",
      cost: "Estimated cost",
      byModel: "By model",
      model: "Model",
      noCalls: "No calls on this route yet.",
      catalogTitle: "Models",
      catalogCount: "{count} served, {hidden} hidden",
      catalogUpdated: "Discovered {time}",
      refresh: "Refresh",
      refreshing: "Refreshing…",
      barAria: "Mistral Vibe allowance: {value} of {max} ({pct}%)",
      barFallback: "No budget reported; showing this Harness's spend",
      signInTitle: "Sign in",
      signInHint: "Approves a key for this account in your browser, the same flow the Vibe CLI uses.",
      signInButton: "Sign in with browser",
      signInOpen: "Open the sign-in page again",
      signInWaiting: "Waiting for approval in the browser…",
      signInDone: "Signed in. The key is stored.",
      signInExpired: "The sign-in link expired. Start again.",
      signInDenied: "Sign-in was denied.",
      signInFailed: "Sign-in failed: {detail}",
      signInCancel: "Cancel",
      keyTitle: "API key",
      keyHint: "Stored by this Harness's credential service as {ref}; it never reaches this page.",
      keyConfigured: "Configured",
      keyMissing: "Not configured",
      keyInput: "Mistral API key",
      keyPlaceholder: "Paste a key to replace the stored one",
      keySave: "Save key",
      keyClear: "Remove key",
      keySaved: "Key saved.",
      keyCleared: "Key removed.",
      modelsTitle: "Visible models",
      modelsHint: "Unchecked models disappear from the composer picker. Capabilities are declared per model.",
      modelsSearch: "Filter models",
      modelsAll: "Show all",
      modelsNone: "Hide all",
      modelsSave: "Save visibility",
      modelsSaved: "Visibility saved.",
      modelsEmpty: "No models discovered yet.",
      renameLabel: "Display name",
      renamePlaceholder: "Name shown in the composer",
      renameReset: "Reset",
      renameSaved: "Name saved.",
      renameFailed: "Could not rename: {detail}",
      renameHint: "The name is only a label: the model id stays the same.",
      levels: "Levels",
      noLevels: "no reasoning",
      context: "Context",
      vision: "vision",
      deprecated: "retired",
      probe: "Probe levels",
      probing: "Probing…",
      probed: "Measured: {levels}",
      settingsNav: "Mistral Vibe",
      settingsIntro: "Sign in, store a key, and choose which Mistral models the composer offers.",
      openPanel: "Open the panel",
      loadFailed: "Could not load: {detail}",
      retry: "Retry",
    };

    const it = {
      nav: "Mistral Vibe",
      title: "Mistral Vibe",
      intro: "Piano, budget e spesa di questo Harness sulla route Mistral Vibe.",
      planTitle: "Piano",
      budgetTitle: "Budget",
      vibeBudget: "Plafond Vibe",
      apiBudget: "Budget API",
      used: "{value} di {max}",
      remaining: "restano {value}",
      resets: "Reset {date}",
      harnessTitle: "Questo Harness",
      calls: "Chiamate",
      input: "Token in ingresso",
      output: "Token in uscita",
      cacheRead: "Token in cache",
      cost: "Costo stimato",
      byModel: "Per modello",
      model: "Modello",
      noCalls: "Nessuna chiamata su questa route.",
      catalogTitle: "Modelli",
      catalogCount: "{count} serviti, {hidden} nascosti",
      catalogUpdated: "Scoperti {time}",
      refresh: "Aggiorna",
      refreshing: "Aggiornamento…",
      barAria: "Plafond Mistral Vibe: {value} di {max} ({pct}%)",
      barFallback: "Nessun budget riportato; mostro la spesa di questo Harness",
      signInTitle: "Accesso",
      signInHint: "Approva una chiave per questo account nel browser, lo stesso flusso della CLI Vibe.",
      signInButton: "Accedi con il browser",
      signInOpen: "Riapri la pagina di accesso",
      signInWaiting: "In attesa di approvazione nel browser…",
      signInDone: "Accesso completato. La chiave è salvata.",
      signInExpired: "Il link è scaduto. Ricomincia.",
      signInDenied: "Accesso negato.",
      signInFailed: "Accesso fallito: {detail}",
      signInCancel: "Annulla",
      keyTitle: "API key",
      keyHint: "Salvata dal servizio credenziali come {ref}; non arriva mai a questa pagina.",
      keyConfigured: "Configurata",
      keyMissing: "Non configurata",
      keyInput: "Mistral API key",
      keyPlaceholder: "Incolla una chiave per sostituire quella salvata",
      keySave: "Salva chiave",
      keyClear: "Rimuovi chiave",
      keySaved: "Chiave salvata.",
      keyCleared: "Chiave rimossa.",
      modelsTitle: "Modelli visibili",
      modelsHint: "I modelli non selezionati spariscono dal picker del composer. Le capability sono dichiarate per modello.",
      modelsSearch: "Filtra i modelli",
      modelsAll: "Mostra tutti",
      modelsNone: "Nascondi tutti",
      modelsSave: "Salva visibilità",
      modelsSaved: "Visibilità salvata.",
      modelsEmpty: "Nessun modello scoperto.",
      renameLabel: "Nome visualizzato",
      renamePlaceholder: "Nome mostrato nel composer",
      renameReset: "Ripristina",
      renameSaved: "Nome salvato.",
      renameFailed: "Rinomina non riuscita: {detail}",
      renameHint: "Il nome è solo un'etichetta: l'id del modello resta lo stesso.",
      levels: "Livelli",
      noLevels: "senza reasoning",
      context: "Contesto",
      vision: "visione",
      deprecated: "ritirato",
      probe: "Misura i livelli",
      probing: "Misura…",
      probed: "Misurati: {levels}",
      settingsNav: "Mistral Vibe",
      settingsIntro: "Accedi, salva una chiave e scegli quali modelli Mistral offrire nel composer.",
      openPanel: "Apri il pannello",
      loadFailed: "Caricamento fallito: {detail}",
      retry: "Riprova",
    };

    // #endregion

    // #region styles

    const CSS = `
.mv-page{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary)}
.mv-scroll{overflow:auto;flex:1;min-height:0}
.mv-content{max-width:760px;margin:0 auto;padding:24px 20px 40px;display:flex;flex-direction:column;gap:16px}
.mv-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.mv-heading-title{margin:0;font-size:18px;font-weight:600}
.mv-card{border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);padding:14px 16px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-l1)}
.mv-card-title{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.mv-card-hint{margin:0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.mv-figures{display:flex;flex-wrap:wrap;gap:18px}
.mv-figure{display:flex;flex-direction:column;gap:2px;min-width:110px}
.mv-figure-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mv-figure-value{font-size:15px;font-variant-numeric:tabular-nums}
.mv-bar{height:8px;border-radius:999px;background:var(--dsw-alias-border-l3);overflow:hidden}
.mv-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#FF8205 0%,#FA500F 55%,#F04405 100%);transition:width .45s ease}
.mv-bar-fill[data-level="warn"]{background:linear-gradient(90deg,#FFB020 0%,#FF8205 100%)}
.mv-bar-fill[data-level="crit"]{background:linear-gradient(90deg,#F04405 0%,#D02B1E 100%)}
.mv-table{width:100%;border-collapse:collapse;font-size:12px}
.mv-table th,.mv-table td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l3)}
.mv-table th{color:var(--dsw-alias-label-tertiary);font-weight:500}
.mv-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.mv-button{border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm);padding:6px 12px;font:inherit;font-size:12px;cursor:pointer}
.mv-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mv-button:disabled{opacity:.5;cursor:default}
.mv-button-primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff}
.mv-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);padding:7px 10px;font:inherit;font-size:12px;background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-label-primary)}
.mv-row{display:flex;align-items:center;gap:8px}
.mv-notice{font-size:12px;color:var(--dsw-alias-label-secondary)}
.mv-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}
.mv-models{display:flex;flex-direction:column;gap:4px;max-height:320px;overflow:auto}
.mv-model{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:var(--dsw-radius-sm)}
.mv-model:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mv-model-id{font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-model{flex-wrap:wrap}
.mv-model-name{display:flex;align-items:center;gap:6px;width:100%;padding-left:22px}
.mv-model-name .mv-input{flex:1;min-width:0;font-size:12px;padding:4px 8px}
.mv-tag{font-size:10px;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);flex:none}
.mv-tag-warn{background:rgba(240,68,5,.15);color:#F04405}
.mv-footer-bar{box-sizing:border-box;border:none;background:0 0;cursor:pointer;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;border-radius:var(--dsw-radius-md);width:100%;display:flex;flex-direction:column;gap:5px;margin:0 2px;padding:7px 8px}
.mv-footer-bar:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mv-footer-compact{width:36px;height:36px;justify-content:center;align-items:center;padding:0;display:inline-flex}
.mv-quota-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;line-height:16px}
.mv-quota-plan{color:var(--dsw-alias-label-secondary);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-quota-pct{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none}
.mv-quota-meta{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary)}
.mv-quota-harness{font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

    // #endregion

    // #region helpers

    /** POST one bridge route. */
    async function callBridge(path, body) {
      const response = await fetch(`${BRIDGE_PREFIX}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const answer = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(answer?.error ?? `HTTP ${response.status}`);
      return answer;
    }

    /** Format an amount. */
    function money(value, currency) {
      if (typeof value !== "number" || !Number.isFinite(value)) return "—";
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currency || "EUR",
          minimumFractionDigits: 2,
          maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
        }).format(value);
      } catch {
        return `${value.toFixed(2)} ${currency ?? ""}`.trim();
      }
    }

    /** Format a token count. */
    function tokens(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) return "—";
      if (value < 1000) return String(value);
      if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
      return `${(value / 1_000_000).toFixed(2)}M`;
    }

    /** Short local date for a reset timestamp. */
    function resetLabel(iso) {
      if (typeof iso !== "string" || iso.length === 0) return "—";
      const when = new Date(iso);
      if (Number.isNaN(when.getTime())) return "—";
      try {
        return when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } catch {
        return iso.slice(0, 10);
      }
    }

    /** Fill `{placeholders}`. */
    function fill(template, params) {
      return String(template).replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
    }

    /** A tiny observable store shared by the card and the panel. */
    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => state,
        subscribe: (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        set: (next) => {
          state = next;
          for (const fn of listeners) fn();
        },
      };
    }

    const store = createStore({ status: "loading", value: null, error: undefined });

    /** Poll the summary once and publish it. */
    async function loadSummary(refresh = false) {
      try {
        const value = await callBridge("summary", { refresh });
        store.set({ status: "ready", value, error: undefined });
        return value;
      } catch (error) {
        store.set({ status: "error", value: store.getSnapshot().value, error: error.message });
        return undefined;
      }
    }

    /** The bar's fill level. */
    function fillLevel(percent) {
      if (typeof percent !== "number") return undefined;
      if (percent >= 90) return "crit";
      if (percent >= 75) return "warn";
      return undefined;
    }

    // #endregion

    // #region sidebar card

    /** The bottom-left quota card. */
    function QuotaCard({ wide, t, selectPanel }) {
      const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      const value = snap.value;
      const bar = value?.bar ?? {};
      const currency = bar.currency ?? "EUR";
      const percent = typeof bar.percent === "number" ? bar.percent : bar.max > 0 ? (bar.value / bar.max) * 100 : undefined;
      const plan = value?.plan?.status === "ok" ? value.plan.planName : undefined;
      const label =
        typeof percent === "number"
          ? fill(t("barAria"), { value: money(bar.value, currency), max: money(bar.max, currency), pct: percent.toFixed(1) })
          : t("barFallback");
      const open = () => {
        if (typeof selectPanel === "function") selectPanel(PANEL_ID);
      };

      if (!wide) {
        return h(
          "button",
          { type: "button", className: "mv-footer-bar mv-footer-compact", title: label, "aria-label": label, onClick: open },
          h("span", {
            role: "meter",
            "aria-valuemin": 0,
            "aria-valuemax": bar.max ?? 100,
            "aria-valuenow": Math.min(bar.value ?? 0, bar.max ?? 100),
            style: {
              display: "inline-flex",
              width: 20,
              height: 6,
              borderRadius: 999,
              overflow: "hidden",
              background: "var(--dsw-alias-border-l3)",
            },
          }, h("span", {
            "aria-hidden": "true",
            style: {
              display: "block",
              height: "100%",
              width: `${Math.min(100, Math.max(0, percent ?? 0))}%`,
              background: "linear-gradient(90deg,#FF8205 0%,#F04405 100%)",
            },
          })),
        );
      }

      return h(
        "button",
        { type: "button", className: "mv-footer-bar", title: label, "aria-label": label, onClick: open },
        h(
          "span",
          { className: "mv-quota-head" },
          h("span", { className: "mv-quota-plan" }, plan === undefined ? t("nav") : `${plan}`),
          h("span", { className: "mv-quota-pct" }, typeof percent === "number" ? `${percent.toFixed(1)}%` : "—"),
        ),
        h(
          "span",
          { className: "mv-bar", role: "meter", "aria-valuemin": 0, "aria-valuemax": bar.max ?? 100, "aria-valuenow": Math.min(bar.value ?? 0, bar.max ?? 100) },
          h("span", { className: "mv-bar-fill", "data-level": fillLevel(percent), style: { width: `${Math.min(100, Math.max(0, percent ?? 0))}%` } }),
        ),
        h(
          "span",
          { className: "mv-quota-meta" },
          h("span", null, fill(t("used"), { value: money(bar.value, currency), max: money(bar.max, currency) })),
          typeof bar.resetAt === "string" ? h("span", null, fill(t("resets"), { date: resetLabel(bar.resetAt) })) : null,
        ),
        h(
          "span",
          { className: "mv-quota-harness" },
          `${t("harnessTitle")} ${money(value?.ledger?.cost, currency)} · ${value?.catalog?.models ?? 0} ${t("catalogTitle").toLowerCase()}`,
        ),
      );
    }

    // #endregion

    // #region panel

    /** One labelled figure. */
    function Figure({ label, value }) {
      return h("div", { className: "mv-figure" }, h("span", { className: "mv-figure-label" }, label), h("span", { className: "mv-figure-value" }, value));
    }

    /** The full panel. */
    function VibePanel({ t }) {
      const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      const [busy, setBusy] = React.useState(false);
      const value = snap.value;
      const currency = value?.bar?.currency ?? "EUR";

      if (snap.status === "loading" && value === null) {
        return h("div", { className: "mv-page" }, h("div", { className: "mv-content" }, h("p", { className: "mv-card-hint" }, t("refreshing"))));
      }
      if (snap.status === "error" && value === null) {
        return h(
          "div",
          { className: "mv-page" },
          h(
            "div",
            { className: "mv-content" },
            h("p", { className: "mv-error" }, fill(t("loadFailed"), { detail: snap.error ?? "" })),
            h("button", { type: "button", className: "mv-button", onClick: () => loadSummary(true) }, t("retry")),
          ),
        );
      }

      const budgets = value?.billing?.budgets ?? {};
      const plan = value?.plan;
      const ledger = value?.ledger ?? { calls: 0, cost: 0, byModel: [] };

      return h(
        "div",
        { className: "mv-page" },
        h(
          "div",
          { className: "mv-scroll" },
          h(
            "div",
            { className: "mv-content" },
            h(
              "div",
              { className: "mv-heading" },
              h("h1", { className: "mv-heading-title" }, t("title")),
              h(
                "button",
                {
                  type: "button",
                  className: "mv-button",
                  disabled: busy,
                  onClick: async () => {
                    setBusy(true);
                    await loadSummary(true);
                    setBusy(false);
                  },
                },
                busy ? t("refreshing") : t("refresh"),
              ),
            ),
            h("p", { className: "mv-card-hint" }, t("intro")),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("planTitle")),
              plan?.status === "ok"
                ? h(
                    "div",
                    { className: "mv-figures" },
                    h(Figure, { label: t("planTitle"), value: `${plan.planName} (${plan.planType})` }),
                    plan.accessScope === undefined ? null : h(Figure, { label: "Scope", value: plan.accessScope }),
                    plan.apiBase === undefined ? null : h(Figure, { label: "API", value: plan.apiBase }),
                  )
                : h("p", { className: "mv-card-hint" }, value?.credential?.configured === true ? "—" : t("keyMissing")),
            ),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("budgetTitle")),
              [budgets.vibe, budgets.api].filter(Boolean).map((entry) =>
                h(
                  "div",
                  { key: entry.kind, style: { display: "flex", flexDirection: "column", gap: 6 } },
                  h(
                    "div",
                    { className: "mv-row", style: { justifyContent: "space-between" } },
                    h("span", { className: "mv-card-hint" }, entry.kind === "vibe" ? t("vibeBudget") : t("apiBudget")),
                    h("span", { className: "mv-card-hint" }, fill(t("used"), { value: money(entry.spent, entry.currency ?? currency), max: money(entry.limit, entry.currency ?? currency) })),
                  ),
                  h("span", { className: "mv-bar" }, h("span", { className: "mv-bar-fill", "data-level": fillLevel(entry.percent), style: { width: `${Math.min(100, Math.max(0, entry.percent ?? 0))}%` } })),
                  h(
                    "div",
                    { className: "mv-row", style: { justifyContent: "space-between" } },
                    h("span", { className: "mv-card-hint" }, fill(t("remaining"), { value: money(entry.remaining, entry.currency ?? currency) })),
                    h("span", { className: "mv-card-hint" }, typeof entry.resetAt === "string" ? fill(t("resets"), { date: resetLabel(entry.resetAt) }) : ""),
                  ),
                ),
              ),
              budgets.vibe === undefined && budgets.api === undefined ? h("p", { className: "mv-card-hint" }, "—") : null,
            ),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("harnessTitle")),
              h(
                "div",
                { className: "mv-figures" },
                h(Figure, { label: t("calls"), value: String(ledger.calls ?? 0) }),
                h(Figure, { label: t("input"), value: tokens(ledger.input) }),
                h(Figure, { label: t("output"), value: tokens(ledger.output) }),
                h(Figure, { label: t("cacheRead"), value: tokens(ledger.cacheRead) }),
                h(Figure, { label: t("cost"), value: money(ledger.cost, currency) }),
              ),
              (ledger.byModel ?? []).length === 0
                ? h("p", { className: "mv-card-hint" }, t("noCalls"))
                : h(
                    "table",
                    { className: "mv-table" },
                    h("thead", null, h("tr", null, h("th", null, t("model")), h("th", { className: "num" }, t("calls")), h("th", { className: "num" }, t("cost")))),
                    h(
                      "tbody",
                      null,
                      ledger.byModel.map((entry) =>
                        h("tr", { key: entry.model }, h("td", null, entry.model), h("td", { className: "num" }, String(entry.calls)), h("td", { className: "num" }, money(entry.cost, currency))),
                      ),
                    ),
                  ),
            ),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("catalogTitle")),
              h("p", { className: "mv-card-hint" }, fill(t("catalogCount"), { count: value?.catalog?.models ?? 0, hidden: (value?.catalog?.hidden ?? []).length })),
              value?.catalog?.error === undefined ? null : h("p", { className: "mv-error" }, String(value.catalog.error)),
            ),
          ),
        ),
      );
    }

    // #endregion

    // #region settings

    /** The Settings page: sign-in, key, model visibility. */
    function VibeSettings({ t }) {
      const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      const value = snap.value;
      const [keyDraft, setKeyDraft] = React.useState("");
      const [notice, setNotice] = React.useState(undefined);
      const [error, setError] = React.useState(undefined);
      const [models, setModels] = React.useState(undefined);
      const [hidden, setHidden] = React.useState(undefined);
      const [query, setQuery] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [signIn, setSignIn] = React.useState(undefined);
      const [probed, setProbed] = React.useState({});
      const [nameDrafts, setNameDrafts] = React.useState({});

      React.useEffect(() => {
        void loadSummary(false);
      }, []);

      const refreshModels = React.useCallback(async (refresh = false) => {
        setBusy(true);
        try {
          const answer = await callBridge("models", { refresh });
          setModels(answer.models ?? []);
          setHidden(new Set(answer.hidden ?? []));
          setError(answer.error);
        } catch (failure) {
          setError(failure.message);
        } finally {
          setBusy(false);
        }
      }, []);

      React.useEffect(() => {
        void refreshModels(false);
      }, [refreshModels]);

      // Poll the sign-in attempt while it waits.
      React.useEffect(() => {
        if (signIn?.status !== "waiting") return undefined;
        const timer = setInterval(async () => {
          try {
            const status = await callBridge("signin/status", {});
            setSignIn(status);
            if (status.status === "completed") {
              setNotice(t("signInDone"));
              await loadSummary(true);
              await refreshModels(true);
            }
          } catch {
            /* keep waiting */
          }
        }, 3000);
        return () => clearInterval(timer);
      }, [signIn?.status, refreshModels, t]);

      const startSignIn = async () => {
        setError(undefined);
        setNotice(undefined);
        setBusy(true);
        try {
          const started = await callBridge("signin/start", {});
          setSignIn({ status: "waiting", signInUrl: started.signInUrl });
          if (typeof window !== "undefined" && typeof started.signInUrl === "string") {
            window.open(started.signInUrl, "_blank", "noopener,noreferrer");
          }
        } catch (failure) {
          setError(fill(t("signInFailed"), { detail: failure.message }));
        } finally {
          setBusy(false);
        }
      };

      const saveKey = async (action, key) => {
        setError(undefined);
        setNotice(undefined);
        setBusy(true);
        try {
          await callBridge("key", { action, ...(key === undefined ? {} : { value: key }) });
          setNotice(action === "set" ? t("keySaved") : t("keyCleared"));
          setKeyDraft("");
          await loadSummary(true);
          await refreshModels(true);
        } catch (failure) {
          setError(failure.message);
        } finally {
          setBusy(false);
        }
      };

      const rename = async (model, name) => {
        setError(undefined);
        setNotice(undefined);
        try {
          await callBridge("models/rename", { model, name });
          setNotice(t("renameSaved"));
          setNameDrafts((current) => {
            const next = { ...current };
            delete next[model];
            return next;
          });
          await refreshModels(false);
        } catch (failure) {
          setError(fill(t("renameFailed"), { detail: failure.message }));
        }
      };

      const saveVisibility = async () => {
        setBusy(true);
        setError(undefined);
        try {
          await callBridge("models/visibility", { hidden: [...(hidden ?? [])] });
          setNotice(t("modelsSaved"));
          await loadSummary(false);
        } catch (failure) {
          setError(failure.message);
        } finally {
          setBusy(false);
        }
      };

      const probe = async (model) => {
        setProbed((current) => ({ ...current, [model]: "…" }));
        try {
          const answer = await callBridge("models/probe", { model });
          setProbed((current) => ({ ...current, [model]: (answer.levels ?? []).join(", ") || t("noLevels") }));
        } catch (failure) {
          setProbed((current) => ({ ...current, [model]: failure.message }));
        }
      };

      const credential = value?.credential ?? { configured: false, ref: "MISTRAL_VIBE_API_KEY" };
      const filtered = (models ?? []).filter((model) => {
        const needle = query.trim().toLowerCase();
        return needle.length === 0 || model.id.toLowerCase().includes(needle) || String(model.name ?? "").toLowerCase().includes(needle);
      });
      const toggle = (id) => {
        setHidden((current) => {
          const next = new Set(current ?? []);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };

      return h(
        "div",
        { className: "mv-page" },
        h(
          "div",
          { className: "mv-scroll" },
          h(
            "div",
            { className: "mv-content" },
            h("h1", { className: "mv-heading-title" }, t("settingsNav")),
            h("p", { className: "mv-card-hint" }, t("settingsIntro")),
            notice === undefined ? null : h("p", { className: "mv-notice" }, notice),
            error === undefined ? null : h("p", { className: "mv-error" }, error),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("signInTitle")),
              h("p", { className: "mv-card-hint" }, t("signInHint")),
              h(
                "div",
                { className: "mv-row" },
                h("button", { type: "button", className: "mv-button mv-button-primary", disabled: busy, onClick: startSignIn }, t("signInButton")),
                signIn?.status === "waiting"
                  ? h("button", { type: "button", className: "mv-button", onClick: async () => { await callBridge("signin/cancel", {}); setSignIn({ status: "idle" }); } }, t("signInCancel"))
                  : null,
                signIn?.status === "waiting" && typeof signIn.signInUrl === "string"
                  ? h("a", { className: "mv-button", href: signIn.signInUrl, target: "_blank", rel: "noreferrer noopener" }, t("signInOpen"))
                  : null,
              ),
              signIn?.status === "waiting" ? h("p", { className: "mv-card-hint" }, t("signInWaiting")) : null,
              signIn?.status === "expired" ? h("p", { className: "mv-error" }, t("signInExpired")) : null,
              signIn?.status === "denied" ? h("p", { className: "mv-error" }, t("signInDenied")) : null,
              signIn?.status === "error" ? h("p", { className: "mv-error" }, fill(t("signInFailed"), { detail: signIn.error ?? "" })) : null,
            ),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("keyTitle")),
              h("p", { className: "mv-card-hint" }, fill(t("keyHint"), { ref: credential.ref })),
              h(
                "div",
                { className: "mv-row" },
                h("span", { className: "mv-tag" }, credential.configured === true ? t("keyConfigured") : t("keyMissing")),
                credential.source === undefined ? null : h("span", { className: "mv-card-hint" }, credential.source),
              ),
              h("input", {
                className: "mv-input",
                type: "password",
                autoComplete: "new-password",
                placeholder: t("keyPlaceholder"),
                "aria-label": t("keyInput"),
                value: keyDraft,
                onChange: (event) => setKeyDraft(event.target.value),
              }),
              h(
                "div",
                { className: "mv-row" },
                h("button", { type: "button", className: "mv-button", disabled: busy || keyDraft.trim().length === 0, onClick: () => saveKey("set", keyDraft.trim()) }, t("keySave")),
                h("button", { type: "button", className: "mv-button", disabled: busy || credential.configured !== true, onClick: () => saveKey("clear") }, t("keyClear")),
              ),
            ),

            h(
              "section",
              { className: "mv-card" },
              h("h2", { className: "mv-card-title" }, t("modelsTitle")),
              h("p", { className: "mv-card-hint" }, t("modelsHint")),
              h(
                "div",
                { className: "mv-row" },
                h("input", { className: "mv-input", placeholder: t("modelsSearch"), value: query, onChange: (event) => setQuery(event.target.value) }),
                h("button", { type: "button", className: "mv-button", disabled: busy, onClick: () => refreshModels(true) }, busy ? t("refreshing") : t("refresh")),
              ),
              h(
                "div",
                { className: "mv-row" },
                h("button", { type: "button", className: "mv-button", onClick: () => setHidden(new Set()) }, t("modelsAll")),
                h("button", { type: "button", className: "mv-button", onClick: () => setHidden(new Set((models ?? []).map((model) => model.id))) }, t("modelsNone")),
                h("button", { type: "button", className: "mv-button mv-button-primary", disabled: busy, onClick: saveVisibility }, t("modelsSave")),
              ),
              filtered.length === 0
                ? h("p", { className: "mv-card-hint" }, t("modelsEmpty"))
                : h(
                    "div",
                    { className: "mv-models" },
                    filtered.map((model) => {
                      const draft = nameDrafts[model.id];
                      const shown = draft === undefined ? model.name ?? model.id : draft;
                      const commit = () => {
                        const next = String(shown ?? "").trim();
                        if (next === (model.name ?? "")) return;
                        void rename(model.id, next);
                      };
                      return h(
                        "div",
                        { key: model.id, className: "mv-model" },
                        h("input", {
                          type: "checkbox",
                          checked: !(hidden ?? new Set()).has(model.id),
                          "aria-label": model.id,
                          onChange: () => toggle(model.id),
                        }),
                        h("span", { className: "mv-model-id", title: model.id }, model.id),
                        (model.levels ?? []).length === 0
                          ? h("span", { className: "mv-tag" }, t("noLevels"))
                          : h("span", { className: "mv-tag" }, (model.levels ?? []).join(" ")),
                        model.input?.includes("image") ? h("span", { className: "mv-tag" }, t("vision")) : null,
                        model.deprecated === true ? h("span", { className: "mv-tag mv-tag-warn" }, t("deprecated")) : null,
                        h("span", { className: "mv-card-hint" }, tokens(model.contextWindow)),
                        h("button", { type: "button", className: "mv-button", onClick: () => probe(model.id) }, probed[model.id] === undefined ? t("probe") : String(probed[model.id])),
                        h(
                          "span",
                          { className: "mv-model-name" },
                          h("input", {
                            className: "mv-input",
                            type: "text",
                            value: shown,
                            placeholder: model.discoveredName ?? t("renamePlaceholder"),
                            title: t("renameHint"),
                            "aria-label": `${t("renameLabel")} ${model.id}`,
                            onChange: (event) => setNameDrafts((current) => ({ ...current, [model.id]: event.target.value })),
                            onBlur: commit,
                            onKeyDown: (event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commit();
                              }
                              if (event.key === "Escape") {
                                setNameDrafts((current) => {
                                  const next = { ...current };
                                  delete next[model.id];
                                  return next;
                                });
                              }
                            },
                          }),
                          model.renamed === true
                            ? h("button", { type: "button", className: "mv-button", onClick: () => rename(model.id, "") }, t("renameReset"))
                            : null,
                        ),
                      );
                    }),
                  ),
            ),
          ),
        ),
      );
    }

    // #endregion

    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, it }), "mistral-vibe: dictionaries");
        ctx.effect(() => {
          const tag = document.createElement("style");
          tag.dataset.plugin = "@local/dsh-mistral-vibe-provider";
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, "mistral-vibe: styles");

        const t = ctx.locale.bind(NS);

        ctx.effect(() => {
          let alive = true;
          const load = () => {
            if (alive) void loadSummary(false);
          };
          load();
          const timer = setInterval(load, REFRESH_MS);
          return () => {
            alive = false;
            clearInterval(timer);
          };
        }, "mistral-vibe: summary poll");

        ctx.slots.inject("main", () =>
          ctx.slots.register({ name: "main", key: PANEL_ID, locale: NS, inject: () => ({ t }) }, VibePanel),
        );

        ctx.inject(["layout"], (lctx) => {
          lctx.slots.inject("sidebar.footer.action", () =>
            lctx.slots.register(
              {
                name: "sidebar.footer.action",
                id: "mistral-vibe-bar",
                order: 0,
                locale: NS,
                label: () => t("nav"),
                inject: () => ({ t, selectPanel: (id) => lctx.layout.selectPanel(id) }),
              },
              QuotaCard,
            ),
          );
          lctx.slots.inject("settings.section", () =>
            ctx.slots.register(
              {
                name: "settings.section",
                id: PANEL_ID,
                order: 55,
                locale: NS,
                label: () => t("settingsNav"),
                inject: () => ({ t }),
              },
              VibeSettings,
            ),
          );
        });
      },
    };
}

if (typeof window !== "undefined" && window.__ModuleLoader__) {
  window.__ModuleLoader__.load({
    id: "dsh-mistral-vibe",
    factory: definePlugin,
  });
  try {
    window.__ModuleLoader__.load({
      id: "@local/dsh-mistral-vibe-provider",
      factory: definePlugin,
    });
  } catch {}
}
