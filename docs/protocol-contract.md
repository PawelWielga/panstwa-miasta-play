# Kontrakt protokołu Android ↔ WWW

Dokument opisuje kontrakt używany przez klienta WWW. Źródłem prawdy pozostaje implementacja hosta Android z repozytorium `PawelWielga/panstwa-miasta` oraz typy w `src/protocol/messages.ts`.

## Transport

Klient WWW tworzy połączenie PeerJS `DataConnection` do identyfikatora hosta przekazanego w linku zaproszenia.

```ts
peer.connect(hostPeerId, {
  label: 'panstwa-miasta-game-v1',
  reliable: true,
  serialization: 'json',
  metadata: {
    room: roomId,
    protocol: protocolVersion,
  },
});
```

Komunikaty są wysyłane jako bezpośrednie obiekty JSON. Nie stosuje się dodatkowej koperty `event/payload`.

## Ograniczenia i identyfikatory

- maksymalny rozmiar wiadomości: 64 KiB po serializacji UTF-8,
- maksymalna długość odpowiedzi: 60 znaków,
- kod pokoju: 6 znaków z alfabetu `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`,
- nazwa gracza: maksymalnie 24 znaki,
- heartbeat klienta: co 2 sekundy,
- brak aktywności hosta przez 6 sekund uruchamia reconnect,
- automatyczne okno reconnect: 10 sekund,
- `requestId` jest generowany osobno dla każdej mutacji.

## Wspólne pola

Każda wiadomość ma pole `type`. Zależnie od rodzaju może również zawierać:

```ts
interface MessageMetadata {
  type: string;
  requestId?: string;
  senderId?: string;
  sentAt?: number;
}
```

Profil gracza:

```ts
interface PlayerProfile {
  id: string;
  name: string;
  color: string;
  emoji: string;
}
```

## Wiadomości klient → host

### `player:hello`

Wysyłana natychmiast po otwarciu DataConnection oraz ponownie podczas reconnect.

```ts
{
  type: 'player:hello';
  protocolVersion: number;
  requestId: string;
  senderId: string;
  sentAt: number;
  reconnectToken: string;
  player: PlayerProfile;
}
```

### `game:ready`

Lokalna deklaracja gotowości gracza.

```ts
{
  type: 'game:ready';
  requestId: string;
  senderId: string;
  sentAt: number;
  ready: boolean;
}
```

Aktualny host Android nie replikuje jeszcze pełnego stanu gotowości w snapshotach. Klient WWW nie traktuje tego pola jako źródła prawdy dla innych graczy.

### `client:heartbeat`

```ts
{
  type: 'client:heartbeat';
  gameId: string;
  playerId: string;
  lastSeenSequenceNumber: number;
  sentAt: number;
}
```

### `client:rejoin`

Wysyłana po ponownym otwarciu połączenia, po `player:hello`.

```ts
{
  type: 'client:rejoin';
  protocolVersion: number;
  requestId: string;
  senderId: string;
  sentAt: number;
  player: PlayerProfile;
  lastSeenSequenceNumber: number;
}
```

### `countries-cities:submit`

```ts
{
  type: 'countries-cities:submit';
  requestId: string;
  senderId: string;
  player: PlayerProfile;
  answers: Record<string, string>;
}
```

Kluczem `answers` jest identyfikator kategorii. Host pozostaje odpowiedzialny za przyjęcie odpowiedzi i czas jej zapisania.

### `countries-cities:edit-answers`

```ts
{
  type: 'countries-cities:edit-answers';
  requestId: string;
  senderId: string;
  sentAt: number;
  playerId: string;
}
```

## Wiadomości host → klient

### `room:players`

```ts
{
  type: 'room:players';
  protocolVersion: number;
  players: PlayerProfile[];
}
```

### `game:reset`

Czyści bieżący stan gry i przenosi klienta do lobby.

```ts
{ type: 'game:reset' }
```

