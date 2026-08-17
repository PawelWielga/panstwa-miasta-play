# Oversized game snapshot chunking

Android pozostaje źródłem prawdy dla stanu gry. Limit pojedynczej wiadomości transportowej nadal wynosi 64 KiB.

## Zasada kompatybilności

Jeżeli zakodowana wiadomość `game:snapshot` mieści się w 64 KiB, host wysyła ją bez zmian. Dzięki temu małe snapshoty zachowują dotychczasowy format.

Jeżeli pełny `game:snapshot` przekracza 64 KiB, host koduje obiekt snapshotu jako JSON UTF-8 i dzieli bajty na fragmenty po maksymalnie 45 KiB. Każdy fragment jest wysyłany jako osobna wiadomość `game:snapshot-chunk` z polami:

- `gameId`
- `sequenceNumber`
- `chunkIndex`, indeks od zera
- `chunkCount`
- `payload`, Base64 surowego fragmentu UTF-8

Maksymalna długość pola `payload` wynosi 62 KiB. Każda kompletna wiadomość protokołu nadal musi mieścić się w limicie 64 KiB.

## Składanie po stronie klienta

Fragmenty są grupowane po `(gameId, sequenceNumber)`. Klient:

- akceptuje fragmenty w dowolnej kolejności,
- ignoruje identyczny duplikat,
- odrzuca zestaw, gdy duplikat tego samego indeksu ma inne bajty,
- odrzuca zestaw z niespójnym `chunkCount`,
- usuwa niekompletny zestaw po 30 sekundach,
- utrzymuje maksymalnie 4 równoległe zestawy,
- ogranicza złożony snapshot do 1 MiB.

Dopiero kompletny i poprawnie zwalidowany zestaw jest przekazywany do aplikacji jako zwykły `game:snapshot`. Niekompletne chunki nie zmieniają `lastSeenSequenceNumber` ani stanu gry.

## Limity kategorii

Kontrakt dla Państw Miast dopuszcza maksymalnie 30 kategorii. Snapshot graniczny testowany jest dla 12 graczy, 30 kategorii, odpowiedzi o maksymalnej długości 60 znaków oraz danych review dla wszystkich kategorii. Taki stan przekracza 64 KiB jako pojedynczy `game:snapshot`, dlatego musi korzystać z chunkowania.
