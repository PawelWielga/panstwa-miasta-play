import { describe, expect, it } from 'vitest';
import {
  COUNTRIES_CITIES_LETTERS,
  FULL_TURN,
  easedWheelSpinProgress,
  positiveModulo,
  wheelLandingOffset,
  wheelRotation,
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

  it('derives deterministic landing offset from seed entropy', () => {
    const segmentCount = COUNTRIES_CITIES_LETTERS.length;
    const targetIndex = 4;
    const otherTargetIndex = 5;
    const sweep = FULL_TURN / segmentCount;
    const offsets = Array.from({ length: 9 }, (_, entropy) => (
      wheelLandingOffset(entropy * segmentCount + targetIndex)
    ));

    expect(new Set(offsets)).toHaveLength(9);
    expect(Math.min(...offsets)).toBeCloseTo(-4 * sweep / 18, 12);
    expect(Math.max(...offsets)).toBeCloseTo(4 * sweep / 18, 12);
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThan(sweep / 2);
    expect(wheelLandingOffset(segmentCount + targetIndex)).toBe(
      wheelLandingOffset(segmentCount + otherTargetIndex),
    );
  });

  it('keeps shared Android and web motion vectors stable', () => {
    const segmentCount = COUNTRIES_CITIES_LETTERS.length;
    const sweep = FULL_TURN / segmentCount;
    const seeds = [4, 27, 50, 73, 96, 119, 142, 165, 188];
    const expectedTargets = [4, 5, 6, 7, 8, 9, 10, 11, 12];
    const expectedProfiles = [0, 1, 2, 0, 1, 2, 0, 1, 2];
    const expectedOffsetRatios = [
      -2 / 9,
      -1 / 6,
      -1 / 9,
      -1 / 18,
      0,
      1 / 18,
      1 / 9,
      1 / 6,
      2 / 9,
    ];

    for (const [index, seed] of seeds.entries()) {
      expect(seed % segmentCount).toBe(expectedTargets[index]);
      expect(wheelSpinProfileIndex(seed)).toBe(expectedProfiles[index]);
      expect(wheelLandingOffset(seed) / sweep).toBeCloseTo(
        expectedOffsetRatios[index],
        12,
      );
    }
  });

  it('preserves the spinning landing angle when the host reveals the result', () => {
    const segmentCount = COUNTRIES_CITIES_LETTERS.length;
    const targetIndex = 4;
    const seed = 7 * segmentCount + targetIndex;
    const spinStartedAt = 1_000;
    const spinDurationMs = 3_000;
    const common = {
      schemaVersion: 1 as const,
      hostSessionId: 'host-session',
      roundNumber: 1,
      spinId: 'spin-1',
      selectedPlayerId: 'player-1',
      waitingStartedAt: 0,
      waitingDeadlineAt: 10_000,
      spinStartedAt,
      spinDurationMs,
      spinSeed: seed,
      finalTurns: 6,
    };
    const spinning = { ...common, phase: 'spinning' as const };
    const finished = {
      ...common,
      phase: 'finished' as const,
      letter: COUNTRIES_CITIES_LETTERS[targetIndex],
    };
    const atFinish = spinStartedAt + spinDurationMs;
    const spinningRotation = wheelRotation(spinning, atFinish);
    const finishedRotation = wheelRotation(finished, atFinish);
    const segmentAtPointer = (
      Math.round(-finishedRotation / (FULL_TURN / segmentCount)) % segmentCount
      + segmentCount
    ) % segmentCount;

    expect(positiveModulo(spinningRotation, FULL_TURN)).toBeCloseTo(
      positiveModulo(finishedRotation, FULL_TURN),
      9,
    );
    expect(segmentAtPointer).toBe(targetIndex);
  });
});
