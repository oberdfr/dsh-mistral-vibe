/**
 * Append-only diagnostic trace for the plugin's own startup.
 *
 * The Harness catches a failed plugin import and only reports it in the app's
 * console, which a packaged desktop build does not keep. Writing to a file the
 * user can read turns "nothing appears" into a specific line.
 *
 * @module dsh-mistral-vibe-provider/trace
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

/** Trace file under the DSH home. */
export const TRACE_PATH = join(
  process.env.DSH_HOME !== undefined && process.env.DSH_HOME.length > 0 ? process.env.DSH_HOME : join(homedir(), ".dsh"),
  "mistral-vibe-trace.log",
);

/**
 * Append one line to the trace.
 * @param {string} message - what happened.
 */
export function trace(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    mkdirSync(dirname(TRACE_PATH), { recursive: true });
    appendFileSync(TRACE_PATH, line, "utf8");
  } catch {
    /* tracing must never break the plugin */
  }
  try {
    console.error(`[mistral-vibe] ${message}`);
  } catch {
    /* no console */
  }
}

/**
 * Describe an error with its stack, for the trace.
 * @param {unknown} error - caught value.
 * @returns {string} the description.
 */
export function describe(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  return String(error);
}
