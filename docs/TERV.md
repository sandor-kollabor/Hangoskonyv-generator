# TERV — Hangoskönyv-generátor, érett verzió

> **Státusz:** javaslat, emberi jóváhagyásra vár (SZOFT-CORE §1: a chat-konszenzus nem konszenzus).
> **Dátum:** 2026-08-20 · **Komplexitás-triázs:** összetett (több modul, külső szolgáltatók,
> pénzköltés) → magas módszertan-szigor, magas modell-tier, egy-változás-egyszerre tempó.

---

## 0. Amit a tervezés ELŐTT megmértünk (és amit nem)

| Kérdés | Lelet | Forrás |
|---|---|---|
| Tud a CosyVoice2 magyarul? | **Nem.** Nyelvei: kínai, angol, japán, koreai + 18 kínai dialektus. | HF model card, GitHub README |
| Tud a CosyVoice3? | **Nem.** 9 nyelv: kínai, angol, japán, koreai, német, spanyol, francia, olasz, orosz. | HF `Fun-CosyVoice3-0.5B-2512`, arXiv 2505.17589 |
| Elfut a hetzner-dockeren? | **Kétszeresen nem:** 4 vCPU / 7 GB / **GPU nélkül**, és már 8 konténer fut rajta (a RAM-szűke miatt kellett 4 GB swap). | `nes-infra/docs/ARCHITECTURE.md` |
| Van magyar nyelvű, önhosztolható, CPU-n futó TTS? | **Igen: Piper** — MIT, 0 VRAM, Raspberry Pi 4-en valós idejű, van `hu_HU-anna` / `hu_HU-berta` hang. | rhasspy/piper-voices (HF) |
| Van magyar prémium felhő-hang? | **Igen:** Google Chirp 3 HD támogatja a `hu-HU`-t. Azure Neural szintén. | Google Cloud TTS dokumentáció |
| Mekkora a korpusz? | 1 220 105 karakter (regény 633k + novellák 384k + Gondoskodás 203k) ≈ **18–24 óra hang**. | karakterszámlálás a három repón |

**A keresési tér határa (km23 — mondd ki, mit NEM néztél):**

- A **Gemini TTS árát nem ellenőriztük.** A mostani prototípus ezen fut, tehát a jelenlegi
  költség ismeretlen. F0-ban mérni kell.
- Az árak **aggregátor-oldalakról** származnak, nem a szolgáltatók saját árlapjáról.
  Nagyságrendre használhatók, elszámolásra nem.
- A **hangminőséget senki nem hallgatta meg magyarul.** Minden minőségi állítás ebben a
  tervben *sejtés*, amíg az F0 mérés le nem fut. Ez a terv legfontosabb nyitott pontja.
- Nem néztük: az Azure árlista részleteit, az ElevenLabs magyar minőségét, az XTTS-v2
  licenc-helyzetét (Coqui CPML — kereskedelmi használatra korlátos, saját használatra
  vizsgálandó).

---

## 1. Kettős orákulum — a munka ELŐTT rögzítve

**KÉSZ, ha** (mind a négy teljesül):

1. Egy teljes novella (~40 000 karakter) végigfut, és a kimenet fejezetjelekkel ellátott
   `.m4b` vagy `.opus`.
2. **A második futás ugyanarra a szövegre 0 API-hívást indít** (gépileg mérve: hívás-számláló).
   Egy karakter megváltoztatása után pontosan 1 szakasz generálódik újra.
3. Ugyanabból a szövegből a *draft* (helyi) és a *final* (felhő) szint azonos szakasz- és
   fejezet-struktúrát ad — a szintváltás nem írja újra a szöveg-tagolást.
4. A futás ELŐTT kiírt költség-becslés a valós, szolgáltatói felületen leolvasott számlától
   **±20%-on belül** van.

**BUKOTT, ha** bármelyik igaz (futásidőben nem lágyítható):

