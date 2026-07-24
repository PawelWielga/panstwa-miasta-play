import { ROOM_CODE_PATTERN } from '../../protocol/constants';

export interface JoinParameters { roomId: string; hostPeerId: string; protocolVersion: number }
export interface JoinParameterResult { value: JoinParameters | null; errors: Partial<Record<'room' | 'peer' | 'protocol', string>>; fromInvitation: boolean }

export function parseJoinParameters(search: string): JoinParameterResult {
  const params = new URLSearchParams(search);
  const raw = { room: params.get('room')?.trim() ?? '', peer: params.get('peer')?.trim() ?? '', protocol: params.get('protocol')?.trim() ?? '' };
  const fromInvitation = Boolean(raw.room || raw.peer || raw.protocol);
  const errors: JoinParameterResult['errors'] = {};
  const roomId = raw.room.toUpperCase();
  if (!ROOM_CODE_PATTERN.test(roomId)) errors.room = 'Kod pokoju musi mieć 6 znaków bez 0, 1, I i O.';
  if (!raw.peer || raw.peer.length > 255 || /\s/.test(raw.peer)) errors.peer = 'Podaj poprawny identyfikator hosta PeerJS.';
  const protocolVersion = Number(raw.protocol);
  if (!raw.protocol || !Number.isInteger(protocolVersion) || protocolVersion <= 0) errors.protocol = 'Wersja protokołu musi być dodatnią liczbą całkowitą.';
  return { value: Object.keys(errors).length === 0 ? { roomId, hostPeerId: raw.peer, protocolVersion } : null, errors, fromInvitation };
}

export function validateJoinParameters(value: JoinParameters): JoinParameterResult['errors'] {
  return parseJoinParameters(`?room=${encodeURIComponent(value.roomId)}&peer=${encodeURIComponent(value.hostPeerId)}&protocol=${String(value.protocolVersion)}`).errors;
}
