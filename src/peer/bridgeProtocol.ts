import type { HostVersionInfo } from '../config/hostCompatibility';

export const PEER_JS_BRIDGE_READY_MESSAGE_TYPE = 'bridge:ready';

export interface PeerJsBridgeReadyMessage extends HostVersionInfo {
  type: typeof PEER_JS_BRIDGE_READY_MESSAGE_TYPE;
}

export function isPeerJsBridgeReadyMessage(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === PEER_JS_BRIDGE_READY_MESSAGE_TYPE;
}

export function parsePeerJsBridgeReadyMessage(value: unknown): PeerJsBridgeReadyMessage | null {
  if (!isPeerJsBridgeReadyMessage(value)) return null;
  const candidate = value as Partial<Record<keyof PeerJsBridgeReadyMessage, unknown>>;
  if (typeof candidate.appVersion !== 'string' || candidate.appVersion.trim().length === 0) return null;
  if (typeof candidate.buildNumber !== 'number'
    || !Number.isSafeInteger(candidate.buildNumber)
    || candidate.buildNumber < 1) return null;
  if (typeof candidate.protocolVersion !== 'number'
    || !Number.isSafeInteger(candidate.protocolVersion)
    || candidate.protocolVersion < 1) return null;
  return {
    type: PEER_JS_BRIDGE_READY_MESSAGE_TYPE,
    appVersion: candidate.appVersion.trim(),
    buildNumber: candidate.buildNumber,
    protocolVersion: candidate.protocolVersion,
  };
}
