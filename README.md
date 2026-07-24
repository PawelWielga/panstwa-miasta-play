# Państwa Miasta Play

Przeglądarkowy klient gry **Państwa Miasta**, przeznaczony przede wszystkim dla użytkowników iPhone’ów oraz urządzeń, na których nie jest dostępna aplikacja Android.

Docelowy adres:

```text
https://play.panstwamiasta.dihor.pl
```

## Status projektu

Projekt jest na etapie przygotowania. Repozytorium nie zawiera jeszcze działającego klienta gry.

Pierwsza wersja ma umożliwiać wyłącznie **dołączanie do rozgrywki utworzonej w aplikacji Android**. Hostowanie gry bezpośrednio z przeglądarki nie wchodzi obecnie w zakres MVP.

## Cel

Gracz powinien móc:

1. otworzyć link zaproszenia lub wpisać kod pokoju,
2. podać swój nick,
3. dołączyć do lobby,
4. wprowadzać odpowiedzi w trakcie rundy,
5. brać udział w głosowaniu,
6. zobaczyć wyniki rundy i całej gry,
7. ponownie połączyć się po chwilowej utracie sieci lub uśpieniu przeglądarki.

## Założenia architektoniczne

Aplikacja Android pozostaje hostem i źródłem prawdy dla:

- stanu rozgrywki,
- przebiegu rund,
- odpowiedzi graczy,
- głosowania,
- naliczania punktów,
- końcowych wyników.

Klient WWW powinien jedynie prezentować stan otrzymany od hosta oraz wysyłać działania gracza. Nie należy kopiować całego silnika gry do przeglądarki bez uzasadnionej potrzeby.

Komunikacja musi pozostać zgodna z wersjonowanym protokołem aplikacji mobilnej.

## Planowany zakres MVP

- ekran wpisania kodu pokoju,
- obsługa bezpośredniego linku zaproszenia,
- wybór nicku,
- lobby i lista graczy,
- ekran rundy z literą, kategoriami i czasem,
- wysyłanie odpowiedzi,
- ekran oczekiwania,
- ocenianie i głosowanie,
- wyniki rundy i całej gry,
- obsługa zamknięcia pokoju przez hosta,
- czytelne komunikaty błędów,
- reconnect po utracie połączenia,
- obsługa niezgodnej wersji protokołu.

## Poza zakresem pierwszej wersji

- hostowanie gry z przeglądarki,
- konta użytkowników,
- synchronizacja profilu w chmurze,
- niezależny silnik punktacji po stronie WWW,
- publiczne wyszukiwanie pokojów,
- matchmaking.

## Technologia

Preferowany lekki stos technologiczny:

- Vite,
- TypeScript,
- semantyczny HTML,
- responsywny CSS,
- GitHub Pages jako hosting klienta statycznego.

Wybór biblioteki interfejsu i transportu powinien nastąpić dopiero po analizie aktualnego protokołu oraz kodu multiplayer aplikacji Android. Nie należy dodawać ciężkiego frameworka tylko dla ujednolicenia projektu.

Rozważane sposoby komunikacji:

- WebSocket relay,
- WebRTC DataChannel,
- PeerJS jako warstwa upraszczająca WebRTC.

GitHub Pages hostuje wyłącznie statyczny frontend. Ewentualny relay WebSocket, PeerServer, STUN lub TURN musi działać w osobnej infrastrukturze.

## Wymagania jakościowe

Klient powinien być:

- projektowany mobile-first,
- wygodny w Safari na iPhone,
- responsywny na telefonach, tabletach i komputerach,
- obsługiwany klawiaturą,
- czytelny przy powiększonym tekście,
- odporny na nieznane i niepoprawne wiadomości sieciowe,
- dostępny wyłącznie przez HTTPS i bezpieczne połączenia sieciowe,
- lekki i szybki nawet przy słabszym połączeniu.

Szczególną uwagę należy poświęcić zmianom stanu karty, usypianiu Safari, reconnectowi i utracie połączenia podczas rundy.

## Planowana struktura

Dokładna struktura zostanie ustalona podczas inicjalizacji projektu. Przewidywany układ może wyglądać następująco:

```text
.
├── src/
│   ├── app/
│   ├── multiplayer/
│   ├── protocol/
│   ├── screens/
│   └── styles/
├── public/
├── tests/
├── index.html
├── package.json
├── vite.config.ts
└── README.md
```

Nie należy traktować tej struktury jako obowiązkowej przed analizą pierwszej implementacji.

## GitHub Pages

Docelowo produkcyjny build będzie publikowany przez GitHub Actions do GitHub Pages pod domeną:

```text
https://play.panstwamiasta.dihor.pl
```

Konfiguracja domeny, DNS i opcji **Enforce HTTPS** będzie wymagała ręcznego ustawienia po przygotowaniu pierwszego działającego builda.

## Powiązane repozytoria

- [`PawelWielga/panstwa-miasta`](https://github.com/PawelWielga/panstwa-miasta) — aplikacja Android, host rozgrywki, silnik gry i źródło protokołu multiplayer.
- [`PawelWielga/panstwa-miasta-website`](https://github.com/PawelWielga/panstwa-miasta-website) — oficjalny landing page, pomoc i polityka prywatności.

## Plan rozwoju

1. Analiza protokołu multiplayer aplikacji Android.
2. Wybór transportu dla połączeń internetowych.
3. Przygotowanie projektu Vite + TypeScript i podstawowego CI.
4. Implementacja dołączania do pokoju i lobby.
5. Implementacja pełnego przebiegu rundy.
6. Reconnect i obsługa błędów sieciowych.
7. Testy na Safari iPhone oraz aktualnych przeglądarkach.
8. Deployment przez GitHub Pages.
9. Podpięcie domeny `play.panstwamiasta.dihor.pl`.
