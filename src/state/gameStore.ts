import type { JoinParameters } from '../features/connection/joinParams';
import { isTerminalJoinError } from '../protocol/gameErrors';
import { connectionFailureCodeForGameError, type ConnectionFailureCode } from '../protocol/connectionFailure';
import type {
  CountriesCitiesAnswerResult, CountriesCitiesSettings, CountriesCitiesSubmission,
  GameCategory, GameSnapshot, HostMessage, PlayerProfile,
} from '../protocol/messages';
import { wheelSpinRequestKey } from '../protocol/wheel';
import type { PlayerIdentity } from '../storage/playerIdentityStorage';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'lost' | 'error' | 'closed';

export interface AppState {
  identity: PlayerIdentity;
  joinParameters: JoinParameters | null;
  connectionStatus: ConnectionStatus;
  connectionError: ConnectionFailureCode | null;
  players: PlayerProfile[];
  snapshot: GameSnapshot | null;
  categories: GameCategory[];
  settings: CountriesCitiesSettings | null;
  hostControlsReview: boolean;
  currentLetter: string | null;
  deadlineAt: number | null;
  reviewSubmissions: CountriesCitiesSubmission[];
  reviewCategoryIndex: number;
  revealResults: Record<string, CountriesCitiesAnswerResult>;
  roundScores: Record<string, number>;
  finalScores: Record<string, number>;
  answers: Record<string, string>;
  answersSubmitted: boolean;
  localReady: boolean;
  pendingWheelSpinRequestKey: string | null;
  lastHostActivityAt: number;
  lastSeenSequenceNumber: number;
  gameId: string | null;
  notice: string | null;
}

export type AppAction =
  | { type: 'identity'; identity: PlayerIdentity }
  | { type: 'join-parameters'; parameters: JoinParameters }
  | { type: 'resume-session'; identity: PlayerIdentity; parameters: JoinParameters; lastSeenSequenceNumber: number }
  | { type: 'connection'; status: ConnectionStatus; error?: ConnectionFailureCode | null }
  | { type: 'host-message'; message: HostMessage; receivedAt: number }
  | { type: 'answer'; categoryId: string; value: string }
  | { type: 'submitted'; value: boolean }
  | { type: 'ready'; value: boolean }
  | { type: 'wheel-spin-requested'; key: string }
  | { type: 'clear-notice' };

export function createInitialState(identity: PlayerIdentity, joinParameters: JoinParameters | null): AppState {
  return {
    identity, joinParameters, connectionStatus: 'idle', connectionError: null, players: [], snapshot: null,
    categories: [], settings: null, hostControlsReview: true, currentLetter: null, deadlineAt: null,
    reviewSubmissions: [], reviewCategoryIndex: 0, revealResults: {}, roundScores: {}, finalScores: {},
    answers: {}, answersSubmitted: false, localReady: false, pendingWheelSpinRequestKey: null,
    lastHostActivityAt: 0, lastSeenSequenceNumber: 0, gameId: null, notice: null,
  };
}

export function gameReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'identity': return { ...state, identity: action.identity };
    case 'join-parameters': return { ...state, joinParameters: action.parameters };
    case 'resume-session': return {
      ...createInitialState(action.identity, action.parameters),
      lastSeenSequenceNumber: action.lastSeenSequenceNumber,
    };
    case 'connection': return { ...state, connectionStatus: action.status, connectionError: action.error ?? null };
    case 'answer': return { ...state, answers: { ...state.answers, [action.categoryId]: action.value } };
    case 'submitted': return { ...state, answersSubmitted: action.value };
    case 'ready': return { ...state, localReady: action.value };
    case 'wheel-spin-requested': return { ...state, pendingWheelSpinRequestKey: action.key };
    case 'clear-notice': return { ...state, notice: null };
    case 'host-message': return reduceHostMessage(state, action.message, action.receivedAt);
  }
}

