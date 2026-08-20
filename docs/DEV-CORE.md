---
core: p1
kiterjeszti: SZOFT-CORE c4
---

# DEV-CORE — Hangoskönyv-generátor (projekt-réteg)

> Ez a fájl a generikus [`SZOFT-CORE`](../../ai-fejlesztes-modszertan/szoftverfejlesztes/SZOFT-CORE.md)
> **kiterjesztése**, nem ismétlése. Ami ott áll, itt is áll. Csak a projekt sajátosságai
> kerülnek ide.

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

## Napló

Minden érdemi lépés a [`DEVLOG.md`](DEVLOG.md)-ba: tünet → gyökérok → megoldás → miért.
