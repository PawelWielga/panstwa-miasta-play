# Państwa Miasta Play

Statyczny klient przeglądarkowy gry **Państwa Miasta**. Gracz dołącza z telefonu, tabletu lub komputera do rozgrywki hostowanej przez aplikację Android.

## Architektura

```text
przeglądarka (React + PeerJS)
        ⇅ WebRTC DataChannel
telefon Android (host i źródło prawdy)
```

Publiczny PeerJS Cloud służy wyłącznie do rejestracji identyfikatorów i sygnalizacji potrzebnej do zestawienia WebRTC. Po otwarciu DataChannel komunikaty gry są przesyłane bezpośrednio między urządzeniami. Repozytorium nie zawiera backendu, PeerServera, relaya WebSocket, bazy danych, Workera Cloudflare ani własnego TURN.

Host Android pozostaje autorytatywny dla faz gry, czasu, odpowiedzi, ocen i punktów. Klient WWW odtwarza ekran z `game:snapshot` i nie oblicza samodzielnie wyników.

## Wymagania

- Node.js 22 lub nowszy
- npm
- nowoczesna przeglądarka z WebRTC, Web Crypto i `localStorage`
- HTTPS w środowisku produkcyjnym

## Uruchomienie lokalne

```bash
npm ci
npm run dev
```

Domyślny adres Vite zostanie wyświetlony w terminalu. Do testu na drugim urządzeniu uruchom Vite z dostępem w sieci lokalnej i pamiętaj, że część funkcji przeglądarki wymaga bezpiecznego kontekstu HTTPS.

## Kontrole jakości

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Testy PeerJS korzystają z interfejsu transportu i mocków. Nie łączą się z publicznym PeerJS Cloud.

## Link zaproszenia

Aplikacja Android generuje link:

```text
https://twoj-adres.example/?room=ABC234&peer=PEER_ID&protocol=3
```

Parametry:

- `room` — sześci znakowy kod pokoju,
- `peer` — identyfikator PeerJS hosta Android,
- `protocol` — wersja protokołu odczytywana z linku i wysyłana do hosta.

Przy braku lub błędzie parametrów aplikacja pokazuje dodatkowe pola techniczne. W prawidłowym zaproszeniu gracz widzi przede wszystkim nazwę pokoju i formularz profilu.

## Kontrakt PeerJS

Klient tworzy tymczasowy `Peer` bez własnego identyfikatora i otwiera `DataConnection` do hosta:

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

Po otwarciu połączenia wysyłany jest bezpośrednio obiekt `player:hello`. Nie ma dodatkowej koperty `event/payload`. `reconnectToken` znajduje się tylko w hello i pamięci lokalnej. Nie jest częścią publicznego obiektu gracza.

Każda mutacja otrzymuje nowy `requestId`. Przed wysłaniem aplikacja liczy rozmiar UTF-8 zserializowanej wiadomości i odrzuca obiekty większe niż 64 KiB.

## Reconnect i Safari

Tożsamość gracza jest zachowywana w `localStorage`:

- `playerId`,
- osobny `reconnectToken`,
- nazwa,
- emoji,
- kolor.

Po utracie połączenia klient tworzy nowy obiekt PeerJS, wysyła ponownie `player:hello`, a następnie `client:rejoin` z ostatnim numerem sekwencji. Automatyczne próby mają ograniczony backoff i dziesięciosekundowe okno zgodne z ustawieniami hosta Flutter. Powrót karty Safari, zdarzenie `pageshow` oraz odzyskanie sieci uruchamiają kontrolowaną próbę ponownego połączenia. Użytkownik może też ponowić ręcznie.

Heartbeat klienta jest wysyłany co 2 sekundy po otwarciu połączenia i otrzymaniu identyfikatora gry. Brak aktywności hosta przez 6 sekund uruchamia reconnect.

## Przebieg gry

Klient obsługuje:

