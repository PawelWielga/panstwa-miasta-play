export const PROTOCOL_VERSION = 3;
export const PEER_CONNECTION_LABEL = 'panstwa-miasta-game-v1';
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const PLAYER_NAME_MAX_LENGTH = 24;
export const PLAYER_ID_MAX_LENGTH = 64;
export const PLAYER_COLOR_MAX_LENGTH = 32;
export const PLAYER_EMOJI_MAX_LENGTH = 16;
export const RECONNECT_TOKEN_MAX_LENGTH = 128;
export const REQUEST_ID_MAX_LENGTH = 128;
export const ANSWER_MAX_LENGTH = 60;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export const HEARTBEAT_INTERVAL_MS = 2_000;
export const HOST_TIMEOUT_MS = 6_000;
export const CONNECT_TIMEOUT_MS = 10_000;
export const AUTO_RECONNECT_WINDOW_MS = 10_000;

export const clientMessageTypes = [
  'player:hello',
  'game:ready',
  'client:heartbeat',
  'client:rejoin',
  'countries-cities:submit',
  'countries-cities:edit-answers',
] as const;

export const hostMessageTypes = [
  'room:players',
  'game:reset',
  'game:start',
  'game:error',
  'host:heartbeat',
  'host:lost',
  'host:migration-started',
  'host:migrated',
  'game:snapshot',
  'countries-cities:settings',
  'countries-cities:start-round',
  'countries-cities:deadline',
  'countries-cities:review',
  'countries-cities:vote',
  'countries-cities:review-ready',
  'countries-cities:reveal',
  'countries-cities:results',
] as const;
