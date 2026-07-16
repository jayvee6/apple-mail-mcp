import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runScript, textContent } from "../applescript-runner.js";

/**
 * Normalize a user-supplied sender domain to a bare lowercase host
 * (e.g. "  @News.Newsletter.com/foo " -> "news.newsletter.com").
 *
 * Returns null when the input doesn't look like a domain. This is a safety
 * gate, not just cosmetics: the rule runner passes each domain into a
 * `from header contains "@domain"` condition, and an empty/trivial value would
 * widen the rule (and the apply_to_existing move) to match almost everything.
 */
function normalizeDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, ""); // strip protocol if a URL was pasted
  d = d.replace(/^@+/, ""); // accept "@domain"
  d = d.replace(/^www\./, "");
  d = d.replace(/[\/?#].*$/, ""); // strip any path/query if a URL was pasted
  if (d.length < 3) return null;
  if (!d.includes(".")) return null;
  if (d.startsWith(".") || d.endsWith(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(d)) return null; // no spaces, quotes, or wildcards
  return d;
}

/** Parse a script's "OK|k=v|k=v" status line into a record. */
function parseKv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split("|")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

export function registerRuleTools(server: McpServer): void {
  server.tool(
    "create_rule",
    "Create a native Apple Mail rule that files incoming mail from given sender domains into a folder. " +
      "This is a REAL Mail rule: Mail applies it to new incoming mail automatically while Mail is running — " +
      "no background process. Multiple domains are OR-combined into one rule. " +
      "Native rules do not touch existing mail; set apply_to_existing=true to also sort what is already in the mailbox now. " +
      "Idempotent: an existing rule with the same name is replaced. The destination folder must already exist (use create_folder).",
    {
      name: z.string().min(1).describe('Rule name — also the identity key for replace/delete, e.g. "Newsletters".'),
      domains: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe('Sender domains to match, e.g. ["newsletter.com","shop.de"]. Mail is filed if its sender contains ANY of them.'),
      dest_mailbox: z.string().min(1).describe('Existing destination folder in the account, e.g. "Newsletters".'),
      account: z.string().default("iCloud").describe('Account whose folder is the destination. Defaults to "iCloud".'),
      apply_to_existing: z
        .boolean()
        .default(false)
        .describe("Also move matching mail already in the source mailbox now (one pass per domain). Default false = future mail only."),
      src_mailbox: z.string().default("INBOX").describe('Mailbox to sort when apply_to_existing is true. Defaults to "INBOX".'),
    },
    async ({ name, domains, dest_mailbox, account, apply_to_existing, src_mailbox }) => {
      // Normalize + dedupe domains; drop anything that doesn't look like a domain.
      const normalized: string[] = [];
      const rejected: string[] = [];
      for (const raw of domains) {
        const n = normalizeDomain(raw);
        if (n) {
          if (!normalized.includes(n)) normalized.push(n);
        } else {
          rejected.push(raw);
        }
      }
      if (normalized.length === 0) {
        return textContent(
          'ERROR: No valid domains after normalization. Provide plain domains like "newsletter.com".' +
            (rejected.length ? ` Rejected: ${rejected.join(", ")}` : "")
        );
      }

      // Create the native rule (the script is idempotent and self-verifying).
      const raw = await runScript("create_rule", [name, account, dest_mailbox, normalized.join(",")], {
        timeoutMs: 60_000,
      });
      const info = parseKv(raw);

      // Optionally sort existing mail: one move_matching pass per domain (its
      // fast path bulk-moves the whole `from header contains "@domain"` set).
      const moved: Record<string, number | "error"> = {};
      let totalMoved = 0;
      if (apply_to_existing) {
        for (const d of normalized) {
          try {
            // Two passes per domain — "@domain" (apex) and ".domain" (subdomains) —
            // mirroring the rule's condition pair. The sets are disjoint, so no
            // message is moved twice.
            let cnt = 0;
            for (const filter of ["@" + d, "." + d]) {
              const mv = await runScript(
                "move_matching",
                [account, src_mailbox, filter, "", "", "", account, dest_mailbox, "0"],
                { timeoutMs: 600_000 }
              );
              const m = mv.match(/Moved\s+(\d+)/);
              cnt += m ? parseInt(m[1], 10) : 0;
            }
            moved[d] = cnt;
            totalMoved += cnt;
          } catch {
            moved[d] = "error";
          }
        }
      }

      // Deterministic, human-readable summary: what was created, what/how much
      // moved, and which domains are affected.
      const lines: string[] = [];
      const replaced = info.replaced && info.replaced !== "0";
      lines.push(`Rule "${name}" created (enabled)${replaced ? " — replaced an existing rule of the same name" : ""}.`);
      lines.push(`  Action:  move to ${account}/${dest_mailbox}`);
      lines.push(`  Match:   sender contains ANY of ${normalized.length} domain${normalized.length > 1 ? "s" : ""}:`);
      lines.push(`             ${normalized.join(", ")}`);
      if (rejected.length) lines.push(`  Ignored invalid entries: ${rejected.join(", ")}`);
      lines.push("");
      if (apply_to_existing) {
        lines.push(`Existing mail in ${account}/${src_mailbox} sorted now:`);
        const order = normalized
          .slice()
          .sort((a, b) => (typeof moved[b] === "number" ? (moved[b] as number) : -1) - (typeof moved[a] === "number" ? (moved[a] as number) : -1));
        for (const d of order) lines.push(`  ${String(moved[d]).padStart(6)}  ${d}`);
        lines.push(`  Total moved: ${totalMoved} → ${dest_mailbox}`);
        lines.push("");
        lines.push("The rule now also sorts NEW incoming mail automatically (while Mail is running).");
      } else {
        lines.push("The rule sorts NEW incoming mail automatically (while Mail is running).");
        lines.push("Existing mail was left untouched — re-run with apply_to_existing=true to sort it now.");
      }
      return textContent(lines.join("\n"));
    }
  );

  server.tool(
    "list_rules",
    "List all Apple Mail rules: name, enabled state, move-target folder, and the sender domains each matches. " +
      "Shows every rule in Mail, including ones created outside this tool.",
    {},
    async () => {
      const raw = await runScript("list_rules", []);
      if (!raw.trim()) return textContent("No mail rules are defined.");
      const rows = raw.split("\n").filter(Boolean);
      const out: string[] = [`Mail rules (${rows.length}):`];
      for (const row of rows) {
        const [rName, enabled, moveTarget, domains] = row.split("\t");
        const state = enabled === "true" ? "enabled" : "disabled";
        const target = !moveTarget || moveTarget === "-" ? "no move action" : `move → ${moveTarget}`;
        const doms =
          !domains || domains === "-"
            ? "(no from-address conditions)"
            : [...new Set(domains.split(",").map((x) => x.replace(/^[@.]/, "")))].join(", ");
        out.push(`• ${rName}  [${state}, ${target}]`);
        out.push(`    from: ${doms}`);
      }
      return textContent(out.join("\n"));
    }
  );

  server.tool(
    "delete_rule",
    "Delete an Apple Mail rule by name. Use list_rules to see rule names. Removes the rule only; it does not move any mail back.",
    {
      name: z.string().min(1).describe("Exact name of the rule to delete (see list_rules)."),
    },
    async ({ name }) => {
      const raw = await runScript("delete_rule", [name]);
      const info = parseKv(raw);
      return textContent(`Deleted rule "${name}" (${info.deleted ?? "?"} removed). ${info.remaining ?? "?"} rule(s) remain.`);
    }
  );
}
