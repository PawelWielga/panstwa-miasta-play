export {
  PEER_JS_GAME_CONNECTION_LABEL as PEER_CONNECTION_LABEL,
  PEER_JS_MAX_MESSAGE_BYTES as MAX_MESSAGE_BYTES,
  PEER_JS_ONLINE_PROTOCOL_VERSION,
} from '../peer/peerJsContract';

export const SUPPORTED_GAME_PROTOCOL_VERSION = 3;
export const PLAYER_NAME_MAX_LENGTH = 24;
export const PLAYER_ID_MAX_LENGTH = 64;
export const PLAYER_COLOR_MAX_LENGTH = 32;
export const PLAYER_EMOJI_MAX_LENGTH = 16;
export const RECONNECT_TOKEN_MAX_LENGTH = 128;
export const REQUEST_ID_MAX_LENGTH = 128;
export const ANSWER_MAX_LENGTH = 60;
export const CATEGORY_NAME_MAX_LENGTH = 64;
export const CATEGORY_ID_MAX_LENGTH = 64;
export const MAX_COUNTRIES_CITIES_CATEGORIES = 30;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
export const HEARTBEAT_INTERVAL_MS = 2_000;
export const HOST_TIMEOUT_MS = 6_000;
export const CONNECT_TIMEOUT_MS = 15_000;
export const AUTO_RECONNECT_WINDOW_MS = 10_000;
export const SNAPSHOT_CHUNK_RAW_BYTES = 45 * 1024;
export const SNAPSHOT_CHUNK_PAYLOAD_MAX_LENGTH = 62 * 1024;
export const MAX_SNAPSHOT_BYTES = 1024 * 1024;
export const MAX_SNAPSHOT_CHUNK_COUNT = Math.ceil(MAX_SNAPSHOT_BYTES / SNAPSHOT_CHUNK_RAW_BYTES);
export const SNAPSHOT_CHUNK_ASSEMBLY_TIMEOUT_MS = 30_000;
export const MAX_ACTIVE_SNAPSHOT_CHUNK_ASSEMBLIES = 4;

export const clientMessageTypes = [
  'player:hello',
  'game:ready',
  'client:heartbeat',
  'client:rejoin',
  'countries-cities:submit',
  'countries-cities:edit-answers',
  'player:startWheelSpin',
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
  'game:snapshot-chunk',
  'countries-cities:settings',
  'countries-cities:start-round',
  'countries-cities:deadline',
  'countries-cities:review',
  'countries-cities:vote',
  'countries-cities:review-ready',
  'countries-cities:reveal',
  'countries-cities:results',
] as const;
