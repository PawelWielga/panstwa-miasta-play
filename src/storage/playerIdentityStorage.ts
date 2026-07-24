import { PLAYER_COLOR_MAX_LENGTH, PLAYER_EMOJI_MAX_LENGTH, PLAYER_ID_MAX_LENGTH, PLAYER_NAME_MAX_LENGTH, RECONNECT_TOKEN_MAX_LENGTH } from '../protocol/constants';
import type { PlayerProfile } from '../protocol/messages';
import { isBoundedString, isRecord } from '../protocol/validation';
import { generatePlayerId, generateReconnectToken } from '../utils/ids';

const KEY = 'panstwa-miasta.player-identity.v1';
export interface StoredPlayerIdentity { playerId: string; reconnectToken: string; playerName: string; playerEmoji: string; playerColor: string }
export interface PlayerIdentity extends StoredPlayerIdentity { profile: PlayerProfile }

const defaults = { playerName: '', playerEmoji: '🦊', playerColor: '#6d4aff' };

export function createPlayerIdentity(partial: Partial<Pick<StoredPlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>> = {}): PlayerIdentity {
  return enrich({ playerId: generatePlayerId(), reconnectToken: generateReconnectToken(), ...defaults, ...partial });
}
export function loadPlayerIdentity(storage: Pick<Storage, 'getItem'> = localStorage): PlayerIdentity {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (isStoredIdentity(value)) return enrich(value);
  } catch { /* replace damaged storage */ }
  return createPlayerIdentity();
}
export function savePlayerIdentity(identity: PlayerIdentity, storage: Pick<Storage, 'setItem'> = localStorage): void {
  const { playerId, reconnectToken, playerName, playerEmoji, playerColor } = identity;
  storage.setItem(KEY, JSON.stringify({ playerId, reconnectToken, playerName, playerEmoji, playerColor }));
}
export function updatePlayerIdentity(identity: PlayerIdentity, values: Pick<StoredPlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>): PlayerIdentity {
  return enrich({ ...identity, playerName: values.playerName.trim(), playerEmoji: values.playerEmoji.trim(), playerColor: values.playerColor.trim() });
}
function enrich(value: StoredPlayerIdentity): PlayerIdentity {
  return { ...value, profile: { id: value.playerId, name: value.playerName, emoji: value.playerEmoji, color: value.playerColor } };
}
function isStoredIdentity(value: unknown): value is StoredPlayerIdentity {
  return isRecord(value)
    && isBoundedString(value.playerId, PLAYER_ID_MAX_LENGTH)
    && isBoundedString(value.reconnectToken, RECONNECT_TOKEN_MAX_LENGTH)
    && isBoundedString(value.playerName, PLAYER_NAME_MAX_LENGTH, true)
    && isBoundedString(value.playerEmoji, PLAYER_EMOJI_MAX_LENGTH)
    && isBoundedString(value.playerColor, PLAYER_COLOR_MAX_LENGTH);
}
export const playerIdentityStorageKey = KEY;
