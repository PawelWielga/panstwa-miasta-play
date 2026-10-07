import type { CountriesCitiesSettings, GameCategory, PlayerProfile } from '../protocol/messages';
import { Card } from './Layout';
import { NativeIcon } from './NativeIcon';
import { PlayerList } from './PlayerList';
import { useI18n } from '../i18n/appLanguage';

export function GameSettingsCard({ categories, settings, timeMode, players, hostPlayerId, ownPlayerId }: { categories: GameCategory[]; settings: CountriesCitiesSettings | null; timeMode: string | undefined; players: PlayerProfile[]; hostPlayerId: string | undefined; ownPlayerId: string }) {
  const { t } = useI18n();
  return <Card className="lobby-summary-card">
    <SummaryValue label={t('Czas na odpowiedź', 'Answer time')} value={timeModeLabel(timeMode, categories.length, t)} />
    <SummaryValue label={t('Bonus za szybkie odpowiedzi', 'Fast answer bonus')} value={settings?.speedBonusEnabled ? t('Włączony', 'Enabled') : t('Wyłączony', 'Disabled')} checked={settings?.speedBonusEnabled === true} />
    <SummaryValue label={t('Liczba rund', 'Number of rounds')} value={settings ? String(settings.roundCount) : '—'} />
    <div className="lobby-summary-section"><strong className="lobby-summary-label">{t('Kategorie', 'Categories')}</strong>
      {categories.length === 0 ? <span className="muted-copy">{t('Brak ustawionych kategorii.', 'No categories selected.')}</span> : <div className="lobby-category-grid">{categories.map((category) => <span key={category.id}>{category.name}</span>)}</div>}
    </div>
    <div className="lobby-summary-divider" />
    <div className="players-panel-heading"><NativeIcon name="group" /><strong>{t('Gracze', 'Players')}: {players.length}/{settings?.maxPlayers ?? '—'} {t('miejsc', 'slots')}</strong></div>
    <PlayerList players={players} hostPlayerId={hostPlayerId} ownPlayerId={ownPlayerId} />
  </Card>;
}

function SummaryValue({ label, value, checked = false }: { label: string; value: string; checked?: boolean }) {
  return <div className="lobby-summary-section"><strong className="lobby-summary-label">{label}</strong><span className={checked ? 'lobby-summary-value enabled' : 'lobby-summary-value'}>{checked ? <NativeIcon name="check" /> : null}{value}</span></div>;
}

function timeModeLabel(timeMode: string | undefined, categoryCount: number, t: (pl: string, en: string) => string): string {
  if (timeMode === 'no-limit') return `∞ ${t('Bez limitu', 'No limit')}`;
  if (timeMode === 'last-call-10s') return t('Po gotowym', 'After ready');
  if (timeMode === 'per-answer-10s') return `10s / ${t('odpowiedź', 'answer')}`;
  return categoryCount > 0 ? `10s / ${t('odpowiedź', 'answer')}` : '—';
}
