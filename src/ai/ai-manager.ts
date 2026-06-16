import type { AIProvider, ChatMessage } from "./provider.js";
import { LMStudioProvider } from "./lmstudio-provider.js";
import { OpenAICompatProvider } from "./openai-compat-provider.js";
import { FoundationProvider } from "./foundation-provider.js";

// Environment variable configuration:
//   APPLE_MAIL_AI_PROVIDER  — "lmstudio" | "openai" | "foundation" | "none" (default: "lmstudio")
//   APPLE_MAIL_AI_ENDPOINT  — base URL, e.g. "http://localhost:1234" (default: "http://localhost:1234")
//   APPLE_MAIL_AI_MODEL     — model identifier (default: auto-detected from provider)
//   APPLE_MAIL_AI_API_KEY   — bearer token for remote endpoints (optional)

function buildProvider(): AIProvider {
  const type = process.env.APPLE_MAIL_AI_PROVIDER ?? "lmstudio";
  const endpoint = (process.env.APPLE_MAIL_AI_ENDPOINT ?? "http://localhost:1234").replace(/\/$/, "");
  const apiKey = process.env.APPLE_MAIL_AI_API_KEY;

  switch (type) {
    case "lmstudio": {
      const model = process.env.APPLE_MAIL_AI_MODEL ?? "gemma-4-it";
      return new LMStudioProvider(endpoint, model, 8192, apiKey);
    }
    case "openai":
    case "openai-compat": {
      const model = process.env.APPLE_MAIL_AI_MODEL ?? "gpt-4o-mini";
      return new OpenAICompatProvider(endpoint, model, apiKey);
    }
    case "foundation":
      return new FoundationProvider();
    case "none":
      return {
        name: "none",
        complete: async () => { throw new Error("AI provider is disabled (APPLE_MAIL_AI_PROVIDER=none)."); },
        isAvailable: async () => false,
      };
    default:
      console.error(`[apple-mail] Unknown AI provider "${type}". AI tools will be unavailable.`);
      return {
        name: "none",
        complete: async () => { throw new Error(`Unknown AI provider: ${type}`); },
        isAvailable: async () => false,
      };
  }
}

class AIManager {
  private readonly provider: AIProvider;
  private availabilityCache: boolean | null = null;

  constructor() {
    this.provider = buildProvider();
  }

  get providerName(): string {
    return this.provider.name;
  }

  async isAvailable(): Promise<boolean> {
    if (this.availabilityCache !== null) return this.availabilityCache;
    this.availabilityCache = await this.provider.isAvailable();
    // Re-check every 60 seconds in case the server starts/stops.
    setTimeout(() => { this.availabilityCache = null; }, 60_000);
    return this.availabilityCache;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    return this.provider.complete(messages);
  }
}

export const ai = new AIManager();
