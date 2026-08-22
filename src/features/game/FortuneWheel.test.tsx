import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CountriesCitiesWheelState } from '../../protocol/messages';
import { FortuneWheel } from './FortuneWheel';

const spinningState: CountriesCitiesWheelState = {
  schemaVersion: 1,
  phase: 'spinning',
  hostSessionId: 'session-1',
  roundNumber: 1,
  spinId: 'spin-1',
  selectedPlayerId: 'player-1',
  waitingStartedAt: 1_000,
  waitingDeadlineAt: 11_000,
  spinStartedAt: 2_000,
  spinDurationMs: 6_000,
  spinSeed: 4,
  finalTurns: 6,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FortuneWheel', () => {
  it('renders the host-provided letter pool instead of the fallback list', () => {
    mockReducedMotion(true);
    const { container } = render(
      <FortuneWheel
        wheelState={{ ...spinningState, letterPool: ['A', 'B', 'Ł'] }}
        now={() => 2_500}
      />,
    );

    expect(
      Array.from(container.querySelectorAll('.fortune-wheel-label')).map((label) => label.textContent),
    ).toEqual(['A', 'B', 'Ł']);
  });

  it('recalculates spinning rotation from host time when the tab becomes visible', () => {
    mockReducedMotion(false);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    let hostNow = 2_500;

    const { container } = render(<FortuneWheel wheelState={spinningState} now={() => hostNow} />);
    const rotor = container.querySelector<SVGGElement>('.fortune-wheel-rotor');
    expect(rotor).not.toBeNull();
    const rotationBeforeResume = rotor?.style.transform;

    hostNow = 5_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(rotor?.style.transform).not.toBe(rotationBeforeResume);
  });

  it('keeps the spinning wheel static when reduced motion is preferred', () => {
    mockReducedMotion(true);
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame');
    let hostNow = 2_500;

    const { container, rerender } = render(<FortuneWheel wheelState={spinningState} now={() => hostNow} />);
    const rotor = container.querySelector<SVGGElement>('.fortune-wheel-rotor');
    expect(rotor).not.toBeNull();
    const reducedMotionRotation = rotor?.style.transform;

    hostNow = 7_000;
    rerender(<FortuneWheel wheelState={{ ...spinningState }} now={() => hostNow} />);

    expect(rotor?.style.transform).toBe(reducedMotionRotation);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

function mockReducedMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}
