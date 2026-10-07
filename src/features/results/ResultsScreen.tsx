import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GamePhaseBanner } from '../../components/GamePhaseBanner';
import { Card, Layout } from '../../components/Layout';
import { NativeIcon } from '../../components/NativeIcon';
import { ScoreTable } from '../../components/ScoreTable';
import { useI18n } from '../../i18n/appLanguage';

export function ResultsScreen({ final = false }: { final?: boolean }) {
  const { state, actions } = useApp();
  const { t } = useI18n();
  const scores = state.snapshot?.finalScores ?? state.finalScores;
  if (final) return <Layout><ConnectionBanner /><Card className="game-card results-card">
    <GamePhaseBanner icon="flag" title={t('Gra zakończona', 'Game finished')} description={t('Możecie wrócić do menu albo rozpocząć nową grę.', 'You can return to the menu or start a new game.')} tone="celebratory" />
    <h2 className="native-final-ranking-title">{t('Klasyfikacja końcowa', 'Final standings')}</h2>
    <ScoreTable players={state.players} scores={scores} ownPlayerId={state.identity.playerId} />
    <button className="button button-primary button-large native-action-button" type="button" onClick={actions.toggleReady} disabled={state.localReady}><NativeIcon name="check" />{state.localReady ? t('Gotowy na kolejną serię', 'Ready for another game') : t('Jestem gotowy', 'I am ready')}</button>
    {state.localReady ? <p className="native-action-note">{t('Gotowość została wysłana gospodarzowi.', 'Your ready status was sent to the host.')}</p> : null}
    <button className="button button-secondary button-large native-action-button" type="button" onClick={actions.returnToMain}><NativeIcon name="flag" />{t('Wyjdź z gry', 'Leave game')}</button>
  </Card></Layout>;

  return <Layout><ConnectionBanner /><Card className="game-card results-card"><h1 className="round-summary-title">{t('Aktualne wyniki', 'Current scores')}</h1><div className="round-ranking-card"><ScoreTable players={state.players} scores={scores} ownPlayerId={state.identity.playerId} /></div><GamePhaseBanner icon="refresh" title={t('Czekamy na kolejną rundę', 'Waiting for the next round')} description={t('Prowadzący może rozpocząć następną rundę albo zresetować grę do poczekalni.', 'The host can start the next round or reset the game back to the lobby.')} /></Card></Layout>;
}
