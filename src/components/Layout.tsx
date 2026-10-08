import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { useApp } from '../app/AppContext';
import { PlayerList } from './PlayerList';
import { RoundStatusBar } from './RoundStatusBar';
import { NativeIcon } from './NativeIcon';
import { useI18n } from '../i18n/appLanguage';

export function Layout({ children, aside, title }: PropsWithChildren<{ aside?: ReactNode; title?: ReactNode }>) {
  const { state, actions } = useApp();
  const { t } = useI18n();
  const [selectedTab, setSelectedTab] = useState<'game' | 'players'>('game');
  const phase = state.snapshot?.phase;
  const isLobby = phase === 'lobby';
  const isGameplay = phase !== undefined && !isLobby;
  const resolvedTitle = title ?? (isGameplay ? <RoundStatusBar /> : isLobby ? t('Poczekalnia', 'Lobby') : t('Dołącz do gry', 'Join game'));
  const hostPlayerId = state.snapshot?.hostPlayerId ?? state.players[0]?.id;
  const canLeave = state.connectionStatus === 'connected'
    && state.joinParameters !== null
    && state.players.some((player) => player.id === state.identity.playerId);
  const leaveGame = (): void => {
    if (isGameplay && !window.confirm(t('Czy na pewno chcesz opuścić grę? Nie będzie można wrócić do tej sesji przyciskiem „Wróć”.', 'Are you sure you want to leave the game? You will not be able to return to this session using Resume.'))) return;
    actions.leaveGame();
  };
  const visibleChildren = isGameplay && selectedTab === 'players'
    ? <Card className="players-game-card">
        <div className="players-panel-heading"><NativeIcon name="group" /><strong>{t('Gracze', 'Players')}</strong></div>
        <PlayerList players={state.players} hostPlayerId={hostPlayerId} ownPlayerId={state.identity.playerId} />
      </Card>
    : children;

  return <div className={isGameplay ? 'app-shell has-game-nav' : 'app-shell'}>
    <header className="native-app-bar"><div className="native-app-bar-title">{resolvedTitle}</div></header>
    <main className={aside ? 'page-grid' : 'page-single'}><section>{visibleChildren}{canLeave ? <div className="leave-game-actions"><button type="button" className="native-leave-game-button" onClick={leaveGame}>{t('Opuść grę', 'Leave game')}</button></div> : null}</section>{aside ? <aside>{aside}</aside> : null}</main>
    {isGameplay ? <nav className="native-game-nav" aria-label={t('Nawigacja rozgrywki', 'Game navigation')}>
      <button type="button" className={selectedTab === 'game' ? 'selected' : ''} onClick={() => setSelectedTab('game')} aria-current={selectedTab === 'game' ? 'page' : undefined}><NativeIcon name="game" /><span>{t('Gra', 'Game')}</span></button>
      <button type="button" className={selectedTab === 'players' ? 'selected' : ''} onClick={() => setSelectedTab('players')} aria-current={selectedTab === 'players' ? 'page' : undefined}><NativeIcon name="group" /><span>{t('Gracze', 'Players')}</span></button>
    </nav> : null}
  </div>;
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
