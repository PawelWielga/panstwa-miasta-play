import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GameSettingsCard } from '../../components/GameSettingsCard';
import { Card, Layout } from '../../components/Layout';
import { NativeIcon } from '../../components/NativeIcon';
import { useI18n } from '../../i18n/appLanguage';

export function LobbyScreen() {
  const { state } = useApp();
  const { t } = useI18n();
  const [tab, setTab] = useState<'game' | 'invite'>('game');
  const snapshot = state.snapshot;
  const roomId = state.joinParameters?.roomId ?? snapshot?.roomId ?? '—';
  return <Layout title={t('Poczekalnia', 'Lobby')}>
    <ConnectionBanner />
    <div className="native-top-tabs" role="tablist" aria-label={t('Poczekalnia', 'Lobby')}>
      <button type="button" role="tab" aria-selected={tab === 'game'} className={tab === 'game' ? 'selected' : ''} onClick={() => setTab('game')}><NativeIcon name="game" />{t('Gra', 'Game')}</button>
      <button type="button" role="tab" aria-selected={tab === 'invite'} className={tab === 'invite' ? 'selected' : ''} onClick={() => setTab('invite')}><NativeIcon name="invite" />{t('Zaproś', 'Invite')}</button>
    </div>
    {tab === 'game' ? <div className="lobby-game-stack">
      <Card className="game-card lobby-waiting-card"><div className="lobby-waiting-row"><span className="lobby-waiting-icon"><NativeIcon name="hourglass" /></span><strong>{t('Oczekiwanie na rozpoczęcie gry', 'Waiting for the game to start')}</strong><span className="lobby-waiting-spacer" /></div></Card>
      <GameSettingsCard categories={state.categories} settings={state.settings} timeMode={snapshot?.timeMode} players={state.players} hostPlayerId={snapshot?.hostPlayerId ?? state.players[0]?.id} ownPlayerId={state.identity.playerId} />
    </div> : <div className="lobby-invite-view">
      <p>{t('Pokaż kod poniżej osobie, którą chcesz zaprosić do gry.', 'Show the code below to the person you want to invite.')}</p>
      <Card className="room-code-card"><span>{t('Kod pokoju', 'Room code')}</span><strong>{roomId}</strong></Card>
      <Card className="invite-help-card"><NativeIcon name="invite" /><div><strong>{t('Dołącz przez internet', 'Join via internet')}</strong><span>{t('Druga osoba może wpisać ten sześciocyfrowy kod na ekranie dołączania.', 'The other person can enter this six-character code on the join screen.')}</span></div></Card>
    </div>}
  </Layout>;
}
