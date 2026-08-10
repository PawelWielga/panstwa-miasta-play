import { useEffect, useState } from 'react';
import type { CountriesCitiesWheelState } from '../../protocol/messages';
import {
  COUNTRIES_CITIES_LETTERS,
  hiddenTargetLetter,
  wheelRotation,
  wheelSpinProgress,
} from './fortuneWheel';
import './FortuneWheel.css';

interface FortuneWheelProps {
  wheelState: CountriesCitiesWheelState;
  usedLetters?: readonly string[];
  now?: () => number;
}

export function FortuneWheel({ wheelState, usedLetters = [], now = Date.now }: FortuneWheelProps) {
  const reducedMotion = useReducedMotion();
  const currentTime = useWheelClock(wheelState, reducedMotion, now);
  const segments: readonly string[] = wheelState.letterPool?.length
    ? wheelState.letterPool
    : COUNTRIES_CITIES_LETTERS;
  const hiddenTarget = hiddenTargetLetter(wheelState, segments);
  const normalizedUsedLetters = new Set(
    usedLetters
      .map((letter) => letter.trim().toUpperCase())
      .filter((letter) => segments.includes(letter))
      .filter((letter) => letter !== hiddenTarget),
  );
  const revealedLetter = wheelState.phase === 'finished' ? wheelState.letter : undefined;
  const animationTime = reducedMotion && wheelState.phase === 'spinning'
    ? wheelState.spinStartedAt ?? currentTime
    : currentTime;
  const rotation = wheelRotation(wheelState, animationTime, segments);
  const rotationDegrees = rotation * 180 / Math.PI;

  return (
    <div
      className="fortune-wheel"
      role="img"
      aria-label={revealedLetter ? `Koło fortuny. Wylosowana litera ${revealedLetter}.` : 'Koło fortuny. Wynik jest ukryty.'}
      data-testid="fortune-wheel"
      data-spin-id={wheelState.spinId}
    >
      <div className="fortune-wheel-stage">
        <div className="fortune-wheel-pointer" aria-hidden="true" />
        <svg className="fortune-wheel-surface" viewBox="0 0 320 320" aria-hidden="true">
          <g className="fortune-wheel-rotor" style={{ transform: `rotate(${String(rotationDegrees)}deg)` }}>
            {segments.map((letter, index) => {
              const used = normalizedUsedLetters.has(letter);
              const revealed = revealedLetter === letter;
              const geometry = segmentGeometry(index, segments.length);
              return (
                <g key={letter}>
                  <path
                    d={geometry.path}
                    className={`fortune-wheel-segment ${index % 2 === 0 ? 'is-even' : 'is-odd'}${used ? ' is-used' : ''}${revealed ? ' is-revealed' : ''}`}
                  />
                  <text
                    x={geometry.labelX}
                    y={geometry.labelY}
                    className={`fortune-wheel-label${used ? ' is-used' : ''}${revealed ? ' is-revealed' : ''}`}
                    transform={['rotate(', geometry.labelRotation, ' ', geometry.labelX, ' ', geometry.labelY, ')'].map(String).join('')}
                  >
                    {letter}
                  </text>
                </g>
              );
            })}
            <circle className="fortune-wheel-rim" cx="160" cy="160" r="143" />
          </g>
        </svg>
        <div className="fortune-wheel-hub" aria-hidden="true">{revealedLetter ?? '?'}</div>
      </div>
    </div>
  );
}

function useWheelClock(
  wheelState: CountriesCitiesWheelState,
  reducedMotion: boolean,
  now: () => number,
): number {
  const [currentTime, setCurrentTime] = useState(() => now());

  useEffect(() => {
    if (wheelState.phase !== 'spinning' || reducedMotion) return undefined;

    let frame: number | null = null;
    const schedule = (): void => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    const update = (): void => {
      frame = null;
      const timestamp = now();
      setCurrentTime(timestamp);
      if (wheelSpinProgress(wheelState, timestamp) < 1) schedule();
    };
    schedule();

    const handleVisibility = (): void => {
      if (document.visibilityState !== 'visible') return;
      const timestamp = now();
      setCurrentTime(timestamp);
      if (wheelSpinProgress(wheelState, timestamp) < 1) schedule();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [now, reducedMotion, wheelState]);

  return currentTime;
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (): void => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reducedMotion;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function segmentGeometry(index: number, segmentCount: number): {
  path: string;
  labelX: number;
  labelY: number;
  labelRotation: number;
} {
  const center = 160;
  const radius = 140;
  const labelRadius = 114;
  const sweep = 360 / segmentCount;
  const startAngle = -90 - sweep / 2 + index * sweep;
  const endAngle = startAngle + sweep;
  const middleAngle = startAngle + sweep / 2;
  const start = polarPoint(center, center, radius, startAngle);
  const end = polarPoint(center, center, radius, endAngle);
  const label = polarPoint(center, center, labelRadius, middleAngle);
  const path = ['M', center, center, 'L', start.x, start.y, 'A', radius, radius, 0, 0, 1, end.x, end.y, 'Z']
    .map(String)
    .join(' ');
  return {
    path,
    labelX: label.x,
    labelY: label.y,
    labelRotation: middleAngle + 90,
  };
}

function polarPoint(centerX: number, centerY: number, radius: number, angleDegrees: number): { x: number; y: number } {
  const radians = angleDegrees * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}