1. formularz gracza i link zaproszenia,
2. połączenie i akceptację przez hosta,
3. poczekalnię oraz `game:ready`,
4. ustawienia i kategorie,
5. losowanie oraz ujawnienie litery,
6. odpowiadanie, Enter między polami i wysyłkę,
7. dozwoloną przez hosta edycję odpowiedzi,
8. ocenianie tylko do odczytu,
9. odsłonięcie punktów kategorii,
10. podsumowanie rundy i ranking końcowy,
11. reset do kolejnej gry,
12. odtworzenie właściwego ekranu z `game:snapshot` po reconnect.

W aktualnym protokole MVP wyłącznie host Android może oceniać odpowiedzi oraz kończyć etap oceny. Klient WWW nie wysyła `countries-cities:vote` ani nie udaje głosowania graczy.

## GitHub Pages

Workflow `.github/workflows/pages.yml` po pushu do `main`:

1. wykonuje `npm ci`,
2. uruchamia lint,
3. uruchamia sprawdzanie typów,
4. uruchamia testy,
5. buduje `dist`,
6. publikuje artefakt przez oficjalne GitHub Pages Actions.

### Ścieżka bazowa Vite

Dla własnej domeny:

```bash
VITE_BASE_PATH=/ npm run build
```

Dla `https://USERNAME.github.io/REPOSITORY/`:

```bash
VITE_BASE_PATH=/REPOSITORY/ npm run build
```

Bez dodatkowej konfiguracji workflow automatycznie używa `/<nazwa-repozytorium>/`, dlatego projekt działa pod standardowym adresem GitHub Pages. Po ustawieniu własnej domeny należy dodać w **Settings → Secrets and variables → Actions → Variables** zmienną `VITE_BASE_PATH` o wartości `/`.

## Własna domena i Cloudflare

1. W GitHub otwórz **Settings → Pages** i ustaw publikację przez GitHub Actions.
2. Po pierwszym udanym wdrożeniu wpisz prawdziwą nazwę w polu **Custom domain**.
3. W Cloudflare dodaj rekord `CNAME` dla wybranej subdomeny wskazujący na `USERNAME.github.io`.
4. W GitHub włącz **Enforce HTTPS**, gdy certyfikat będzie gotowy.
5. W Cloudflare ustaw SSL/TLS na **Full** lub **Full (strict)**, gdy origin i konfiguracja domeny na to pozwalają.
6. Plik `public/CNAME.example` jest wyłącznie wzorem na przyszłość; nie jest używany przy obecnej publikacji pod `github.io`.

Cloudflare pełni tu wyłącznie rolę DNS/proxy/HTTPS. Nie przechowuje stanu gry i nie uruchamia logiki multiplayer.

## Test z fizycznym telefonem Android

Zbuduj aplikację Flutter z właściwym adresem klienta:

```bash
flutter build apk \
  --dart-define=ONLINE_WEB_CLIENT_URL=https://twoja-domena.example
```

Następnie:

1. uruchom aplikację Android,
2. utwórz pokój online,
3. otwórz panel QR,
4. zeskanuj link drugim urządzeniem,
5. wpisz nazwę i dołącz,
6. ustaw gotowość,
7. rozpocznij rundę na hoście,
8. wpisz i wyślij odpowiedzi w przeglądarce,
9. przejdź ocenianie i wyniki,
10. na chwilę wyłącz internet albo uśpij Safari,
11. przywróć sieć i sprawdź reconnect oraz odtworzenie ekranu ze snapshotu.

## Ograniczenia P2P

Projekt nie utrzymuje własnego TURN. Publiczny PeerJS Cloud realizuje sygnalizację, ale nie gwarantuje przejścia przez każdy NAT lub firewall. VPN, sieci firmowe, część sieci komórkowych i restrykcyjne routery mogą blokować bezpośredni WebRTC DataChannel. W takim przypadku warto zmienić sieć Wi-Fi lub wyłączyć VPN. Nie można zagwarantować działania w każdej sieci bez infrastruktury TURN.
