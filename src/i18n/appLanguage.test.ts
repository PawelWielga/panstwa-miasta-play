import { afterEach, describe, expect, it } from 'vitest';
import {
  appLanguageStorageKey,
  getEffectiveAppLanguageCode,
  getLanguagePreference,
  lockAppLanguage,
  resolveSystemLanguage,
  setLanguagePreference,
  translateLegacyMessage,
  unlockAppLanguage,
} from './appLanguage';

afterEach(() => {
  unlockAppLanguage();
  setLanguagePreference('system');
  window.localStorage.clear();
});

describe('application language', () => {
  it('resolves supported browser languages and falls back to Polish', () => {
    expect(resolveSystemLanguage(['en-US'])).toBe('en');
    expect(resolveSystemLanguage(['de-DE', 'en-GB'])).toBe('en');
    expect(resolveSystemLanguage(['de-DE'])).toBe('pl');
    expect(resolveSystemLanguage(['pl-PL'])).toBe('pl');
  });

  it('persists a manual preference and locks language for an active session', () => {
    expect(setLanguagePreference('en')).toBe(true);
    expect(getLanguagePreference()).toBe('en');
    expect(getEffectiveAppLanguageCode()).toBe('en');
    expect(window.localStorage.getItem(appLanguageStorageKey)).toBe('en');

    expect(lockAppLanguage()).toBe('en');
    expect(setLanguagePreference('pl')).toBe(false);
    expect(getLanguagePreference()).toBe('en');
    expect(getEffectiveAppLanguageCode()).toBe('en');

    unlockAppLanguage();
    expect(setLanguagePreference('pl')).toBe(true);
    expect(getLanguagePreference()).toBe('pl');
    expect(window.localStorage.getItem(appLanguageStorageKey)).toBe('pl');
  });

  it('translates legacy join validation without exposing Polish in English UI', () => {
    expect(translateLegacyMessage('Kod dołączenia nie może być pusty.', 'en'))
      .toBe('The join code cannot be empty.');
    expect(translateLegacyMessage('Kod dołączenia nie może być pusty.', 'pl'))
      .toBe('Kod dołączenia nie może być pusty.');
  });
});
