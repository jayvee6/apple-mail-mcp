import type { AIProvider, ChatMessage } from "./provider.js";

interface OpenAICompatResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export class OpenAICompatProvider implements AIProvider {
  readonly name = "openai-compat";

  constructor(
    private readonly endpoint: string,
    private readonly model: string,
    private readonly apiKey?: string
  ) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.model, messages, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`OpenAI-compat /v1/chat/completions ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as OpenAICompatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI-compat endpoint returned empty response");
    return content.trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/v1/models`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
