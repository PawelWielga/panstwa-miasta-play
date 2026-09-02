import { useApp } from '../../app/AppContext';
import { CategoryResultsList } from '../../components/CategoryResultsList';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { GamePhaseBanner } from '../../components/GamePhaseBanner';
import { Card, Layout } from '../../components/Layout';

export function ReviewScreen() {
  const { state } = useApp();
  const snapshot = state.snapshot;
  const categoryIndex = snapshot?.round?.categoryIndex ?? state.reviewCategoryIndex;
  const categories = snapshot?.round?.categories ?? state.categories;
  const submissions = snapshot ? Object.values(snapshot.submissions) : state.reviewSubmissions;
  const previousCategory = categoryIndex > 0 ? categories[categoryIndex - 1] : undefined;
  const results = snapshot?.finalResults ?? state.revealResults;
  const hasPreviousResults = previousCategory !== undefined && Object.keys(results).length > 0;

  return <Layout><ConnectionBanner /><Card className="game-card review-game-card">
    {hasPreviousResults ? <>
      <GamePhaseBanner icon="hourglass" title="Oczekiwanie na ocenę" description="Host ocenia odpowiedzi na kolejną kategorię" showProgress />
      <div className="phase-section-gap" />
      <CategoryResultsList category={previousCategory} submissions={submissions} results={results} ownPlayerId={state.identity.playerId} />
    </> : <>
      <GamePhaseBanner icon="hourglass" title="Host sprawdza odpowiedzi" description="Za chwilę zobaczysz punkty za tę kategorię." />
      <div className="phase-section-gap" />
      <h2 className="native-section-title">Czasy odpowiedzi graczy</h2>
      <div className="answer-timing-list">{state.players.map((player) => <div className="answer-timing-card" key={player.id}><strong>{player.name}</strong><span>Czas odpowiedzi: {formatResponseTime(snapshot?.round?.answeringStartedAt, snapshot?.submittedAtByPlayerId[player.id])}</span></div>)}</div>
      {snapshot?.settings.speedBonusEnabled ? <p className="native-small-note">Punkty za szybkie odpowiedzi zostaną doliczone na koniec rundy po sprawdzeniu odpowiedzi.</p> : null}
    </>}
  </Card></Layout>;
}

function formatResponseTime(startedAt: number | null | undefined, submittedAt: number | undefined): string {
  if (startedAt === null || startedAt === undefined || submittedAt === undefined) return 'brak zapisu czasu';
  const milliseconds = Math.max(0, Math.round(submittedAt - startedAt));
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor(milliseconds / 1_000) % 60;
  const hundredths = Math.floor((milliseconds % 1_000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(hundredths).padStart(2, '0')}`;
}
