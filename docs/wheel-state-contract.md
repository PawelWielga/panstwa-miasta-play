# Kontrakt `wheelState` Android ↔ WWW

Źródłem prawdy dla koła fortuny pozostaje host Android. Klient WWW wyłącznie waliduje i renderuje otrzymany stan.

## Schemat v1

`wheelState.schemaVersion` ma wartość `1`. Stan przechodzi przez fazy `waiting`, `spinning` i `finished`.

Pole `letterPool` zawiera uporządkowaną listę segmentów koła wybraną przez hosta. Lista musi zawierać od 1 do 32 unikalnych, pojedynczych liter. Litery są normalizowane przez `trim()` i zapis wielkimi literami.

`letterPool` jest opcjonalne wyłącznie dla kompatybilności ze starszymi snapshotami. Gdy pola brakuje, obie strony używają legacy puli:

```text
A B C D E F G H I J K L M N O P R S T U W Z
```

## Inwariant zakończonego obrotu

W fazie `finished` pole `letter` jest wymagane. Po normalizacji litera musi należeć do aktywnego `letterPool`, czyli do puli przesłanej przez hosta albo do legacy puli użytej jako fallback.

Snapshot `finished`, którego `letter` nie występuje w aktywnej puli, jest wewnętrznie sprzeczny i musi zostać odrzucony. Klient nie może dopisywać segmentu, podmieniać litery ani wyliczać alternatywnego wyniku z `spinSeed`.

`spinSeed`, `spinDurationMs` i `finalTurns` służą wyłącznie do deterministycznej animacji. Wynik rundy nadal pochodzi z autorytatywnego stanu hosta.

## Wspólne wektory

Android i WWW utrzymują identyczny fixture `countries_cities_wheel_state_v1.json`. Testy obu repozytoriów sprawdzają poprawne stany oraz odrzucenie stanu `finished` z literą spoza `letterPool`.
