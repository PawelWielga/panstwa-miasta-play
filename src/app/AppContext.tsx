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
import { HEARTBEAT_INTERVAL_MS, HOST_TIMEOUT_MS } from '../protocol/constants';
import { createEditAnswers, createGameReady, createHeartbeat, createPlayerHello, createRejoin, createSubmit } from '../protocol/outgoing';
import type { ClientMessage, HostMessage } from '../protocol/messages';
import { PeerJsGameTransport } from '../peer/PeerJsGameTransport';
import { canAutoReconnect, reconnectDelay } from '../peer/reconnectPolicy';
import type { GameTransport, TransportState } from '../peer/transport';
import type { JoinParameters } from '../features/connection/joinParams';
import { createInitialState, gameReducer, type AppState } from '../state/gameStore';
import { loadPlayerIdentity, savePlayerIdentity, updatePlayerIdentity, type PlayerIdentity, type StoredPlayerIdentity } from '../storage/playerIdentityStorage';

export interface AppActions {
  updateIdentity: (values: Pick<StoredPlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>) => PlayerIdentity;
  connect: (parameters: JoinParameters) => Promise<void>;
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
  const reconnectRef = useRef({ startedAt: 0, attempt: 0, timer: 0, manuallyClosed: false, everConnected: false });
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

  const handleMessage = useCallback((message: HostMessage): void => {
    if (message.type !== 'host:heartbeat') {
      recordConnectionDiagnostic('host-message.received', 'info', hostMessageDiagnosticDetails(message));
    }
    dispatch({ type: 'host-message', message, receivedAt: Date.now() });
  }, []);

  const scheduleReconnect = useCallback((): void => {
    const current = reconnectRef.current;
    const parameters = stateRef.current.joinParameters;
    if (current.manuallyClosed || parameters === null) {
      recordConnectionDiagnostic('reconnect.skipped', 'info', {
        manuallyClosed: current.manuallyClosed,
        hasJoinParameters: parameters !== null,
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
    window.clearTimeout(current.timer);
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
      current.attempt += 1;
      recordConnectionDiagnostic('reconnect.attempt.started', 'warning', { attempt: current.attempt });
      void connectInternalRef.current(parameters, true);
    }, delayMs);
  }, []);

  const onTransportState = useCallback((transportState: TransportState): void => {
    recordConnectionDiagnostic('transport.state.changed', transportState === 'error' || transportState === 'closed' ? 'warning' : 'info', {
      transportState,
      manuallyClosed: reconnectRef.current.manuallyClosed,
    });
    if ((transportState === 'closed' || transportState === 'error') && !reconnectRef.current.manuallyClosed) scheduleReconnect();
  }, [scheduleReconnect]);

  const connectInternal = useCallback(async (parameters: JoinParameters, reconnecting: boolean): Promise<void> => {
    const current = reconnectRef.current;
    current.manuallyClosed = false;
    recordConnectionDiagnostic('connection.attempt.started', reconnecting ? 'warning' : 'info', {
      reconnecting,
      attempt: current.attempt,
      ...getConnectionRuntimeDetails(parameters.roomId),
    });
    dispatch({ type: 'join-parameters', parameters });
    dispatch({ type: 'connection', status: reconnecting ? 'reconnecting' : 'connecting' });
    transportRef.current?.close();
    const transport = factoryRef.current();
    transportRef.current = transport;
    try {
      await transport.connect(parameters, {
        onState: onTransportState,
        onMessage: handleMessage,
        onError: (message) => {
          recordConnectionDiagnostic('transport.user-error', 'error', { userMessage: message });
          dispatch({ type: 'connection', status: 'error', error: message });
        },
      });
      const currentState = stateRef.current;
      transport.send(createPlayerHello({ profile: currentState.identity.profile, reconnectToken: currentState.identity.reconnectToken }));
      recordConnectionDiagnostic('client-message.send', 'info', { messageType: 'player:hello' });
      if (reconnecting || current.everConnected) {
        transport.send(createRejoin(currentState.identity.profile, currentState.lastSeenSequenceNumber));
        recordConnectionDiagnostic('client-message.send', 'info', {
          messageType: 'client:rejoin',
          lastSeenSequenceNumber: currentState.lastSeenSequenceNumber,
        });
      }
      current.everConnected = true;
      current.startedAt = 0;
      current.attempt = 0;
      recordConnectionDiagnostic('connection.established');
      dispatch({ type: 'connection', status: 'connected' });
    } catch (error) {
      recordConnectionDiagnostic('connection.attempt.failed', 'error', {
        reconnecting,
        attempt: current.attempt,
        ...getDiagnosticErrorDetails(error),
      });
      scheduleReconnect();
    }
  }, [handleMessage, onTransportState, scheduleReconnect]);

  useEffect(() => {
    connectInternalRef.current = connectInternal;
  }, [connectInternal]);

  const connect = useCallback(async (parameters: JoinParameters): Promise<void> => {
    clearConnectionDiagnostics();
    recordConnectionDiagnostic('connection.session.started', 'info', getConnectionRuntimeDetails(parameters.roomId));
    reconnectRef.current = { startedAt: 0, attempt: 0, timer: 0, manuallyClosed: false, everConnected: reconnectRef.current.everConnected };
    await connectInternal(parameters, false);
  }, [connectInternal]);

  const cancel = useCallback((): void => {
    recordConnectionDiagnostic('connection.cancelled-by-user');
    reconnectRef.current.manuallyClosed = true;
    window.clearTimeout(reconnectRef.current.timer);
    transportRef.current?.close();
    dispatch({ type: 'connection', status: 'closed' });
  }, []);

  const retry = useCallback((): void => {
    const parameters = stateRef.current.joinParameters;
    if (!parameters) {
      recordConnectionDiagnostic('connection.retry.skipped', 'warning', { reason: 'join-parameters-unavailable' });
      return;
    }
    recordConnectionDiagnostic('connection.retry.requested', 'warning', getConnectionRuntimeDetails(parameters.roomId));
    reconnectRef.current.startedAt = 0;
    reconnectRef.current.attempt = 0;
    reconnectRef.current.manuallyClosed = false;
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
    transportRef.current?.close();
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

function hostMessageDiagnosticDetails(message: HostMessage): ConnectionDiagnosticDetails {
  const details: Record<string, string | number | boolean | null> = { messageType: message.type };
  if ('sequenceNumber' in message) details.sequenceNumber = message.sequenceNumber;
  if (message.type === 'game:snapshot') details.sequenceNumber = message.snapshot.sequenceNumber;
  return details;
}
