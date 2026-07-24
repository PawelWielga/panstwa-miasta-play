import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GameSettingsCard } from '../../components/GameSettingsCard';
import { Card, Layout } from '../../components/Layout';
import { PlayerList } from '../../components/PlayerList';

export function LobbyScreen() {
  const { state, actions } = useApp();
  const snapshot = state.snapshot;
  return <Layout aside={<GameSettingsCard categories={state.categories} settings={state.settings} timeMode={snapshot?.timeMode} />}>
    <ConnectionBanner />
    <Card><span className="eyebrow">Pokój {state.joinParameters?.roomId}</span><h1>Poczekalnia</h1><p>Host rozpocznie grę, gdy wszyscy będą gotowi.</p>
      <PlayerList players={state.players} hostPlayerId={snapshot?.hostPlayerId ?? state.players[0]?.id} ownPlayerId={state.identity.playerId} />
      <button className={state.localReady ? 'button button-success button-large' : 'button button-primary button-large'} onClick={actions.toggleReady}>{state.localReady ? '✓ Gotowy' : 'Jestem gotowy'}</button>
      <p className="hint">Gotowość jest zgłaszana hostowi. Start rundy zawsze zatwierdza prowadzący.</p>
    </Card>
  </Layout>;
}
