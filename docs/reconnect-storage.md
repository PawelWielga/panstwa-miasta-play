# Trwały kontekst reconnect w przeglądarce

## Cel

Klient WWW przechowuje minimalny kontekst niedokończonej rozgrywki, aby po odświeżeniu lub ponownym otwarciu karty można było wrócić do tego samego slotu gracza bez tworzenia duplikatu.

Kontrakt hosta Android pozostaje źródłem prawdy. Storage WWW nie przechowuje stanu gry ani lokalnego czasu rundy. Niewysłane odpowiedzi są osobnym draftem, którego przywrócenie wymaga potwierdzenia przez hosta aktualnej sesji i rundy. Po wznowieniu klient musi odtworzyć ekran wyłącznie z aktualnego snapshotu hosta.

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
- Odpowiedzi już przyjęte przez hosta mają pierwszeństwo przed lokalnym draftem.

## Świadome opuszczenie gry

Akcja „Opuść grę” usuwa zapis niedokończonej sesji tylko dla aktualnego pokoju i gracza, czyści draft bieżącej rundy i zamyka transport po best-effort `client:leave`. Trwała tożsamość gracza pozostaje zachowana. Zwykły reload, `pagehide`, przejście Safari w tło, utrata sieci lub DataChannel nie wykonują tego cleanupu, dzięki czemu „Wróć” nadal może wznowić przerwaną sesję.

Cleanup świadomego wyjścia jest idempotentny: ponowne wywołanie po przejściu do ekranu dołączania nie wysyła kolejnego `client:leave` i nie uruchamia reconnectu.
## Niewysłane odpowiedzi po zamknięciu karty

Draft w `sessionStorage` i trwały draft w `localStorage` korzystają z tego samego modelu i walidacji. Store `panstwa-miasta.persistent-answer-drafts.v1` przechowuje maksymalnie 8 rekordów, 128 000 znaków łącznie, z TTL 24 godziny i tolerancją przyszłego czasu 5 minut. Rekord wiąże odpowiedzi z `hostSessionId`, pokojem, `playerId`, `gameId` i numerem rundy. Zachowuje także zamrożoną odpowiedź finalizacji wraz z jej identyfikatorem żądania.

Otwarcie transportu lub odczyt kontekstu reconnect nie przywraca odpowiedzi. Dopiero zaakceptowany, aktualny snapshot hosta dla tego gracza i tej samej rundy może odtworzyć niewysłany draft. Sam zapis nie powoduje wysłania odpowiedzi. Istniejąca obsługa finalizacji może wysłać odpowiedź wyłącznie w reakcji na żądanie hosta.

Hostowe potwierdzenie odpowiedzi, inna runda lub gra, zakończenie odpowiadania, `host:room-closed`, trwałe odrzucenie wznowienia i świadome wyjście usuwają draft danej sesji. Puste odpowiedzi bez zamrożonej finalizacji nie tworzą trwałego rekordu. Zapis, odczyt i cleanup sprawdzają bieżącą dzierżawę karty; poprzedni właściciel po przejęciu nie może nadpisać ani usunąć wspólnego draftu.

Uszkodzony zapis, przekroczone limity lub niedostępny storage nie blokują gry. Drafty mogą zawierać prywatne wpisy gracza i podlegają tym samym ograniczeniom współdzielonego profilu i originu co kontekst reconnect.

Testy automatyczne symulują definitywne zamknięcie przez usunięcie `sessionStorage`, nowe otwarcie i ponowną autoryzację przez hosta. Fizyczne zamknięcie i otwarcie Chrome Android oraz Safari iOS z hostem Android nadal wymaga testu na urządzeniach przed domknięciem Issue #21.
