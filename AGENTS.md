# Instrukcje dla agentów

## Źródła prawdy

### UI i UX

Repozytorium [`PawelWielga/panstwa-miasta-design`](https://github.com/PawelWielga/panstwa-miasta-design) jest nadrzędnym źródłem prawdy dla interfejsu użytkownika klienta WWW.

Przed rozpoczęciem zmian dotyczących UI agent musi przeanalizować aktualny stan tego repozytorium. Dotyczy to w szczególności:

- układu ekranów i nawigacji,
- kolorów, typografii i odstępów,
- wyglądu oraz zachowania komponentów,
- ikon, grafik i innych zasobów wizualnych,
- responsywności na telefonach, tabletach i komputerach,
- stanów ładowania, błędów, braku połączenia i ponownego łączenia.

Nie należy tworzyć niezależnego kierunku wizualnego ani traktować aktualnej implementacji w tym repozytorium jako nadrzędnego wzorca. Jeżeli implementacja klienta WWW różni się od projektu w `panstwa-miasta-design`, należy dostosować klienta WWW do repozytorium projektowego, o ile nie stoi to w sprzeczności z dostępnością, bezpieczeństwem lub ograniczeniami technicznymi przeglądarki.

### Logika gry i multiplayer

Repozytorium [`PawelWielga/panstwa-miasta`](https://github.com/PawelWielga/panstwa-miasta) pozostaje źródłem prawdy dla protokołu multiplayer, stanu gry, rund, odpowiedzi, oceniania, głosowania i punktacji. Aplikacja Android jest hostem i systemem autorytatywnym, a klient WWW powinien odwzorowywać otrzymany stan zamiast duplikować silnik gry.

### Zgodność wersji hosta

Klient WWW obsługuje wyłącznie ręcznie wskazaną, wspieraną wersję hosta Android. Minimalny `buildNumber` i wymagana wersja protokołu są utrzymywane centralnie w `src/config/hostCompatibility.ts`. Każda zmiana tych wartości musi obejmować testy i dokumentację; nie należy dodawać cichego fallbacku dla hostów bez metadanych wersji.

