import { connectionFailureCodes, localConnectionFailureCodes, type ConnectionFailureCode } from '../../protocol/connectionFailure';
import type { SupportedLanguage } from '../../i18n/appLanguage';

export type ConnectionRecoveryAction = 'retry' | 'editConnection' | 'changeNetwork' | 'backToMenu';

export interface ConnectionFailureGuidance {
  title: string;
  message: string;
  primaryAction: ConnectionRecoveryAction;
  actionLabel: string;
  hint: string;
}

export function getConnectionFailureGuidance(
  code: ConnectionFailureCode | null,
  language: SupportedLanguage = 'pl',
): ConnectionFailureGuidance {
  const t = (pl: string, en: string): string => language === 'en' ? en : pl;
  const guidanceByCode: Record<ConnectionFailureCode, ConnectionFailureGuidance> = {
    [connectionFailureCodes.invalidJoinCode]: {
      title: t('Nie udało się dołączyć', 'Could not join'),
      message: t('Kod lub dane pokoju są nieprawidłowe. Poproś prowadzącego o aktualny kod.', 'The room code or join data is invalid. Ask the host for the current code.'),
      primaryAction: 'editConnection',
      actionLabel: t('Wpisz kod ponownie', 'Enter the code again'),
      hint: t('Poproś prowadzącego o aktualny kod i wpisz go ponownie.', 'Ask the host for the current code and enter it again.'),
    },
    [connectionFailureCodes.roomUnavailable]: {
      title: t('Nie znaleziono pokoju', 'Room not found'),
      message: t('Nie znaleziono pokoju. Sprawdź, czy prowadzący nadal go udostępnia i spróbuj ponownie.', 'The room could not be found. Check that the host is still sharing it and try again.'),
      primaryAction: 'retry',
      actionLabel: t('Spróbuj ponownie', 'Try again'),
      hint: t('Ponowienie użyje tego samego kodu pokoju.', 'Retry will use the same room code.'),
    },
    [connectionFailureCodes.staleHostSession]: {
      title: t('Kod dotyczy innej sesji', 'Code belongs to another session'),
      message: t('Pod tym kodem działa już inna sesja gry. Poproś prowadzącego o nowy kod.', 'A different game session is already using this code. Ask the host for a new code.'),
      primaryAction: 'editConnection',
      actionLabel: t('Wpisz kod ponownie', 'Enter the code again'),
      hint: t('Poproś prowadzącego o nowy kod wygenerowany dla bieżącej gry.', 'Ask the host for a new code generated for the current game.'),
    },
    [connectionFailureCodes.unsupportedVersion]: {
      title: t('Wersje gry nie są zgodne', 'Game versions do not match'),
      message: t('Wersje gry nie są zgodne. Zaktualizuj aplikację i poproś prowadzącego o aktualizację.', 'The game versions do not match. Update the app and ask the host to update too.'),
      primaryAction: 'backToMenu',
      actionLabel: t('Wróć do menu', 'Back to menu'),
      hint: t('Po aktualizacji prowadzący powinien utworzyć pokój ponownie.', 'After updating, the host should create the room again.'),
    },
    [connectionFailureCodes.joinRejected]: {
      title: t('Nie udało się dołączyć', 'Could not join'),
      message: t('Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.', 'Could not join the game. Try again or ask the host for the current code.'),
      primaryAction: 'editConnection',
      actionLabel: t('Wpisz kod ponownie', 'Enter the code again'),
      hint: t('Poproś prowadzącego o aktualny kod przed kolejną próbą.', 'Ask the host for the current code before trying again.'),
    },
    [connectionFailureCodes.roomFull]: {
      title: t('Pokój jest pełny', 'Room is full'),
      message: t('Pokój jest pełny. Prowadzący ustawił limit graczy dla tej rozgrywki.', 'The room is full. The host set a player limit for this game.'),
      primaryAction: 'backToMenu',
      actionLabel: t('Wróć do menu', 'Back to menu'),
      hint: t('Poproś prowadzącego o zwolnienie miejsca przed kolejną próbą.', 'Ask the host to free a slot before trying again.'),
    },
    [connectionFailureCodes.gameAlreadyStarted]: {
      title: t('Gra już się rozpoczęła', 'Game already started'),
      message: t('Gra już się rozpoczęła. Poproś prowadzącego o nowy pokój albo spróbuj później.', 'The game has already started. Ask the host for a new room or try again later.'),
      primaryAction: 'editConnection',
      actionLabel: t('Wpisz kod ponownie', 'Enter the code again'),
      hint: t('Do trwającej rozgrywki nie można dołączyć jak do nowego pokoju.', 'You cannot join an active game as a new player.'),
    },
    [connectionFailureCodes.connectionTimeout]: {
      title: t('Połączenie trwa zbyt długo', 'Connection is taking too long'),
      message: t('Prowadzący nie odpowiedział na czas. Sprawdź, czy pokój nadal jest dostępny, i spróbuj ponownie.', 'The host did not respond in time. Check that the room is still available and try again.'),
      primaryAction: 'retry',
      actionLabel: t('Spróbuj ponownie', 'Try again'),
      hint: t('Jeśli problem się powtarza, poproś prowadzącego o ponowne udostępnienie pokoju.', 'If the problem continues, ask the host to share the room again.'),
    },
    [connectionFailureCodes.p2pNetworkBlocked]: {
      title: t('Ta sieć blokuje grę', 'This network blocks the game'),
      message: t('Nie udało się nawiązać bezpośredniego połączenia z prowadzącym. Ta sieć blokuje grę przez internet.', 'A direct connection to the host could not be established. This network blocks internet play.'),
      primaryAction: 'changeNetwork',
      actionLabel: t('Wróć i zmień sieć', 'Go back and change network'),
      hint: t('Spróbuj innej sieci Wi‑Fi, internetu komórkowego albo wyłącz VPN. Potem wpisz ponownie ten sam kod pokoju.', 'Try another Wi-Fi network, mobile data, or turn off VPN. Then enter the same room code again.'),
    },
    [connectionFailureCodes.signalingInterrupted]: {
      title: t('Łączenie zostało przerwane', 'Connection was interrupted'),
      message: t('Połączenie zostało przerwane. Spróbuj ponownie.', 'The connection was interrupted. Try again.'),
      primaryAction: 'retry',
      actionLabel: t('Spróbuj ponownie', 'Try again'),
      hint: t('Jeśli gra nadal działa, nie zamykaj jej. W przeciwnym razie spróbuj ponownie.', 'If the game is still running, keep it open. Otherwise try again.'),
    },
    [connectionFailureCodes.gameConnectionLost]: {
      title: t('Utracono połączenie z grą', 'Connection to the game was lost'),
      message: t('Połączenie zostało przerwane. Spróbuj ponownie.', 'The connection was interrupted. Try again.'),
      primaryAction: 'retry',
      actionLabel: t('Spróbuj ponownie', 'Try again'),
      hint: t('Ponowienie spróbuje odzyskać połączenie z tym samym pokojem.', 'Retry will try to restore the connection to the same room.'),
    },
    [localConnectionFailureCodes.sessionInUse]: {
      title: t('Gra jest otwarta w innej karcie', 'Game is open in another tab'),
      message: t('Ta sama sesja gracza jest już aktywna w innej karcie tej przeglądarki.', 'The same player session is already active in another browser tab.'),
      primaryAction: 'retry',
      actionLabel: t('Spróbuj ponownie', 'Try again'),
      hint: t('Zamknij drugą kartę albo opuść w niej grę, a następnie spróbuj ponownie tutaj.', 'Close the other tab or leave the game there, then try again here.'),
    },
    [localConnectionFailureCodes.languageMismatch]: {
      title: t('Inny język pokoju', 'Different room language'),
      message: t('Ten pokój wymaga innego języka.', 'This room requires a different language.'),
      primaryAction: 'editConnection',
      actionLabel: t('Wróć', 'Back'),
      hint: t('Zmień język albo wróć do ekranu dołączania.', 'Change the language or return to the join screen.'),
    },
    [localConnectionFailureCodes.reconnectSessionRejected]: {
      title: t('Nie można wrócić do gry', 'Could not resume the game'),
      message: t('Nie udało się przywrócić Twojego miejsca w tej rozgrywce. Wróć do ekranu dołączania.', 'Your previous place in this game could not be restored. Return to the join screen.'),
      primaryAction: 'backToMenu',
      actionLabel: t('Wróć do dołączania', 'Back to join'),
      hint: t('Jeśli gra nadal trwa, poproś prowadzącego o aktualny kod pokoju.', 'If the game is still running, ask the host for the current room code.'),
    },
    [connectionFailureCodes.cancelled]: {
      title: t('Dołączanie anulowane', 'Join cancelled'),
      message: t('Próba dołączenia została anulowana.', 'The join attempt was cancelled.'),
      primaryAction: 'backToMenu',
      actionLabel: t('Wróć do menu', 'Back to menu'),
      hint: t('Możesz rozpocząć nową próbę z ekranu dołączania.', 'You can start a new attempt from the join screen.'),
    },
    [connectionFailureCodes.unknown]: {
      title: t('Nie udało się połączyć', 'Could not connect'),
      message: t('Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.', 'Could not join. Try again or ask the host for the current code.'),
      primaryAction: 'retry',
      actionLabel: t('Spróbuj ponownie', 'Try again'),
      hint: t('Jeśli problem się powtarza, poproś prowadzącego o nowy kod pokoju.', 'If the problem continues, ask the host for a new room code.'),
    },
  };
  return guidanceByCode[code ?? connectionFailureCodes.unknown];
}
