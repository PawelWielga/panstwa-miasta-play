import { useApp } from '../../app/AppContext';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';

export function ReviewScreen() {
  const { state } = useApp();
  const snapshot = state.snapshot;
  const categoryIndex = snapshot?.round?.categoryIndex ?? state.reviewCategoryIndex;
  const category = (snapshot?.round?.categories ?? state.categories)[categoryIndex];
  const submissions = snapshot ? Object.values(snapshot.submissions) : state.reviewSubmissions;
  return <Layout><ConnectionBanner /><Card><span className="eyebrow">Ocenianie</span><h1>{category?.name ?? 'Odpowiedzi graczy'}</h1><p>Odpowiedzi ocenia prowadzący na telefonie. Ten ekran aktualizuje się automatycznie.</p>
    <div className="review-list">{submissions.map((submission) => <div className="review-row" key={submission.playerId}><strong>{submission.playerName}</strong><span>{category ? submission.answers[category.id] ?? submission.answers[category.name] ?? '—' : '—'}</span></div>)}</div>
    <div className="waiting-line"><span className="mini-spinner" /> Czekamy na ocenę hosta…</div>
  </Card></Layout>;
}
