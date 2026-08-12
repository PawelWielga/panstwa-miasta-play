import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';
import { wheelSpinRequestKey } from '../../protocol/wheel';
import type { CountriesCitiesWheelState } from '../../protocol/messages';
import { FortuneWheel } from './FortuneWheel';

const MAX_WHEEL_HOLD_DURATION_MS = 2_000;
const WHEEL_HOLD_PROGRESS_INTERVAL_MS = 50;

export function TransitionScreen() {
  const { state, actions } = useApp();
  const wheelState = state.snapshot?.wheelState;
  if (!wheelState) return <LegacyTransitionScreen />;

  return (
    <SynchronizedWheelScreen
      key={wheelState.spinId}
      wheelState={wheelState}
      state={state}
      startWheelSpinHold={actions.startWheelSpinHold}
      cancelWheelSpinHold={actions.cancelWheelSpinHold}
      startWheelSpin={actions.startWheelSpin}
    />
  );
}

interface SynchronizedWheelScreenProps {
  wheelState: CountriesCitiesWheelState;
  state: ReturnType<typeof useApp>['state'];
  startWheelSpinHold: () => void;
  cancelWheelSpinHold: () => void;
  startWheelSpin: (holdDurationMs?: number) => void;
}

function SynchronizedWheelScreen({
  wheelState,
  state,
  startWheelSpinHold,
  cancelWheelSpinHold,
  startWheelSpin,
}: SynchronizedWheelScreenProps) {
  const now = useWaitingClock(wheelState);
  const selectedPlayer = state.players.find((player) => player.id === wheelState.selectedPlayerId);
  const selectedPlayerName = selectedPlayer?.name.trim() || 'wybrany gracz';
  const isSelectedPlayer = wheelState.selectedPlayerId === state.identity.playerId;
  const remainingMilliseconds = wheelState.waitingDeadlineAt - now;
  const remainingSeconds = remainingMilliseconds <= 0 ? 0 : Math.ceil(remainingMilliseconds / 1000);
  const requestPending = state.pendingWheelSpinRequestKey === wheelSpinRequestKey(wheelState);
  const holdGesture = useRef<{ pointerId: number; startedAt: number } | null>(null);
  const pendingHoldDurationMs = useRef<number | undefined>(undefined);
  const holdStrengthTimer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdStrengthPercent, setHoldStrengthPercent] = useState(0);
  const canStart = wheelState.phase === 'waiting'
    && isSelectedPlayer
    && state.connectionStatus === 'connected'
    && !requestPending
    && remainingMilliseconds > 0;
  const canReleaseHold = holding
    && wheelState.phase === 'waiting'
    && isSelectedPlayer
    && state.connectionStatus === 'connected'
    && !requestPending;
  const status = wheelStatus(wheelState, selectedPlayerName, isSelectedPlayer, requestPending, remainingSeconds);

  const stopHoldStrengthTimer = (): void => {
    if (holdStrengthTimer.current === null) return;
    window.clearInterval(holdStrengthTimer.current);
    holdStrengthTimer.current = null;
  };
  const resetHoldStrength = (): void => {
    stopHoldStrengthTimer();
    setHoldStrengthPercent(0);
  };
  const startHoldStrength = (): void => {
    stopHoldStrengthTimer();
    const startedAt = Date.now();
    setHoldStrengthPercent(0);
    holdStrengthTimer.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const percent = Math.min(100, Math.round(elapsed * 100 / MAX_WHEEL_HOLD_DURATION_MS));
      setHoldStrengthPercent(percent);
      if (percent >= 100) stopHoldStrengthTimer();
    }, WHEEL_HOLD_PROGRESS_INTERVAL_MS);
  };

  useEffect(() => () => {
    if (holdStrengthTimer.current !== null) {
      window.clearInterval(holdStrengthTimer.current);
    }
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!canStart || event.button !== 0 || holdGesture.current !== null) return;
    holdGesture.current = { pointerId: event.pointerId, startedAt: event.timeStamp };
    setHolding(true);
    startHoldStrength();
    startWheelSpinHold();
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const gesture = holdGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    holdGesture.current = null;
    pendingHoldDurationMs.current = Math.max(
      0,
      Math.min(MAX_WHEEL_HOLD_DURATION_MS, Math.round(event.timeStamp - gesture.startedAt)),
    );
    stopHoldStrengthTimer();
  };
  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (holdGesture.current?.pointerId !== event.pointerId) return;
    holdGesture.current = null;
    pendingHoldDurationMs.current = undefined;
    setHolding(false);
    resetHoldStrength();
    cancelWheelSpinHold();
  };
  const handleClick = (): void => {
    const holdDurationMs = pendingHoldDurationMs.current;
    pendingHoldDurationMs.current = undefined;
    setHolding(false);
    resetHoldStrength();
    startWheelSpin(holdDurationMs);
  };

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
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onClick={handleClick}
              disabled={!canStart && !canReleaseHold}
            >
              {requestPending ? 'Czekamy na hosta…' : 'Zakręć kołem'}
            </button>
            {holding && (
              <div
                className="fortune-wheel-strength"
                role="progressbar"
                aria-label="Siła obrotu"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={holdStrengthPercent}
                aria-valuetext={`${String(holdStrengthPercent)}%`}
              >
                <div className="fortune-wheel-strength-track" aria-hidden="true">
                  <div
                    className="fortune-wheel-strength-fill"
                    style={{ width: `${String(holdStrengthPercent)}%` }}
                  />
                </div>
                <span>Siła obrotu: {holdStrengthPercent}%</span>
              </div>
            )}
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
          : `Przytrzymaj „Zakręć kołem” i puść. Dłuższe przytrzymanie daje mocniejszy obrót. Auto-start za ${String(remainingSeconds)} s.`,
      };
    }
    return {
      title: `Teraz kręci ${selectedPlayerName}`,
      description: `Koło ruszy po akcji gracza albo automatycznie za ${String(remainingSeconds)} s.`,
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
