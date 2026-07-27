export const PEER_JS_BRIDGE_READY_MESSAGE_TYPE = 'bridge:ready';

export function isPeerJsBridgeReadyMessage(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === PEER_JS_BRIDGE_READY_MESSAGE_TYPE;
}
