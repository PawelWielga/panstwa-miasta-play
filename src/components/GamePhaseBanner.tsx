import type { NativeIconName } from './NativeIcon';
import { NativeIcon } from './NativeIcon';

export function GamePhaseBanner({ icon, title, description, tone = 'waiting', showProgress = false }: { icon: NativeIconName; title: string; description: string; tone?: 'waiting' | 'informational' | 'celebratory'; showProgress?: boolean }) {
  return <div className={`phase-banner phase-banner-${tone}`} role="status">
    <NativeIcon name={icon} className="phase-banner-icon" />
    <div className="phase-banner-copy"><strong>{title}</strong><span>{description}</span>{showProgress ? <span className="phase-progress" aria-hidden="true"><i /></span> : null}</div>
  </div>;
}
