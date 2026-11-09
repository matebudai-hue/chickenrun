# Chicken Run

Önálló, magyar nyelvű, többjátékos tréningjáték. A tréner futamot indít, a játékosok pedig a QR-kóddal vagy a szobakóddal, fiók és név nélkül csatlakoznak. Indításkor véletlen párokat kapnak. Egy szobában legfeljebb 40 fő játszhat. Páratlan létszámnál a rendszer egy megfigyelőt sorsol.

## Játékmenet

A távolság a két autó között értendő. Ha mindketten haladnak, normál lépésben mindkét autó 100 métert tesz meg. A döntési pontok: 1000, 800, 600, 400, 200, 50 és 10 méter. A két autó a finálé rövidebb szakaszain is egyenlő távolságot tesz meg.

Mindkét játékos titokban küld be egy döntést. Egy döntés után a felület várakozást jelez, és a másik választását csak a két beküldés után mutatja. Kitérésnél véget ér a pár futama. Ha mindketten haladnak 10 méternél is, ütköznek. A párok a játék közben szabad szövegben üzenhetnek egymásnak. A tréneri nézet a párok állását és összesített kimeneteleiket mutatja.

## Helyi futtatás és ellenőrzés

Node.js 22.13 vagy újabb szükséges. Nincs telepítendő csomag.

```sh
npm test
npm start
```

A helyi cím: http://localhost:8080. A helyi játékállapotot a folyamat memóriája tárolja. A távoli résztvevők az internetes kiadást használják, ahol a szobákat a játék saját adatbázisa tartja meg a futam idejére. A szobák nyolc óra után lejárnak.

A `npm run build` elkészíti a Worker-csomagot. A hosztolt változat a `DB` adatbáziskötést és a `drizzle/` migrációt használja. A QR-kódot a vendég böngészője állítja elő. A beépített QR-kód-könyvtár licence a `public/QR-LICENSE.txt` fájlban van.

