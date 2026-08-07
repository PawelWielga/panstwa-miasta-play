# Trwały kontekst reconnect w przeglądarce

## Cel

Klient WWW przechowuje minimalny kontekst niedokończonej rozgrywki, aby po odświeżeniu lub ponownym otwarciu karty można było wrócić do tego samego slotu gracza bez tworzenia duplikatu.

Kontrakt hosta Android pozostaje źródłem prawdy. Storage WWW nie przechowuje stanu gry, odpowiedzi ani lokalnego czasu rundy. Po wznowieniu klient musi odtworzyć ekran wyłącznie z aktualnego snapshotu hosta.

## Zakres danych

Store `panstwa-miasta.unfinished-sessions.v1` zapisuje maksymalnie 8 rekordów. Każdy rekord zawiera:

- identyfikator pokoju i `hostSessionId`,
- dane potrzebne do ponownego zestawienia transportu PeerJS,
- `playerId` i prywatny `reconnectToken`,
- najwyższy znany `lastSeenSequenceNumber`,
- czas ostatniego użycia.

Rekord wygasa po 24 godzinach. Wpis z czasem przesuniętym o ponad 5 minut w przyszłość jest traktowany jako nieprawidłowy.

Dla obecnego 6-znakowego kodu dołączenia zapisujemy tylko ten krótki kod i przy odczycie ponownie wyprowadzamy techniczne dane `PM4`. Pełny starszy kod `PM4-...` może zostać zapisany wyłącznie wtedy, gdy jest konieczny do wznowienia sesji utworzonej przez starszy format. Nadal obowiązuje ten sam limit 24 godzin.

## Bezpieczeństwo i ograniczenia

`localStorage` jest magazynem tego samego originu, a nie bezpiecznym sejfem. Kod działający w originie aplikacji może odczytać zapisane dane. Dlatego ochrona przed XSS i ograniczanie zewnętrznych skryptów są częścią bezpieczeństwa reconnect.

Na współdzielonym profilu przeglądarki kolejna osoba może odziedziczyć możliwość wznowienia niedokończonej sesji do czasu jej wygaśnięcia lub jawnego opuszczenia gry. Tryb prywatny, polityka przeglądarki, brak miejsca albo ręczne blokowanie storage mogą uniemożliwić zapis.

Brak `localStorage` nie może blokować zwykłego dołączenia. W takim przypadku klient używa tożsamości tylko w pamięci i działa bez funkcji powrotu po zamknięciu karty.

## Reguły cyklu życia

- Rekord powstaje dopiero po potwierdzeniu przyjęcia gracza przez hosta, nie po samym wpisaniu kodu.
- Kolejne wiadomości hosta mogą tylko zwiększać zapisany numer sekwencji; nie wolno go cofać.
- Reconnect zachowuje pierwotny token przypisany do slotu gracza.
- Jawne opuszczenie gry usuwa rekord.
- Trwałe odrzucenie readmission, niezgodna sesja hosta albo nieprawidłowe uwierzytelnienie usuwa rekord.
- Błędy przejściowe, utrata sieci, uśpienie Safari i timeout nie usuwają rekordu.
- Pełne odpowiedzi gracza nie są zapisywane w tej wersji. Po readmission hostowy snapshot odtwarza odpowiedzi już wysłane; lokalny niewysłany draft może zniknąć po zamknięciu karty.
