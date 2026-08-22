import { useApp } from '../app/AppContext';
import { getConnectionFailureGuidance } from '../features/connection/connectionFailureGuidance';

const labels = {
  idle: 'Gotowy do połączenia', connecting: 'Łączenie…', connected: 'Połączono', reconnecting: 'Ponowne łączenie…',
  lost: 'Utracono połączenie', error: 'Błąd połączenia', closed: 'Połączenie zamknięte',
} as const;
export function ConnectionBanner() {
  const { state, actions } = useApp();
  if (state.connectionStatus === 'idle') return null;
  const guidance = state.connectionError ? getConnectionFailureGuidance(state.connectionError) : null;
  const canRetry = ['lost', 'error', 'closed'].includes(state.connectionStatus)
    && (guidance?.primaryAction ?? 'retry') === 'retry';
  return <div className={`connection-banner status-${state.connectionStatus}`} role={state.connectionStatus === 'error' ? 'alert' : 'status'}>
    <span className="status-dot" aria-hidden="true" />
    <div><strong>{labels[state.connectionStatus]}</strong>{guidance ? <small>{guidance.message}</small> : null}</div>
    {canRetry ? <button className="button button-small" onClick={actions.retry}>Spróbuj ponownie</button> : null}
  </div>;
}
