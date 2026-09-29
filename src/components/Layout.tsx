import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { useApp } from '../app/AppContext';
import { PlayerList } from './PlayerList';
import { RoundStatusBar } from './RoundStatusBar';
import { NativeIcon } from './NativeIcon';

export function Layout({ children, aside, title }: PropsWithChildren<{ aside?: ReactNode; title?: ReactNode }>) {
  const { state, actions } = useApp();
  const [selectedTab, setSelectedTab] = useState<'game' | 'players'>('game');
  const phase = state.snapshot?.phase;
  const isLobby = phase === 'lobby';
  const isGameplay = phase !== undefined && !isLobby;
  const resolvedTitle = title ?? (isGameplay ? <RoundStatusBar /> : isLobby ? 'Poczekalnia' : 'Dołącz do gry');
  const hostPlayerId = state.snapshot?.hostPlayerId ?? state.players[0]?.id;
  const canLeave = state.connectionStatus === 'connected'
    && state.joinParameters !== null
    && state.players.some((player) => player.id === state.identity.playerId);
  const leaveGame = (): void => {
    if (isGameplay && !window.confirm('Czy na pewno chcesz opuścić grę? Nie będzie można wrócić do tej sesji przyciskiem „Wróć”.')) return;
    actions.leaveGame();
  };
  const visibleChildren = isGameplay && selectedTab === 'players'
    ? <Card className="players-game-card">
        <div className="players-panel-heading"><NativeIcon name="group" /><strong>Gracze</strong></div>
        <PlayerList players={state.players} hostPlayerId={hostPlayerId} ownPlayerId={state.identity.playerId} />
      </Card>
    : children;

  return <div className={isGameplay ? 'app-shell has-game-nav' : 'app-shell'}>
    <header className="native-app-bar"><div className="native-app-bar-title">{resolvedTitle}</div></header>
    <main className={aside ? 'page-grid' : 'page-single'}><section>{visibleChildren}{canLeave ? <div className="leave-game-actions"><button type="button" className="native-leave-game-button" onClick={leaveGame}>Opuść grę</button></div> : null}</section>{aside ? <aside>{aside}</aside> : null}</main>
    {isGameplay ? <nav className="native-game-nav" aria-label="Nawigacja rozgrywki">
      <button type="button" className={selectedTab === 'game' ? 'selected' : ''} onClick={() => setSelectedTab('game')} aria-current={selectedTab === 'game' ? 'page' : undefined}><NativeIcon name="game" /><span>Gra</span></button>
      <button type="button" className={selectedTab === 'players' ? 'selected' : ''} onClick={() => setSelectedTab('players')} aria-current={selectedTab === 'players' ? 'page' : undefined}><NativeIcon name="group" /><span>Gracze</span></button>
    </nav> : null}
  </div>;
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
