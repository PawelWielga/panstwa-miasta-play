import { HOST_VERSION_UNSUPPORTED_MESSAGE } from '../../config/hostCompatibility';

export type ConnectionRecoveryAction = 'retry' | 'editConnection' | 'changeNetwork' | 'backToMenu';

export interface ConnectionFailureGuidance {
  title: string;
  message: string;
  primaryAction: ConnectionRecoveryAction;
  actionLabel: string;
  hint: string;
}

const invalidInvitation: ConnectionFailureGuidance = {
  title: 'Nie udało się dołączyć',
  message: 'Kod lub dane pokoju są nieprawidłowe. Poproś prowadzącego o aktualny kod.',
  primaryAction: 'editConnection',
  actionLabel: 'Wpisz kod ponownie',
  hint: 'Poproś prowadzącego o aktualny kod i wpisz go ponownie.',
};

const unreachable: ConnectionFailureGuidance = {
  title: 'Nie znaleziono pokoju',
  message: 'Nie znaleziono pokoju. Sprawdź, czy prowadzący nadal go udostępnia i spróbuj ponownie.',
  primaryAction: 'retry',
  actionLabel: 'Spróbuj ponownie',
  hint: 'Ponowienie użyje tego samego kodu pokoju.',
};

const timeout: ConnectionFailureGuidance = {
  title: 'Połączenie trwa zbyt długo',
  message: 'Połączenie trwało zbyt długo. Sprawdź sieć i spróbuj ponownie.',
  primaryAction: 'retry',
  actionLabel: 'Spróbuj ponownie',
  hint: 'Ponowienie użyje tego samego kodu pokoju.',
};

const onlineUnavailable: ConnectionFailureGuidance = {
  title: 'Ta sieć nie pozwala się połączyć',
  message: 'Nie udało się połączyć przez tę sieć. Użyj innej sieci albo hotspotu.',
  primaryAction: 'changeNetwork',
  actionLabel: 'Użyj innej sieci',
  hint: 'Po zmianie sieci wpisz ponownie ten sam kod pokoju.',
};

const roomFull: ConnectionFailureGuidance = {
  title: 'Pokój jest pełny',
  message: 'Pokój jest pełny. Prowadzący ustawił limit graczy.',
  primaryAction: 'backToMenu',
  actionLabel: 'Wróć do menu',
  hint: 'Poproś prowadzącego o zwolnienie miejsca przed kolejną próbą.',
};

const gameAlreadyStarted: ConnectionFailureGuidance = {
  title: 'Gra już się rozpoczęła',
  message: 'Gra już się rozpoczęła. Poproś prowadzącego o nowy pokój.',
  primaryAction: 'editConnection',
  actionLabel: 'Wpisz kod ponownie',
  hint: 'Do trwającej rozgrywki nie można dołączyć jak do nowego pokoju.',
};

const interrupted: ConnectionFailureGuidance = {
  title: 'Połączenie zostało przerwane',
  message: 'Połączenie zostało przerwane. Spróbuj ponownie.',
  primaryAction: 'retry',
  actionLabel: 'Spróbuj ponownie',
  hint: 'Ponowienie spróbuje odzyskać połączenie z tym samym pokojem.',
};

const unknown: ConnectionFailureGuidance = {
  title: 'Nie udało się połączyć',
  message: 'Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.',
  primaryAction: 'retry',
  actionLabel: 'Spróbuj ponownie',
  hint: 'Jeśli problem się powtarza, poproś prowadzącego o nowy kod pokoju.',
};

export function getConnectionFailureGuidance(error: string | null): ConnectionFailureGuidance {
  if (error === HOST_VERSION_UNSUPPORTED_MESSAGE) {
    return {
      title: 'Prowadzący musi zaktualizować grę',
      message: HOST_VERSION_UNSUPPORTED_MESSAGE,
      primaryAction: 'backToMenu',
      actionLabel: 'Wróć do menu',
      hint: 'Po aktualizacji aplikacji prowadzący powinien utworzyć pokój ponownie.',
    };
  }

  const message = normalize(error);
  if (containsAny(message, ['pokój jest pełny', 'pokoj jest pelny', 'room_full', 'room full'])) return roomFull;
  if (containsAny(message, ['gra już się rozpoczęła', 'gra juz sie rozpoczela', 'game_already_started'])) return gameAlreadyStarted;
  if (containsAny(message, [
    'kod pokoju jest nieprawidłowy', 'kod pokoju jest nieprawidlowy',
    'nie udało się potwierdzić', 'nie udalo sie potwierdzic', 'nowy kod dołączenia', 'nowy kod dolaczenia',
    'nieprawidłowy kod', 'nieprawidlowy kod', 'invalid-id',
  ])) return invalidInvitation;
  if (containsAny(message, ['nie odpowiedział na czas', 'nie odpowiedzial na czas', 'połączenie trwało zbyt długo', 'polaczenie trwalo zbyt dlugo', 'timeout'])) return timeout;
  if (containsAny(message, [
    'ta sieć blokuje', 'ta siec blokuje', 'nie udało się połączyć z usługą gry', 'nie udalo sie polaczyc z usluga gry',
    'usługa połączeń jest chwilowo niedostępna', 'usluga polaczen jest chwilowo niedostepna',
    'użyj innej sieci', 'uzyj innej sieci', 'hotspot',
  ])) return onlineUnavailable;
  if (containsAny(message, [
    'połączenie zostało przerwane', 'polaczenie zostalo przerwane', 'utracono połączenie', 'utracono polaczenie',
    'automatyczne ponowne łączenie nie powiodło się', 'automatyczne ponowne laczenie nie powiodlo sie',
  ])) return interrupted;
  if (containsAny(message, [
    'brak aktywnego pokoju', 'nie znaleziono hosta', 'host niedostępny', 'host niedostepny',
    'nie udało się połączyć z prowadzącym', 'nie udalo sie polaczyc z prowadzacym',
  ])) return unreachable;
  return unknown;
}

function normalize(value: string | null): string {
  return value?.trim().toLocaleLowerCase('pl-PL') ?? '';
}

function containsAny(value: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}
