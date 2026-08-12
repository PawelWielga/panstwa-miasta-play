export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface MessageMetadata {
  type: string;
  requestId?: string;
  senderId?: string;
  sentAt?: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  color: string;
  emoji: string;
}

export interface ReplicatedPlayerState {
  profile: PlayerProfile;
  joinedAt: number;
  connected: boolean;
}

export interface GameCategory {
  id: string;
  name: string;
  order: number;
}

export interface CountriesCitiesSettings {
  answerDurationSeconds: number;
  roundCount: number;
  maxPlayers: number;
  speedBonusEnabled: boolean;
}

export interface CountriesCitiesRound {
  number: number;
  letter: string;
  usedLetters: string[];
  categories: GameCategory[];
  deadlineAt: number | null;
  answeringStartedAt: number | null;
  lastCallPlayerId: string | null;
  categoryIndex: number;
}

export type CountriesCitiesWheelPhase = 'waiting' | 'spinning' | 'finished';

export interface CountriesCitiesWheelState {
  schemaVersion: 1;
  phase: CountriesCitiesWheelPhase;
  hostSessionId: string;
  roundNumber: number;
  spinId: string;
  selectedPlayerId: string;
  letterPool?: string[];
  waitingStartedAt: number;
  waitingDeadlineAt: number;
  spinStartedAt?: number;
  spinDurationMs?: number;
  spinSeed?: number;
  finalTurns?: number;
  letter?: string;
}

export interface CountriesCitiesSubmission {
  playerId: string;
  playerName: string;
  answers: Record<string, string>;
}

export interface CountriesCitiesAnswerResult {
  winner: string;
  points: number;
}

export type GamePhase =
  | 'lobby'
  | 'letterDraw'
  | 'letterReveal'
  | 'answering'
  | 'categoryReview'
  | 'categoryResults'
  | 'roundSummary'
  | 'gameFinished';

export interface GameSnapshot {
  gameId: string;
  roomId: string;
  sequenceNumber: number;
  hostPlayerId: string;
  phase: GamePhase;
  players: ReplicatedPlayerState[];
  categories: GameCategory[];
  usedLetters: string[];
  letterHistory: string[];
  round: CountriesCitiesRound | null;
  wheelState?: CountriesCitiesWheelState;
  endMode: string;
  timeMode: string;
  settings: CountriesCitiesSettings;
  hostControlsReview: boolean;
  submissions: Record<string, CountriesCitiesSubmission>;
  submittedAtByPlayerId: Record<string, number>;
  donePlayerIds: string[];
  votes: Record<string, Record<string, string>>;
  hostVoteSuggestions: Record<string, string>;
  reviewReady: Record<string, string[]>;
  finalResults: Record<string, CountriesCitiesAnswerResult>;
  roundScores: Record<string, number>;
  finalScores: Record<string, number>;
  speedBonusPlayerIds: string[];
}

