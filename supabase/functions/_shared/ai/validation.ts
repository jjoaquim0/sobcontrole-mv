import type { AIChatMessage } from './types.ts';

export const MAX_BODY_BYTES = 25_000;
export const MAX_MESSAGES = 12;
export const MAX_MESSAGE_LENGTH = 2_000;
export const MAX_TOTAL_MESSAGE_LENGTH = 12_000;

export type ChatPayloadResult =
  | { ok: true; messages: AIChatMessage[] }
  | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseChatPayload = (value: unknown): ChatPayloadResult => {
  if (!isRecord(value)) return { ok: false };

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'messages') return { ok: false };
  if (!Array.isArray(value.messages) || value.messages.length === 0) return { ok: false };
  if (value.messages.length > MAX_MESSAGES) return { ok: false };

  let totalLength = 0;
  const messages: AIChatMessage[] = [];

  for (const item of value.messages) {
    if (!isRecord(item)) return { ok: false };
    const itemKeys = Object.keys(item).sort();
    if (itemKeys.length !== 2 || itemKeys[0] !== 'content' || itemKeys[1] !== 'role') {
      return { ok: false };
    }

    if (item.role !== 'assistant' && item.role !== 'user') return { ok: false };
    if (typeof item.content !== 'string') return { ok: false };

    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return { ok: false };

    totalLength += content.length;
    if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) return { ok: false };
    messages.push({ role: item.role, content });
  }

  if (messages.at(-1)?.role !== 'user') return { ok: false };
  return { ok: true, messages };
};

export const parseChatPayloadText = (bodyText: string): ChatPayloadResult => {
  if (!bodyText || new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return { ok: false };
  }

  try {
    return parseChatPayload(JSON.parse(bodyText));
  } catch {
    return { ok: false };
  }
};

export const estimateInputTokens = (messages: AIChatMessage[]): number => {
  const characterCount = messages.reduce((total, message) => total + message.content.length, 0);
  const structuralOverhead = messages.length * 4;
  return Math.max(1, Math.ceil(characterCount / 4) + structuralOverhead);
};
