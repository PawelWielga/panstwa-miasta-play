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
import {
  HOST_VERSION_UNSUPPORTED_MESSAGE,
  isHostVersionUnsupportedError,
} from '../config/hostCompatibility';
import { HEARTBEAT_INTERVAL_MS, HOST_TIMEOUT_MS } from '../protocol/constants';
import { isTerminalJoinError } from '../protocol/gameErrors';
import { createEditAnswers, createGameReady, createHeartbeat, createPlayerHello, createRejoin, createSubmit } from '../protocol/outgoing';
import type { ClientMessage, HostMessage } from '../protocol/messages';
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

const UNFINISHED_SESSION_REFRESH_INTERVAL_MS = 60_000;

export interface AppActions {
  updateIdentity: (values: Pick<StoredPlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>) => PlayerIdentity;
  connect: (parameters: JoinParameters, resumeSession?: UnfinishedMultiplayerSession) => Promise<void>;
  cancel: () => void;
  retry: () => void;
  toggleReady: () => void;
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
  const factoryRef = useRef(transportFactory);
  const connectInternalRef = useRef<(parameters: JoinParameters, reconnecting: boolean) => Promise<void>>(() => Promise.resolve());
  useEffect(() => { stateRef.current = state; }, [state]);

  const send = useCallback((message: ClientMessage): void => {
    const transport = transportRef.current;
    if (!transport) {
      recordConnectionDiagnostic('client-message.skipped', 'warning', { messageType: message.type, reason: 'transport-unavailable' });
      return;
    }
    if (message.type !== 'client:heartbeat') {
      recordConnectionDiagnostic('client-message.send', 'info', { messageType: message.type });
    }
    try {
      transport.send(message);
    } catch (error) {
      recordConnectionDiagnostic('client-message.send.failed', 'error', {
        messageType: message.type,
        ...getDiagnosticErrorDetails(error),
      });
      dispatch({ type: 'connection', status: 'error', error: error instanceof Error ? error.message : 'Nie udało się wysłać wiadomości.' });
    }
  }, []);

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
  }, [persistCurrentUnfinishedSession, removeCurrentUnfinishedSession]);

  const scheduleReconnect = useCallback((): void => {
    const current = reconnectRef.current;
    const parameters = stateRef.current.joinParameters;
    if (current.terminalJoinRejected) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', { reason: 'terminal-join-rejection' });
      return;
    }
    if (stateRef.current.connectionError === HOST_VERSION_UNSUPPORTED_MESSAGE) {
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
      dispatch({ type: 'connection', status: 'lost', error: 'Automatyczne ponowne łączenie nie powiodło się.' });
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
          onError: (message) => {
            if (!isCurrentAttempt()) {
              recordConnectionDiagnostic('transport.user-error.ignored', 'info', {
                connectionAttemptId,
                reason: 'stale-attempt',
              });
              return;
            }
            recordConnectionDiagnostic('transport.user-error', 'error', { connectionAttemptId, userMessage: message });
            dispatch({ type: 'connection', status: 'error', error: message });
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
        if (permanentFailure) removeCurrentUnfinishedSession();
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
  }, [connectInternal]);

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
    if (stateRef.current.connectionError === HOST_VERSION_UNSUPPORTED_MESSAGE) {
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
    const visibility = (): void => { if (document.visibilityState === 'visible') resume('visibilitychange'); };
    window.addEventListener('online', online);
    window.addEventListener('pageshow', pageShow);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('pageshow', pageShow);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [retry]);

  useEffect(() => () => {
    reconnectRef.current.manuallyClosed = true;
    window.clearTimeout(reconnectRef.current.timer);
    reconnectRef.current.timer = 0;
    connectionAttemptRef.current.currentId = null;
    connectionAttemptRef.current.inFlight = null;
    const transport = transportRef.current;
    transportRef.current = null;
    transport?.close();
  }, []);

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
    setAnswer: (categoryId, value) => dispatch({ type: 'answer', categoryId, value }),
    submitAnswers: () => {
      const current = stateRef.current;
      send(createSubmit(current.identity.profile, current.answers));
      dispatch({ type: 'submitted', value: true });
    },
    editAnswers: () => {
      const current = stateRef.current;
      send(createEditAnswers(current.identity.playerId));
      dispatch({ type: 'submitted', value: false });
    },
    clearNotice: () => dispatch({ type: 'clear-notice' }),
  }), [cancel, connect, retry, send, updateIdentityAction]);

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
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
