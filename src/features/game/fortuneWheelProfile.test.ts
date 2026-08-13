import { describe, expect, it } from 'vitest';
import {
  COUNTRIES_CITIES_LETTERS,
  easedWheelSpinProgress,
  wheelSpinProfileIndex,
} from './fortuneWheel';

describe('fortune wheel spin profiles', () => {
  it('derives profile only from seed entropy, not target segment', () => {
    const segmentCount = COUNTRIES_CITIES_LETTERS.length;
    const firstTargetIndex = 4;
    const secondTargetIndex = 5;

    expect(wheelSpinProfileIndex(firstTargetIndex)).toBe(0);
    expect(wheelSpinProfileIndex(segmentCount + firstTargetIndex)).toBe(1);
    expect(wheelSpinProfileIndex(2 * segmentCount + firstTargetIndex)).toBe(2);
    expect(wheelSpinProfileIndex(segmentCount + firstTargetIndex)).toBe(
      wheelSpinProfileIndex(segmentCount + secondTargetIndex),
    );
  });

  it('provides distinct deterministic deceleration while ending together', () => {
    const segmentCount = COUNTRIES_CITIES_LETTERS.length;
    const targetIndex = 4;
    const seeds = [
      targetIndex,
      segmentCount + targetIndex,
      2 * segmentCount + targetIndex,
    ];

    const halfway = seeds.map((seed) => easedWheelSpinProgress(0.5, seed));
    expect(new Set(halfway)).toHaveLength(3);

    for (const seed of seeds) {
      expect(easedWheelSpinProgress(0, seed)).toBe(0);
      expect(easedWheelSpinProgress(0.7, seed)).toBeGreaterThan(0.9);
      expect(easedWheelSpinProgress(1, seed)).toBe(1);
    }
  });
});
