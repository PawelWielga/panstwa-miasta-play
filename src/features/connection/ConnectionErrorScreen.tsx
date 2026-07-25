import { useMemo, useState, useSyncExternalStore } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import {
  formatConnectionDiagnostics,
  getConnectionDiagnostics,
  subscribeConnectionDiagnostics,
} from '../../diagnostics/connectionDiagnostics';

export function ConnectionErrorScreen() {
  const { state, actions } = useApp();
  const diagnostics = useSyncExternalStore(
    subscribeConnectionDiagnostics,
    getConnectionDiagnostics,
    getConnectionDiagnostics,
  );
  const diagnosticText = useMemo(() => formatConnectionDiagnostics(diagnostics), [diagnostics]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copyDiagnostics = async (): Promise<void> => {
    try {
      await copyText(diagnosticText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return <Layout>
    <Card className="center-card error-card">
      <div className="error-icon">!</div>
      <h1>Nie udało się połączyć</h1>
      <p>{state.connectionError ?? 'Telefon prowadzącego może być niedostępny albo połączenie zostało przerwane.'}</p>
      <div className="button-row">
        <button className="button button-primary" onClick={actions.retry}>Spróbuj ponownie</button>
        <button className="button button-secondary" onClick={actions.cancel}>Wróć</button>
      </div>
      <small>Sprawdź kod pokoju, połączenie z internetem albo ponownie otwórz kod QR.</small>
      <details className="connection-diagnostics">
        <summary>Szczegóły diagnostyczne ({diagnostics.length})</summary>
        <p>Log nie zawiera nicku, odpowiedzi ani tokenu ponownego połączenia.</p>
        <pre aria-label="Log diagnostyczny połączenia">{diagnosticText}</pre>
        <button className="button button-secondary" type="button" onClick={() => void copyDiagnostics()}>
          {copyStatus === 'copied' ? 'Skopiowano' : copyStatus === 'failed' ? 'Nie udało się skopiować' : 'Kopiuj diagnostykę'}
        </button>
      </details>
    </Card>
  </Layout>;
}

async function copyText(text: string): Promise<void> {
  const clipboard = (navigator as unknown as { clipboard?: Clipboard }).clipboard;
  if (!clipboard) throw new Error('clipboard-unavailable');
  await clipboard.writeText(text);
}
