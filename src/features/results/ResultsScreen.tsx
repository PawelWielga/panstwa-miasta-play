import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';
import { ScoreTable } from '../../components/ScoreTable';

export function ResultsScreen({ final = false }: { final?: boolean }) {
  const { state } = useApp();
  const scores = state.snapshot?.finalScores ?? state.finalScores;
  const winner = state.players.map((player) => ({ player, score: scores[player.id] ?? 0 })).sort((a, b) => b.score - a.score)[0];
  return <Layout><ConnectionBanner /><Card className="results-card"><span className="eyebrow">{final ? 'Koniec gry' : 'Podsumowanie rundy'}</span><h1>{final && winner ? `${winner.player.emoji} Wygrywa ${winner.player.name}!` : 'Aktualny ranking'}</h1>
    <ScoreTable players={state.players} scores={scores} ownPlayerId={state.identity.playerId} />
    <p>{final ? 'Możesz zostać w pokoju. Po resecie hosta wrócisz do poczekalni.' : 'Czekamy, aż prowadzący rozpocznie kolejną rundę.'}</p>
  </Card></Layout>;
}
