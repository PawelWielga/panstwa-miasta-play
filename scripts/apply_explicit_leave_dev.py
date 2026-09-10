from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected marker once, found {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, content: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if marker in text:
        raise RuntimeError(f'{path}: content already present: {marker}')
    file.write_text(text.rstrip() + '\n\n' + content.strip() + '\n', encoding='utf-8')


replace_once(
    'src/protocol/constants.ts',
    "  'client:room-closed-ack',\n  'client:rejoin',",
    "  'client:room-closed-ack',\n  'client:leave',\n  'client:rejoin',",
)

replace_once(
    'src/protocol/messages.ts',
    "export interface ClientRoomClosedAcknowledgementMessage extends MessageMetadata {\n  type: 'client:room-closed-ack'; gameId: string; shutdownId: string; playerId: string;\n}\nexport interface ClientRejoinMessage extends MessageMetadata {",
    "export interface ClientRoomClosedAcknowledgementMessage extends MessageMetadata {\n  type: 'client:room-closed-ack'; gameId: string; shutdownId: string; playerId: string;\n}\nexport interface ClientLeaveMessage extends MessageMetadata {\n  type: 'client:leave'; roomId: string; hostSessionId: string; playerId: string;\n}\nexport interface ClientRejoinMessage extends MessageMetadata {",
)
replace_once(
    'src/protocol/messages.ts',
    "export type ClientMessage = PlayerHelloMessage | GameReadyMessage | ClientHeartbeatMessage | ClientRoomClosedAcknowledgementMessage | ClientRejoinMessage | CountriesCitiesSubmitMessage | CountriesCitiesEditAnswersMessage | CountriesCitiesWheelSpinHoldStartedMessage | CountriesCitiesWheelSpinHoldCancelledMessage | CountriesCitiesStartWheelSpinMessage;",
    "export type ClientMessage = PlayerHelloMessage | GameReadyMessage | ClientHeartbeatMessage | ClientRoomClosedAcknowledgementMessage | ClientLeaveMessage | ClientRejoinMessage | CountriesCitiesSubmitMessage | CountriesCitiesEditAnswersMessage | CountriesCitiesWheelSpinHoldStartedMessage | CountriesCitiesWheelSpinHoldCancelledMessage | CountriesCitiesStartWheelSpinMessage;",
)

replace_once(
    'src/protocol/outgoing.ts',
    "import type { ClientMessage, ClientRoomClosedAcknowledgementMessage, CountriesCitiesSubmitMessage, CountriesCitiesWheelSpinHoldCancelledMessage, CountriesCitiesWheelSpinHoldStartedMessage, CountriesCitiesWheelState, JsonValue, PlayerProfile } from './messages';",
    "import type { ClientLeaveMessage, ClientMessage, ClientRoomClosedAcknowledgementMessage, CountriesCitiesSubmitMessage, CountriesCitiesWheelSpinHoldCancelledMessage, CountriesCitiesWheelSpinHoldStartedMessage, CountriesCitiesWheelState, JsonValue, PlayerProfile } from './messages';",
)
replace_once(
    'src/protocol/outgoing.ts',
    "export function createRejoin(profile: PlayerProfile, lastSeenSequenceNumber: number): ClientMessage {\n  return { type: 'client:rejoin', protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION, player: profile, lastSeenSequenceNumber, ...meta(profile.id) };\n}",
    "export function createClientLeave(playerId: string, roomId: string, hostSessionId: string): ClientLeaveMessage {\n  return { type: 'client:leave', roomId, hostSessionId, playerId, ...meta(playerId) };\n}\nexport function createRejoin(profile: PlayerProfile, lastSeenSequenceNumber: number): ClientMessage {\n  return { type: 'client:rejoin', protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION, player: profile, lastSeenSequenceNumber, ...meta(profile.id) };\n}",
)

replace_once(
    'src/protocol/outgoing.test.ts',
    "import { createFinalizationSubmit, createPlayerHello, createRejoin, createRoomClosedAcknowledgement, createStartWheelSpin, createSubmit, createWheelSpinHoldStarted } from './outgoing';",
    "import { createClientLeave, createFinalizationSubmit, createPlayerHello, createRejoin, createRoomClosedAcknowledgement, createStartWheelSpin, createSubmit, createWheelSpinHoldStarted } from './outgoing';",
)
replace_once(
    'src/protocol/outgoing.test.ts',
    "describe('countries-cities submit bounds', () => {",
    "describe('explicit client leave', () => {\n  it('binds the leave intent to the current room, host session and player', () => {\n    expect(createClientLeave('player-1', 'ABC123', 'SESSION123')).toMatchObject({\n      type: 'client:leave',\n      roomId: 'ABC123',\n      hostSessionId: 'SESSION123',\n      playerId: 'player-1',\n      senderId: 'player-1',\n    });\n    expect(createClientLeave('player-1', 'ABC123', 'SESSION123')).toHaveProperty('requestId');\n  });\n});\n\ndescribe('countries-cities submit bounds', () => {",
)

replace_once(
    'src/app/AppContext.tsx',
    "import { createEditAnswers, createFinalizationSubmit, createGameReady, createHeartbeat, createPlayerHello, createRejoin, createRoomClosedAcknowledgement, createStartWheelSpin, createSubmit, createWheelSpinHoldCancelled, createWheelSpinHoldStarted } from '../protocol/outgoing';",
    "import { createClientLeave, createEditAnswers, createFinalizationSubmit, createGameReady, createHeartbeat, createPlayerHello, createRejoin, createRoomClosedAcknowledgement, createStartWheelSpin, createSubmit, createWheelSpinHoldCancelled, createWheelSpinHoldStarted } from '../protocol/outgoing';",
)
replace_once(
    'src/app/AppContext.tsx',
    "  cancel: () => void;\n  returnToMain: () => void;\n  retry: () => void;",
    "  cancel: () => void;\n  returnToMain: () => void;\n  leaveGame: () => void;\n  retry: () => void;",
)
replace_once(
    'src/app/AppContext.tsx',
    "  const returnToMain = useCallback((): void => {\n    cancel();\n    stateRef.current = createInitialState(stateRef.current.identity, null);\n    dispatch({ type: 'return-to-main' });\n  }, [cancel]);\n\n  const retry = useCallback((): void => {",
    "  const returnToMain = useCallback((): void => {\n    cancel();\n    stateRef.current = createInitialState(stateRef.current.identity, null);\n    dispatch({ type: 'return-to-main' });\n  }, [cancel]);\n\n  const leaveGame = useCallback((): void => {\n    const currentState = stateRef.current;\n    const target = currentState.joinParameters;\n    const transport = transportRef.current;\n    const current = reconnectRef.current;\n\n    current.manuallyClosed = true;\n    current.terminalJoinRejected = false;\n    current.startedAt = 0;\n    current.attempt = 0;\n    window.clearTimeout(current.timer);\n    current.timer = 0;\n    connectionAttemptRef.current.currentId = null;\n    connectionAttemptRef.current.inFlight = null;\n    transportRef.current = null;\n\n    if (transport && target) {\n      try {\n        transport.send(createClientLeave(\n          currentState.identity.playerId,\n          target.roomId,\n          target.hostSessionId,\n        ));\n        recordConnectionDiagnostic('client-leave.sent', 'info', { roomId: target.roomId });\n      } catch (error) {\n        recordConnectionDiagnostic('client-leave.send.failed', 'warning', {\n          roomId: target.roomId,\n          ...getDiagnosticErrorDetails(error),\n        });\n      }\n    }\n\n    clearAnswerDraftForState(currentState);\n    removeCurrentUnfinishedSession();\n    wheelSpinHoldRef.current = null;\n    transport?.close();\n    stateRef.current = createInitialState(currentState.identity, null);\n    dispatch({ type: 'return-to-main' });\n  }, [clearAnswerDraftForState, removeCurrentUnfinishedSession]);\n\n  const retry = useCallback((): void => {",
)
replace_once(
    'src/app/AppContext.tsx',
    "    returnToMain,\n    retry,",
    "    returnToMain,\n    leaveGame,\n    retry,",
)
replace_once(
    'src/app/AppContext.tsx',
    "  }), [cancel, connect, flushCurrentAnswerDraft, retry, returnToMain, send, updateIdentityAction]);",
    "  }), [cancel, connect, flushCurrentAnswerDraft, leaveGame, retry, returnToMain, send, updateIdentityAction]);",
)

replace_once(
    'src/test/fixtures.ts',
    "connect: vi.fn(() => Promise.resolve()), cancel: vi.fn(), returnToMain: vi.fn(), retry: vi.fn(), toggleReady: vi.fn(),",
    "connect: vi.fn(() => Promise.resolve()), cancel: vi.fn(), returnToMain: vi.fn(), leaveGame: vi.fn(), retry: vi.fn(), toggleReady: vi.fn(),",
)

replace_once(
    'src/components/Layout.tsx',
    "  const { state } = useApp();",
    "  const { state, actions } = useApp();",
)
replace_once(
    'src/components/Layout.tsx',
    "  const hostPlayerId = state.snapshot?.hostPlayerId ?? state.players[0]?.id;",
    "  const hostPlayerId = state.snapshot?.hostPlayerId ?? state.players[0]?.id;\n  const canLeave = state.connectionStatus === 'connected'\n    && state.joinParameters !== null\n    && state.players.some((player) => player.id === state.identity.playerId);\n  const leaveGame = (): void => {\n    if (isGameplay && !window.confirm('Czy na pewno chcesz opuścić grę? Nie będzie można wrócić do tej sesji przyciskiem „Wróć”.')) return;\n    actions.leaveGame();\n  };",
)
replace_once(
    'src/components/Layout.tsx',
    "    <main className={aside ? 'page-grid' : 'page-single'}><section>{visibleChildren}</section>{aside ? <aside>{aside}</aside> : null}</main>",
    "    <main className={aside ? 'page-grid' : 'page-single'}><section>{visibleChildren}{canLeave ? <div className=\"leave-game-actions\"><button type=\"button\" className=\"native-leave-game-button\" onClick={leaveGame}>Opuść grę</button></div> : null}</section>{aside ? <aside>{aside}</aside> : null}</main>",
)

append_once(
    'src/native-parity.css',
    '.native-leave-game-button {',
    """
.leave-game-actions {
  display: flex;
  justify-content: center;
  margin: 16px 0 0;
}

.native-leave-game-button {
  width: 100%;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--pm-color-error) 48%, var(--pm-color-border));
  border-radius: 16px;
  background: var(--pm-color-surface);
  color: var(--pm-color-error);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.native-leave-game-button:hover {
  background: color-mix(in srgb, var(--pm-color-error) 6%, var(--pm-color-surface));
}

.native-leave-game-button:focus-visible {
  outline: 2px solid var(--pm-color-error);
  outline-offset: 2px;
}
""",
)

Path('src/components/Layout.test.tsx').write_text("""import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { appActions, appState } from '../test/fixtures';
import type { AppState } from '../state/gameStore';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue(state: AppState = appState()) { return { state, actions: appActions() }; }
vi.mock('../app/AppContext', () => ({ useApp: () => mocked.value }));

afterEach(() => vi.restoreAllMocks());

it('exposes explicit leave in the lobby without confirmation', () => {
  mocked.value = createValue();
  render(<Layout title=\"Poczekalnia\"><div>Lobby</div></Layout>);

  fireEvent.click(screen.getByRole('button', { name: 'Opuść grę' }));

  expect(mocked.value.actions.leaveGame).toHaveBeenCalledTimes(1);
});

it('requires confirmation before leaving an active game', () => {
  const snapshot = { phase: 'answering', hostPlayerId: 'host' } as AppState['snapshot'];
  mocked.value = createValue(appState({ snapshot }));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<Layout title=\"Runda 1\"><div>Gra</div></Layout>);

  fireEvent.click(screen.getByRole('button', { name: 'Opuść grę' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(mocked.value.actions.leaveGame).not.toHaveBeenCalled();

  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Opuść grę' }));
  expect(mocked.value.actions.leaveGame).toHaveBeenCalledTimes(1);
});
""", encoding='utf-8')

append_once(
    'src/app/AppContext.test.tsx',
    "describe('explicit leave lifecycle'",
    """
describe('explicit leave lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  async function connectAndAdmit(transports: DeferredTransport[]): Promise<DeferredTransport> {
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });
    let connectPromise!: Promise<void>;
    act(() => { connectPromise = actions.connect(joinParameters); });
    await act(async () => {
      getTransport(transports, 0).open();
      await connectPromise;
    });
    act(() => {
      getTransport(transports, 0).emitMessage({
        type: 'room:players',
        protocolVersion: 4,
        players: [currentState.identity.profile],
      });
    });
    return getTransport(transports, 0);
  }

  it('sends explicit leave, clears resume state and ignores stale transport events', async () => {
    const transports: DeferredTransport[] = [];
    const transport = await connectAndAdmit(transports);
    const playerId = currentState.identity.playerId;
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();

    act(() => { actions.leaveGame(); });

    expect(transport.send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'client:leave',
      roomId: joinParameters.roomId,
      hostSessionId: joinParameters.hostSessionId,
      playerId,
      senderId: playerId,
    }));
    expect(transport.close).toHaveBeenCalledTimes(1);
    expect(readLatestUnfinishedMultiplayerSession()).toBeNull();
    expect(currentState.connectionStatus).toBe('idle');
    expect(currentState.identity.playerId).toBe(playerId);

    act(() => {
      transport.emitState('closed');
      transport.emitMessage({ type: 'room:players', protocolVersion: 4, players: [] });
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(transports).toHaveLength(1);
    expect(currentState.connectionStatus).toBe('idle');

    act(() => { actions.leaveGame(); });
    expect(transport.send.mock.calls.filter(([message]) => message.type === 'client:leave')).toHaveLength(1);
  });

  it('returns to the join screen even when sending leave fails', async () => {
    const transports: DeferredTransport[] = [];
    const transport = await connectAndAdmit(transports);
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();
    transport.send.mockImplementation((message: ClientMessage) => {
      if (message.type === 'client:leave') throw new Error('send failed');
    });

    act(() => { actions.leaveGame(); });

    expect(transport.close).toHaveBeenCalledTimes(1);
    expect(readLatestUnfinishedMultiplayerSession()).toBeNull();
    expect(currentState.connectionStatus).toBe('idle');
  });

  it('does not treat pagehide or reconnect cancellation as explicit leave', async () => {
    const transports: DeferredTransport[] = [];
    const transport = await connectAndAdmit(transports);

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(transport.send.mock.calls.some(([message]) => message.type === 'client:leave')).toBe(false);
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();

    act(() => { actions.cancel(); });
    expect(transport.send.mock.calls.some(([message]) => message.type === 'client:leave')).toBe(false);
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();
  });
});
""",
)

append_once(
    'docs/protocol-contract.md',
    '## Explicit client leave',
    """
## Explicit client leave

Świadome wyjście klienta WWW jest odrębną intencją od utraty transportu. Klient wysyła best-effort komunikat `client:leave` przed zamknięciem bieżącego transportu:

```json
{
  "type": "client:leave",
  "roomId": "ABC123",
  "hostSessionId": "...",
  "playerId": "...",
  "senderId": "...",
  "requestId": "...",
  "sentAt": 0
}
```

`roomId`, `hostSessionId` i `playerId` muszą wskazywać bieżącą sesję oraz tożsamość gracza. Brak `client:leave` oznacza wyłącznie utratę transportu i nie może być interpretowany jako świadome opuszczenie gry. Zdarzenia `offline`, `visibilitychange`, `pagehide`, reload oraz utrata DataChannel nie wysyłają tego komunikatu i zachowują ścieżkę reconnect/resume.
""",
)

append_once(
    'docs/reconnect-storage.md',
    '## Świadome opuszczenie gry',
    """
## Świadome opuszczenie gry

Akcja „Opuść grę” usuwa zapis niedokończonej sesji tylko dla aktualnego pokoju i gracza, czyści draft bieżącej rundy i zamyka transport po best-effort `client:leave`. Trwała tożsamość gracza pozostaje zachowana. Zwykły reload, `pagehide`, przejście Safari w tło, utrata sieci lub DataChannel nie wykonują tego cleanupu, dzięki czemu „Wróć” nadal może wznowić przerwaną sesję.
""",
)
