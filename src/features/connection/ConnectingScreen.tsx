import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import { useI18n } from '../../i18n/appLanguage';

export function ConnectingScreen() {
  const { state, actions } = useApp();
  const { t } = useI18n();
  const reconnecting = state.connectionStatus === 'reconnecting';
  return <Layout><Card className="center-card"><div className="spinner" aria-hidden="true" /><h1>{reconnecting ? t('Ponowne łączenie…', 'Reconnecting…') : t('Łączenie z prowadzącym…', 'Connecting to host…')}</h1><p>{reconnecting ? t('Próbujemy przywrócić Twoje miejsce w grze.', 'Trying to restore your place in the game.') : `${t('Pokój', 'Room')} ${state.joinParameters?.roomId ?? ''}`}</p><button className="button button-secondary" onClick={actions.cancel}>{t('Anuluj', 'Cancel')}</button></Card></Layout>;
}