### `game:start`

Informuje o rozpoczęciu gry. Pełny stan pochodzi z kolejnego snapshotu.

```ts
{ type: 'game:start' }
```

### `game:error`

```ts
{
  type: 'game:error';
  code?: string;
  message: string;
  requestId?: string;
}
```

### `host:heartbeat`

```ts
{
  type: 'host:heartbeat';
  gameId: string;
  sequenceNumber: number;
  sentAt?: number;
}
```

### Zdarzenia utraty i migracji hosta

```ts
{
  type: 'host:lost';
  gameId: string;
  lostHostPlayerId: string;
  sequenceNumber: number;
}
```

```ts
{
  type: 'host:migration-started';
  gameId: string;
  lostHostPlayerId: string;
  candidateHostPlayerId: string;
  sequenceNumber: number;
}
```

```ts
{
  type: 'host:migrated';
  gameId: string;
  newHostPlayerId: string;
  newHostIp: string;
  newHostPort: number;
  sequenceNumber: number;
  snapshot: GameSnapshot;
}
```

Klient WWW nie przejmuje roli hosta. Zdarzenia migracji służą wyłącznie do odtworzenia stanu i komunikatu dla użytkownika.

### `game:snapshot`

```ts
{
  type: 'game:snapshot';
  snapshot: GameSnapshot;
}
```

Snapshot jest autorytatywnym stanem klienta. Zawiera między innymi:

- `gameId`, `roomId`, `sequenceNumber`, `hostPlayerId`,
- fazę gry,
- listę graczy i kategorii,
- ustawienia i dane bieżącej rundy,
- odpowiedzi, statusy wysłania i dane oceny,
- wyniki kategorii, rundy i całej gry.

Klient przyjmuje tylko snapshoty o poprawnej strukturze i używa `sequenceNumber` do heartbeat oraz reconnect.

### `countries-cities:settings`

```ts
{
  type: 'countries-cities:settings';
  categories: GameCategory[];
  endMode: string;
  timeMode: string;
  settings: CountriesCitiesSettings;
  hostControlsReview: boolean;
}
```

### `countries-cities:start-round`

```ts
{
  type: 'countries-cities:start-round';
  letter: string;
  usedLetters: string[];
}
```

### `countries-cities:deadline`

```ts
{
  type: 'countries-cities:deadline';
  deadlineAt: number;
}
```

### `countries-cities:review`

```ts
{
  type: 'countries-cities:review';
  submissions: CountriesCitiesSubmission[];
  categoryIndex: number;
}
```

Etap oceny w WWW jest tylko do odczytu. W bieżącym MVP głosowanie i zakończenie oceny kontroluje host Android.

### `countries-cities:vote`

Klient potrafi zwalidować wiadomość hosta, ale sam nie wysyła głosów.

```ts
{
  type: 'countries-cities:vote';
  answerId: string;
  vote: string;
}
```

### `countries-cities:review-ready`

```ts
{
  type: 'countries-cities:review-ready';
  categoryIndex: number;
  playerId: string;
}
```

### `countries-cities:reveal`

```ts
{
  type: 'countries-cities:reveal';
  categoryIndex: number;
  finalResults: Record<string, {
    winner: string;
    points: number;
  }>;
}
```

### `countries-cities:results`

```ts
{
  type: 'countries-cities:results';
  finalResults: Record<string, {
    winner: string;
    points: number;
  }>;
  roundScores: Record<string, number>;
  finalScores: Record<string, number>;
}
```

## Walidacja i bezpieczeństwo

- każda wiadomość przychodząca jest sprawdzana przed użyciem,
- nieznane typy są odrzucane,
- niepoprawne snapshoty nie modyfikują stanu UI,
- rozmiar jest sprawdzany przed parsowaniem i przed wysłaniem,
- tekst jest renderowany przez React bez wstrzykiwania HTML,
- host Android jest jedynym źródłem wyników i faz gry.
