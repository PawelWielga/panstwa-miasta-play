# Państwa Miasta Play

**[▶ Otwórz aplikację](https://pawelwielga.github.io/panstwa-miasta-play/)**

Statyczny klient przeglądarkowy gry **Państwa Miasta**. Gracz dołącza z telefonu, tabletu lub komputera do rozgrywki hostowanej przez aplikację Android.

## Architektura

```text
przeglądarka (React + PeerJS)
        ⇅ WebRTC DataChannel
telefon Android (host i źródło prawdy)
```

Publiczny PeerJS Cloud służy wyłącznie do rejestracji identyfikatorów i sygnalizacji potrzebnej do zestawienia WebRTC. Po otwarciu DataChannel komunikaty gry są przesyłane bezpośrednio między urządzeniami. Klient przekazuje PeerJS jawną konfigurację STUN-only i nie używa publicznego ani własnego TURN, relaya WebSocket, backendu, bazy danych ani Workera Cloudflare.

Host Android pozostaje autorytatywny dla faz gry, czasu, odpowiedzi, ocen i punktów. Klient WWW odtwarza ekran z `game:snapshot` i nie oblicza samodzielnie wyników.

## Wymagania

- Node.js 22 lub nowszy,
- npm,
- nowoczesna przeglądarka z WebRTC, Web Crypto i `localStorage`,
- HTTPS w środowisku produkcyjnym.

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

## Dołączanie online

Ręczne dołączenie używa wyłącznie **6-znakowego kodu**, np.:

```text
ABC234
```

Kod korzysta z alfabetu `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Formularz normalizuje wielkość liter i usuwa separatory. Użytkownik nie wpisuje Peer ID, wersji protokołu, dodatkowego PIN-u ani pełnego kodu `PM4-...`.

Link lub QR używa parametru `code`. Może przenosić krótki kod albo pełne wewnętrzne credentials v4 dla zgodności ze starszymi zaproszeniami, np.:

```text
https://gra.dihor.pl/?code=ABC234
```

lub kompatybilnościowo:

```text
https://gra.dihor.pl/?code=PM4-ABC234-<hostSessionId>-<secret>&protocol=4
```

Pełny `PM4-...` pozostaje formatem technicznym i kompatybilnościowym. Nie jest ręcznym fallbackiem dla użytkownika. Starszy parametr `room` jest odrzucany czytelnym komunikatem zamiast uruchamiać przewidywalny transport v3.

## Uwierzytelniony kontrakt PeerJS v4

Dla 6-znakowego kodu obie strony deterministycznie wyprowadzają identyczne wewnętrzne credentials v4. Następnie Peer ID hosta jest liczony z SHA-256 pełnego wewnętrznego kodu:

```text
panstwa-miasta-room-v4-{pierwsze 32 znaki hex SHA-256(wewnętrznego pełnego kodu)}
```

Wspólny wektor regresyjny Android ↔ WWW:

```text
ABC234 -> panstwa-miasta-room-v4-d7fee74e05cf19a0c1b97b4486a7b738
```

`DataConnection` używa etykiety `panstwa-miasta-game-v4` oraz metadata zawierającej `hostSessionId` i wersję kontraktu.

Po otwarciu kanału host i klient wykonują wzajemny handshake HMAC-SHA-256:

1. host wysyła jednorazowy `bridge:challenge`,
2. klient weryfikuje hosta i odsyła `bridge:authenticate`,
3. host weryfikuje klienta i dopiero wtedy otwiera most do silnika gry,
4. host wysyła `bridge:ready`,
5. dopiero wtedy klient wysyła `player:hello` i ewentualny `client:rejoin`.

Profil, `playerId` i `reconnectToken` nie są wysyłane przed potwierdzeniem hosta. Powtórzone lub spóźnione komunikaty handshake, zły HMAC, niezgodna sesja i timeout kończą próbę. Sekrety, nonce i pełne dowody są wykluczone z diagnostyki.

Model bezpieczeństwa jest świadomie ograniczony entropią 6-znakowego kodu. Deterministyczne wyprowadzenie credentials nie zwiększa siły sekretu: osoba, która poprawnie odgadnie kod, może próbować dołączyć. Warstwa v4 nadal chroni kolejność handshake, integralność, replay i przedwczesne ujawnienie danych gracza.

Pełny kontrakt, canonicalizację HMAC, limity i wspólne wektory testowe opisuje `docs/protocol-contract.md`.

## Zgodność wersji hosta

Klient WWW wspiera kontrakt PeerJS v4 i minimalny build ustawiony w `src/config/hostCompatibility.ts`. Nie ma cichego downgrade'u do v3 ani nieuwierzytelnionego transportu.

Krótki kod oraz zgodne pełne credentials `PM4-...` prowadzą do tego samego kontraktu v4. LAN/hotspot aplikacji Android pozostaje niezależnym transportem.

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

W aktualnym protokole wyłącznie host Android może oceniać odpowiedzi oraz kończyć etap oceny. Klient WWW nie wysyła `countries-cities:vote` ani nie duplikuje silnika gry.

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

Bez dodatkowej konfiguracji workflow automatycznie używa `/<nazwa-repozytorium>/`. Po ustawieniu własnej domeny należy dodać w **Settings → Secrets and variables → Actions → Variables** zmienną `VITE_BASE_PATH` o wartości `/`.

## Własna domena i Cloudflare

1. W GitHub otwórz **Settings → Pages** i ustaw publikację przez GitHub Actions.
2. Po pierwszym udanym wdrożeniu wpisz prawdziwą nazwę w polu **Custom domain**.
3. W Cloudflare dodaj rekord `CNAME` dla wybranej subdomeny wskazujący na `USERNAME.github.io`.
4. W GitHub włącz **Enforce HTTPS**, gdy certyfikat będzie gotowy.
5. W Cloudflare ustaw SSL/TLS na **Full** lub **Full (strict)**, gdy origin i konfiguracja domeny na to pozwalają.
6. Plik `public/CNAME.example` jest wyłącznie wzorem na przyszłość.

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
3. odczytaj 6-znakowy kod albo zeskanuj QR drugim urządzeniem,
4. wpisz nazwę i dołącz,
5. ustaw gotowość,
6. rozpocznij rundę na hoście,
7. wpisz i wyślij odpowiedzi w przeglądarce,
8. przejdź ocenianie i wyniki,
9. na chwilę wyłącz internet albo uśpij Safari,
10. przywróć sieć i sprawdź reconnect oraz odtworzenie ekranu ze snapshotu.

## Ograniczenia P2P

Projekt używa jawnej polityki ICE STUN-only i nie konfiguruje żadnego publicznego ani własnego TURN. Publiczny PeerJS Cloud realizuje wyłącznie sygnalizację. CGNAT, symetryczny NAT, VPN, sieci firmowe, szkolne, część sieci komórkowych, publiczne Wi-Fi i restrykcyjne routery mogą blokować bezpośredni WebRTC DataChannel. W takim przypadku klient pokazuje komunikat o blokadzie połączenia bezpośredniego; należy zmienić sieć lub wyłączyć VPN. Nie można zagwarantować działania online w każdej sieci bez kontrolowanej infrastruktury TURN.
