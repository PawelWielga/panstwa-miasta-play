import { MAX_MESSAGE_BYTES } from './constants';
import type { JsonValue } from './messages';

const encoder = new TextEncoder();

export function encodedMessageSize(value: JsonValue): number {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

export function isMessageWithinLimit(value: JsonValue): boolean {
  return encodedMessageSize(value) <= MAX_MESSAGE_BYTES;
}
