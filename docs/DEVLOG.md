# DEVLOG — Hangoskönyv-generátor

Legújabb elöl. Formátum: tünet → gyökérok → megoldás → miért.

---

## 2026-08-20 — Repó-higiénia + a CosyVoice2-terv cáfolata (F0 előtt)

### Lelet 1: a repó már létezett (stale-state, km10)

**Tünet:** a feladat úgy szólt, hogy „hozd létre a hangoskönyv fejlesztés repóját", és a
kiindulási kódnak a `G:\Saját meghajtó\TÉMÁK\Hangos könyv generátor\index-v6-hangoskonyv.html`
volt megadva.

**Gyökérok:** a repó **már megvolt** (`C:\dev\Hangoskonyv-generator`, GitHub-remote-tal,
16 committal), és a benne lévő `index.html` **újabb** volt, mint a G:-n lévő v6 — pontosan egy
prompt-szabállyal (a `»…«` közti szöveg gépi hangon olvasása). A G:-s fájl elavult másolat.
Ha nem nézem meg az élő állapotot, egy második repót hoztam volna létre, és a drift megduplázódik.

**Megoldás:** a meglévő repót rendeztük, nem újat hoztunk létre. A G:-s láb ezzel lezárva —
egy igazságforrás (git).

**Miért:** ez a km10 (stale-state fék) és a J33 (a lábszám maga is drift-felület) tankönyvi
esete. A `G:` egy harmadik, kézi, verziótlan láb volt.

### Lelet 2: a repónak nem volt `main` ága

**Tünet:** `git branch -a` → egyetlen ág, `claude/debug-gemini-tts-UdO5p`, és **a távoli HEAD is ez.**
Nem volt README, `.gitignore`, DEVLOG — csak az `index.html`.

**Gyökérok:** a repó egy debug-munkamenetből keletkezett, és soha nem kapott alap-szerkezetet.
Így a SZOFT-CORE §3 („a `main` védett", funkció-branch/PR) nem tud érvényesülni: nincs mihez
képest PR-t nyitni.

**Megoldás:** `main` létrehozva a jelenlegi HEAD-ből (a teljes 16-commites history megtartva),
plusz `.gitignore` (titkok + generált hang), `README.md`, `docs/TERV.md`, `docs/DEV-CORE.md`,
`docs/DEVLOG.md`. A prototípus `archiv/index-v6plus.html` néven megőrizve.

### Lelet 3: a CosyVoice2-terv két ponton bukik — mérés nélkül is

**Tünet:** a kiinduló feltevés az volt, hogy a CosyVoice2 a legköltséghatékonyabb út, és
„állítólag VPS kell hozzá", amit a Hetzner Docker-részén biztosítani lehet.

**Gyökérok — két független ok:**

1. **Nyelv.** A CosyVoice2 nyelvei: kínai, angol, japán, koreai + 18 kínai dialektus.
   A CosyVoice3 (arXiv 2505.17589) 9 nyelvre skálázott: kínai, angol, japán, koreai, német,
   spanyol, francia, olasz, orosz. **Magyar egyikben sem.** A zero-shot cross-lingual klónozás
   nem nyelvtudás — magyar szöveget idegen fonémakészletből közelít.
2. **Hardver.** `hetzner-docker` = 4 vCPU / 7 GB RAM / 75 GB, **GPU nélkül**, és már 8 konténer
   fut rajta (a RAM-szűke miatt kellett 4 GB swapfile). Egy 0,5B autoregresszív TTS CPU-n ide
   nem fér be úgy, hogy a többi szolgáltatás is éljen. *(Forrás: `nes-infra/docs/ARCHITECTURE.md`,
   nem becslés.)*

**Megoldás:** a VPS-irány elvetve. Ami helyette áll:

- **Draft-szint:** Piper (MIT, CPU-only, `hu_HU-anna`/`berta`) **a PC1-en** — nem a VPS-en.
  A PC1 folyamatosan üzemel, nem osztja a RAM-ot 8 konténerrel, és a kézirat nem hagyja el a házat.
- **Final-szint:** determinisztikus felhő-TTS magyar hanggal (Google Chirp 3 HD `hu-HU`,
  vagy Azure Neural) — de **csak a mérés (F0) után**, meghallgatás alapján.

**Miért — és ez a fontosabb tanulság:** a költséghatékonyság helye nem a szolgáltató-választás.
A korpusz ~1,22 M karakter (≈18–24 óra), ami a legdrágább Google-hangon is ~$37 **egyszeri**.
A pénz az **újragenerálásnál** szivárog: a prototípus egy 429-nél elveszti a már kifizetett
szakaszokat, és egy irodalmi szöveget szerkesztés közben 4–5-ször hallgat végig a szerző —
így ugyanaz a korpusz ~$185. A fék tehát **chunk-szintű, tartalom-címzett cache** + **draft/final
szintezés**, nem a per-karakter ár lenyomása.

### Nyitott, ELŐTT lévő pont

**Az F0 mérés nem futott le.** Ebben a naplóbejegyzésben és a `TERV.md`-ben minden **minőségi**
állítás (Piper magyar minősége, Chirp3-HD magyar kiejtése) **sejtés**, nem bizonyított. Az árak
aggregátor-oldalakról származnak, nem szolgáltatói árlapról. A **Gemini TTS árát — a prototípus
jelenlegi szolgáltatóját — nem ellenőriztük.**

### Környezeti akadály

A `push` nem futott le: a `~/.ssh/agent.sock` létezik, de az agent halott
(`Error connecting to agent: Connection refused`). A fő kulcs jelszavas → felügyelet nélküli
push nem megy. Feloldás a szerző részéről: `bash ~/.ssh/agent-up.sh`.
