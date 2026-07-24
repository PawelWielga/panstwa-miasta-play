import type { PlayerProfile } from '../protocol/messages';

export function PlayerList({ players, hostPlayerId, ownPlayerId }: { players: PlayerProfile[]; hostPlayerId?: string; ownPlayerId: string }) {
  return <ul className="player-list" aria-label="Gracze w pokoju">
    {players.map((player) => <li key={player.id} className={player.id === ownPlayerId ? 'is-me' : ''}>
      <span className="player-avatar" style={{ backgroundColor: player.color }} aria-hidden="true">{player.emoji}</span>
      <span><strong>{player.name}</strong><small>{player.id === hostPlayerId ? 'Prowadzący' : player.id === ownPlayerId ? 'To Ty' : 'Gracz'}</small></span>
    </li>)}
  </ul>;
}
