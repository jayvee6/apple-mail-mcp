import type { AIProvider, ChatMessage } from "./provider.js";

interface LMStudioChatResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export class LMStudioProvider implements AIProvider {
  readonly name = "lmstudio";

  constructor(
    private readonly endpoint: string,
    private readonly model: string,
    private readonly contextLength = 8192,
    private readonly apiKey?: string
  ) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.endpoint}/api/v1/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        contextLength: this.contextLength,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`LM Studio /api/v1/chat ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as LMStudioChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LM Studio returned empty response");
    return content.trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/v1/models`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
