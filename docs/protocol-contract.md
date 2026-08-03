# Kontrakt protokołu Android ↔ WWW

Dokument opisuje kontrakt używany przez klienta WWW. Źródłem prawdy pozostaje implementacja hosta Android z repozytorium `PawelWielga/panstwa-miasta` oraz typy w `src/protocol/messages.ts`.


## Wersjonowane źródło kontraktu PeerJS

Wartości transportu v4 używane przez runtime klienta WWW są zebrane w
`src/peer/peerJsContract.ts`. Identyczny zestaw publicznych wektorów jest
przechowywany w `src/test/fixtures/peerjs_contract_v4.json` oraz w repozytorium
Android pod `test/fixtures/peerjs_contract_v4.json`.

SHA-256 dokładnych bajtów bieżącego zestawu:

```text
511d759248509a097fe80f9c2d25d2bd4c1101bb3177454fedbd376d8afe1234
```

Testy Dart i TypeScript sprawdzają tę checksumę oraz wersję, label, metadata,
canonicalizację i dowody HMAC, komunikaty bridge, politykę ICE i stabilne kody
błędów. Nie wolno kopiować tych wartości do kolejnych modułów runtime.
Zmiana znaczenia pola obowiązkowego, canonicalizacji, labelu lub HMAC wymaga
nowej wersji transportu i nowego pliku wektorów. Nieznana wersja jest odrzucana
bez cichego downgrade; nowe pola v4 mogą być dodawane tylko jako opcjonalne.

## Transport PeerJS v4

Link zaproszenia zawiera jeden kod sesji online oraz jawną wersję kontraktu transportowego:

```text
https://gra.dihor.pl/?code=PM4-ABC123-<hostSessionId>-<secret>&protocol=4
```

Format kodu:

```text
PM4-{roomId}-{hostSessionId}-{secret}
```

- `roomId`: 6 znaków,
- `hostSessionId`: 26 znaków z alfabetu `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`,
- `secret`: 20 znaków z tego samego alfabetu,
- kod jest generowany ponownie przy każdym włączeniu gry online,
- po wyłączeniu gry online poprzedni kod przestaje być ważny.

Klient nie przyjmuje starszego linku zawierającego wyłącznie `room`. Nie ma fallbacku do przewidywalnego Peer ID ani do nieuwierzytelnionego kontraktu.

Peer ID hosta nie zawiera jawnego sekretu. Obie strony wyliczają go identycznie:

```text
panstwa-miasta-room-v4-{pierwsze 32 znaki hex SHA-256(całego kodu)}
```

`DataConnection` używa:

```ts
peer.connect(hostPeerId, {
  label: 'panstwa-miasta-game-v4',
  reliable: true,
  serialization: 'json',
  metadata: {
    hostSessionId,
    protocol: 4,
  },
});
```

Metadata nie zawiera sekretu. Samo dopasowanie Peer ID i metadata nie uwierzytelnia hosta, dlatego przed wiadomościami gry wykonywany jest wzajemny handshake HMAC.

### Polityka ICE STUN-only

Host Flutter i klient WWW przekazują PeerJS jawną, identyczną konfigurację ICE:

```ts
{
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  sdpSemantics: 'unified-plan',
}
```

Konfiguracja nie zawiera `turn:`, `turns:`, `username` ani `credential`. Jawne przekazanie `iceServers` jest wymagane, aby nie odziedziczyć publicznych relayów z defaults biblioteki PeerJS. STUN służy wyłącznie do odkrycia kandydatów i nie pośredniczy w przesyłaniu komunikatów gry.

Bez TURN połączenie nie jest gwarantowane przy CGNAT, symetrycznym NAT, VPN, restrykcyjnym firewallu, w części sieci firmowych, szkolnych, komórkowych i publicznych Wi-Fi. Błąd WebRTC jest prezentowany jako blokada bezpośredniego połączenia i nie uruchamia mniej bezpiecznego fallbacku relay.

### Uwierzytelniony handshake

1. Po otwarciu `DataConnection` host generuje jednorazowy 128-bitowy nonce.
2. Host wysyła `bridge:challenge` z wersją aplikacji, `hostSessionId`, nonce, Peer ID i `hostProof`.
3. Klient sprawdza wersję, sesję, Peer ID i HMAC hosta.
4. Klient odsyła `bridge:authenticate` z `clientProof`.
5. Host sprawdza HMAC klienta. Dopiero wtedy otwiera lokalny WebSocket do silnika gry.
6. Po otwarciu lokalnego mostu host wysyła `bridge:ready`.
7. Dopiero po `bridge:ready` transport WWW przechodzi do stanu `open` i `AppContext` może wysłać `player:hello` oraz ewentualny `client:rejoin`.

`bridge:challenge`:

```ts
{
  type: 'bridge:challenge';
  appVersion: string;
  buildNumber: number;
  protocolVersion: 4;
  hostSessionId: string;
  nonce: string;
  peerId: string;
  hostProof: string;
}
```

`bridge:authenticate`:

```ts
{
  type: 'bridge:authenticate';
  protocolVersion: 4;
  hostSessionId: string;
  nonce: string;
  clientProof: string;
}
```

`bridge:ready`:

```ts
{
  type: 'bridge:ready';
  appVersion: string;
  buildNumber: number;
  protocolVersion: 4;
  hostSessionId: string;
}
```

HMAC-SHA-256 używa całego znormalizowanego kodu jako klucza. Podpisywana wartość składa się z pól rozdzielonych pojedynczym znakiem LF:

```text
panstwa-miasta-peerjs-v4
{host|client}
{nonce lowercase}
{hostSessionId}
{peerId}
4
```

Host i klient korzystają ze wspólnych wektorów SHA-256/HMAC w testach Dart i TypeScript. Dowody są porównywane w stałym czasie. Powtórzony challenge, druga odpowiedź uwierzytelniająca, wiadomość gry przed handshake, niezgodna sesja, zły HMAC lub timeout zamykają połączenie bez uruchamiania lokalnego mostu.

### Zgodność wersji hosta

Minimalny build hosta jest ustawiany w `src/config/hostCompatibility.ts`. Wymagana wersja transportu PeerJS pochodzi z `PEER_JS_ONLINE_PROTOCOL_VERSION` i wynosi 4. `appVersion` służy diagnostyce, a `buildNumber` jest Androidowym `versionCode`.

Błąd wersji lub uwierzytelnienia zamyka połączenie przed wysłaniem danych gracza i wyłącza automatyczny reconnect dla tej próby. Użytkownik otrzymuje prosty komunikat o potrzebie nowego kodu albo aktualizacji. Klient nie pobiera wersji z Google Play ani z zewnętrznego backendu.

### Kolejność wdrożenia

Bezpieczna kolejność częściowego wdrożenia to:

1. klient WWW obsługujący wyłącznie v4,
2. host Android publikujący kody v4.

W okresie między wdrożeniami starszy host nie połączy się z nowym klientem, ale nie nastąpi cichy downgrade. LAN/hotspot Android pozostaje niezależny od tej zmiany.

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

Wysyłana natychmiast po zaakceptowaniu transportowego `bridge:ready` oraz ponownie podczas reconnect.

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
