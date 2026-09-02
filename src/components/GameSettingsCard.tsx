import type { CountriesCitiesSettings, GameCategory, PlayerProfile } from '../protocol/messages';
import { Card } from './Layout';
import { NativeIcon } from './NativeIcon';
import { PlayerList } from './PlayerList';

export function GameSettingsCard({ categories, settings, timeMode, players, hostPlayerId, ownPlayerId }: { categories: GameCategory[]; settings: CountriesCitiesSettings | null; timeMode: string | undefined; players: PlayerProfile[]; hostPlayerId: string | undefined; ownPlayerId: string }) {
  return <Card className="lobby-summary-card">
    <SummaryValue label="Czas na odpowiedź" value={timeModeLabel(timeMode, categories.length)} />
    <SummaryValue label="Bonus za szybkie odpowiedzi" value={settings?.speedBonusEnabled ? 'Włączony' : 'Wyłączony'} checked={settings?.speedBonusEnabled === true} />
    <SummaryValue label="Liczba rund" value={settings ? String(settings.roundCount) : '—'} />
    <div className="lobby-summary-section"><strong className="lobby-summary-label">Kategorie</strong>
      {categories.length === 0 ? <span className="muted-copy">Brak ustawionych kategorii.</span> : <div className="lobby-category-grid">{categories.map((category) => <span key={category.id}>{category.name}</span>)}</div>}
    </div>
    <div className="lobby-summary-divider" />
    <div className="players-panel-heading"><NativeIcon name="group" /><strong>Gracze: {players.length}/{settings?.maxPlayers ?? '—'} miejsc</strong></div>
    <PlayerList players={players} hostPlayerId={hostPlayerId} ownPlayerId={ownPlayerId} />
  </Card>;
}

function SummaryValue({ label, value, checked = false }: { label: string; value: string; checked?: boolean }) {
  return <div className="lobby-summary-section"><strong className="lobby-summary-label">{label}</strong><span className={checked ? 'lobby-summary-value enabled' : 'lobby-summary-value'}>{checked ? <NativeIcon name="check" /> : null}{value}</span></div>;
}

function timeModeLabel(timeMode: string | undefined, categoryCount: number): string {
  if (timeMode === 'no-limit') return '∞ Bez limitu';
  if (timeMode === 'last-call-10s') return 'Po gotowym';
  if (timeMode === 'per-answer-10s') return '10s / odpowiedź';
  return categoryCount > 0 ? '10s / odpowiedź' : '—';
}
