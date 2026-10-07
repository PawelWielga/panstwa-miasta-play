import { describe, expect, it } from 'vitest';
import { resolveSystemLanguage, translateLegacyMessage } from './appLanguage';

describe('application language', () => {
  it('resolves supported browser languages and falls back to Polish', () => {
    expect(resolveSystemLanguage(['en-US'])).toBe('en');
    expect(resolveSystemLanguage(['de-DE', 'en-GB'])).toBe('en');
    expect(resolveSystemLanguage(['de-DE'])).toBe('pl');
    expect(resolveSystemLanguage(['pl-PL'])).toBe('pl');
  });

  it('translates legacy join validation without exposing Polish in English UI', () => {
    expect(translateLegacyMessage('Kod dołączenia nie może być pusty.', 'en'))
      .toBe('The join code cannot be empty.');
    expect(translateLegacyMessage('Kod dołączenia nie może być pusty.', 'pl'))
      .toBe('Kod dołączenia nie może być pusty.');
  });
});