function reduceHostMessage(state: AppState, message: HostMessage, receivedAt: number): AppState {
  const active = { ...state, lastHostActivityAt: receivedAt };
  switch (message.type) {
    case 'room:players': return { ...active, players: message.players };
    case 'game:error': return isTerminalJoinError(message)
      ? { ...active, connectionStatus: 'error', connectionError: connectionFailureCodeForGameError(message.code), notice: null }
      : { ...active, notice: message.message };
    case 'host:heartbeat': return { ...active, gameId: message.gameId, lastSeenSequenceNumber: Math.max(state.lastSeenSequenceNumber, message.sequenceNumber) };
    case 'game:snapshot': return applySnapshot(active, message.snapshot);
    case 'host:migrated': return { ...applySnapshot(active, message.snapshot), notice: 'Host gry został zmieniony.' };
    case 'host:lost': return { ...active, notice: 'Połączenie z hostem zostało utracone.' };
    case 'host:migration-started': return { ...active, notice: 'Trwa próba zmiany hosta gry.' };
    case 'game:reset': return { ...active, snapshot: null, currentLetter: null, deadlineAt: null, answers: {}, answersSubmitted: false, localReady: false, pendingWheelSpinRequestKey: null, revealResults: {}, roundScores: {}, finalScores: {}, notice: 'Host przygotowuje nową grę.' };
    case 'game:start': return { ...active, localReady: false, notice: null };
    case 'countries-cities:settings': return { ...active, categories: message.categories, settings: message.settings, hostControlsReview: message.hostControlsReview };
    case 'countries-cities:start-round': return { ...active, currentLetter: message.letter, answers: {}, answersSubmitted: false, revealResults: {}, roundScores: {}, notice: null };
    case 'countries-cities:deadline': return { ...active, deadlineAt: message.deadlineAt };
    case 'countries-cities:review': return { ...active, reviewSubmissions: message.submissions, reviewCategoryIndex: message.categoryIndex };
    case 'countries-cities:vote': return active;
    case 'countries-cities:review-ready': return active;
    case 'countries-cities:reveal': return { ...active, reviewCategoryIndex: message.categoryIndex, revealResults: message.finalResults };
    case 'countries-cities:results': return { ...active, revealResults: message.finalResults, roundScores: message.roundScores, finalScores: message.finalScores };
  }
}

function applySnapshot(state: AppState, snapshot: GameSnapshot): AppState {
  const previousRound = state.snapshot?.round?.number;
  const nextRound = snapshot.round?.number;
  const roundChanged = previousRound !== undefined && nextRound !== previousRound;
  const ownSubmission = snapshot.submissions[state.identity.playerId];
  const categories = snapshot.round?.categories ?? snapshot.categories;
  const restoredAnswers = ownSubmission?.answers ?? state.answers;
  const waitingWheelRequestKey = snapshot.wheelState?.phase === 'waiting'
    ? wheelSpinRequestKey(snapshot.wheelState)
    : null;
  return {
    ...state,
    snapshot,
    players: snapshot.players.map((player) => player.profile),
    categories,
    settings: snapshot.settings,
    hostControlsReview: snapshot.hostControlsReview,
    currentLetter: snapshot.round?.letter ?? null,
    deadlineAt: snapshot.round?.deadlineAt ?? null,
    reviewSubmissions: Object.values(snapshot.submissions),
    reviewCategoryIndex: snapshot.round?.categoryIndex ?? 0,
    revealResults: snapshot.finalResults,
    roundScores: snapshot.roundScores,
    finalScores: snapshot.finalScores,
    answers: roundChanged ? (ownSubmission?.answers ?? {}) : restoredAnswers,
    answersSubmitted: snapshot.donePlayerIds.includes(state.identity.playerId) || ownSubmission !== undefined,
    pendingWheelSpinRequestKey: state.pendingWheelSpinRequestKey === waitingWheelRequestKey
      ? state.pendingWheelSpinRequestKey
      : null,
    lastSeenSequenceNumber: Math.max(state.lastSeenSequenceNumber, snapshot.sequenceNumber),
    gameId: snapshot.gameId,
  };
}
