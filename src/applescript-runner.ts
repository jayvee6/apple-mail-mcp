import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname, basename } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), "../scripts/applescript");

/** AppleScript hangs indefinitely if Mail shows a permission prompt or is frozen. */
const APPLESCRIPT_TIMEOUT_MS = 30_000;

/** Convenience wrapper so tool handlers don't repeat `{ type: "text" as const, ... }`. */
export function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// Security: args are passed via execFile's args array (never shell-interpolated) and read
// in AppleScript as positional argv items. AppleScript treats them as data, not code —
// there is no injection risk from user-supplied strings passed as positional arguments.
export async function runScript(scriptName: string, args: string[]): Promise<string> {
  // Guard against path traversal — script names must be bare identifiers.
  if (scriptName !== basename(scriptName)) {
    throw new Error(`Invalid script name: ${scriptName}`);
  }

  const scriptPath = join(scriptsDir, `${scriptName}.applescript`);
  const { stdout, stderr } = await execFileAsync("osascript", [scriptPath, ...args], {
    timeout: APPLESCRIPT_TIMEOUT_MS,
  });

  if (stderr) console.error(`[applescript:${scriptName}]`, stderr.trim());

  const result = stdout.trim();
  // AppleScript scripts signal not-found / bad-args with an "ERROR:" prefix.
  // Surface these as real MCP tool errors rather than successful responses
  // with error text embedded in the content.
  if (result.startsWith("ERROR:")) {
    throw new Error(result);
  }
  return result;
}

export function parseMessageRef(ref: string): { account: string; mailbox: string; messageId: string } {
  const idx1 = ref.indexOf("::");
  const idx2 = ref.indexOf("::", idx1 + 2);
  if (idx1 === -1 || idx2 === -1) throw new Error(`Invalid message ref: ${ref}`);
  return {
    account: ref.slice(0, idx1),
    mailbox: ref.slice(idx1 + 2, idx2),
    messageId: ref.slice(idx2 + 2),
  };
}

export function buildMessageRef(account: string, mailbox: string, messageId: string): string {
  return `${account}::${mailbox}::${messageId}`;
}
