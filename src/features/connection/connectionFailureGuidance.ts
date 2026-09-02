import { connectionFailureCodes, type ConnectionFailureCode } from '../../protocol/connectionFailure';

export type ConnectionRecoveryAction = 'retry' | 'editConnection' | 'changeNetwork' | 'backToMenu';

export interface ConnectionFailureGuidance {
  title: string;
  message: string;
  primaryAction: ConnectionRecoveryAction;
  actionLabel: string;
  hint: string;
}

const guidanceByCode: Record<ConnectionFailureCode, ConnectionFailureGuidance> = {
  [connectionFailureCodes.invalidJoinCode]: {
    title: 'Nie udało się dołączyć',
    message: 'Kod lub dane pokoju są nieprawidłowe. Poproś prowadzącego o aktualny kod.',
    primaryAction: 'editConnection',
    actionLabel: 'Wpisz kod ponownie',
    hint: 'Poproś prowadzącego o aktualny kod i wpisz go ponownie.',
  },
  [connectionFailureCodes.roomUnavailable]: {
    title: 'Nie znaleziono pokoju',
    message: 'Nie znaleziono pokoju. Sprawdź, czy prowadzący nadal go udostępnia i spróbuj ponownie.',
    primaryAction: 'retry',
    actionLabel: 'Spróbuj ponownie',
    hint: 'Ponowienie użyje tego samego kodu pokoju.',
  },
  [connectionFailureCodes.staleHostSession]: {
    title: 'Kod dotyczy innej sesji',
    message: 'Pod tym kodem działa już inna sesja gry. Poproś prowadzącego o nowy kod.',
    primaryAction: 'editConnection',
    actionLabel: 'Wpisz kod ponownie',
    hint: 'Poproś prowadzącego o nowy kod wygenerowany dla bieżącej gry.',
  },
  [connectionFailureCodes.unsupportedVersion]: {
    title: 'Wersje gry nie są zgodne',
    message: 'Wersje gry nie są zgodne. Zaktualizuj aplikację i poproś prowadzącego o aktualizację.',
    primaryAction: 'backToMenu',
    actionLabel: 'Wróć do menu',
    hint: 'Po aktualizacji prowadzący powinien utworzyć pokój ponownie.',
  },
  [connectionFailureCodes.joinRejected]: {
    title: 'Nie udało się dołączyć',
    message: 'Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.',
    primaryAction: 'editConnection',
    actionLabel: 'Wpisz kod ponownie',
    hint: 'Poproś prowadzącego o aktualny kod przed kolejną próbą.',
  },
  [connectionFailureCodes.roomFull]: {
    title: 'Pokój jest pełny',
    message: 'Pokój jest pełny. Prowadzący ustawił limit graczy dla tej rozgrywki.',
    primaryAction: 'backToMenu',
    actionLabel: 'Wróć do menu',
    hint: 'Poproś prowadzącego o zwolnienie miejsca przed kolejną próbą.',
  },
  [connectionFailureCodes.gameAlreadyStarted]: {
    title: 'Gra już się rozpoczęła',
    message: 'Gra już się rozpoczęła. Poproś prowadzącego o nowy pokój albo spróbuj później.',
    primaryAction: 'editConnection',
    actionLabel: 'Wpisz kod ponownie',
    hint: 'Do trwającej rozgrywki nie można dołączyć jak do nowego pokoju.',
  },
  [connectionFailureCodes.connectionTimeout]: {
    title: 'Połączenie trwa zbyt długo',
    message: 'Prowadzący nie odpowiedział na czas. Sprawdź, czy pokój nadal jest dostępny, i spróbuj ponownie.',
    primaryAction: 'retry',
    actionLabel: 'Spróbuj ponownie',
    hint: 'Jeśli problem się powtarza, poproś prowadzącego o ponowne udostępnienie pokoju.',
  },
  [connectionFailureCodes.p2pNetworkBlocked]: {
    title: 'Ta sieć blokuje grę',
    message: 'Nie udało się nawiązać bezpośredniego połączenia z prowadzącym. Ta sieć blokuje grę przez internet.',
    primaryAction: 'changeNetwork',
    actionLabel: 'Wróć i zmień sieć',
    hint: 'Spróbuj innej sieci Wi‑Fi, internetu komórkowego albo wyłącz VPN. Potem wpisz ponownie ten sam kod pokoju.',
  },
  [connectionFailureCodes.signalingInterrupted]: {
    title: 'Łączenie zostało przerwane',
    message: 'Połączenie zostało przerwane. Spróbuj ponownie.',
    primaryAction: 'retry',
    actionLabel: 'Spróbuj ponownie',
    hint: 'Jeśli gra nadal działa, nie zamykaj jej. W przeciwnym razie spróbuj ponownie.',
  },
  [connectionFailureCodes.gameConnectionLost]: {
    title: 'Utracono połączenie z grą',
    message: 'Połączenie zostało przerwane. Spróbuj ponownie.',
    primaryAction: 'retry',
    actionLabel: 'Spróbuj ponownie',
    hint: 'Ponowienie spróbuje odzyskać połączenie z tym samym pokojem.',
  },
  [connectionFailureCodes.cancelled]: {
    title: 'Dołączanie anulowane',
    message: 'Próba dołączenia została anulowana.',
    primaryAction: 'backToMenu',
    actionLabel: 'Wróć do menu',
    hint: 'Możesz rozpocząć nową próbę z ekranu dołączania.',
  },
  [connectionFailureCodes.unknown]: {
    title: 'Nie udało się połączyć',
    message: 'Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.',
    primaryAction: 'retry',
    actionLabel: 'Spróbuj ponownie',
    hint: 'Jeśli problem się powtarza, poproś prowadzącego o nowy kod pokoju.',
  },
};

export function getConnectionFailureGuidance(code: ConnectionFailureCode | null): ConnectionFailureGuidance {
  return guidanceByCode[code ?? connectionFailureCodes.unknown];
}
