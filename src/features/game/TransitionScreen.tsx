import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';

export function TransitionScreen() {
  const { state } = useApp();
  const phase = state.snapshot?.phase;
  const title = phase === 'letterDraw' ? 'Losowanie litery…' : phase === 'letterReveal' ? 'Litera została wylosowana!' : 'Host przygotowuje kolejną rundę…';
  return <Layout><ConnectionBanner /><Card className="center-card"><div className="letter-orbit">{state.currentLetter ?? '?'}</div><h1>{title}</h1><p>Poczekaj na sygnał prowadzącego.</p></Card></Layout>;
}
