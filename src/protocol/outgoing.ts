import { PROTOCOL_VERSION } from './constants';
import type { ClientMessage, PlayerProfile } from './messages';
import { generateRequestId } from '../utils/ids';

export interface IdentityCredentials { profile: PlayerProfile; reconnectToken: string }

function meta(playerId: string, withRequestId = true): { senderId: string; sentAt: number; requestId?: string } {
  return { senderId: playerId, sentAt: Date.now(), ...(withRequestId ? { requestId: generateRequestId() } : {}) };
}
export function createPlayerHello(identity: IdentityCredentials, protocolVersion = PROTOCOL_VERSION): ClientMessage {
  return { type: 'player:hello', protocolVersion, reconnectToken: identity.reconnectToken, player: identity.profile, ...meta(identity.profile.id) };
}
export function createGameReady(playerId: string, ready: boolean): ClientMessage { return { type: 'game:ready', ready, ...meta(playerId) }; }
export function createHeartbeat(playerId: string, gameId: string, sequence: number): ClientMessage {
  return { type: 'client:heartbeat', gameId, playerId, lastSeenSequenceNumber: sequence, senderId: playerId, sentAt: Date.now() };
}
export function createRejoin(profile: PlayerProfile, lastSeenSequenceNumber: number, protocolVersion = PROTOCOL_VERSION): ClientMessage {
  return { type: 'client:rejoin', protocolVersion, player: profile, lastSeenSequenceNumber, ...meta(profile.id) };
}
export function createSubmit(profile: PlayerProfile, answers: Record<string, string>): ClientMessage {
  return { type: 'countries-cities:submit', player: profile, answers, senderId: profile.id, requestId: generateRequestId() };
}
export function createEditAnswers(playerId: string): ClientMessage {
  return { type: 'countries-cities:edit-answers', playerId, ...meta(playerId) };
}
