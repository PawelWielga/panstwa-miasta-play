import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import { useI18n } from '../../i18n/appLanguage';

export function HostEndedGameScreen() {
  const { actions } = useApp();
  const { t } = useI18n();

  return <Layout>
    <Card className="center-card">
      <h1>{t('Host zakończył rozgrywkę', 'The host ended the game')}</h1>
      <p>{t('Host zamknął pokój. Ta rozgrywka została zakończona.', 'The host closed the room. This game has ended.')}</p>
      <div className="button-row">
        <button className="button button-primary" type="button" onClick={actions.returnToMain}>
          {t('Wróć do ekranu głównego', 'Back to home')}
        </button>
      </div>
    </Card>
  </Layout>;
}
