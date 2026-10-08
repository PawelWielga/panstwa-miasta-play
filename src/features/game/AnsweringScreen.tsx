import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GamePhaseBanner } from '../../components/GamePhaseBanner';
import { Card, Layout } from '../../components/Layout';
import { NativeIcon } from '../../components/NativeIcon';
import { ANSWER_MAX_LENGTH } from '../../protocol/constants';
import { useI18n } from '../../i18n/appLanguage';

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
  const { t } = useI18n();
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
    <div className="answer-form-header"><strong>{t('Wpisz odpowiedzi', 'Enter answers')}</strong><span>{filledAnswers}/{categories.length} {t('odpowiedzi wpisane', 'answers entered')}</span></div>
    <div className="answer-progress" aria-hidden="true"><i style={{ width: `${String(progress * 100)}%` }} /></div>
    <form className="answers-form native-answers-form" onSubmit={submit}>{categories.map((category, index) => <label className="native-answer-field" key={category.id}><span>{category.name}</span><input ref={(element) => { inputs.current[index] = element; }} value={state.answers[category.id] ?? ''} maxLength={ANSWER_MAX_LENGTH} placeholder={t('Wpisz odpowiedź', 'Enter answer')} autoComplete="off" autoCapitalize="sentences" enterKeyHint={index === categories.length - 1 ? 'done' : 'next'} onKeyDown={(event) => keyDown(event, index)} disabled={locked} onChange={(event) => { if (!locked) actions.setAnswer(category.id, event.target.value); }} /></label>)}
      <button className="button button-primary button-large native-submit-button" type="submit" disabled={locked}><NativeIcon name="check" />{t('Gotowe', 'Done')}</button></form>
  </Card></Layout>;
}

export function WaitingForPlayersScreen() {
  const { state, actions } = useApp();
  const { t } = useI18n();
  const remaining = useRemaining(state.deadlineAt);
  const mayEdit = state.snapshot?.phase === 'answering' && state.snapshot.answerFinalization === undefined && (remaining === null || remaining > 0);
  return <Layout><ConnectionBanner /><Card className="game-card"><GamePhaseBanner icon="check" title={t('Odpowiedzi zapisane', 'Answers saved')} description={t('Twoje odpowiedzi są zapisane. Czekamy, aż pozostali gracze skończą rundę.', 'Your answers are saved. Waiting for the other players to finish the round.')} />{mayEdit ? <button className="native-text-button" onClick={actions.editAnswers}><NativeIcon name="edit" />{t('Zmień odpowiedzi', 'Edit answers')}</button> : null}</Card></Layout>;
}

function DeadlineElapsedScreen() {
  const { t } = useI18n();
  return <Layout><ConnectionBanner /><Card className="game-card"><GamePhaseBanner icon="hourglass" title={t('Czas minął', 'Time is up')} description={t('Czekamy na prowadzącego…', 'Waiting for the host…')} /></Card></Layout>;
}

function FinalizationWaitingScreen({ acknowledged }: { acknowledged: boolean }) {
  const { t } = useI18n();
  return <Layout><ConnectionBanner /><Card className="game-card"><GamePhaseBanner icon={acknowledged ? 'check' : 'hourglass'} title={acknowledged ? t('Odpowiedzi zapisane', 'Answers saved') : t('Kończymy rundę', 'Finishing the round')} description={acknowledged ? t('Twoje odpowiedzi są zapisane. Czekamy na rozpoczęcie oceny.', 'Your answers are saved. Waiting for the review to start.') : t('Wysyłamy ostatni zapisany stan odpowiedzi do hosta. Formularz jest już zablokowany.', 'Sending the last saved answer state to the host. The form is now locked.')} /></Card></Layout>;
}
