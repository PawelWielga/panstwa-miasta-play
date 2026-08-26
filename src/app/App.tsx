import { useApp } from './AppContext';
import { JoinScreen } from '../features/connection/JoinScreen';
import { ConnectingScreen } from '../features/connection/ConnectingScreen';
import { ConnectionErrorScreen } from '../features/connection/ConnectionErrorScreen';
import { HostEndedGameScreen } from '../features/connection/HostEndedGameScreen';
import { LobbyScreen } from '../features/lobby/LobbyScreen';
import { AnsweringScreen } from '../features/game/AnsweringScreen';
import { TransitionScreen } from '../features/game/TransitionScreen';
import { ReviewScreen } from '../features/game/ReviewScreen';
import { RevealScreen } from '../features/game/RevealScreen';
import { ResultsScreen } from '../features/results/ResultsScreen';

export function App() {
  const { state } = useApp();
  if (state.hostClosedRoom) return <HostEndedGameScreen />;
  if (state.connectionStatus === 'idle' || state.connectionStatus === 'closed') return <JoinScreen />;
  if (state.connectionStatus === 'connecting' || state.connectionStatus === 'reconnecting') return <ConnectingScreen />;
  if (state.connectionStatus === 'error' || state.connectionStatus === 'lost') return <ConnectionErrorScreen />;
  if (!state.players.some((player) => player.id === state.identity.playerId)) return <ConnectingScreen />;
  const phase = state.snapshot?.phase ?? 'lobby';
  switch (phase) {
    case 'lobby': return <LobbyScreen />;
    case 'letterDraw': case 'letterReveal': return <TransitionScreen />;
    case 'answering': return <AnsweringScreen />;
    case 'categoryReview': return <ReviewScreen />;
    case 'categoryResults': return <RevealScreen />;
    case 'roundSummary': return <ResultsScreen />;
    case 'gameFinished': return <ResultsScreen final />;
  }
  return null;
}
