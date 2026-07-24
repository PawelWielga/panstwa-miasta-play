import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';

function normalizeCategoryId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[-\s]+/g, ' ')
    .trim()
    .replaceAll(' ', '-');
  return normalized || 'category';
}
function resultFor(results: Record<string, { winner: string; points: number }>, playerId: string, categoryId: string) {
  return results[`${playerId}::${normalizeCategoryId(categoryId)}`];
}
export function RevealScreen() {
  const { state } = useApp();
  const snapshot = state.snapshot;
  const index = snapshot?.round?.categoryIndex ?? state.reviewCategoryIndex;
  const category = (snapshot?.round?.categories ?? state.categories)[index];
  const submissions = snapshot ? Object.values(snapshot.submissions) : state.reviewSubmissions;
  const results = snapshot?.finalResults ?? state.revealResults;
  return <Layout><ConnectionBanner /><Card><span className="eyebrow">Wyniki kategorii</span><h1>{category?.name ?? 'Kategoria'}</h1>
    <div className="review-list">{submissions.map((submission) => { const result = category ? resultFor(results, submission.playerId, category.id) : undefined; return <div className="review-row result-row" key={submission.playerId}><div><strong>{submission.playerName}</strong><span>{category ? submission.answers[category.id] ?? submission.answers[category.name] ?? '—' : '—'}</span></div><b>{result ? `${String(result.points)} pkt` : '—'}</b></div>; })}</div>
    <p className="hint">Punkty pochodzą bezpośrednio z hosta. Przeglądarka ich nie przelicza.</p>
  </Card></Layout>;
}
