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
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submit = (event: SyntheticEvent<HTMLFormElement>): void => { event.preventDefault(); actions.submitAnswers(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (event.key === 'Enter') { event.preventDefault(); inputs.current[index + 1]?.focus(); }
  };
  if (state.answersSubmitted) return <WaitingForPlayersScreen />;
  return <Layout><ConnectionBanner /><Card className="game-card">
    <div className="round-header"><div><span className="eyebrow">Runda {state.snapshot?.round?.number ?? '—'}</span><h1>Litera <span className="letter-badge">{state.currentLetter ?? '?'}</span></h1></div>
      <div className={remaining !== null && remaining <= 10_000 ? 'timer timer-urgent' : 'timer'} aria-live="polite"><small>Pozostało</small><strong>{remaining === null ? '∞' : `${String(Math.ceil(remaining / 1000))} s`}</strong></div></div>
    <form className="answers-form" onSubmit={submit}>{categories.map((category, index) => <label key={category.id}><span>{category.name}</span><input ref={(element) => { inputs.current[index] = element; }} value={state.answers[category.id] ?? ''} maxLength={ANSWER_MAX_LENGTH} autoComplete="off" enterKeyHint={index === categories.length - 1 ? 'done' : 'next'} onKeyDown={(event) => keyDown(event, index)} onChange={(event) => actions.setAnswer(category.id, event.target.value)} /></label>)}
      <button className="button button-primary button-large" type="submit">Wyślij odpowiedzi</button></form>
    <p className="hint">Zegar jest tylko wizualizacją czasu hosta. O zakończeniu rundy decyduje telefon prowadzącego.</p>
  </Card></Layout>;
}

export function WaitingForPlayersScreen() {
  const { state, actions } = useApp();
  const mayEdit = state.snapshot?.phase === 'answering';
  return <Layout><ConnectionBanner /><Card className="center-card success-card"><div className="success-icon">✓</div><h1>Odpowiedzi wysłane</h1><p>Czekamy na pozostałych graczy.</p>{mayEdit ? <button className="button button-secondary" onClick={actions.editAnswers}>Edytuj odpowiedzi</button> : null}</Card></Layout>;
}
