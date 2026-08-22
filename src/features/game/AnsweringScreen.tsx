import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';
import { ANSWER_MAX_LENGTH } from '../../protocol/constants';

function useRemaining(deadlineAt: number | null): number | null {
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    if (deadlineAt === null) return undefined;
    const update = (): void => setCurrentTime(Date.now());
    const initialTimer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 250);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [deadlineAt]);
  return deadlineAt === null || currentTime === null ? null : Math.max(0, deadlineAt - currentTime);
}

export function AnsweringScreen() {
  const { state, actions } = useApp();
  const categories = state.snapshot?.round?.categories ?? state.categories;
  const remaining = useRemaining(state.deadlineAt);
  const finalization = state.snapshot?.answerFinalization;
  const playerDone = state.snapshot?.donePlayerIds.includes(state.identity.playerId) ?? false;
  const deadlineElapsed = remaining !== null && remaining <= 0;
  const locked = deadlineElapsed || finalization !== undefined;
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submit = (event: SyntheticEvent<HTMLFormElement>): void => { event.preventDefault(); if (!locked) actions.submitAnswers(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (event.key === 'Enter') { event.preventDefault(); inputs.current[index + 1]?.focus(); }
  };
  if (finalization) return <FinalizationWaitingScreen acknowledged={playerDone} />;
  if (deadlineElapsed) return <DeadlineElapsedScreen />;
  if (state.answersSubmitted) return <WaitingForPlayersScreen />;
  return <Layout><ConnectionBanner /><Card className="game-card">
    <div className="round-header"><div><span className="eyebrow">Runda {state.snapshot?.round?.number ?? '—'}</span><h1>Litera <span className="letter-badge">{state.currentLetter ?? '?'}</span></h1></div>
      <div className={remaining !== null && remaining <= 10_000 ? 'timer timer-urgent' : 'timer'} aria-live="polite"><small>Pozostało</small><strong>{remaining === null ? '∞' : `${String(Math.ceil(remaining / 1000))} s`}</strong></div></div>
    <form className="answers-form" onSubmit={submit}>{categories.map((category, index) => <label key={category.id}><span>{category.name}</span><input ref={(element) => { inputs.current[index] = element; }} value={state.answers[category.id] ?? ''} maxLength={ANSWER_MAX_LENGTH} autoComplete="off" enterKeyHint={index === categories.length - 1 ? 'done' : 'next'} onKeyDown={(event) => keyDown(event, index)} disabled={locked} onChange={(event) => { if (!locked) actions.setAnswer(category.id, event.target.value); }} /></label>)}
      <button className="button button-primary button-large" type="submit" disabled={locked}>Wyślij odpowiedzi</button></form>
    <p className="hint">Zegar jest tylko wizualizacją czasu hosta. O zakończeniu rundy decyduje telefon prowadzącego.</p>
  </Card></Layout>;
}

export function WaitingForPlayersScreen() {
  const { state, actions } = useApp();
  const remaining = useRemaining(state.deadlineAt);
  const mayEdit = state.snapshot?.phase === 'answering'
    && state.snapshot.answerFinalization === undefined
    && (remaining === null || remaining > 0);
  return <Layout><ConnectionBanner /><Card className="center-card success-card"><div className="success-icon">✓</div><h1>Odpowiedzi wysłane</h1><p>Czekamy na pozostałych graczy.</p>{mayEdit ? <button className="button button-secondary" onClick={actions.editAnswers}>Edytuj odpowiedzi</button> : null}</Card></Layout>;
}

function DeadlineElapsedScreen() {
  return <Layout><ConnectionBanner /><Card className="center-card"><h1>Czas minął</h1><p>Czekamy na prowadzącego…</p></Card></Layout>;
}

function FinalizationWaitingScreen({ acknowledged }: { acknowledged: boolean }) {
  return <Layout><ConnectionBanner /><Card className={acknowledged ? 'center-card success-card' : 'center-card'}>
    {acknowledged ? <div className="success-icon">✓</div> : null}
    <h1>{acknowledged ? 'Odpowiedzi zapisane' : 'Zapisujemy odpowiedzi…'}</h1>
    <p>{acknowledged ? 'Czekamy na ocenę prowadzącego…' : 'Czekamy na potwierdzenie prowadzącego…'}</p>
  </Card></Layout>;
}
