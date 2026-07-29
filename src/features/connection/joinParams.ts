import { PEER_JS_ONLINE_PROTOCOL_VERSION } from '../../protocol/constants';
import {
  normalizeOnlineJoinCode,
  parseOnlineJoinCode,
  validateOnlineJoinCredentials,
  type PeerJsOnlineJoinCredentials,
} from '../../peer/onlineJoinCredentials';

export type JoinParameters = PeerJsOnlineJoinCredentials;
export type JoinParameterErrorKey = 'code' | 'protocol';
export interface JoinParameterResult {
  value: JoinParameters | null;
  errors: Partial<Record<JoinParameterErrorKey, string>>;
  fromInvitation: boolean;
}

export const INCOMPATIBLE_GAME_VERSION_MESSAGE =
  'Ta wersja gry jest niezgodna. Odśwież stronę lub poproś prowadzącego o nowy link.';

export function parseJoinParameters(search: string): JoinParameterResult {
  const params = new URLSearchParams(search);
  const codeValues = params.getAll('code');
  const protocolValues = params.getAll('protocol');
  const roomValues = params.getAll('room');
  const rawOnlineJoinCode = codeValues[0] ?? '';
  const rawProtocol = protocolValues[0]?.trim() ?? '';
  const hasLegacyRoom = roomValues.length > 0;
  const errors: JoinParameterResult['errors'] = {};
  let value: JoinParameters | null = null;

  if (codeValues.length > 1) errors.code = 'Link zawiera więcej niż jeden kod dołączenia.';
  if (protocolValues.length > 1 || roomValues.length > 1) {
    errors.protocol = INCOMPATIBLE_GAME_VERSION_MESSAGE;
  }

  if (!errors.code && rawOnlineJoinCode.trim()) {
    try { value = parseOnlineJoinCode(rawOnlineJoinCode); }
    catch (error) { errors.code = error instanceof Error ? error.message : 'Kod dołączenia jest nieprawidłowy.'; }
  } else if (hasLegacyRoom) {
    errors.protocol = INCOMPATIBLE_GAME_VERSION_MESSAGE;
  }

  if (rawProtocol) {
    const protocolVersion = Number(rawProtocol);
    if (!Number.isInteger(protocolVersion) || protocolVersion !== PEER_JS_ONLINE_PROTOCOL_VERSION) {
      errors.protocol = INCOMPATIBLE_GAME_VERSION_MESSAGE;
    }
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors,
    fromInvitation: rawOnlineJoinCode.trim().length > 0 || hasLegacyRoom,
  };
}

export function validateOnlineJoinCode(rawCode: string): JoinParameterResult['errors'] {
  try {
    const credentials = parseOnlineJoinCode(rawCode);
    validateOnlineJoinCredentials(credentials);
    return {};
  } catch (error) {
    return { code: error instanceof Error ? error.message : 'Kod dołączenia jest nieprawidłowy.' };
  }
}

export { normalizeOnlineJoinCode, parseOnlineJoinCode };

export function sanitizedJoinInvitationPath(rawHref: string): string {
  const url = new URL(rawHref);
  for (const parameter of ['code', 'protocol', 'room', 'peer']) {
    url.searchParams.delete(parameter);
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}
