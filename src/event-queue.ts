export interface MailEvent {
  subject: string;
  from: string;
  date: string;
  messageId: string;
  preview: string;
  receivedAt: string;
  encryptionState?: string; // "encrypted" | "encryptionFailed" — omitted when not encrypted
}

const MAX = 100;
const queue: MailEvent[] = [];

export function pushEvent(e: MailEvent): void {
  e.receivedAt = e.receivedAt ?? new Date().toISOString();
  queue.push(e);
  if (queue.length > MAX) {
    const dropped = queue.shift()!;
    console.error(`[apple-mail] Event queue full: dropped event "${dropped.subject}" from ${dropped.from}`);
  }
}

export function drainEvents(): MailEvent[] {
  return queue.splice(0);
}
