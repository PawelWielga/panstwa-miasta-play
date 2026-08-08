import { useEffect, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';
import { wheelSpinRequestKey } from '../../protocol/wheel';
import type { CountriesCitiesWheelState } from '../../protocol/messages';
import { FortuneWheel } from './FortuneWheel';

export function TransitionScreen() {
  const { state, actions } = useApp();
  const wheelState = state.snapshot?.wheelState;
  if (!wheelState) return <LegacyTransitionScreen />;

  return (
    <SynchronizedWheelScreen
      wheelState={wheelState}
      state={state}
      startWheelSpin={actions.startWheelSpin}
    />
  );
}

interface SynchronizedWheelScreenProps {
  wheelState: CountriesCitiesWheelState;
  state: ReturnType<typeof useApp>['state'];
  startWheelSpin: () => void;
}

function SynchronizedWheelScreen({ wheelState, state, startWheelSpin }: SynchronizedWheelScreenProps) {
  const now = useWaitingClock(wheelState);
  const selectedPlayer = state.players.find((player) => player.id === wheelState.selectedPlayerId);
  const selectedPlayerName = selectedPlayer?.name.trim() || 'wybrany gracz';
  const isSelectedPlayer = wheelState.selectedPlayerId === state.identity.playerId;
  const remainingMilliseconds = wheelState.waitingDeadlineAt - now;
  const remainingSeconds = remainingMilliseconds <= 0 ? 0 : Math.ceil(remainingMilliseconds / 1000);
  const requestPending = state.pendingWheelSpinRequestKey === wheelSpinRequestKey(wheelState);
  const canStart = wheelState.phase === 'waiting'
    && isSelectedPlayer
    && state.connectionStatus === 'connected'
    && !requestPending
    && remainingMilliseconds > 0;
  const status = wheelStatus(wheelState, selectedPlayerName, isSelectedPlayer, requestPending, remainingSeconds);

  return (
    <Layout>
      <ConnectionBanner />
      <Card className="center-card">
        <section className="fortune-wheel-status" aria-live="polite">
          <h1>{status.title}</h1>
          <p>{status.description}</p>
        </section>
        <FortuneWheel wheelState={wheelState} usedLetters={state.snapshot?.usedLetters ?? []} />
        {wheelState.phase === 'waiting' && (
          <p className="fortune-wheel-countdown" aria-live="polite">
            Start automatyczny za {remainingSeconds} s
          </p>
        )}
        {wheelState.phase === 'waiting' && isSelectedPlayer && (
          <div className="fortune-wheel-action">
            <button
              type="button"
              className="button button-primary button-large"
              onClick={startWheelSpin}
              disabled={!canStart}
            >
              {requestPending ? 'Czekamy na hosta…' : 'Zakręć kołem'}
            </button>
            {requestPending && <p className="fortune-wheel-request-note">Prośba została wysłana tylko raz.</p>}
          </div>
        )}
      </Card>
    </Layout>
  );
}

function LegacyTransitionScreen() {
  const { state } = useApp();
  const phase = state.snapshot?.phase;
  const title = phase === 'letterDraw'
    ? 'Losowanie litery…'
    : phase === 'letterReveal'
      ? 'Litera została wylosowana!'
      : 'Host przygotowuje kolejną rundę…';
  return (
    <Layout>
      <ConnectionBanner />
      <Card className="center-card">
        <div className="letter-orbit">{state.currentLetter ?? '?'}</div>
        <h1>{title}</h1>
        <p>Poczekaj na sygnał prowadzącego.</p>
      </Card>
    </Layout>
  );
}

function useWaitingClock(wheelState: CountriesCitiesWheelState): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (wheelState.phase !== 'waiting') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    const visibility = (): void => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [wheelState.phase, wheelState.spinId]);
  return now;
}

function wheelStatus(
  wheelState: CountriesCitiesWheelState,
  selectedPlayerName: string,
  isSelectedPlayer: boolean,
  requestPending: boolean,
  remainingSeconds: number,
): { title: string; description: string } {
  if (wheelState.phase === 'waiting') {
    if (isSelectedPlayer) {
      return {
        title: 'Twoja kolej',
        description: requestPending
          ? 'Wysłano prośbę. Koło ruszy po potwierdzeniu hosta.'
          : `Naciśnij „Zakręć kołem”. Jeśli nie zdążysz, host uruchomi je automatycznie za ${remainingSeconds} s.`,
      };
    }
    return {
      title: `Teraz kręci ${selectedPlayerName}`,
      description: `Koło ruszy po akcji gracza albo automatycznie za ${remainingSeconds} s.`,
    };
  }
  if (wheelState.phase === 'spinning') {
    return {
      title: 'Koło się kręci',
      description: isSelectedPlayer
        ? 'Twoja akcja została potwierdzona przez hosta.'
        : 'Wszyscy widzą ten sam przebieg losowania.',
    };
  }
  return {
    title: 'Koło się zatrzymało',
    description: 'Host potwierdził literę tej rundy.',
  };
}
