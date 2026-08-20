# Hangoskönyv-generátor

Hosszú magyar szövegek (regény, novellafüzér, tanulmány) hangoskönyvvé alakítása,
**szolgáltató-független** TTS-adapter réteggel.

- **Állapot:** tervezés (F0). A működő előzmény egy egyfájlos prototípus: [`archiv/index-v6plus.html`](archiv/index-v6plus.html).
- **Terv:** [`docs/TERV.md`](docs/TERV.md) — ezt olvasd először.
- **Napló:** [`docs/DEVLOG.md`](docs/DEVLOG.md)
- **Projekt-fegyelem:** [`docs/DEV-CORE.md`](docs/DEV-CORE.md) (a generikus `SZOFT-CORE` kiterjesztése)

## Miért nem elég a prototípus

A `archiv/index-v6plus.html` működik, és 16 commit csiszolta. Négy szerkezeti korlátja van,
amit prompt-hangolással nem lehet megoldani:

1. **A Gemini TTS nem TTS-motor, hanem LLM.** Visszabeszélhet, elutasíthat, hangot váltogat.
   A kódban három külön kerülőút van erre (prompt-kerítés, „erősebb prompt" újrapróbálás,
   `seed: 42`). Determinisztikus TTS API-k ezt a hibaosztályt nem termelik.
2. **Nincs folytatás.** Egy 429 a könyv közepén elveszti a már legenerált *és kifizetett*
   szakaszokat. Ez a fő költség-szivárgás, nem a karakter-ár.
3. **Csak WAV.** 20 óra 24 kHz/16 bit mono ≈ 3,5 GB, fejezetjelek nélkül.
4. **Egy szolgáltató.** A draft/final szintezés (lásd terv) legalább kettőt igényel.

## Költség-nagyságrend (a döntés alapja)

A szóba jövő saját korpusz ~1,22 M karakter ≈ **18–24 óra hang**. Publikált listaárak szerint
ez a legdrágább Google-hangon is ~$37 **egyszeri**. A megtakarítás helye ezért nem a
szolgáltató-választás, hanem az újragenerálás elkerülése — lásd `docs/TERV.md` 2. szakasz.
