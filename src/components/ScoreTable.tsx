import type { PlayerProfile } from '../protocol/messages';

export function ScoreTable({ players, scores, ownPlayerId }: { players: PlayerProfile[]; scores: Record<string, number>; ownPlayerId: string }) {
  const rows = players.map((player) => ({ player, score: scores[player.id] ?? 0 })).sort((a, b) => b.score - a.score);
  return <ol className="score-list">
    {rows.map(({ player, score }, index) => <li key={player.id} className={player.id === ownPlayerId ? 'is-me' : ''}>
      <span className="rank">{index + 1}</span><span className="player-avatar" style={{ backgroundColor: player.color }}>{player.emoji}</span>
      <strong>{player.name}</strong><span className="score">{score} pkt</span>
    </li>)}
  </ol>;
}
