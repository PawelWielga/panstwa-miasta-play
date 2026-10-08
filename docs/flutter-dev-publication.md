# Flutter Web DEV

Branch `dev` przyjmuje gotowy klient z CI `PawelWielga/panstwa-miasta`
w katalogu `flutter-dev/`. Nie edytować tych plików ręcznie.
`source.json` wskazuje źródłowy commit, entrypoint i przebieg CI.

`npm run build:pages` nadal buduje produkcję z `origin/main`. Dla `/dev/`
wykorzystuje `flutter-dev/`, jeśli katalog istnieje i ma poprawną metrykę
oraz bazę URL. Bez niego buduje dotychczasowego klienta TypeScript.
Workflow Pages publikuje oba katalogi i weryfikuje SHA Fluttera po wdrożeniu.

Do cofnięcia DEV można przywrócić wcześniejszy commit artefaktów lub usunąć
`flutter-dev/` na `dev`, aby wrócić do TypeScript. Następny udany push
źródłowego `dev` ponownie dostarczy Fluttera. Produkcyjny `main` pozostaje
osobnym krokiem release.
