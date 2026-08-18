import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  clearConnectionDiagnostics,
  getConnectionRuntimeDetails,
  getDiagnosticErrorDetails,
  recordConnectionDiagnostic,
  type ConnectionDiagnosticDetails,
} from '../diagnostics/connectionDiagnostics';
import { isHostVersionUnsupportedError } from '../config/hostCompatibility';
import { HEARTBEAT_INTERVAL_MS, HOST_TIMEOUT_MS } from '../protocol/constants';
import { isTerminalJoinError } from '../protocol/gameErrors';
import { connectionFailureCodes } from '../protocol/connectionFailure';
import { createEditAnswers, createFinalizationSubmit, createGameReady, createHeartbeat, createPlayerHello, createRejoin, createStartWheelSpin, createSubmit, createWheelSpinHoldCancelled, createWheelSpinHoldStarted } from '../protocol/outgoing';
import type { ClientMessage, CountriesCitiesWheelState, GameSnapshot, HostMessage } from '../protocol/messages';
import { wheelSpinRequestKey } from '../protocol/wheel';
import { isPeerJsAuthenticationError, PeerJsGameTransport } from '../peer/PeerJsGameTransport';
import { canAutoReconnect, reconnectDelay } from '../peer/reconnectPolicy';
import type { GameTransport, TransportState } from '../peer/transport';
import type { JoinParameters } from '../features/connection/joinParams';
import { createInitialState, gameReducer, type AppState } from '../state/gameStore';
import { loadPlayerIdentity, savePlayerIdentity, updatePlayerIdentity, type PlayerIdentity, type StoredPlayerIdentity } from '../storage/playerIdentityStorage';
import {
  removeUnfinishedMultiplayerSession,
  saveUnfinishedMultiplayerSession,
  type UnfinishedMultiplayerSession,
} from '../storage/unfinishedMultiplayerSessionStorage';
import {
  readAnswerDraft,
  removeAnswerDraft,
  saveAnswerDraft,
  type AnswerDraftScope,
  type FrozenFinalizationResponse,
} from '../storage/answerDraftStorage';

const UNFINISHED_SESSION_REFRESH_INTERVAL_MS = 60_000;
const ANSWER_DRAFT_DEBOUNCE_MS = 200;

export interface AppActions {
  updateIdentity: (values: Pick<StoredPlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>) => PlayerIdentity;
  connect: (parameters: JoinParameters, resumeSession?: UnfinishedMultiplayerSession) => Promise<void>;
  cancel: () => void;
  retry: () => void;
  toggleReady: () => void;
  startWheelSpinHold: () => void;
  cancelWheelSpinHold: () => void;
  startWheelSpin: (holdDurationMs?: number) => void;
  setAnswer: (categoryId: string, value: string) => void;
  submitAnswers: () => void;
  editAnswers: () => void;
  clearNotice: () => void;
}
interface AppContextValue { state: AppState; actions: AppActions }
const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps extends PropsWithChildren { transportFactory?: () => GameTransport }

