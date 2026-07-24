import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';

export function ConnectionErrorScreen() {
  const { state, actions } = useApp();
  return <Layout><Card className="center-card error-card"><div className="error-icon">!</div><h1>Nie udało się połączyć</h1><p>{state.connectionError ?? 'Telefon prowadzącego może być niedostępny albo połączenie zostało przerwane.'}</p><div className="button-row"><button className="button button-primary" onClick={actions.retry}>Spróbuj ponownie</button><button className="button button-secondary" onClick={actions.cancel}>Wróć</button></div><small>Sprawdź kod pokoju, połączenie z internetem albo ponownie otwórz kod QR.</small></Card></Layout>;
}
