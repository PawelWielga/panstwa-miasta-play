import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GamePhaseBanner } from '../../components/GamePhaseBanner';
import { Card, Layout } from '../../components/Layout';
import { NativeIcon } from '../../components/NativeIcon';
import { ScoreTable } from '../../components/ScoreTable';

export function ResultsScreen({ final = false }: { final?: boolean }) {
  const { state, actions } = useApp();
  const scores = state.snapshot?.finalScores ?? state.finalScores;
  if (final) return <Layout><ConnectionBanner /><Card className="game-card results-card">
    <GamePhaseBanner icon="flag" title="Gra zakończona" description="Możecie wrócić do menu albo rozpocząć nową grę." tone="celebratory" />
    <h2 className="native-final-ranking-title">Klasyfikacja końcowa</h2>
    <ScoreTable players={state.players} scores={scores} ownPlayerId={state.identity.playerId} />
    <button className="button button-primary button-large native-action-button" type="button" onClick={actions.toggleReady} disabled={state.localReady}><NativeIcon name="check" />{state.localReady ? 'Gotowy na kolejną serię' : 'Jestem gotowy'}</button>
    {state.localReady ? <p className="native-action-note">Gotowość została wysłana gospodarzowi.</p> : null}
    <button className="button button-secondary button-large native-action-button" type="button" onClick={actions.returnToMain}><NativeIcon name="flag" />Wyjdź z gry</button>
  </Card></Layout>;

  return <Layout><ConnectionBanner /><Card className="game-card results-card"><h1 className="round-summary-title">Aktualne wyniki</h1><div className="round-ranking-card"><ScoreTable players={state.players} scores={scores} ownPlayerId={state.identity.playerId} /></div><GamePhaseBanner icon="refresh" title="Czekamy na kolejną rundę" description="Prowadzący może rozpocząć następną rundę albo zresetować grę do poczekalni." /></Card></Layout>;
}