- (a) Egy megszakadt futás után **újra fizetni kell** már legenerált szakaszért.
- (b) Új adapter hozzáadása az `adapters/` könyvtáron **kívül** bármely fájl módosítását igényli.
- (c) API-kulcs bekerül a gitbe, vagy naplózott URL query-stringbe.
- (d) A költség-becslés a valós számlától **>2×** eltér.

**Kontraszt-eset előre (J55) — hol várom, hogy a tervem NEM áll:**

Ha az F0 mérés azt adja, hogy **egyetlen** szolgáltató minden dimenzióban nyer (minőség,
magyar kiejtés, ár, megbízhatóság), akkor az adapter-réteg **túltervezés**, és egy egyszerű
egy-szolgáltatós kliens a helyes válasz. A réteget csak a **draft/final szintezés** tartja
életben — ha az F0 azt mutatja, hogy a Piper magyar minősége korrektúrára is használhatatlan,
a szintezés elesik, és **vele az adapter-réteg fő indoka is.** Ezt előre kimondom, hogy
utólag ne magyarázat, hanem jóslat legyen.

---

## 2. A költség-hatékonyság HELYE — nem a szolgáltató-választás

A karakter-ár ezen a volumenen kis tétel. A pénz két helyen szivárog:

**(1) Újragenerálás.** A prototípus egy hibánál mindent elveszít. Egy irodalmi szöveget
szerkesztés közben 4–5-ször hallgat végig a szerző.

| | Karakter | Chirp3-HD (~$30/1M) |
|---|---|---|
| Korpusz egyszer | 1,22 M | ~$37 |
| 5 szerkesztő-körrel, cache nélkül | 6,1 M | ~$185 |
| 5 kör, cache + draft/final szintezés | 1,22 M fizetett | **~$37** |

**Mechanizmus: chunk-szintű, tartalom-címzett cache.** Kulcs =
`sha256(szakasz-szöveg + adapter + hang + paraméterek)`. A már legenerált szakasz sosem
generálódik újra — sem újrafuttatásnál, sem szövegjavítás után (csak az érintett szakasz).
Ez egyben az (a) bukás-kritérium ellenszere is.

**(2) Fizetett próba-hallgatás.** A korrektúra-körök helyi Piperrel futnak ($0, a PC1-en),
fizetett szolgáltató **csak a végleges renderben**.

> **Miért a PC1 és nem a hetzner-docker:** a PC1 folyamatosan üzemel, nem kell a 7 GB RAM-ot
> 8 konténerrel osztania, és a kiadatlan kézirat nem hagyja el a házat. A VPS itt a legrosszabb
> kombináció: költ ÉS gyengébben teljesít.

**Amit ez NEM ígér:** a Piper (VITS, medium magyar hangok) **nem hangoskönyv-osztály**
irodalmi prózához. A draft-szint korrektúrára van, nem szállításra. A végleges narráció
megspórolása 20 órára ~$37-ért rossz csere.

---

## 3. Architektúra

Node.js CLI + `ffmpeg` (folytonosság a meglévő JS-kóddal; a hang-összefűzés és az M4B
fejezetjel amúgy is ffmpeg).

```
core/
  chunker.js     szöveg → szakaszok (mondathatár, fejezet-észlelés, magyar
                 gondolatjeles párbeszéd — a prototípusban már megoldott rész átvehető)
  cache.js       sha256(szöveg+adapter+hang+param) → audio blob a lemezen
  synth.js       vezénylés: szakaszok → adapter → cache → részeredmény
  assembler.js   szakaszok → fejezet → .m4b/.opus + fejezetjelek (ffmpeg)
  cost.js        előzetes becslés (karakter × adapter-tarifa) + utólagos elszámolás
adapters/
  google-cloud-tts.js   determinisztikus, hu-HU, Standard/Neural2/Chirp3-HD
  piper-local.js        determinisztikus, hu-HU, $0, helyi (draft-szint)
  gemini-tts.js         NEM determinisztikus (a prototípus szolgáltatója)
  azure-tts.js          determinisztikus, hu-HU  [F2]
  elevenlabs.js         [F2, csak ha a mérés indokolja]
bench/
  bakeoff.js     ugyanaz a 3 magyar minta × N adapter → mérési táblázat
  minta/         a három teszt-szöveg (verziózva, hogy a mérés ismételhető legyen)
```

