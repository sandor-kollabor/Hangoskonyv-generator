# F0 mérés — előfeltételek

## Ami már megvan
- Node v24.18.0 ✅

## Ami hiányzik (mért állapot, 2026-08-20)

### Piper (draft-szint, ingyenes, determinisztikus)
```
pip install piper-tts
```
Majd a magyar hang letöltése a `rhasspy/piper-voices` HF-repóból (`hu/hu_HU/anna/medium`):
a `hu_HU-anna-medium.onnx` **és** a `hu_HU-anna-medium.onnx.json` együtt kell.
A `.env`-ben: `PIPER_BIN` = a piper futtathatója, `PIPER_VOICE_DIR` = a hangok könyvtára.

### ffmpeg — F1 előfeltétele, F0-hoz NEM kell
Az `assembler.js` (M4B, fejezetjelek) ezen áll. A mérő szándékosan nem használja:
saját WAV-írót tartalmaz (`core/wav.mjs`), hogy az F0 ffmpeg nélkül is lefusson.

### Azure — fiók-beállítás, a szerző lépése
portal.azure.com -> Create a resource -> Speech service -> **Pricing tier: Free F0**
-> Region: West Europe -> Keys and Endpoint.

## Futtatás
```
node bench/bakeoff.mjs            # dry-run: mit futtatna, mit koltene (nem hiv API-t)
node bench/bakeoff.mjs --run      # eles futas
```
A mérő **először pozitív kontrollt** futtat minden adapteren. Ha az elbukik, az adapter
további leletei érvénytelenek — nem a magyar kiejtést mértük, hanem a saját hívásunkat.

Kimenet: `bench/out/MERES.md` (gépi rovatok kitöltve, **minőségi rovatok üresen**) és
`bench/out/*.wav`. **A minőségről a szerző füle dönt, nem a táblázat.**
