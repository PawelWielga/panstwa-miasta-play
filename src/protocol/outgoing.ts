import { SUPPORTED_GAME_PROTOCOL_VERSION } from './constants';
import type { ClientMessage, CountriesCitiesWheelSpinHoldStartedMessage, CountriesCitiesWheelState, PlayerProfile } from './messages';
import { generateRequestId } from '../utils/ids';

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
export function createRejoin(profile: PlayerProfile, lastSeenSequenceNumber: number): ClientMessage {
  return { type: 'client:rejoin', protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION, player: profile, lastSeenSequenceNumber, ...meta(profile.id) };
}
export function createSubmit(profile: PlayerProfile, answers: Record<string, string>): ClientMessage {
  return { type: 'countries-cities:submit', player: profile, answers, senderId: profile.id, requestId: generateRequestId() };
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
