import { useEffect, useMemo, useSyncExternalStore } from 'react';

export type SupportedLanguage = 'pl' | 'en';
export type LanguagePreference = 'system' | SupportedLanguage;

const STORAGE_KEY = 'panstwa-miasta.app-language.v1';
const listeners = new Set<() => void>();
let preference = readPreference();
let lockedLanguage: SupportedLanguage | null = null;

export function resolveSystemLanguage(languages: readonly string[] = browserLanguages()): SupportedLanguage {
  for (const value of languages) {
    const code = value.trim().toLowerCase().split(/[-_]/, 1)[0];
    if (code === 'pl' || code === 'en') return code;
  }
  return 'pl';
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function getEffectiveAppLanguageCode(): SupportedLanguage {
  return lockedLanguage ?? (preference === 'system' ? resolveSystemLanguage() : preference);
}

export function isAppLanguageLocked(): boolean {
  return lockedLanguage !== null;
}

export function setLanguagePreference(next: LanguagePreference): boolean {
  if (lockedLanguage !== null) return false;
  preference = next;
  persistPreference(next);
  applyDocumentLanguage();
  emit();
  return true;
}

export function lockAppLanguage(): SupportedLanguage {
  lockedLanguage ??= preference === 'system' ? resolveSystemLanguage() : preference;
  applyDocumentLanguage();
  emit();
  return lockedLanguage;
}

export function changeLockedAppLanguage(next: SupportedLanguage): void {
  preference = next;
  lockedLanguage = next;
  persistPreference(next);
  applyDocumentLanguage();
  emit();
}

export function unlockAppLanguage(): void {
  if (lockedLanguage === null) return;
  lockedLanguage = null;
  applyDocumentLanguage();
  emit();
}

export function languageDisplayName(code: SupportedLanguage, uiLanguage: SupportedLanguage): string {
  if (uiLanguage === 'en') return code === 'en' ? 'English' : 'Polish';
  return code === 'en' ? 'angielski' : 'polski';
}

export function translateLegacyMessage(message: string, language: SupportedLanguage): string {
  if (language === 'pl') return message;
  return legacyEnglish[message] ?? message;
}

export function useI18n() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [, language] = snapshot.split('|') as [LanguagePreference, SupportedLanguage, string];
  const currentPreference = snapshot.split('|')[0] as LanguagePreference;
  useEffect(() => {
    applyDocumentLanguage();
  }, [language]);
  return useMemo(() => ({
    language,
    preference: currentPreference,
    locked: isAppLanguageLocked(),
    setPreference: setLanguagePreference,
    t: (polish: string, english: string): string => language === 'en' ? english : polish,
  }), [currentPreference, language]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onLanguageChange = (): void => {
    if (preference === 'system' && lockedLanguage === null) {
      applyDocumentLanguage();
      emit();
    }
  };
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY || lockedLanguage !== null) return;
    preference = readPreference();
    applyDocumentLanguage();
    emit();
  };
  window.addEventListener('languagechange', onLanguageChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('languagechange', onLanguageChange);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): string {
  return [preference, getEffectiveAppLanguageCode(), lockedLanguage ?? 'unlocked'].join('|');
}

function emit(): void {
  for (const listener of listeners) listener();
}

function readPreference(): LanguagePreference {
  try {
    const value = globalThis.localStorage.getItem(STORAGE_KEY);
    if (value === 'pl' || value === 'en' || value === 'system') return value;
  } catch {
    // Private mode or blocked storage: keep an ephemeral System preference.
  }
  return 'system';
}

function persistPreference(value: LanguagePreference): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // The language still changes for this tab when persistent storage is unavailable.
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages.length ? navigator.languages : [navigator.language];
}

function applyDocumentLanguage(): void {
  if (typeof document === 'undefined') return;
  const language = getEffectiveAppLanguageCode();
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'City, Country & More' : 'Państwa Miasta';
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) {
    description.content = language === 'en'
      ? 'Join a City, Country & More game hosted on an Android phone.'
      : 'Dołącz do gry Państwa Miasta hostowanej na telefonie z Androidem.';
  }
}

const legacyEnglish: Record<string, string> = {
  'Ta wersja gry jest niezgodna. Odśwież stronę lub poproś prowadzącego o nowy link.':
    'This game version is incompatible. Refresh the page or ask the host for a new link.',
  'Link zawiera więcej niż jeden kod dołączenia.':
    'The link contains more than one join code.',
  'Kod dołączenia jest nieprawidłowy.':
    'The join code is invalid.',
  'Kod dołączenia nie może być pusty.':
    'The join code cannot be empty.',
  'Kod dołączenia ma nieobsługiwany format. Poproś prowadzącego o nowy kod.':
    'The join code uses an unsupported format. Ask the host for a new code.',
  'Kod dołączenia zawiera nieprawidłowy identyfikator pokoju.':
    'The join code contains an invalid room identifier.',
  'Kod dołączenia zawiera nieprawidłową sesję hosta.':
    'The join code contains an invalid host session.',
  'Kod dołączenia zawiera nieprawidłowy sekret.':
    'The join code contains invalid credentials.',
  'Dane dołączenia nie opisują tej samej sesji hosta.':
    'The join data does not describe the same host session.',
  'Kod pokoju musi mieć dokładnie 6 znaków z alfabetu bez I, O, 0 i 1.':
    'The room code must contain exactly 6 characters and cannot use I, O, 0 or 1.',
};

export const appLanguageStorageKey = STORAGE_KEY;
