# Padlógáz tréneri pult

A tréner játék közben egy pillantással ellenőrzi a szoba működését. Feldolgozáskor a csoport eredményéből eljut egy játékos döntéséhez és egy konkrét párbeszédhez. A kivetítő közben az utoljára kért tartalmat mutatja.

## Áttekintés

- Három fő fül: Áttekintés, Riport, Pontszámok. Indítás előtt az Áttekintés a belépett játékosokat és a kapcsolati jelet mutatja. Akiktől nem érkezik friss jel, elöl vannak. Az ismeretlen kapcsolat külön állapot.
- Játék közben felül egy sorban látszik a létszám, a kapcsolódók száma, az aktív és befejezett futamok, a rajtra és új párra várók. Kiemelve jelenjen meg az elmaradt rajt, a kapcsolati jel hiánya és a párra várás. Az érintett pár részlete nyitható. A teljes napló és a hibakeresési JSON innen érhető el.
- Elfogadás: 20 résztvevő és 50 lezárt futam mellett a működési összefoglaló és az első teendő látszik 1280×720-on görgetés nélkül. Keskeny kijelzőn tördelődik, a dokumentum szélessége nem nő.

## Riport

- Eredmények, Futamok, Párbeszédek és Kivezetés külön nézet. Az Eredmények közös Csoport/Játékos választója a meglevő színes éremábrára és a fényoszlopokra is hat. Az egyéni futamsorok és a Mi jött utána nyitható részben elérhetők.
- A fényoszlop magassága a nézetben lineárisan arányos a kitérések darabszámával. A méterjelölések a játék mérési pontjai, egyenletes vizuális kiosztással. Ütközés külön számláló. Egyoldalú kitérés egy jel, kölcsönös kitérés két jel, félbemaradt futam és nem végrehajtott gombnyomás nulla. Ha a végrehajtási pont hiányzik, az eset nem kap kitalált távolságot. A csoportos tesztjátékosos szűrés alatt a tesztsofőr végrehajtott kitérése is beletartozik; egyéni szűrésben csak a kiválasztott ember számít.
- Kattintás egy mérési pontra megnyitja ott a futamokat, üzenetszámmal. Egy eset megnyitása az idővonalra visz. Időzített futamban, ahol mindkét adat megvan, a kitérési kérés és a tényleges kitérés helye külön szerepel.
- Kivetítéskor változatlan az éjszakai racing stílus. A fényoszlopok nagyobbak, az összes futam listája a pulton marad. A leggyakoribb eredmény részesedése a tényleges kitérésekből számolódik; holtverseny esetén nincs egyetlen csúcsnak nevezve.
- Pontszámok külön fülön, névvel vagy játékosszámmal kivetíthető, névsor vagy pont szerint. Győztes +2, Vesztes 0, Kórház −1, Döntetlen +1.

## Párbeszédek

- Gyors szűrők: Van üzenet, Legalább 2 üzenet, Mindketten írtak. Kombinálhatók a futam kimenetelével és a név/futamszám keresővel. Két üzenet ugyanattól a féltől nem számít kétoldalú párbeszédnek.
- Találati sor: futamszám, kimenetel, üzenetszám, első üzenetváltás előnézete. A kiválasztott eset teljes idővonala a két fél oldalán automatikusan mutatja az üzeneteket. Felkészüléskor több futam felvehető a vetítési sorba; a sorból előző/következő eset vetíthető.
- Név nélküli vetítéskor a szereplők A/B. Az üzenetszöveg előnézetében látszik az eredeti szöveg, amely maga is tartalmazhat nevet. Az előnézet megnyitása és a szűrők változtatása nem indít vetítést.

## Kivetítő és ellenőrzés

- A ragadós vezérlés az aktív tartalmat, a névkapcsolót és az adott nézethez tartozó lapozót mutatja. A Váltás menüből minden vetíthető nézet elérhető. Első Kivetítem kattintás megnyitja az ablakot. A további küldések az élő ablakot frissítik fókuszálás nélkül.
- A pult és a kivetített tartalom kiválasztása önálló. Egyéni és csoportos eredmény, ponttábla, futamsorok, átmenetek, eset és kivezetési kérdések névvel vagy név nélkül próbálandók. A pult szűrője csak a következő vetítéskor kerül át a kivetítőre.
- Elfogadás: korábbi export és szintetikus futamok alapján ellenőrizni az eredményeket és a kitérést, valamint nulla kitérést és holtversenyt. Böngészőben 20 fős ellenőrzés, kétoldalú üzenetek kiszűrése, vetítési sor, külön ablak, névkapcsolás és 1280×720-as görgetés nélküli vetítés. A résztvevői kliens és a játékszabály változatlan.