export function AppProvider({ children, transportFactory = () => new PeerJsGameTransport() }: AppProviderProps) {
  const [initialIdentity] = useState(() => loadPlayerIdentity());
  const [state, dispatch] = useReducer(gameReducer, createInitialState(initialIdentity, null));
  const stateRef = useRef(state);
  const transportRef = useRef<GameTransport | null>(null);
  const reconnectRef = useRef({
    startedAt: 0,
    attempt: 0,
    timer: 0,
    manuallyClosed: false,
    everConnected: false,
    terminalJoinRejected: false,
  });
  const connectionAttemptRef = useRef({
    sequence: 0,
    currentId: null as string | null,
    inFlight: null as Promise<void> | null,
  });
  const unfinishedSessionRef = useRef({
    admitted: false,
    lastSeenSequenceNumber: 0,
    lastPersistedSequenceNumber: -1,
    lastPersistAttemptAt: 0,
    storageUnavailable: false,
  });
  const wheelSpinHoldRef = useRef<{ key: string; holdId: string; wheelState: CountriesCitiesWheelState } | null>(null);
  const frozenFinalizationRef = useRef<FrozenFinalizationResponse | null>(null);
  const seenFinalizationRef = useRef<{ gameId: string; roundNumber: number } | null>(null);
  const legacyFallbackSentRef = useRef<string | null>(null);
  const answerDraftTimerRef = useRef(0);
  const factoryRef = useRef(transportFactory);
  const connectInternalRef = useRef<(parameters: JoinParameters, reconnecting: boolean) => Promise<void>>(() => Promise.resolve());
  useEffect(() => { stateRef.current = state; }, [state]);

  const send = useCallback((message: ClientMessage): boolean => {
    const transport = transportRef.current;
    if (!transport) {
      recordConnectionDiagnostic('client-message.skipped', 'warning', { messageType: message.type, reason: 'transport-unavailable' });
      return false;
    }
    if (message.type !== 'client:heartbeat') {
      recordConnectionDiagnostic('client-message.send', 'info', { messageType: message.type });
    }
    try {
      transport.send(message);
      return true;
    } catch (error) {
      recordConnectionDiagnostic('client-message.send.failed', 'error', {
        messageType: message.type,
        ...getDiagnosticErrorDetails(error),
      });
      dispatch({ type: 'connection', status: 'error', error: connectionFailureCodes.gameConnectionLost });
      return false;
    }
  }, []);

  const answerDraftScope = useCallback((current: AppState, snapshot: GameSnapshot | null = current.snapshot): AnswerDraftScope | null => {
    const round = snapshot?.round;
    const target = current.joinParameters;
    if (!target || !snapshot || !round || snapshot.roomId.trim().toUpperCase() !== target.roomId.trim().toUpperCase()) return null;
    return {
      hostSessionId: target.hostSessionId,
      roomId: snapshot.roomId,
      gameId: snapshot.gameId,
      roundNumber: round.number,
      playerId: current.identity.playerId,
    };
  }, []);

  const flushCurrentAnswerDraft = useCallback((): void => {
    const current = stateRef.current;
    const scope = answerDraftScope(current);
    if (!scope || current.snapshot?.phase !== 'answering') return;
    const frozen = frozenFinalizationRef.current;
    const matchingFrozen = frozen
      && frozen.gameId === scope.gameId
      && frozen.roundNumber === scope.roundNumber
      ? frozen
      : undefined;
    saveAnswerDraft({ scope, answers: current.answers, ...(matchingFrozen ? { frozenFinalization: matchingFrozen } : {}) });
  }, [answerDraftScope]);

  const clearAnswerDraftForState = useCallback((current: AppState): void => {
    const scope = answerDraftScope(current);
    if (scope) removeAnswerDraft(scope);
    frozenFinalizationRef.current = null;
    seenFinalizationRef.current = null;
    legacyFallbackSentRef.current = null;
    window.clearTimeout(answerDraftTimerRef.current);
    answerDraftTimerRef.current = 0;
  }, [answerDraftScope]);

  const handleSnapshotAnswerLifecycle = useCallback((snapshot: GameSnapshot): Record<string, string> | null => {
    const current = stateRef.current;
    const previousSnapshot = current.snapshot;
    const previousSequence = previousSnapshot?.sequenceNumber;
    if ((previousSequence !== undefined && snapshot.sequenceNumber <= previousSequence)
      || snapshot.sequenceNumber < current.lastSeenSequenceNumber) return null;

    const playerId = current.identity.playerId;
    if (!snapshot.players.some((player) => player.profile.id === playerId)) return null;
    const previousScope = answerDraftScope(current, previousSnapshot);
    const nextScope = answerDraftScope(current, snapshot);
    const roundChanged = previousSnapshot?.gameId !== undefined
      && (previousSnapshot.gameId !== snapshot.gameId
        || previousSnapshot.round?.number !== snapshot.round?.number);
    if (roundChanged && previousScope) {
      removeAnswerDraft(previousScope);
      frozenFinalizationRef.current = null;
      seenFinalizationRef.current = null;
      legacyFallbackSentRef.current = null;
    }

    const stored = nextScope ? readAnswerDraft(nextScope) : null;
    const sameCurrentRound = previousSnapshot?.gameId === snapshot.gameId
      && previousSnapshot.round?.number === snapshot.round?.number;
    const restorableAnswers = snapshot.phase === 'answering'
      && !snapshot.donePlayerIds.includes(playerId)
      && !current.hasLocalAnswerDraft
      ? stored?.answers ?? null
      : null;

    const finalization = snapshot.answerFinalization;
    if (finalization && nextScope && snapshot.phase === 'answering' && snapshot.round) {
      seenFinalizationRef.current = { gameId: snapshot.gameId, roundNumber: snapshot.round.number };
      if (!snapshot.donePlayerIds.includes(playerId)) {
        const inMemory = frozenFinalizationRef.current;
        const storedFrozen = stored?.frozenFinalization;
        const existingFrozen = inMemory
          && inMemory.gameId === snapshot.gameId
          && inMemory.roundNumber === snapshot.round.number
          && inMemory.finalizationId === finalization.id
          ? inMemory
          : storedFrozen
            && storedFrozen.gameId === snapshot.gameId
            && storedFrozen.roundNumber === snapshot.round.number
            && storedFrozen.finalizationId === finalization.id
            ? storedFrozen
            : null;
        const ownSubmission = snapshot.submissions[playerId]?.answers;
        const answers = existingFrozen?.answers
          ?? (sameCurrentRound && current.hasLocalAnswerDraft ? current.answers : null)
          ?? stored?.answers
          ?? ownSubmission
          ?? current.answers;
        try {
          const message = existingFrozen
            ? createFinalizationSubmit(current.identity.profile, existingFrozen.answers, existingFrozen.roundNumber, existingFrozen.finalizationId, existingFrozen.requestId)
            : createFinalizationSubmit(current.identity.profile, answers, snapshot.round.number, finalization.id);
          const frozen: FrozenFinalizationResponse = existingFrozen ?? {
            gameId: snapshot.gameId,
            roundNumber: snapshot.round.number,
            finalizationId: finalization.id,
            requestId: message.requestId ?? '',
            answers: { ...answers },
          };
          if (!frozen.requestId) throw new Error('Brak requestId finalizacji.');
          frozenFinalizationRef.current = frozen;
          saveAnswerDraft({ scope: nextScope, answers: frozen.answers, frozenFinalization: frozen });
          send(message);
        } catch (error) {
          recordConnectionDiagnostic('answer-finalization.prepare.failed', 'error', getDiagnosticErrorDetails(error));
        }
      }
    }

    const enteringReview = snapshot.phase === 'categoryReview'
      && previousSnapshot?.phase === 'answering'
      && previousSnapshot.gameId === snapshot.gameId
      && previousSnapshot.round?.number === snapshot.round?.number;
    if (enteringReview && previousScope) {
      const previousStored = readAnswerDraft(previousScope);
      const finalizationWasSeen = (seenFinalizationRef.current?.gameId === snapshot.gameId
        && seenFinalizationRef.current.roundNumber === snapshot.round?.number)
        || previousStored?.frozenFinalization !== undefined;
      const fallbackKey = JSON.stringify([snapshot.gameId, snapshot.round?.number, playerId]);
      if (!finalizationWasSeen
        && !snapshot.donePlayerIds.includes(playerId)
        && legacyFallbackSentRef.current !== fallbackKey) {
        legacyFallbackSentRef.current = fallbackKey;
        const answers = current.hasLocalAnswerDraft ? current.answers : previousStored?.answers ?? current.answers;
        try {
          send(createSubmit(current.identity.profile, answers));
        } catch (error) {
          recordConnectionDiagnostic('legacy-finalization.submit.failed', 'error', getDiagnosticErrorDetails(error));
        }
      }
      removeAnswerDraft(previousScope);
      frozenFinalizationRef.current = null;
      seenFinalizationRef.current = null;
    } else if (snapshot.phase === 'gameFinished' && previousScope) {
      removeAnswerDraft(previousScope);
      frozenFinalizationRef.current = null;
      seenFinalizationRef.current = null;
      legacyFallbackSentRef.current = null;
    }

    return restorableAnswers;
  }, [answerDraftScope, send]);

  const removeCurrentUnfinishedSession = useCallback((): void => {
    const currentState = stateRef.current;
    if (currentState.joinParameters) {
      removeUnfinishedMultiplayerSession(currentState.joinParameters, currentState.identity.playerId);
    }
    const lifecycle = unfinishedSessionRef.current;
    lifecycle.admitted = false;
    lifecycle.lastSeenSequenceNumber = 0;
    lifecycle.lastPersistedSequenceNumber = -1;
    lifecycle.lastPersistAttemptAt = 0;
  }, []);

  const persistCurrentUnfinishedSession = useCallback((now: number, force = false): void => {
    const lifecycle = unfinishedSessionRef.current;
    const currentState = stateRef.current;
    const target = currentState.joinParameters;
    if (!lifecycle.admitted || lifecycle.storageUnavailable || !target) return;
    if (!force
      && lifecycle.lastSeenSequenceNumber <= lifecycle.lastPersistedSequenceNumber
      && now - lifecycle.lastPersistAttemptAt < UNFINISHED_SESSION_REFRESH_INTERVAL_MS) return;

    lifecycle.lastPersistAttemptAt = now;
    const saved = saveUnfinishedMultiplayerSession({
      target,
      playerId: currentState.identity.playerId,
      reconnectToken: currentState.identity.reconnectToken,
      lastSeenSequenceNumber: lifecycle.lastSeenSequenceNumber,
      lastUsedAt: now,
    });
    if (!saved) {
      lifecycle.storageUnavailable = true;
      recordConnectionDiagnostic('unfinished-session.storage-unavailable', 'warning');
      return;
    }
    lifecycle.lastPersistedSequenceNumber = Math.max(
      lifecycle.lastPersistedSequenceNumber,
      lifecycle.lastSeenSequenceNumber,
    );
  }, []);

  const handleMessage = useCallback((message: HostMessage): void => {
    const receivedAt = Date.now();
    const snapshot = snapshotFromHostMessage(message);
    const restoredAnswers = snapshot ? handleSnapshotAnswerLifecycle(snapshot) : null;
    if (message.type === 'game:reset') clearAnswerDraftForState(stateRef.current);
    if (message.type !== 'host:heartbeat') {
      recordConnectionDiagnostic('host-message.received', 'info', hostMessageDiagnosticDetails(message));
    }

    const lifecycle = unfinishedSessionRef.current;
    const sequenceNumber = hostMessageSequenceNumber(message);
    if (sequenceNumber !== null) {
      lifecycle.lastSeenSequenceNumber = Math.max(lifecycle.lastSeenSequenceNumber, sequenceNumber);
    }

    if (isTerminalJoinError(message)) {
      const current = reconnectRef.current;
      current.terminalJoinRejected = true;
      window.clearTimeout(current.timer);
      current.timer = 0;
      removeCurrentUnfinishedSession();
      recordConnectionDiagnostic('join.rejected', 'warning', { code: message.code });
      transportRef.current?.close();
    } else {
      if (!lifecycle.admitted && hostMessageAdmitsPlayer(message, stateRef.current.identity.playerId)) {
        lifecycle.admitted = true;
        recordConnectionDiagnostic('unfinished-session.admitted', 'info', {
          lastSeenSequenceNumber: lifecycle.lastSeenSequenceNumber,
        });
        persistCurrentUnfinishedSession(receivedAt, true);
      } else if (lifecycle.admitted) {
        persistCurrentUnfinishedSession(receivedAt);
      }
    }
    dispatch({ type: 'host-message', message, receivedAt });
    if (restoredAnswers) dispatch({ type: 'restore-draft', answers: restoredAnswers });
  }, [clearAnswerDraftForState, handleSnapshotAnswerLifecycle, persistCurrentUnfinishedSession, removeCurrentUnfinishedSession]);

  const scheduleReconnect = useCallback((): void => {
    const current = reconnectRef.current;
    const parameters = stateRef.current.joinParameters;
    if (current.terminalJoinRejected) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', { reason: 'terminal-join-rejection' });
      return;
    }
    if (stateRef.current.connectionError === connectionFailureCodes.unsupportedVersion) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', { reason: 'host-version-unsupported' });
      return;
    }
    if (current.manuallyClosed || parameters === null) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', {
        reason: current.manuallyClosed ? 'manually-closed' : 'join-parameters-unavailable',
        manuallyClosed: current.manuallyClosed,
        hasJoinParameters: parameters !== null,
      });
      return;
    }
    if (connectionAttemptRef.current.inFlight !== null) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', {
        reason: 'connection-attempt-in-flight',
        connectionAttemptId: connectionAttemptRef.current.currentId,
      });
      return;
    }
    if (current.timer !== 0) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', {
        reason: 'retry-already-scheduled',
        connectionAttemptId: connectionAttemptRef.current.currentId,
      });
      return;
    }
    if (current.startedAt === 0) current.startedAt = Date.now();
    const now = Date.now();
    const elapsedMs = now - current.startedAt;
    if (!canAutoReconnect(current.startedAt, now)) {
      recordConnectionDiagnostic('reconnect.window.exhausted', 'error', {
        attempts: current.attempt,
        elapsedMs,
        online: navigator.onLine,
        lastConnectionError: stateRef.current.connectionError,
      });
      dispatch({ type: 'connection', status: 'lost', error: connectionFailureCodes.gameConnectionLost });
      return;
    }
    const delayMs = reconnectDelay(current.attempt);
    recordConnectionDiagnostic('reconnect.scheduled', 'warning', {
      nextAttempt: current.attempt + 1,
      delayMs,
      elapsedMs,
      online: navigator.onLine,
      visibility: document.visibilityState,
    });
    dispatch({ type: 'connection', status: 'reconnecting' });
    current.timer = window.setTimeout(() => {
      current.timer = 0;
      if (current.manuallyClosed || current.terminalJoinRejected || connectionAttemptRef.current.inFlight !== null) {
        recordConnectionDiagnostic('reconnect.timer.cancelled', 'info', {
          reason: current.manuallyClosed
            ? 'manually-closed'
            : current.terminalJoinRejected
              ? 'terminal-join-rejection'
              : 'connection-attempt-in-flight',
        });
        return;
      }
      current.attempt += 1;
      recordConnectionDiagnostic('reconnect.attempt.started', 'warning', { attempt: current.attempt });
      void connectInternalRef.current(parameters, true);
    }, delayMs);
  }, []);

  const onTransportState = useCallback((transportState: TransportState, connectionAttemptId: string): void => {
    recordConnectionDiagnostic('transport.state.changed', transportState === 'error' || transportState === 'closed' ? 'warning' : 'info', {
      connectionAttemptId,
      transportState,
      manuallyClosed: reconnectRef.current.manuallyClosed,
    });
    if ((transportState === 'closed' || transportState === 'error') && !reconnectRef.current.manuallyClosed) scheduleReconnect();
  }, [scheduleReconnect]);

  const connectInternal = useCallback((parameters: JoinParameters, reconnecting: boolean): Promise<void> => {
    const existingAttempt = connectionAttemptRef.current.inFlight;
    if (existingAttempt !== null) {
      recordConnectionDiagnostic('connection.attempt.deduplicated', 'warning', {
        connectionAttemptId: connectionAttemptRef.current.currentId,
        reconnecting,
      });
      return existingAttempt;
    }

    const current = reconnectRef.current;
    current.manuallyClosed = false;
    window.clearTimeout(current.timer);
    current.timer = 0;
    connectionAttemptRef.current.sequence += 1;
    const connectionAttemptId = createConnectionAttemptId(connectionAttemptRef.current.sequence);
    connectionAttemptRef.current.currentId = connectionAttemptId;
    recordConnectionDiagnostic('connection.attempt.started', reconnecting ? 'warning' : 'info', {
      connectionAttemptId,
      reconnecting,
      attempt: current.attempt,
      ...getConnectionRuntimeDetails(parameters.roomId),
    });
    stateRef.current = { ...stateRef.current, joinParameters: parameters };
    dispatch({ type: 'join-parameters', parameters });
    dispatch({ type: 'connection', status: reconnecting ? 'reconnecting' : 'connecting' });

    const previousTransport = transportRef.current;
    transportRef.current = null;
    previousTransport?.close();
    const transport = factoryRef.current();
    transportRef.current = transport;
    const isCurrentAttempt = (): boolean =>
      connectionAttemptRef.current.currentId === connectionAttemptId
      && transportRef.current === transport
      && !reconnectRef.current.manuallyClosed
      && !reconnectRef.current.terminalJoinRejected;

    let handshakeSent = false;
    const sendInitialHandshake = (): void => {
      if (handshakeSent || !isCurrentAttempt()) return;
      try {
        const currentState = stateRef.current;
        transport.send(createPlayerHello({
          profile: currentState.identity.profile,
          reconnectToken: currentState.identity.reconnectToken,
        }));
        recordConnectionDiagnostic('client-message.send', 'info', {
          connectionAttemptId,
          messageType: 'player:hello',
          trigger: 'transport-open',
        });
        if (reconnecting || current.everConnected) {
          transport.send(createRejoin(currentState.identity.profile, currentState.lastSeenSequenceNumber));
          recordConnectionDiagnostic('client-message.send', 'info', {
            connectionAttemptId,
            messageType: 'client:rejoin',
            lastSeenSequenceNumber: currentState.lastSeenSequenceNumber,
            trigger: 'transport-open',
          });
        }
        handshakeSent = true;
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        recordConnectionDiagnostic('client-handshake.send.failed', 'error', {
          connectionAttemptId,
          ...getDiagnosticErrorDetails(normalizedError),
        });
        transport.close();
        throw normalizedError;
      }
    };

    let shouldReconnect = false;
    const attemptPromise = (async (): Promise<void> => {
      try {
        await transport.connect(parameters, {
          onState: (transportState) => {
            if (!isCurrentAttempt()) {
              recordConnectionDiagnostic('transport.state.ignored', 'info', {
                connectionAttemptId,
                transportState,
                reason: 'stale-attempt',
              });
              return;
            }
            if (transportState === 'open') sendInitialHandshake();
            onTransportState(transportState, connectionAttemptId);
          },
          onMessage: (message) => {
            if (isCurrentAttempt()) handleMessage(message);
            else recordConnectionDiagnostic('host-message.ignored', 'info', {
              connectionAttemptId,
              reason: 'stale-attempt',
            });
          },
          onError: (failureCode) => {
            if (!isCurrentAttempt()) {
              recordConnectionDiagnostic('transport.user-error.ignored', 'info', {
                connectionAttemptId,
                reason: 'stale-attempt',
              });
              return;
            }
            recordConnectionDiagnostic('transport.user-error', 'error', { connectionAttemptId, failureCode });
            dispatch({ type: 'connection', status: 'error', error: failureCode });
          },
        }, { connectionAttemptId });
        if (!isCurrentAttempt()) {
          recordConnectionDiagnostic('connection.attempt.result.ignored', 'info', {
            connectionAttemptId,
            reason: 'stale-attempt',
          });
          return;
        }

        current.everConnected = true;
        current.startedAt = 0;
        current.attempt = 0;
        window.clearTimeout(current.timer);
        current.timer = 0;
        recordConnectionDiagnostic('connection.established', 'info', { connectionAttemptId });
        dispatch({ type: 'connection', status: 'connected' });
      } catch (error) {
        if (!isCurrentAttempt()) {
          recordConnectionDiagnostic('connection.attempt.failure.ignored', 'info', {
            connectionAttemptId,
            reason: 'stale-or-cancelled',
            ...getDiagnosticErrorDetails(error),
          });
          return;
        }
        recordConnectionDiagnostic('connection.attempt.failed', 'error', {
          connectionAttemptId,
          reconnecting,
          attempt: current.attempt,
          ...getDiagnosticErrorDetails(error),
        });
        const permanentFailure = isHostVersionUnsupportedError(error) || isPeerJsAuthenticationError(error);
        if (permanentFailure) {
          window.clearTimeout(current.timer);
          current.timer = 0;
          removeCurrentUnfinishedSession();
        }
        shouldReconnect = !permanentFailure;
      } finally {
        if (connectionAttemptRef.current.currentId === connectionAttemptId) {
          connectionAttemptRef.current.inFlight = null;
        }
        if (shouldReconnect && isCurrentAttempt()) scheduleReconnect();
      }
    })();
    connectionAttemptRef.current.inFlight = attemptPromise;
    return attemptPromise;
  }, [handleMessage, onTransportState, removeCurrentUnfinishedSession, scheduleReconnect]);

  useEffect(() => {
    connectInternalRef.current = connectInternal;
  }, [connectInternal]);

  const connect = useCallback((parameters: JoinParameters, resumeSession?: UnfinishedMultiplayerSession): Promise<void> => {
    const existingAttempt = connectionAttemptRef.current.inFlight;
    if (existingAttempt !== null) {
      recordConnectionDiagnostic('connection.request.deduplicated', 'warning', {
        connectionAttemptId: connectionAttemptRef.current.currentId,
      });
      return existingAttempt;
    }

    clearConnectionDiagnostics();
    const previousParameters = stateRef.current.joinParameters;
    if (previousParameters
      && (previousParameters.roomId !== parameters.roomId
        || previousParameters.hostSessionId !== parameters.hostSessionId)) {
      clearAnswerDraftForState(stateRef.current);
    }
    const resumingStoredSession = resumeSession !== undefined;
    recordConnectionDiagnostic(
      resumingStoredSession ? 'connection.session.resume-requested' : 'connection.session.started',
      'info',
      getConnectionRuntimeDetails(parameters.roomId),
    );

    const lifecycle = unfinishedSessionRef.current;
    lifecycle.admitted = false;
    lifecycle.lastSeenSequenceNumber = resumeSession?.lastSeenSequenceNumber ?? 0;
    lifecycle.lastPersistedSequenceNumber = resumeSession?.lastSeenSequenceNumber ?? -1;
    lifecycle.lastPersistAttemptAt = 0;
    lifecycle.storageUnavailable = false;

    if (resumeSession) {
      const currentIdentity = stateRef.current.identity;
      const restoredIdentity: PlayerIdentity = {
        ...currentIdentity,
        playerId: resumeSession.playerId,
        reconnectToken: resumeSession.reconnectToken,
        profile: { ...currentIdentity.profile, id: resumeSession.playerId },
      };
      savePlayerIdentity(restoredIdentity);
      stateRef.current = {
        ...createInitialState(restoredIdentity, parameters),
        lastSeenSequenceNumber: resumeSession.lastSeenSequenceNumber,
      };
      dispatch({
        type: 'resume-session',
        identity: restoredIdentity,
        parameters,
        lastSeenSequenceNumber: resumeSession.lastSeenSequenceNumber,
      });
    }

    const current = reconnectRef.current;
    window.clearTimeout(current.timer);
    current.startedAt = 0;
    current.attempt = 0;
    current.timer = 0;
    current.manuallyClosed = false;
    current.everConnected = false;
    current.terminalJoinRejected = false;
    connectionAttemptRef.current.currentId = null;
    transportRef.current?.close();
    transportRef.current = null;
    return connectInternal(parameters, resumingStoredSession);
  }, [clearAnswerDraftForState, connectInternal]);

  const cancel = useCallback((): void => {
    recordConnectionDiagnostic('connection.cancelled-by-user', 'info', {
      connectionAttemptId: connectionAttemptRef.current.currentId,
    });
    const current = reconnectRef.current;
    current.manuallyClosed = true;
    current.terminalJoinRejected = false;
    window.clearTimeout(current.timer);
    current.timer = 0;
    connectionAttemptRef.current.currentId = null;
    connectionAttemptRef.current.inFlight = null;
    const transport = transportRef.current;
    transportRef.current = null;
    transport?.close();
    dispatch({ type: 'connection', status: 'closed' });
  }, []);

  const retry = useCallback((): void => {
    const parameters = stateRef.current.joinParameters;
    if (reconnectRef.current.terminalJoinRejected) {
      recordConnectionDiagnostic('connection.retry.skipped', 'info', { reason: 'terminal-join-rejection' });
      return;
    }
    if (stateRef.current.connectionError === connectionFailureCodes.unsupportedVersion) {
      recordConnectionDiagnostic('connection.retry.skipped', 'info', { reason: 'host-version-unsupported' });
      return;
    }
    if (!parameters) {
      recordConnectionDiagnostic('connection.retry.skipped', 'warning', { reason: 'join-parameters-unavailable' });
      return;
    }
    if (connectionAttemptRef.current.inFlight !== null) {
      recordConnectionDiagnostic('connection.retry.skipped', 'info', {
        reason: 'connection-attempt-in-flight',
        connectionAttemptId: connectionAttemptRef.current.currentId,
      });
      return;
    }
    recordConnectionDiagnostic('connection.retry.requested', 'warning', getConnectionRuntimeDetails(parameters.roomId));
    const current = reconnectRef.current;
    window.clearTimeout(current.timer);
    current.timer = 0;
    current.startedAt = 0;
    current.attempt = 0;
    current.manuallyClosed = false;
    void connectInternal(parameters, true);
  }, [connectInternal]);

  useEffect(() => {
    window.clearTimeout(answerDraftTimerRef.current);
    answerDraftTimerRef.current = 0;
    if (state.snapshot?.phase !== 'answering' || !state.snapshot.round || !state.joinParameters) return undefined;
    answerDraftTimerRef.current = window.setTimeout(() => {
      answerDraftTimerRef.current = 0;
      flushCurrentAnswerDraft();
    }, ANSWER_DRAFT_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(answerDraftTimerRef.current);
      answerDraftTimerRef.current = 0;
    };
  }, [state.answers, state.gameId, state.joinParameters, state.snapshot?.phase, state.snapshot?.round, flushCurrentAnswerDraft]);

  useEffect(() => {
    if (state.snapshot?.phase !== 'answering' || state.deadlineAt === null) return undefined;
    const delay = Math.max(0, state.deadlineAt - Date.now());
    const timer = window.setTimeout(flushCurrentAnswerDraft, delay);
    return () => window.clearTimeout(timer);
  }, [state.deadlineAt, state.snapshot?.phase, state.snapshot?.round?.number, flushCurrentAnswerDraft]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = stateRef.current;
      if (current.connectionStatus !== 'connected') return;
      if (current.gameId) send(createHeartbeat(current.identity.playerId, current.gameId, current.lastSeenSequenceNumber));
      if (current.lastHostActivityAt > 0 && Date.now() - current.lastHostActivityAt > HOST_TIMEOUT_MS) {
        const inactivityMs = Date.now() - current.lastHostActivityAt;
        recordConnectionDiagnostic('host.activity.timeout', 'error', {
          inactivityMs,
          timeoutMs: HOST_TIMEOUT_MS,
          lastSeenSequenceNumber: current.lastSeenSequenceNumber,
        });
        transportRef.current?.close();
        scheduleReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [scheduleReconnect, send]);

  useEffect(() => {
    const resume = (reason: string): void => {
      const status = stateRef.current.connectionStatus;
      if (status !== 'lost' && status !== 'error' && status !== 'reconnecting') return;
      recordConnectionDiagnostic('browser.resume.detected', 'warning', {
        reason,
        status,
        online: navigator.onLine,
        visibility: document.visibilityState,
      });
      if (navigator.onLine) retry();
    };
    const online = (): void => resume('online');
    const pageShow = (): void => resume('pageshow');
    const pageHide = (): void => flushCurrentAnswerDraft();
    const visibility = (): void => {
      if (document.visibilityState === 'hidden') flushCurrentAnswerDraft();
      else resume('visibilitychange');
    };
    window.addEventListener('online', online);
    window.addEventListener('pageshow', pageShow);
    window.addEventListener('pagehide', pageHide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('pageshow', pageShow);
      window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [flushCurrentAnswerDraft, retry]);

  useEffect(() => () => {
    flushCurrentAnswerDraft();
    reconnectRef.current.manuallyClosed = true;
    window.clearTimeout(reconnectRef.current.timer);
    reconnectRef.current.timer = 0;
    connectionAttemptRef.current.currentId = null;
    connectionAttemptRef.current.inFlight = null;
    const transport = transportRef.current;
    transportRef.current = null;
    transport?.close();
  }, [flushCurrentAnswerDraft]);

  const updateIdentityAction = useCallback((values: Pick<StoredPlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>): PlayerIdentity => {
    const identity = updatePlayerIdentity(stateRef.current.identity, values);
    savePlayerIdentity(identity);
    stateRef.current = { ...stateRef.current, identity };
    dispatch({ type: 'identity', identity });
    return identity;
  }, []);

  const actions = useMemo<AppActions>(() => ({
    updateIdentity: updateIdentityAction,
    connect,
    cancel,
    retry,
    toggleReady: () => {
      const next = !stateRef.current.localReady;
      send(createGameReady(stateRef.current.identity.playerId, next));
      dispatch({ type: 'ready', value: next });
    },
    startWheelSpinHold: () => {
      const current = stateRef.current;
      const wheelState = current.snapshot?.wheelState;
      if (current.connectionStatus !== 'connected'
        || !wheelState
        || wheelState.phase !== 'waiting'
        || wheelState.selectedPlayerId !== current.identity.playerId
        || Date.now() >= wheelState.waitingDeadlineAt) return;
      const key = wheelSpinRequestKey(wheelState);
      if (current.pendingWheelSpinRequestKey === key || wheelSpinHoldRef.current?.key === key) return;
      const message = createWheelSpinHoldStarted(current.identity.playerId, wheelState);
      if (!send(message)) return;
      wheelSpinHoldRef.current = { key, holdId: message.holdId, wheelState };
    },
    cancelWheelSpinHold: () => {
      const activeHold = wheelSpinHoldRef.current;
      wheelSpinHoldRef.current = null;
      if (!activeHold) return;
      const current = stateRef.current;
      if (current.connectionStatus !== 'connected') return;
      send(createWheelSpinHoldCancelled(
        current.identity.playerId,
        activeHold.wheelState,
        activeHold.holdId,
      ));
    },
    startWheelSpin: (holdDurationMs) => {
      const current = stateRef.current;
      const wheelState = current.snapshot?.wheelState;
      if (current.connectionStatus !== 'connected'
        || !wheelState
        || wheelState.phase !== 'waiting'
        || wheelState.selectedPlayerId !== current.identity.playerId) return;
      const key = wheelSpinRequestKey(wheelState);
      const activeHold = wheelSpinHoldRef.current?.key === key ? wheelSpinHoldRef.current : null;
      if (Date.now() >= wheelState.waitingDeadlineAt && activeHold === null) return;
      if (current.pendingWheelSpinRequestKey === key) return;
      wheelSpinHoldRef.current = null;
      if (!send(createStartWheelSpin(current.identity.playerId, wheelState, holdDurationMs, activeHold?.holdId))) return;
      stateRef.current = { ...current, pendingWheelSpinRequestKey: key };
      dispatch({ type: 'wheel-spin-requested', key });
    },
    setAnswer: (categoryId, value) => {
      const current = stateRef.current;
      if (isAnswerEditingLocked(current)) return;
      dispatch({ type: 'answer', categoryId, value });
    },
    submitAnswers: () => {
      const current = stateRef.current;
      if (isAnswerEditingLocked(current)) return;
      try {
        const message = createSubmit(current.identity.profile, current.answers);
        if (!send(message)) return;
        flushCurrentAnswerDraft();
        dispatch({ type: 'submitted', value: true });
      } catch (error) {
        recordConnectionDiagnostic('answers.submit.failed', 'error', getDiagnosticErrorDetails(error));
      }
    },
    editAnswers: () => {
      const current = stateRef.current;
      if (isAnswerEditingLocked(current)) return;
      if (!send(createEditAnswers(current.identity.playerId))) return;
      dispatch({ type: 'submitted', value: false });
    },
    clearNotice: () => dispatch({ type: 'clear-notice' }),
  }), [cancel, connect, flushCurrentAnswerDraft, retry, send, updateIdentityAction]);

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

function snapshotFromHostMessage(message: HostMessage): GameSnapshot | null {
  if (message.type === 'game:snapshot' || message.type === 'host:migrated') return message.snapshot;
  return null;
}

function isAnswerEditingLocked(state: AppState, now = Date.now()): boolean {
  if (state.snapshot?.phase !== 'answering') return true;
  if (state.snapshot.answerFinalization) return true;
  return state.deadlineAt !== null && now >= state.deadlineAt;
}

function createConnectionAttemptId(sequence: number): string {
  return `web-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function hostMessageSequenceNumber(message: HostMessage): number | null {
  switch (message.type) {
    case 'host:heartbeat':
    case 'host:lost':
    case 'host:migration-started':
      return message.sequenceNumber;
    case 'game:snapshot':
      return message.snapshot.sequenceNumber;
    case 'host:migrated':
      return Math.max(message.sequenceNumber, message.snapshot.sequenceNumber);
    default:
      return null;
  }
}

function hostMessageAdmitsPlayer(message: HostMessage, playerId: string): boolean {
  switch (message.type) {
    case 'room:players':
      return message.players.some((player) => player.id === playerId);
    case 'game:snapshot':
    case 'host:migrated':
      return message.snapshot.players.some((player) => player.profile.id === playerId);
    default:
      return false;
  }
}

function hostMessageDiagnosticDetails(message: HostMessage): ConnectionDiagnosticDetails {
  const details: Record<string, string | number | boolean | null> = { messageType: message.type };
  if ('sequenceNumber' in message) details.sequenceNumber = message.sequenceNumber;
  if (message.type === 'game:snapshot') details.sequenceNumber = message.snapshot.sequenceNumber;
  return details;
}