export interface RoomPlayersMessage extends MessageMetadata {
  type: 'room:players';
  protocolVersion: number;
  players: PlayerProfile[];
}
export interface GameResetMessage extends MessageMetadata { type: 'game:reset' }
export interface GameStartMessage extends MessageMetadata { type: 'game:start' }
export interface GameErrorMessage extends MessageMetadata {
  type: 'game:error';
  message: string;
  code?: string;
}
export interface HostHeartbeatMessage extends MessageMetadata {
  type: 'host:heartbeat';
  gameId: string;
  sequenceNumber: number;
}
export interface HostLostMessage extends MessageMetadata {
  type: 'host:lost'; gameId: string; lostHostPlayerId: string; sequenceNumber: number;
}
export interface HostMigrationStartedMessage extends MessageMetadata {
  type: 'host:migration-started'; gameId: string; lostHostPlayerId: string; candidateHostPlayerId: string; sequenceNumber: number;
}
export interface HostMigratedMessage extends MessageMetadata {
  type: 'host:migrated'; gameId: string; newHostPlayerId: string; newHostIp: string; newHostPort: number; sequenceNumber: number; snapshot: GameSnapshot;
}
export interface GameSnapshotMessage extends MessageMetadata { type: 'game:snapshot'; snapshot: GameSnapshot }
export interface CountriesCitiesSettingsMessage extends MessageMetadata {
  type: 'countries-cities:settings'; categories: GameCategory[]; endMode: string; timeMode: string; settings: CountriesCitiesSettings; hostControlsReview: boolean;
}
export interface CountriesCitiesStartRoundMessage extends MessageMetadata {
  type: 'countries-cities:start-round'; letter: string; usedLetters: string[];
}
export interface CountriesCitiesDeadlineMessage extends MessageMetadata { type: 'countries-cities:deadline'; deadlineAt: number }
export interface CountriesCitiesReviewMessage extends MessageMetadata {
  type: 'countries-cities:review'; submissions: CountriesCitiesSubmission[]; categoryIndex: number;
}
export interface CountriesCitiesVoteMessage extends MessageMetadata { type: 'countries-cities:vote'; answerId: string; vote: string }
export interface CountriesCitiesReviewReadyMessage extends MessageMetadata { type: 'countries-cities:review-ready'; categoryIndex: number; playerId: string }
export interface CountriesCitiesRevealMessage extends MessageMetadata {
  type: 'countries-cities:reveal'; categoryIndex: number; finalResults: Record<string, CountriesCitiesAnswerResult>;
}
export interface CountriesCitiesResultsMessage extends MessageMetadata {
  type: 'countries-cities:results'; finalResults: Record<string, CountriesCitiesAnswerResult>; roundScores: Record<string, number>; finalScores: Record<string, number>;
}

export type HostMessage =
  | RoomPlayersMessage | GameResetMessage | GameStartMessage | GameErrorMessage
  | HostHeartbeatMessage | HostLostMessage | HostMigrationStartedMessage | HostMigratedMessage
  | GameSnapshotMessage | CountriesCitiesSettingsMessage | CountriesCitiesStartRoundMessage
  | CountriesCitiesDeadlineMessage | CountriesCitiesReviewMessage | CountriesCitiesVoteMessage
  | CountriesCitiesReviewReadyMessage | CountriesCitiesRevealMessage | CountriesCitiesResultsMessage;

export interface PlayerHelloMessage extends MessageMetadata {
  type: 'player:hello'; protocolVersion: number; reconnectToken: string; player: PlayerProfile;
}
export interface GameReadyMessage extends MessageMetadata { type: 'game:ready'; ready: boolean }
export interface ClientHeartbeatMessage extends MessageMetadata {
  type: 'client:heartbeat'; gameId: string; playerId: string; lastSeenSequenceNumber: number;
}
export interface ClientRejoinMessage extends MessageMetadata {
  type: 'client:rejoin'; protocolVersion: number; player: PlayerProfile; lastSeenSequenceNumber: number;
}
export interface CountriesCitiesSubmitMessage extends MessageMetadata {
  type: 'countries-cities:submit'; player: PlayerProfile; answers: Record<string, string>;
}
export interface CountriesCitiesEditAnswersMessage extends MessageMetadata {
  type: 'countries-cities:edit-answers'; playerId: string;
}
export interface CountriesCitiesWheelSpinHoldStartedMessage extends MessageMetadata {
  type: 'player:wheelSpinHoldStarted';
  hostSessionId: string;
  roundNumber: number;
  spinId: string;
  holdId: string;
}
export interface CountriesCitiesWheelSpinHoldCancelledMessage extends MessageMetadata {
  type: 'player:wheelSpinHoldCancelled';
  hostSessionId: string;
  roundNumber: number;
  spinId: string;
  holdId: string;
}
export interface CountriesCitiesStartWheelSpinMessage extends MessageMetadata {
  type: 'player:startWheelSpin';
  hostSessionId: string;
  roundNumber: number;
  spinId: string;
  holdDurationMs?: number;
  holdId?: string;
}
export type ClientMessage = PlayerHelloMessage | GameReadyMessage | ClientHeartbeatMessage | ClientRejoinMessage | CountriesCitiesSubmitMessage | CountriesCitiesEditAnswersMessage | CountriesCitiesWheelSpinHoldStartedMessage | CountriesCitiesWheelSpinHoldCancelledMessage | CountriesCitiesStartWheelSpinMessage;
