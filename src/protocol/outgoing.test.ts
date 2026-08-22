import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX_LENGTH,
  CATEGORY_ID_MAX_LENGTH,
  MAX_COUNTRIES_CITIES_CATEGORIES,
  MAX_MESSAGE_BYTES,
  REQUEST_ID_MAX_LENGTH,
  SUPPORTED_GAME_PROTOCOL_VERSION,
} from './constants';
import { createFinalizationSubmit, createPlayerHello, createRejoin, createStartWheelSpin, createSubmit, createWheelSpinHoldStarted } from './outgoing';

const profile = { id: 'player-1', name: 'Ala', color: '#6d4aff', emoji: '🦊' };

describe('outgoing protocol version', () => {
  it('uses the internal version for player hello', () => {
    expect(createPlayerHello({ profile, reconnectToken: 'reconnect-token' })).toMatchObject({
      type: 'player:hello',
      protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION,
    });
  });

  it('uses the internal version for reconnect', () => {
    expect(createRejoin(profile, 7)).toMatchObject({
      type: 'client:rejoin',
      protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION,
    });
  });
});

describe('countries-cities submit bounds', () => {
  it('builds a tagged finalization submit with a reusable requestId', () => {
    const message = createFinalizationSubmit(profile, { city: 'Augustów' }, 3, 'final-3', 'request-fixed');
    expect(message).toEqual({
      type: 'countries-cities:submit',
      player: profile,
      answers: { city: 'Augustów' },
      roundNumber: 3,
      finalizationId: 'final-3',
      senderId: profile.id,
      requestId: 'request-fixed',
    });
    expect(createFinalizationSubmit(profile, { city: 'Augustów' }, 3, 'final-3', 'request-fixed')).toEqual(message);
  });

  it('keeps a maximum tagged finalization submit below 64 KiB', () => {
    const answers = Object.fromEntries(Array.from({ length: MAX_COUNTRIES_CITIES_CATEGORIES }, (_, index) => [
      `category-${String(index + 1)}`.padEnd(CATEGORY_ID_MAX_LENGTH, 'x'),
      'Ż'.repeat(ANSWER_MAX_LENGTH),
    ]));
    const message = createFinalizationSubmit(
      profile,
      answers,
      99,
      'f'.repeat(REQUEST_ID_MAX_LENGTH),
      'r'.repeat(REQUEST_ID_MAX_LENGTH),
    );

    expect(Object.keys(message.answers)).toHaveLength(MAX_COUNTRIES_CITIES_CATEGORIES);
    expect(Object.keys(message.answers).every((id) => id.length === CATEGORY_ID_MAX_LENGTH)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(message)).byteLength).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
  });

  it('rejects oversized answer maps', () => {
    const answers = Object.fromEntries(Array.from({ length: MAX_COUNTRIES_CITIES_CATEGORIES }, (_, index) => [
      `category-${String(index + 1)}`,
      'Ż'.repeat(ANSWER_MAX_LENGTH),
    ]));
    expect(() => createSubmit(profile, { ...answers, extra: 'A' })).toThrow();
    expect(() => createSubmit(profile, { ['k'.repeat(CATEGORY_ID_MAX_LENGTH + 1)]: 'A' })).toThrow();
    expect(() => createSubmit(profile, { city: 'A'.repeat(ANSWER_MAX_LENGTH + 1) })).toThrow();
  });
});

describe('wheel intent', () => {
  it('copies authoritative identifiers and optional hold duration into the start intent', () => {
    const wheelState = {
      schemaVersion: 1 as const,
      phase: 'waiting' as const,
      hostSessionId: 'session-1',
      roundNumber: 3,
      spinId: 'spin-3',
      selectedPlayerId: profile.id,
      waitingStartedAt: 1_000,
      waitingDeadlineAt: 11_000,
    };
    const holdMessage = createWheelSpinHoldStarted(profile.id, wheelState);
    const message = createStartWheelSpin(profile.id, wheelState, 1250, holdMessage.holdId);

    expect(holdMessage).toMatchObject({
      type: 'player:wheelSpinHoldStarted',
      senderId: profile.id,
      hostSessionId: 'session-1',
      roundNumber: 3,
      spinId: 'spin-3',
    });
    expect(holdMessage.holdId).not.toBe('');
    expect(message).toMatchObject({
      type: 'player:startWheelSpin',
      senderId: profile.id,
      hostSessionId: 'session-1',
      roundNumber: 3,
      spinId: 'spin-3',
      holdDurationMs: 1250,
      holdId: holdMessage.holdId,
    });
    expect(message).toHaveProperty('requestId');
    expect(message).toHaveProperty('sentAt');
    expect(createStartWheelSpin(profile.id, wheelState)).not.toHaveProperty('holdDurationMs');
  });
});
