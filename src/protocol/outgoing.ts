import { MAX_MESSAGE_BYTES, REQUEST_ID_MAX_LENGTH, SUPPORTED_GAME_PROTOCOL_VERSION } from './constants';
import type { ClientMessage, ClientRoomClosedAcknowledgementMessage, CountriesCitiesSubmitMessage, CountriesCitiesWheelSpinHoldCancelledMessage, CountriesCitiesWheelSpinHoldStartedMessage, CountriesCitiesWheelState, JsonValue, PlayerProfile } from './messages';
import { generateRequestId } from '../utils/ids';
import { encodedMessageSize } from './messageSize';
import { isBoundedString, parseSubmissionAnswers } from './validation';

export interface IdentityCredentials { profile: PlayerProfile; reconnectToken: string }

function meta(playerId: string, withRequestId = true): { senderId: string; sentAt: number; requestId?: string } {
  return { senderId: playerId, sentAt: Date.now(), ...(withRequestId ? { requestId: generateRequestId() } : {}) };
}
export function createPlayerHello(identity: IdentityCredentials): ClientMessage {
  return { type: 'player:hello', protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION, reconnectToken: identity.reconnectToken, player: identity.profile, ...meta(identity.profile.id) };
}
export function createGameReady(playerId: string, ready: boolean): ClientMessage { return { type: 'game:ready', ready, ...meta(playerId) }; }
export function createHeartbeat(playerId: string, gameId: string, sequence: number): ClientMessage {
  return { type: 'client:heartbeat', gameId, playerId, lastSeenSequenceNumber: sequence, senderId: playerId, sentAt: Date.now() };
}
export function createRoomClosedAcknowledgement(
  playerId: string,
  gameId: string,
  shutdownId: string,
  requestId?: string,
): ClientRoomClosedAcknowledgementMessage {
  return {
    type: 'client:room-closed-ack',
    gameId,
    shutdownId,
    playerId,
    senderId: playerId,
    sentAt: Date.now(),
    ...(requestId ? { requestId } : {}),
  };
}
export function createRejoin(profile: PlayerProfile, lastSeenSequenceNumber: number): ClientMessage {
  return { type: 'client:rejoin', protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION, player: profile, lastSeenSequenceNumber, ...meta(profile.id) };
}
export function createSubmit(profile: PlayerProfile, answers: Record<string, string>): CountriesCitiesSubmitMessage {
  return createBoundedSubmit({
    type: 'countries-cities:submit',
    player: profile,
    answers,
    senderId: profile.id,
    requestId: generateRequestId(),
  });
}

export function createFinalizationSubmit(
  profile: PlayerProfile,
  answers: Record<string, string>,
  roundNumber: number,
  finalizationId: string,
  requestId = generateRequestId(),
): CountriesCitiesSubmitMessage {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) throw new RangeError('Nieprawidłowy numer rundy finalizacji.');
  if (!isBoundedString(finalizationId, REQUEST_ID_MAX_LENGTH)) throw new RangeError('Nieprawidłowy identyfikator finalizacji.');
  if (!isBoundedString(requestId, REQUEST_ID_MAX_LENGTH)) throw new RangeError('Nieprawidłowy identyfikator żądania.');
  return createBoundedSubmit({
    type: 'countries-cities:submit',
    player: profile,
    answers,
    roundNumber,
    finalizationId,
    senderId: profile.id,
    requestId,
  });
}

function createBoundedSubmit(message: CountriesCitiesSubmitMessage): CountriesCitiesSubmitMessage {
  const answers = parseSubmissionAnswers(message.answers);
  if (!answers) throw new RangeError('Odpowiedzi przekraczają limity protokołu.');
  const normalized = { ...message, answers };
  if (encodedMessageSize(normalized as unknown as JsonValue) > MAX_MESSAGE_BYTES) {
    throw new RangeError('Wiadomość z odpowiedziami przekracza limit 64 KiB.');
  }
  return normalized;
}
export function createEditAnswers(playerId: string): ClientMessage {
  return { type: 'countries-cities:edit-answers', playerId, ...meta(playerId) };
}
export function createWheelSpinHoldStarted(
  playerId: string,
  wheelState: CountriesCitiesWheelState,
): CountriesCitiesWheelSpinHoldStartedMessage {
  return {
    type: 'player:wheelSpinHoldStarted',
    hostSessionId: wheelState.hostSessionId,
    roundNumber: wheelState.roundNumber,
    spinId: wheelState.spinId,
    holdId: generateRequestId(),
    ...meta(playerId),
  };
}
export function createWheelSpinHoldCancelled(
  playerId: string,
  wheelState: CountriesCitiesWheelState,
  holdId: string,
): CountriesCitiesWheelSpinHoldCancelledMessage {
  return {
    type: 'player:wheelSpinHoldCancelled',
    hostSessionId: wheelState.hostSessionId,
    roundNumber: wheelState.roundNumber,
    spinId: wheelState.spinId,
    holdId,
    ...meta(playerId),
  };
}
export function createStartWheelSpin(
  playerId: string,
  wheelState: CountriesCitiesWheelState,
  holdDurationMs?: number,
  holdId?: string,
): ClientMessage {
  return {
    type: 'player:startWheelSpin',
    hostSessionId: wheelState.hostSessionId,
    roundNumber: wheelState.roundNumber,
    spinId: wheelState.spinId,
    ...(holdDurationMs === undefined ? {} : { holdDurationMs }),
    ...(holdId === undefined ? {} : { holdId }),
    ...meta(playerId),
  };
}
