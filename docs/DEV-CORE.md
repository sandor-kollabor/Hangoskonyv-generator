---
core: p2
kiterjeszti: SZOFT-CORE c6
osszevetve: 2026-11-12
---

# DEV-CORE — Hangoskönyv-generátor (projekt-réteg)

> Ez a fájl a generikus [`SZOFT-CORE`](../../ai-fejlesztes-modszertan/szoftverfejlesztes/SZOFT-CORE.md)
> **kiterjesztése**, nem ismétlése. Ami ott áll, itt is áll. Csak a projekt sajátosságai
> kerülnek ide.
>
> **Verzió:** `p2`, a `SZOFT-CORE c6` fölött — **összevetve: 2026-11-12.** A `p1` a c4-hez
> készült; a c5 (`J138`), a c6 (`J139`) és a `J73` itt utólag került összevetésre (lent, „A
> c5–c6 összevetése”). A felirat azt jelenti, hogy a réteg a megnevezett verzióval **ténylegesen
> össze lett vetve**, nem azt, hogy a legújabbat töltöd be.

## A projekt specifikus kockázatai

**1. Ez a projekt pénzt költ futásonként.** A legtöbb szoftverhiba itt nem hibajelzés, hanem
számla. Ezért:

- Minden generáló futás **előtt** kiírt költség-becslés, `--dry-run` opcióval.
- Egy adapter alapállapotban **nem** hív fizetős API-t; a fizetős szintet explicit
  `--tier=final` kapcsolja be.
- A cache **találati arányát** naplózzuk minden futásnál — ez a fő költség-fék működésének
  szenzora. Ha 0%, valami eltört, és azt a *számla* előtt kell megtudni.

**2. A siker-jel itt emberi ítélet, nem teszt.** A hangminőség és a magyar kiejtés
helyessége nem automatizálható orákulum. Következmény: **egyetlen adapter- vagy
prompt-változtatás sem tekinthető késznek meghallgatás nélkül.** A „lefutott / 200 / nincs
hibajelzés" itt különösen félrevezető: a rossz hang is 200-at ad.

**3. A Gemini TTS nem determinisztikus szolgáltató.** LLM, ami hangot ad vissza — tehát
visszabeszélhet, elutasíthat, hangot váltogat. Az adapter `deterministic: false` mezője ezt
jelöli. **Ne általánosíts** nem-determinisztikus adapteren mért viselkedést a determinisztikusakra
és fordítva — ez két különböző hibaosztály.

## Verifikációs fékek (a §2-höz)

- **A cache működését a hívás-számlálóból olvasd, ne a naplósorból** (J32): a második futásnak
  gépileg mérve 0 kimenő API-hívása legyen. A `cache: HIT` echo önjelentés.
- **A hangfájl létezése nem siker.** Egy 0 bájtos, csonka vagy csendes WAV is létrejön.
  A poszt-ellenőrzés: hossz > 0, és a **várt hossz nagyságrendjében** van
  (karakter/18 ≈ másodperc). A puszta fájl-létezés-ellenőrzés néma szenzor (km23).
- **Negatív leletre pozitív kontroll:** ha egy adapter „nem támogatja a magyart" leletet ad,
  ugyanabból a mérésből egy tudottan támogatott nyelv is menjen át — különben nem a nyelvet
  mérted, hanem az elrontott hívásodat (J73: a bemeneti oldal is szenzor).

## Titok-kezelés

- Kulcs kizárólag `.env`-ből, **HTTP headerben** — sose URL query-stringben (`?key=`), mert az
  proxy- és szerver-naplókba kerül. *A prototípus ezt megsérti; az érett verzió nem.*
- A `.gitignore` a titkokra és a generált hangra (GB-os fájlok) az első kulcs keletkezése
  **előtt** felvéve — kész.

## A c5–c6 összevetése (2026-11-12)

- **`J73` (SZOFT-CORE §2):** a fenti harmadik verifikációs fék már erre hivatkozik — egyezik,
  nincs teendő.
- **`J138` (SZOFT-CORE §4, telepített állapot): ma nem alkalmazható** — a projekt helyi CLI,
  kiszolgált könyvtára és szervere nincs (kódból és fájllistából olvasva, 2026-11-12; a
  `.venv-piper`-ben lévő Piper-HTTP-szervert nem használjuk). **Akkor válik kötelezővé,** ha a
  generált hang vagy bármely kimenet webszerverre kerül: onnantól a kiszolgált könyvtár külön
  mérési tárgy, és a `.env` meg a mentések nem kerülhetnek oda.
- **`J139` (SZOFT-CORE §7, visszakeresés) — az első alkalmazás itt:** a „kulcs csak headerben”
  szabályra keresve `?key=` — egy találat, az `archiv/index-v6plus.html` (a prototípus, a fenti
  Titok-kezelés pont már kimondja); az élő adapter (`adapters/gemini-tts.mjs`) az
  `x-goog-api-key` headert használja. Az `archiv/` történet, nem élő állapot, ezért a `J139`
  határa szerint nem javítandó — de **ne indítsd onnan** valódi kulccsal.

## Napló

Minden érdemi lépés a [`DEVLOG.md`](DEVLOG.md)-ba: tünet → gyökérok → megoldás → miért.
