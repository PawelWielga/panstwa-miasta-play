import { useApp } from '../../app/AppContext';
import { CategoryResultsList } from '../../components/CategoryResultsList';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Card, Layout } from '../../components/Layout';

export function RevealScreen() {
  const { state } = useApp();
  const snapshot = state.snapshot;
  const index = snapshot?.round?.categoryIndex ?? state.reviewCategoryIndex;
  const category = (snapshot?.round?.categories ?? state.categories)[index];
  const submissions = snapshot ? Object.values(snapshot.submissions) : state.reviewSubmissions;
  const results = snapshot?.finalResults ?? state.revealResults;
  return <Layout><ConnectionBanner /><Card className="game-card"><CategoryResultsList category={category} submissions={submissions} results={results} ownPlayerId={state.identity.playerId} /></Card></Layout>;
}
