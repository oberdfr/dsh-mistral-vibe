# dsh-mistral-vibe

Mistral Vibe provider plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Provides a dedicated `mistral-vibe` route with **strict per-model reasoning levels**, browser OAuth/PKCE sign-in, live model discovery, model visibility toggling, model renaming, and a quota & budget panel.

## Features

| Feature | Detail |
|---|---|
| **Dedicated Route** | `mistral-vibe`, registered independently of the generic provider |
| **Per-Model Reasoning Levels** | Thinking efforts mapped per model from live API verification (e.g. `deepseek-v4-1-flash-1017` supports `off`, `low`, `high`, `xhigh`, `max`; `mistral-large-4` supports `low`, `medium`, `high`; non-reasoning models offer none) |
| **Browser PKCE Sign-In** | Authorizes an API key directly from your Mistral account in your browser (matching `vibe --setup`) |
| **Manual API Key Entry** | Allows pasting a standard Mistral key, stored securely in DSH credentials (`MISTRAL_VIBE_API_KEY`) |
| **Quota & Billing Panel** | Bottom-left status bar showing monthly Vibe allowance / API budget, reset date, plan tier, and local token usage |
| **Model Visibility** | Toggle which models appear in the composer picker |
| **Model Renaming** | Custom display names for models in the picker that persist across sessions and update dynamically |
| **Dynamic Discovery** | Periodically probes `/v1/models` and `/v1/models/<id>` for context windows, vision support, aliases, and deprecations |
| **Agent Tool** | Exposes the `mistral_vibe` tool to agents for querying remaining allowance and spend |

## How it works

The plugin registers the `mistral-vibe` provider using `@deepseek-ai/dsh-llm-pi-ai`'s `PiAiAdapter` with `mistralConversationsApi` as the underlying wire protocol. Streaming, tool calls, images, replay, and the idle watchdog behave with full native fidelity.

## Installation

### From GitHub (Recommended)

In your terminal or DSH CLI:

```bash
dsh plugin --profile desktop add https://github.com/oberdfr/dsh-mistral-vibe
```

Or add it to `dsh.profile.bundles` in your profile `package.json`:

```json
"dependencies": {
  "dsh-mistral-vibe": "github:oberdfr/dsh-mistral-vibe"
}
```

### From Local Source

```bash
dsh plugin --profile desktop add "link:/path/to/dsh-mistral-vibe"
```

> **Note:** On Windows desktop installations, plugins must reside within or be linked under the profile directory so Node ESM resolution reaches DSH's hoisted dependencies (`@deepseek-ai/schemastery`, etc.).

## Configuration

In your profile's `cordis.patch.yml`:

```yaml
- id: mistral-vibe
  name: 'dsh-mistral-vibe'
  config:
    apiKeyEnv: MISTRAL_VIBE_API_KEY  # Credential reference holding the key
    apiBase: https://api.mistral.ai  # Mistral API base URL
    consoleBase: https://console.mistral.ai  # Mistral Console base URL
    barBudget: vibe                  # Which budget counter the bottom bar tracks ('vibe' or 'api')
    currency: EUR                    # Currency symbol
    discoveryMinutes: 10             # Interval to refresh dynamic models (0 disables)
    hidden: []                       # Hidden model IDs
    names: {}                        # Per-model display name overrides
```

## Structure

```
dsh-mistral-vibe/
├── index.js               # Entry point (startup trace & loader bridge)
├── client.js              # Web client bundle (sidebar bar, main panel, settings)
├── cordis.patch.yml       # Default bundle loader patch
├── icon.svg               # Mistral logo icon
├── lib/
│   ├── capabilities.js    # Curated reasoning levels & capabilities
│   ├── catalog.js         # Dynamic discovery & descriptor building
│   ├── host.js            # Route adapter, web server bridge & agent tool
│   ├── quota.js           # Whoami, billing endpoints & local usage ledger
│   ├── signin.js          # PKCE browser authentication state machine
│   └── trace.js           # Startup diagnostics logger
├── locale/
│   ├── en.json            # English translations
│   └── it.json            # Italian translations
├── LICENSE                # MIT License
├── package.json
└── README.md
```

## License

MIT © [oberdfr](https://github.com/oberdfr)
