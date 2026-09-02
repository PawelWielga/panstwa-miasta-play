import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GameSettingsCard } from '../../components/GameSettingsCard';
import { Card, Layout } from '../../components/Layout';
import { NativeIcon } from '../../components/NativeIcon';

export function LobbyScreen() {
  const { state } = useApp();
  const [tab, setTab] = useState<'game' | 'invite'>('game');
  const snapshot = state.snapshot;
  const roomId = state.joinParameters?.roomId ?? snapshot?.roomId ?? '—';
  return <Layout title="Poczekalnia">
    <ConnectionBanner />
    <div className="native-top-tabs" role="tablist" aria-label="Poczekalnia">
      <button type="button" role="tab" aria-selected={tab === 'game'} className={tab === 'game' ? 'selected' : ''} onClick={() => setTab('game')}><NativeIcon name="game" />Gra</button>
      <button type="button" role="tab" aria-selected={tab === 'invite'} className={tab === 'invite' ? 'selected' : ''} onClick={() => setTab('invite')}><NativeIcon name="invite" />Zaproś</button>
    </div>
    {tab === 'game' ? <div className="lobby-game-stack">
      <Card className="game-card lobby-waiting-card"><div className="lobby-waiting-row"><span className="lobby-waiting-icon"><NativeIcon name="hourglass" /></span><strong>Oczekiwanie na rozpoczęcie gry</strong><span className="lobby-waiting-spacer" /></div></Card>
      <GameSettingsCard categories={state.categories} settings={state.settings} timeMode={snapshot?.timeMode} players={state.players} hostPlayerId={snapshot?.hostPlayerId ?? state.players[0]?.id} ownPlayerId={state.identity.playerId} />
    </div> : <div className="lobby-invite-view">
      <p>Pokaż kod poniżej osobie, którą chcesz zaprosić do gry.</p>
      <Card className="room-code-card"><span>Kod pokoju</span><strong>{roomId}</strong></Card>
      <Card className="invite-help-card"><NativeIcon name="invite" /><div><strong>Dołącz przez internet</strong><span>Druga osoba może wpisać ten sześciocyfrowy kod na ekranie dołączania.</span></div></Card>
    </div>}
  </Layout>;
}
