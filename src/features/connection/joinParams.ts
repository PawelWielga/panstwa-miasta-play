import { ROOM_CODE_PATTERN, SUPPORTED_GAME_PROTOCOL_VERSION } from '../../protocol/constants';

export interface JoinParameters { roomId: string }
export type JoinParameterErrorKey = 'room' | 'protocol';
export interface JoinParameterResult {
  value: JoinParameters | null;
  errors: Partial<Record<JoinParameterErrorKey, string>>;
  fromInvitation: boolean;
}

export const INCOMPATIBLE_GAME_VERSION_MESSAGE =
  'Ta wersja gry jest niezgodna. Odśwież stronę lub poproś prowadzącego o nowy link.';

export function normalizeRoomId(rawRoomId: string): string {
  const roomId = rawRoomId.trim().toUpperCase();
  if (!roomId) throw new Error('Kod pokoju nie może być pusty.');
  if (!ROOM_CODE_PATTERN.test(roomId)) {
    throw new Error('Kod pokoju musi mieć dokładnie 6 liter lub cyfr.');
  }
  return roomId;
}

export function parseJoinParameters(search: string): JoinParameterResult {
  const params = new URLSearchParams(search);
  const rawRoomId = params.get('room') ?? '';
  const rawProtocol = params.get('protocol')?.trim() ?? '';
  const errors: JoinParameterResult['errors'] = {};
  let roomId = '';

  try {
    roomId = normalizeRoomId(rawRoomId);
  } catch (error) {
    errors.room = error instanceof Error ? error.message : 'Kod pokoju jest nieprawidłowy.';
  }

  if (rawProtocol) {
    const protocolVersion = Number(rawProtocol);
    if (!Number.isInteger(protocolVersion) || protocolVersion !== SUPPORTED_GAME_PROTOCOL_VERSION) {
      errors.protocol = INCOMPATIBLE_GAME_VERSION_MESSAGE;
    }
  }

  return {
    value: Object.keys(errors).length === 0 ? { roomId } : null,
    errors,
    fromInvitation: rawRoomId.trim().length > 0,
  };
}

export function validateJoinParameters(value: JoinParameters): JoinParameterResult['errors'] {
  try {
    normalizeRoomId(value.roomId);
    return {};
  } catch (error) {
    return { room: error instanceof Error ? error.message : 'Kod pokoju jest nieprawidłowy.' };
  }
}
