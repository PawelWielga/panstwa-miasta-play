import { describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from './gameStore';
import { connectionFailureCodes } from '../protocol/connectionFailure';
import { createPlayerIdentity } from '../storage/playerIdentityStorage';

describe('gameReducer', () => {
  it('applies host messages without calculating scores locally', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity({ playerName: 'Ala' }), null);
    const state = gameReducer(initial, { type: 'host-message', receivedAt: 10, message: { type: 'countries-cities:results', finalResults: {}, roundScores: { [initial.identity.playerId]: 10 }, finalScores: { [initial.identity.playerId]: 25 } } });
    expect(state.finalScores[initial.identity.playerId]).toBe(25);
  });
  it('stores a stable code instead of host-provided text for terminal join rejection', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    const state = gameReducer(initial, {
      type: 'host-message',
      receivedAt: 10,
      message: { type: 'game:error', code: 'room_full', message: 'technical host details' },
    });
    expect(state.connectionError).toBe(connectionFailureCodes.roomFull);
    expect(state.notice).toBeNull();
  });

  it('keeps unsent answers in memory across rerenders', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    expect(gameReducer(initial, { type: 'answer', categoryId: 'city', value: 'Augustów' }).answers.city).toBe('Augustów');
  });
});
