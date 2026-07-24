import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react';
import { HEARTBEAT_INTERVAL_MS, HOST_TIMEOUT_MS } from '../protocol/constants';
import { createEditAnswers, createGameReady, createHeartbeat, createPlayerHello, createRejoin, createSubmit } from '../protocol/outgoing';
import type { ClientMessage, HostMessage } from '../protocol/messages';
import { PeerJsGameTransport } from '../peer/PeerJsGameTransport';
import { canAutoReconnect, reconnectDelay } from '../peer/reconnectPolicy';
import type { GameTransport, TransportState } from '../peer/transport';
import type { JoinParameters } from '../features/connection/joinParams';
import { createInitialState, gameReducer, type AppState } from '../state/gameStore';
import { loadPlayerIdentity, savePlayerIdentity, updatePlayerIdentity, type PlayerIdentity, type StoredPlayerIdentity } from '../storage/playerIdentityStorage';

interface AppActions {
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

export interface AppProviderProps extends PropsWithChildren { transportFactory?: () => GameTransport; initialSearch?: string }

export function AppProvider({ children, transportFactory = () => new PeerJsGameTransport(), initialSearch = window.location.search }: AppProviderProps) {
  const initialIdentity = useMemo(loadPlayerIdentity, []);
  const [state, dispatch] = useReducer(gameReducer, createInitialState(initialIdentity, null));
  const stateRef = useRef(state);
  const transportRef = useRef<GameTransport | null>(null);
  const reconnectRef = useRef({ startedAt: 0, attempt: 0, timer: 0, manuallyClosed: false, everConnected: false });
  const factoryRef = useRef(transportFactory);
  useEffect(() => { stateRef.current = state; }, [state]);

  const send = useCallback((message: ClientMessage): void => {
    try { transportRef.current?.send(message); }
    catch (error) { dispatch({ type: 'connection', status: 'error', error: error instanceof Error ? error.message : 'Nie udało się wysłać wiadomości.' }); }
  }, []);

  const handleMessage = useCallback((message: HostMessage): void => {
    dispatch({ type: 'host-message', message, receivedAt: Date.now() });
  }, []);

  const scheduleReconnect = useCallback((): void => {
    const current = reconnectRef.current;
    if (current.manuallyClosed || !stateRef.current.joinParameters) return;
    if (current.startedAt === 0) current.startedAt = Date.now();
    if (!canAutoReconnect(current.startedAt, Date.now())) {
      dispatch({ type: 'connection', status: 'lost', error: 'Automatyczne ponowne łączenie nie powiodło się.' });
      return;
    }
    window.clearTimeout(current.timer);
    dispatch({ type: 'connection', status: 'reconnecting' });
    current.timer = window.setTimeout(() => {
      current.attempt += 1;
      void connectInternal(stateRef.current.joinParameters!, true);
    }, reconnectDelay(current.attempt));
  }, []);

  const onTransportState = useCallback((transportState: TransportState): void => {
    if ((transportState === 'closed' || transportState === 'error') && !reconnectRef.current.manuallyClosed) scheduleReconnect();
  }, [scheduleReconnect]);

  const connectInternal = useCallback(async (parameters: JoinParameters, reconnecting: boolean): Promise<void> => {
    const current = reconnectRef.current;
    current.manuallyClosed = false;
    dispatch({ type: 'join-parameters', parameters });
    dispatch({ type: 'connection', status: reconnecting ? 'reconnecting' : 'connecting' });
    transportRef.current?.close();
    const transport = factoryRef.current();
    transportRef.current = transport;
    try {
      await transport.connect(parameters, {
        onState: onTransportState,
        onMessage: handleMessage,
        onError: (message) => dispatch({ type: 'connection', status: 'error', error: message }),
      });
      const currentState = stateRef.current;
      transport.send(createPlayerHello({ profile: currentState.identity.profile, reconnectToken: currentState.identity.reconnectToken }, parameters.protocolVersion));
      if (reconnecting || current.everConnected) transport.send(createRejoin(currentState.identity.profile, currentState.lastSeenSequenceNumber, parameters.protocolVersion));
      current.everConnected = true;
      current.startedAt = 0;
      current.attempt = 0;
      dispatch({ type: 'connection', status: 'connected' });
    } catch {
      if (!current.manuallyClosed) scheduleReconnect();
    }
  }, [handleMessage, onTransportState, scheduleReconnect]);

  const connect = useCallback(async (parameters: JoinParameters): Promise<void> => {
    reconnectRef.current = { startedAt: 0, attempt: 0, timer: 0, manuallyClosed: false, everConnected: reconnectRef.current.everConnected };
    await connectInternal(parameters, false);
  }, [connectInternal]);

  const cancel = useCallback((): void => {
    reconnectRef.current.manuallyClosed = true;
    window.clearTimeout(reconnectRef.current.timer);
    transportRef.current?.close();
    dispatch({ type: 'connection', status: 'closed' });
  }, []);

  const retry = useCallback((): void => {
    const parameters = stateRef.current.joinParameters;
    if (!parameters) return;
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
        transportRef.current?.close();
        scheduleReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [scheduleReconnect, send]);

  useEffect(() => {
    const resume = (): void => {
      const status = stateRef.current.connectionStatus;
      if (navigator.onLine && (status === 'lost' || status === 'error' || status === 'reconnecting')) retry();
    };
    const visibility = (): void => { if (document.visibilityState === 'visible') resume(); };
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
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

  void initialSearch;
  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
