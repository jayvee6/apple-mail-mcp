import type { AIProvider, ChatMessage } from "./provider.js";

// Stub for Apple Foundation Models (macOS 27+ / Core AI framework).
// Implementation: a small Swift CLI helper (scripts/swift-ai/main.swift) that
// receives messages on stdin as JSON and writes the completion to stdout.
// Wire this in once the Core AI Swift SDK ships with macOS 27.
export class FoundationProvider implements AIProvider {
  readonly name = "foundation";

  async complete(_messages: ChatMessage[]): Promise<string> {
    throw new Error("Apple Foundation Models provider is not yet implemented. Set APPLE_MAIL_AI_PROVIDER=lmstudio or openai-compat.");
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}
