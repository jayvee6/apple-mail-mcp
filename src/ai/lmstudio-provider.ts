import type { AIProvider, ChatMessage } from "./provider.js";
import { OpenAICompatProvider } from "./openai-compat-provider.js";

// LM Studio's native POST /api/v1/chat takes `input`, not `messages`, so a
// chat-completions body gets a 400. Its OpenAI-compatible server is stable
// across versions, so talk to that and keep "lmstudio" as the provider name.
export class LMStudioProvider implements AIProvider {
  readonly name = "lmstudio";
  private readonly inner: OpenAICompatProvider;

  constructor(endpoint: string, model: string, apiKey?: string) {
    this.inner = new OpenAICompatProvider(endpoint, model, apiKey);
  }

  complete(messages: ChatMessage[]): Promise<string> {
    return this.inner.complete(messages);
  }

  isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }
}
