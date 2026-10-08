import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n/appLanguage';

export function RoundStatusBar() {
  const { state } = useApp();
  const { t } = useI18n();
  const snapshot = state.snapshot;
  const round = snapshot?.round;
  const deadlineAt = snapshot?.phase === 'answering' ? state.deadlineAt : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  const totalRounds = snapshot?.settings.roundCount ?? state.settings?.roundCount;
  const remainingSeconds = deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  const letter = state.currentLetter ?? round?.letter ?? '?';

  return <div className="round-status-bar" aria-label={t('Stan rundy', 'Round status')}>
    {round?.number !== undefined && totalRounds !== undefined ? <StatusPill label={t('Runda', 'Round')} value={`${String(round.number)}/${String(totalRounds)}`} /> : null}
    <StatusPill label={t('Litera', 'Letter')} value={letter.toUpperCase()} />
    {remainingSeconds !== null ? <StatusPill label={t('Czas', 'Time')} value={formatRemainingTime(remainingSeconds)} /> : null}
  </div>;
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return <span className="round-status-pill"><span>{label}: </span><strong>{value}</strong></span>;
}

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes)}:${String(rest).padStart(2, '0')}`;
}
