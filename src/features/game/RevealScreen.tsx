import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';

function resultFor(results: Record<string, { winner: string; points: number }>, playerId: string, categoryId: string) {
  return results[`${playerId}:${categoryId}`] ?? results[`${playerId}::${categoryId}`] ?? Object.entries(results).find(([key]) => key.includes(playerId) && key.includes(categoryId))?.[1];
}
export function RevealScreen() {
  const { state } = useApp();
  const snapshot = state.snapshot;
  const index = snapshot?.round?.categoryIndex ?? state.reviewCategoryIndex;
  const category = (snapshot?.round?.categories ?? state.categories)[index];
  const submissions = snapshot ? Object.values(snapshot.submissions) : state.reviewSubmissions;
  const results = snapshot?.finalResults ?? state.revealResults;
  return <Layout><ConnectionBanner /><Card><span className="eyebrow">Wyniki kategorii</span><h1>{category?.name ?? 'Kategoria'}</h1>
    <div className="review-list">{submissions.map((submission) => { const result = category ? resultFor(results, submission.playerId, category.id) : undefined; return <div className="review-row result-row" key={submission.playerId}><div><strong>{submission.playerName}</strong><span>{category ? submission.answers[category.id] ?? submission.answers[category.name] ?? '—' : '—'}</span></div><b>{result ? `${result.points} pkt` : '—'}</b></div>; })}</div>
    <p className="hint">Punkty pochodzą bezpośrednio z hosta. Przeglądarka ich nie przelicza.</p>
  </Card></Layout>;
}
