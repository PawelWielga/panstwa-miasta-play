import { useApp } from '../app/AppContext';
import { getConnectionFailureGuidance } from '../features/connection/connectionFailureGuidance';
import { useI18n } from '../i18n/appLanguage';

export function ConnectionBanner() {
  const { state, actions } = useApp();
  const { language, t } = useI18n();
  const labels = {
    idle: t('Gotowy do połączenia', 'Ready to connect'),
    connecting: t('Łączenie…', 'Connecting…'),
    connected: t('Połączono', 'Connected'),
    reconnecting: t('Ponowne łączenie…', 'Reconnecting…'),
    lost: t('Utracono połączenie', 'Connection lost'),
    error: t('Błąd połączenia', 'Connection error'),
    closed: t('Połączenie zamknięte', 'Connection closed'),
  } as const;
  if (state.connectionStatus === 'idle' || state.connectionStatus === 'connected') return null;
  const guidance = state.connectionError ? getConnectionFailureGuidance(state.connectionError, language) : null;
  const canRetry = ['lost', 'error', 'closed'].includes(state.connectionStatus)
    && (guidance?.primaryAction ?? 'retry') === 'retry';
  return <div className={`connection-banner status-${state.connectionStatus}`} role={state.connectionStatus === 'error' ? 'alert' : 'status'}>
    <span className="status-dot" aria-hidden="true" />
    <div><strong>{labels[state.connectionStatus]}</strong>{guidance ? <small>{guidance.message}</small> : null}</div>
    {canRetry ? <button className="button button-small" onClick={actions.retry}>{t('Spróbuj ponownie', 'Try again')}</button> : null}
  </div>;
}
