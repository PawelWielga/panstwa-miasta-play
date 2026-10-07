import type { PlayerProfile } from '../protocol/messages';
import { useI18n } from '../i18n/appLanguage';

export function PlayerList({ players, hostPlayerId, ownPlayerId }: { players: PlayerProfile[]; hostPlayerId: string | undefined; ownPlayerId: string }) {
  const { t } = useI18n();
  return <ul className="player-list" aria-label={t('Gracze w pokoju', 'Players in room')}>
    {players.map((player) => <li key={player.id} className={player.id === ownPlayerId ? 'is-me' : ''}>
      <span className="player-avatar" style={{ backgroundColor: player.color }} aria-hidden="true">{player.emoji}</span>
      <span><strong>{player.name}</strong><small>{player.id === hostPlayerId ? t('Prowadzący', 'Host') : player.id === ownPlayerId ? t('To Ty', 'You') : t('Gracz', 'Player')}</small></span>
    </li>)}
  </ul>;
}
