import { useMemo, useState, useSyncExternalStore } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import {
  formatConnectionDiagnostics,
  getConnectionDiagnostics,
  subscribeConnectionDiagnostics,
} from '../../diagnostics/connectionDiagnostics';
import { getConnectionFailureGuidance } from './connectionFailureGuidance';
import { localConnectionFailureCodes } from '../../protocol/connectionFailure';
import { languageDisplayName, useI18n } from '../../i18n/appLanguage';

export function ConnectionErrorScreen() {
  const { state, actions } = useApp();
  const { language, t } = useI18n();
  const diagnostics = useSyncExternalStore(
    subscribeConnectionDiagnostics,
    getConnectionDiagnostics,
    getConnectionDiagnostics,
  );
  const diagnosticText = useMemo(() => formatConnectionDiagnostics(diagnostics), [diagnostics]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const guidance = getConnectionFailureGuidance(state.connectionError, language);
  const requiredLanguage = state.requiredGameLanguageCode;

  if (state.connectionError === localConnectionFailureCodes.languageMismatch && requiredLanguage) {
    const requiredName = languageDisplayName(requiredLanguage, language);
    return <Layout>
      <Card className="center-card error-card">
        <div className="error-icon">!</div>
        <h1>{requiredLanguage === 'en'
          ? t('Ten pokój wymaga języka angielskiego', 'This room requires English')
          : t('Ten pokój wymaga języka polskiego', 'This room requires Polish')}</h1>
        <p>{t(
          `Twoja aplikacja używa innego języka. Zmień język na ${requiredName}, aby dołączyć.`,
          `Your app uses a different language. Switch to ${requiredName} to join.`,
        )}</p>
        <div className="button-row">
          <button className="button button-primary" type="button" onClick={() => actions.changeLanguageAndRetry(requiredLanguage)}>
            {t(`Zmień na ${requiredName} i dołącz`, `Switch to ${requiredName} and join`)}
          </button>
          <button className="button button-secondary" type="button" onClick={actions.returnToMain}>
            {t('Wyjdź', 'Exit')}
          </button>
        </div>
      </Card>
    </Layout>;
  }

  const copyDiagnostics = async (): Promise<void> => {
    try {
      await copyText(diagnosticText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const recover = (): void => {
    if (guidance.primaryAction === 'retry') actions.retry();
    else actions.cancel();
  };

  return <Layout>
    <Card className="center-card error-card">
      <div className="error-icon">!</div>
      <h1>{guidance.title}</h1>
      <p>{guidance.message}</p>
      <div className="button-row">
        <button className="button button-primary" onClick={recover}>{guidance.actionLabel}</button>
      </div>
      <small>{guidance.hint}</small>
      <details className="connection-diagnostics">
        <summary>{t('Szczegóły diagnostyczne', 'Diagnostic details')} ({diagnostics.length})</summary>
        <p>{t('Log nie zawiera nicku, odpowiedzi ani tokenu ponownego połączenia.', 'The log does not contain your nickname, answers or reconnect token.')}</p>
        <pre aria-label={t('Log diagnostyczny połączenia', 'Connection diagnostic log')}>{diagnosticText}</pre>
        <button className="button button-secondary" type="button" onClick={() => void copyDiagnostics()}>
          {copyStatus === 'copied' ? t('Skopiowano', 'Copied') : copyStatus === 'failed' ? t('Nie udało się skopiować', 'Copy failed') : t('Kopiuj diagnostykę', 'Copy diagnostics')}
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
