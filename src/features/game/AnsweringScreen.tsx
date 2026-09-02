import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GamePhaseBanner } from '../../components/GamePhaseBanner';
import { Card, Layout } from '../../components/Layout';
import { NativeIcon } from '../../components/NativeIcon';
import { ANSWER_MAX_LENGTH } from '../../protocol/constants';

function useRemaining(deadlineAt: number | null): number | null {
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    if (deadlineAt === null) return undefined;
    const update = (): void => setCurrentTime(Date.now());
    const initialTimer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 250);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(interval); };
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
  const filledAnswers = categories.filter((category) => (state.answers[category.id] ?? '').trim().length > 0).length;
  const submit = (event: SyntheticEvent<HTMLFormElement>): void => { event.preventDefault(); if (!locked) actions.submitAnswers(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (index === categories.length - 1) actions.submitAnswers(); else inputs.current[index + 1]?.focus();
  };
  if (finalization) return <FinalizationWaitingScreen acknowledged={playerDone} />;
  if (deadlineElapsed) return <DeadlineElapsedScreen />;
  if (state.answersSubmitted) return <WaitingForPlayersScreen />;
  const progress = categories.length === 0 ? 0 : filledAnswers / categories.length;
  return <Layout><ConnectionBanner /><Card className="game-card answering-card">
    <div className="answer-form-header"><strong>Wpisz odpowiedzi</strong><span>{filledAnswers}/{categories.length} odpowiedzi wpisane</span></div>
    <div className="answer-progress" aria-hidden="true"><i style={{ width: `${String(progress * 100)}%` }} /></div>
    <form className="answers-form native-answers-form" onSubmit={submit}>{categories.map((category, index) => <label className="native-answer-field" key={category.id}><span>{category.name}</span><input ref={(element) => { inputs.current[index] = element; }} value={state.answers[category.id] ?? ''} maxLength={ANSWER_MAX_LENGTH} placeholder="Wpisz odpowiedź" autoComplete="off" autoCapitalize="sentences" enterKeyHint={index === categories.length - 1 ? 'done' : 'next'} onKeyDown={(event) => keyDown(event, index)} disabled={locked} onChange={(event) => { if (!locked) actions.setAnswer(category.id, event.target.value); }} /></label>)}
      <button className="button button-primary button-large native-submit-button" type="submit" disabled={locked}><NativeIcon name="check" />Gotowe</button></form>
  </Card></Layout>;
}

export function WaitingForPlayersScreen() {
  const { state, actions } = useApp();
  const remaining = useRemaining(state.deadlineAt);
  const mayEdit = state.snapshot?.phase === 'answering' && state.snapshot.answerFinalization === undefined && (remaining === null || remaining > 0);
  return <Layout><ConnectionBanner /><Card className="game-card"><GamePhaseBanner icon="check" title="Odpowiedzi zapisane" description="Twoje odpowiedzi są zapisane. Czekamy, aż pozostali gracze skończą rundę." />{mayEdit ? <button className="native-text-button" onClick={actions.editAnswers}><NativeIcon name="edit" />Zmień odpowiedzi</button> : null}</Card></Layout>;
}

function DeadlineElapsedScreen() {
  return <Layout><ConnectionBanner /><Card className="game-card"><GamePhaseBanner icon="hourglass" title="Czas minął" description="Czekamy na prowadzącego…" /></Card></Layout>;
}

function FinalizationWaitingScreen({ acknowledged }: { acknowledged: boolean }) {
  return <Layout><ConnectionBanner /><Card className="game-card"><GamePhaseBanner icon={acknowledged ? 'check' : 'hourglass'} title={acknowledged ? 'Odpowiedzi zapisane' : 'Kończymy rundę'} description={acknowledged ? 'Twoje odpowiedzi są zapisane. Czekamy na rozpoczęcie oceny.' : 'Wysyłamy ostatni zapisany stan odpowiedzi do hosta. Formularz jest już zablokowany.'} /></Card></Layout>;
}
