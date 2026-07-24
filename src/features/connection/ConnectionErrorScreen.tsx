import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';

export function ConnectionErrorScreen() {
  const { state, actions } = useApp();
  return <Layout><Card className="center-card error-card"><div className="error-icon">!</div><h1>Nie udało się połączyć</h1><p>{state.connectionError ?? 'Telefon prowadzącego może być niedostępny albo sieć blokuje połączenia P2P.'}</p><div className="button-row"><button className="button button-primary" onClick={actions.retry}>Spróbuj ponownie</button><button className="button button-secondary" onClick={actions.cancel}>Wróć</button></div><small>Pomaga zmiana sieci Wi‑Fi, wyłączenie VPN albo ponowne otwarcie kodu QR.</small></Card></Layout>;
}
