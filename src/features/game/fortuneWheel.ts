import type { CountriesCitiesWheelState } from '../../protocol/messages';

export const COUNTRIES_CITIES_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
  'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'W', 'Z',
] as const;

export const FULL_TURN = Math.PI * 2;

export function wheelSpinProgress(state: CountriesCitiesWheelState, nowMilliseconds: number): number {
  if (state.phase === 'waiting') return 0;
  if (state.phase === 'finished') return 1;
  if (state.spinStartedAt === undefined || state.spinDurationMs === undefined || state.spinDurationMs <= 0) return 0;
  return clamp((nowMilliseconds - state.spinStartedAt) / state.spinDurationMs, 0, 1);
}

export function easedWheelSpinProgress(progress: number): number {
  return cubicBezierTransform(clamp(progress, 0, 1), 0.1, 0, 0.3, 1);
}

export function initialWheelRotation(state: CountriesCitiesWheelState, segments: readonly string[] = COUNTRIES_CITIES_LETTERS): number {
  if (segments.length === 0) return 0;
  const hash = stableHash(state.spinId);
  const sweep = FULL_TURN / segments.length;
  return ((hash % segments.length) + (Math.floor(hash / segments.length) % 1000) / 1000) * sweep;
}

export function wheelRotation(
  state: CountriesCitiesWheelState,
  nowMilliseconds: number,
  segments: readonly string[] = COUNTRIES_CITIES_LETTERS,
): number {
  if (segments.length === 0) return 0;
  const initial = initialWheelRotation(state, segments);
  if (state.phase === 'waiting') return initial;
  if (state.phase === 'finished') return rotationForLetter(segments, state.letter);

  const target = rotationForSeed(segments, state.spinSeed);
  const turns = clamp(Math.trunc(state.finalTurns ?? 6), 1, 20);
  const distance = turns * FULL_TURN + positiveModulo(target - initial, FULL_TURN);
  return initial + easedWheelSpinProgress(wheelSpinProgress(state, nowMilliseconds)) * distance;
}

export function hiddenTargetLetter(
  state: CountriesCitiesWheelState,
  segments: readonly string[] = COUNTRIES_CITIES_LETTERS,
): string | null {
  if (state.phase === 'finished' || state.spinSeed === undefined || segments.length === 0) return null;
  return segments[Math.abs(state.spinSeed) % segments.length] ?? null;
}

export function rotationForSeed(segments: readonly string[], spinSeed: number | undefined): number {
  if (segments.length === 0 || spinSeed === undefined) return 0;
  return rotationForIndex(segments, Math.abs(spinSeed) % segments.length);
}

export function rotationForLetter(segments: readonly string[], letter: string | undefined): number {
  if (segments.length === 0 || letter === undefined) return 0;
  const normalized = letter.trim().toUpperCase();
  const index = segments.findIndex((segment) => segment.trim().toUpperCase() === normalized);
  return index < 0 ? 0 : rotationForIndex(segments, index);
}

export function rotationForIndex(segments: readonly string[], index: number): number {
  if (segments.length === 0) return 0;
  return -index * FULL_TURN / segments.length;
}

export function positiveModulo(value: number, modulus: number): number {
  const remainder = value % modulus;
  return remainder < 0 ? remainder + modulus : remainder;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) & 0x7fffffff;
  }
  return hash;
}

function cubicBezierTransform(progress: number, x1: number, y1: number, x2: number, y2: number): number {
  if (progress <= 0 || progress >= 1) return progress;
  let parameter = progress;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const x = cubicCoordinate(parameter, x1, x2) - progress;
    const derivative = cubicDerivative(parameter, x1, x2);
    if (Math.abs(x) < 1e-7 || Math.abs(derivative) < 1e-7) break;
    parameter = clamp(parameter - x / derivative, 0, 1);
  }
  return cubicCoordinate(parameter, y1, y2);
}

function cubicCoordinate(t: number, point1: number, point2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * point1 + 3 * inverse * t * t * point2 + t * t * t;
}

function cubicDerivative(t: number, point1: number, point2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * point1 + 6 * inverse * t * (point2 - point1) + 3 * t * t * (1 - point2);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
