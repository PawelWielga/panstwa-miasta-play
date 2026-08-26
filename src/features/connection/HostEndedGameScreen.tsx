import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';

export function HostEndedGameScreen() {
  const { actions } = useApp();

  return <Layout>
    <Card className="center-card">
      <h1>Host zakończył rozgrywkę</h1>
      <p>Host zamknął pokój. Ta rozgrywka została zakończona.</p>
      <div className="button-row">
        <button className="button button-primary" type="button" onClick={actions.returnToMain}>
          Wróć do ekranu głównego
        </button>
      </div>
    </Card>
  </Layout>;
}
