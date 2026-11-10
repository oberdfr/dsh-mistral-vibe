/**
 * Mistral Vibe provider — entry point.
 *
 * The implementation lives in `lib/host.js`. This wrapper exists so a failure
 * to import it is recorded in `~/.dsh/mistral-vibe-trace.log` instead of
 * disappearing into the packaged app's console: a desktop build keeps no
 * console, so "the plugin does nothing" is otherwise indistinguishable from
 * "the plugin never loaded".
 *
 * @module dsh-mistral-vibe-provider
 */
import { describe, trace } from "./lib/trace.js";

trace("entry: loading lib/host.js");

let host;
try {
  host = await import("./lib/host.js");
} catch (error) {
  trace(`entry: import failed\n${describe(error)}`);
  throw error;
}

trace(`entry: import ok (${Object.keys(host).join(", ")})`);

export const name = host.name;
export const inject = host.inject;
export const Config = host.Config;
export const ROUTE = host.ROUTE;

/**
 * Mount the provider, tracing the outcome.
 * @param {object} ctx - plugin context.
 * @param {object} config - resolved plugin configuration.
 */
export function apply(ctx, config) {
  trace("apply: start");
  try {
    host.apply(ctx, config);
    trace("apply: ok");
  } catch (error) {
    trace(`apply: failed\n${describe(error)}`);
    throw error;
  }
}
