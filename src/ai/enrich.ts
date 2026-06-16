import type { MailEvent } from "../event-queue.js";
import { ai } from "./ai-manager.js";

const ENRICH_TIMEOUT_MS = 10_000;

interface EnrichResult {
  summary: string;
  category: string;
  priority: "high" | "medium" | "low";
  action_required: boolean;
  tags: string[];
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`AI enrichment timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function enrichEvent(event: MailEvent): Promise<MailEvent> {
  if (process.env.APPLE_MAIL_AI_ENRICH_EVENTS !== "1") return event;
  if (!(await ai.isAvailable())) return event;

  try {
    const raw = await withTimeout(
      ai.complete([
        {
          role: "system",
          content:
            "You are a concise email classifier. Respond only with valid JSON — no markdown, no explanation.",
        },
        {
          role: "user",
          content:
            "Classify this incoming email and write a one-sentence summary.\n" +
            'JSON schema: {"summary": string, "category": string, "priority": "high"|"medium"|"low", "action_required": boolean, "tags": string[]}\n\n' +
            `Subject: ${event.subject}\nFrom: ${event.from}\nPreview: ${event.preview}`,
        },
      ]),
      ENRICH_TIMEOUT_MS
    );

    const result = JSON.parse(raw) as EnrichResult;
    return {
      ...event,
      aiSummary: result.summary,
      aiCategory: result.category,
      aiPriority: result.priority,
      aiActionRequired: result.action_required,
      aiTags: result.tags,
    };
  } catch (err) {
    console.error("[apple-mail] Event enrichment failed:", err instanceof Error ? err.message : String(err));
    return event;
  }
}
