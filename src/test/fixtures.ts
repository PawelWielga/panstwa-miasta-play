import { vi } from 'vitest';
import type { AppActions } from '../app/AppContext';
import type { AppState } from '../state/gameStore';
import type { PlayerIdentity } from '../storage/playerIdentityStorage';

export const identity: PlayerIdentity = {
  playerId: 'player-1', reconnectToken: 'secret-token', playerName: 'Ala', playerEmoji: '🦊', playerColor: '#6d4aff',
  profile: { id: 'player-1', name: 'Ala', emoji: '🦊', color: '#6d4aff' },
};
export function appState(overrides: Partial<AppState> = {}): AppState {
  return {
    identity, joinParameters: { roomId: 'ABC234' }, connectionStatus: 'connected', connectionError: null,
    players: [identity.profile, { id: 'host', name: 'Host', emoji: '🎲', color: '#000000' }], snapshot: null,
    categories: [{ id: 'city', name: 'Miasto', order: 0 }], settings: { answerDurationSeconds: 90, roundCount: 5, maxPlayers: 8, speedBonusEnabled: false },
    hostControlsReview: true, currentLetter: 'A', deadlineAt: null, reviewSubmissions: [], reviewCategoryIndex: 0, revealResults: {}, roundScores: {}, finalScores: {},
    answers: {}, answersSubmitted: false, localReady: false, lastHostActivityAt: Date.now(), lastSeenSequenceNumber: 1, gameId: 'g1', notice: null,
    ...overrides,
  };
}
export function appActions(): AppActions {
  return {
    updateIdentity: vi.fn((values: Pick<PlayerIdentity, 'playerName' | 'playerEmoji' | 'playerColor'>) => ({ ...identity, ...values })), connect: vi.fn(() => Promise.resolve()), cancel: vi.fn(), retry: vi.fn(), toggleReady: vi.fn(),
    setAnswer: vi.fn(), submitAnswers: vi.fn(), editAnswers: vi.fn(), clearNotice: vi.fn(),
  };
}
