# Chicken Run

Önálló, magyar nyelvű, többjátékos tréningjáték. A főoldal a tréneri vezérlőpult. Az Új futam és QR-kód gomb megnyitja a várót, a Játék indítása gomb sorsolja a párokat az addig csatlakozott játékosokból. A játékosok a QR-kóddal vagy a szobakóddal, fiók nélkül csatlakoznak. Az opcionális nevet vagy becenevet csak a tréner látja. Egy szobában legfeljebb 40 résztvevő játszhat.

## Játékmenet

- Az első párosítás véletlen. Páratlan létszámnál a pár nélkül maradt résztvevő egy automatikus tesztjátékost kap.
- Az autók 1000 méterre indulnak egymástól. A következő döntési pontok 800, 600, 400, 200, 50 és 10 méternél vannak.
- A választás akkor válik láthatóvá, amikor mindkét fél beküldte. Kitérésnél véget ér a játék. Ha 10 méternél is mindketten haladnak, ütköznek. A párok játék közben üzenhetnek egymásnak.
- Az **Új játékot indítok** gombbal a résztvevő várólistára kerül. A rendszer olyan másik résztvevőt keres, aki ugyanezt választotta, és akivel az előző játékban egyikük sem volt párban.
- A **Saját döntési riport** az összes befejezett játékot és az egyes döntések távolságát, időpontját és kimenetelét mutatja. A tréner látja a név szerinti párokat, az aktuális állást és a közösen lezárt döntéseket, valamint a párok teljes üzenetváltását. A tréneri CSV mindkettőt tartalmazza. A futam lezárása után a riportok a szoba lejártáig elérhetők.

## Közzététel

A játékos- és a tréneri felület címe: https://matebudai-hue.github.io/chickenrun/. A GitHub Pages a main ág docs mappáját szolgálja ki. A valós idejű játékállapotot a Chicken Run saját háttérszolgáltatása kezeli. A szobák nyolc óra után lejárnak. A tréneri hozzáférés a futamot indító böngészőben érhető el.

## Helyi futtatás

Node.js 22.13 vagy újabb szükséges. Nincs telepítendő csomag.

    npm test
    npm start

Helyben a http://localhost:8080 címen fut, és a játékállapotot a folyamat memóriája tárolja. Az npm run build elkészíti a Worker-csomagot. A hosztolt háttérszolgáltatás a DB adatbáziskötést és a drizzle/ migrációt használja. A QR-kódot a vendég böngészője állítja elő. A QR-kód-könyvtár licence a docs/QR-LICENSE.txt fájlban van.
