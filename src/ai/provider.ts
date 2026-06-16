export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  readonly name: string;
  complete(messages: ChatMessage[]): Promise<string>;
  isAvailable(): Promise<boolean>;
}
