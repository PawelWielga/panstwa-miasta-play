import type { CountriesCitiesSettings, GameCategory } from '../protocol/messages';
import { Card } from './Layout';

export function GameSettingsCard({ categories, settings, timeMode }: { categories: GameCategory[]; settings: CountriesCitiesSettings | null; timeMode?: string }) {
  return <Card className="settings-card"><h2>Ustawienia gry</h2>
    <dl className="settings-grid">
      <div><dt>Rundy</dt><dd>{settings?.roundCount ?? '—'}</dd></div>
      <div><dt>Czas</dt><dd>{timeMode === 'no-limit' ? 'Bez limitu' : settings ? `${settings.answerDurationSeconds} s` : '—'}</dd></div>
      <div><dt>Gracze</dt><dd>maks. {settings?.maxPlayers ?? '—'}</dd></div>
      <div><dt>Bonus szybkości</dt><dd>{settings?.speedBonusEnabled ? 'Tak' : 'Nie'}</dd></div>
    </dl>
    <h3>Kategorie</h3><div className="chips">{categories.map((category) => <span className="chip" key={category.id}>{category.name}</span>)}</div>
  </Card>;
}
