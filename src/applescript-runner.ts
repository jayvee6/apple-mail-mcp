import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), "../scripts/applescript");

export async function runScript(scriptName: string, args: string[]): Promise<string> {
  const scriptPath = join(scriptsDir, `${scriptName}.applescript`);
  const { stdout, stderr } = await execFileAsync("osascript", [scriptPath, ...args]);
  if (stderr) console.error(`[applescript:${scriptName}]`, stderr.trim());
  return stdout.trim();
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
