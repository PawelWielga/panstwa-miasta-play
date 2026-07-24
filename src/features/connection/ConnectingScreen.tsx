import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';

export function ConnectingScreen() {
  const { state, actions } = useApp();
  const reconnecting = state.connectionStatus === 'reconnecting';
  return <Layout><Card className="center-card"><div className="spinner" aria-hidden="true" /><h1>{reconnecting ? 'Ponowne łączenie…' : 'Łączenie z prowadzącym…'}</h1><p>{reconnecting ? 'Próbujemy przywrócić Twoje miejsce w grze.' : `Pokój ${state.joinParameters?.roomId ?? ''}`}</p><button className="button button-secondary" onClick={actions.cancel}>Anuluj</button></Card></Layout>;
}