**Az adapter-szerződés** (ezen áll vagy bukik a cserélhetőség):

```js
synthesize({ text, voice, lang, speed })
  -> { audio: Buffer, format, sampleRate, chars, providerMeta }

capabilities()
  -> { languages, voices, maxChars, supportsSSML, supportsCloning,
       pricePerMillionChars,
       deterministic: bool }   // <- ez a kulcs-mezo
```

A `deterministic: false` az, ami a Gemini-t elkülöníti: a mag ekkor **bekapcsolja** a
védekező prompt-kerítést és a szöveg-visszaellenőrzést. Determinisztikus adapternél ez a kód
**nem fut** — a prototípus három kerülőútja így nem szennyezi a magot, hanem egy adapter
lokális ügye lesz.

**Titok-kezelés (SZOFT-CORE §4):** kulcs `.env`-ből, `.gitignore`-olva (már felvéve),
**HTTP headerben**, nem query-stringben. A prototípus `?key=...`-t használ, ami proxy- és
szerver-naplókba kerül — ez javítandó hiba, nem stílus.

---

## 4. Fázisok és kapuk

### F0 — Mérés, kódírás előtt (fél nap)

Nem szolgáltatót *választunk*, hanem **mérünk** (km23: becsült leletre pozitív kontroll kell).
Három magyar minta-szöveg, verziózva:

1. **Próza dialógussal** — magyar gondolatjeles párbeszéd (a prototípus külön kezelte).
2. **Kiejtés-csapdák** — számok, dátumok (`1948-ban`), rövidítések (`kb.`, `stb.`, `pl.`),
   idegen nevek (`Zuboff`, `Cynefin`), mértékegységek.
3. **Hosszú bekezdés 3 szakasz-határon át** — a hangváltás-teszt.

Kimenet: táblázat = adapter × (költség/1M kar **mért**, valós RTF, magyar kiejtési hibák
kézi jelöléssel, hallható-e a szakasz-határ).

> **KAPU (ember az orákulum):** a szerző **meghallgatja** a mintákat. A minőségről nem a
> táblázat és nem az AI dönt. Amíg ez nem futott le, minden minőségi állítás ebben a tervben
> *sejtés*.

### F1 — A mag + a mérés két nyertes adaptere (1–2 nap)

`chunker` + `cache` + `synth` + `assembler`. Orákulum: az 1. szakasz KÉSZ-kritériumai,
különösen a **„második futás = 0 API-hívás"** (gépileg eldönthető).

### F2 — Költség-becslő, CLI-UX, további adapterek

`cost.js` előzetes becslés a futás előtt (a (d) bukás-kritérium ellen), folytatás/megszakítás
kezelése, `--dry-run`.

### F3 — Web-fél, szerver-proxy, auth

**NEM most.** Szerzői döntés (2026-08-20): „másoknak szolgáltatás még nem fontos". Ez a fázis
csak akkor nyílik meg, ha ez megváltozik — akkor viszont a titok-kezelés és a rate limit
újratervezendő.

### Pre-mortem (SZOFT-CORE §1)

*Ha ez a terv tévedés volt, mi lett volna az első jel, amit figyelmen kívül hagytam?*

Az, hogy **az F0 mérés elmarad, vagy az AI értékeli ki hallgatás helyett.** Ekkor a
szolgáltató-választás aggregátor-blogokból vett táblázaton nyugszik, nem a valóságon — és egy
20 órás, elhibázott hangú render után derül ki. A második jel: ha a cache „működik"-jelentése
a szkript záró echo-jából jön, nem a hívás-számlálóból (J32).
