import type { CountriesCitiesAnswerResult, CountriesCitiesSubmission, GameCategory } from '../protocol/messages';

export function CategoryResultsList({ category, submissions, results, ownPlayerId }: { category: GameCategory | undefined; submissions: CountriesCitiesSubmission[]; results: Record<string, CountriesCitiesAnswerResult>; ownPlayerId: string }) {
  if (!category) return <p>Brak wyników do pokazania.</p>;
  return <div className="category-results-view">
    <div className="category-results-header"><span>Kategoria:</span><strong>{category.name}</strong></div>
    <div className="category-results-list">{submissions.map((submission) => {
      const result = resultFor(results, submission.playerId, category.id);
      const answer = submission.answers[category.id] ?? submission.answers[category.name] ?? '';
      const points = result?.points ?? 0;
      const resultTone = answer.trim() === '' || result?.winner === 'wrong' ? 'error' : result?.winner === 'duplicate' ? 'warning' : 'success';
      return <div className={`category-result-card result-${resultTone}${submission.playerId === ownPlayerId ? ' is-me' : ''}`} key={submission.playerId}>
        <div><strong>{submission.playerName}</strong><span className={points > 0 ? 'result-points positive' : 'result-points'}>{points > 0 ? '+' : ''}{String(points)} pkt</span></div>
        <span className={answer.trim() === '' ? 'category-answer empty' : 'category-answer'}>{answer.trim() === '' ? 'Brak odpowiedzi' : answer}</span>
      </div>;
    })}</div>
  </div>;
}

function normalizeCategoryId(value: string): string {
  const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9\s-]/g, '').replace(/[-\s]+/g, ' ').trim().replaceAll(' ', '-');
  return normalized || 'category';
}

function resultFor(results: Record<string, CountriesCitiesAnswerResult>, playerId: string, categoryId: string): CountriesCitiesAnswerResult | undefined {
  return results[`${playerId}::${normalizeCategoryId(categoryId)}`] ?? results[`${playerId}::${categoryId}`];
}
