#!/usr/bin/env node
// F0 MERES - ugyanaz a magyar minta N adapteren at.
//
// Ez NEM szolgaltato-valasztas, hanem meres. A kiertekelo a SZERZO FULE:
// a szkript tablazatot es hangfajlokat termel, iteletet nem.
//
// Hasznalat:
//   node bench/bakeoff.mjs                 # dry-run: mit futtatna, mit koltene
//   node bench/bakeoff.mjs --run           # tenyleges futas (FIZETOS adaptereket is hiv)
//   node bench/bakeoff.mjs --run --only=piper,azure
//
// Alapallapotban NEM hiv fizetos API-t (docs/DEV-CORE.md).

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pcmToWav, pcmDurationSec } from '../core/wav.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MINTA = join(HERE, 'minta');
const OUT = join(HERE, 'out');

// Magyar narracios tempo: kb. 18 karakter/masodperc. A VART hosszhoz kell,
// hogy a csonka/nema kimenet kiderüljön (a fajl letezese nem siker - km23).
const CHARS_PER_SEC = 18;

const ADAPTERS = ['piper-local', 'azure-tts', 'gemini-tts'];

const args = process.argv.slice(2);
const DRY = !args.includes('--run');
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',');

/** Egy adapter betoltese + allapota. */
async function loadAdapters() {
  const out = [];
  for (const file of ADAPTERS) {
    const mod = await import(`../adapters/${file}.mjs`);
    if (only && !only.includes(mod.id)) continue;
    out.push({ mod, caps: mod.capabilities(), ready: mod.configured() });
  }
  return out;
}

/**
 * POZITIV KONTROLL (km23): egy rovid, tudottan helyes mondat.
 * Ha ez elbukik, az adapter minden tovabbi negativ lelete ERVENYTELEN -
 * nem a magyar kiejtest mertuk, hanem a sajat elrontott hivasunkat (J73).
 */
async function positiveControl(mod, text) {
  try {
    const r = await mod.synthesize({ text });
    const sec = pcmDurationSec(r.audio.length, r.sampleRate);
    const expected = text.length / CHARS_PER_SEC;
    // Nagysagrend-ellenorzes, nem egyezes: 0,3x - 3x a vart hossz.
    if (sec < expected * 0.3 || sec > expected * 3) {
      return { ok: false, reason: `hossz-anomalia: ${sec.toFixed(1)}s a vart ~${expected.toFixed(1)}s helyett` };
    }
    return { ok: true, sec };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(MINTA)).filter((f) => f.endsWith('.txt')).sort();
  const samples = [];
  for (const f of files) {
    samples.push({ name: f.replace(/\.txt$/, ''), text: (await readFile(join(MINTA, f), 'utf8')).trim() });
  }
  const control = samples.find((s) => s.name.startsWith('00-'));
  const cases = samples.filter((s) => !s.name.startsWith('00-'));

  const adapters = await loadAdapters();

  console.log(`\n=== F0 MERES ${DRY ? '(DRY-RUN - nem hiv API-t)' : '(ELES FUTAS)'} ===\n`);
  console.log('Adapterek:');
  for (const a of adapters) {
    const price = a.caps.pricePerMillionChars;
    const priceStr = price === null ? 'ISMERETLEN (nem ellenorzott tarifa)'
                   : price === 0 ? '$0 (helyi)' : `$${price}/1M kar`;
    console.log(`  ${a.mod.id.padEnd(8)} determinisztikus=${String(a.caps.deterministic).padEnd(5)} ` +
                `${a.ready ? 'beallitva ' : 'NINCS KULCS'} ${priceStr}`);
  }

  const totalChars = cases.reduce((s, c) => s + c.text.length, 0);
  console.log(`\nMinta-karakterek osszesen: ${totalChars} / adapter`);
  for (const a of adapters) {
    const p = a.caps.pricePerMillionChars;
    const cost = p === null ? 'ismeretlen' : `$${((totalChars * p) / 1e6).toFixed(4)}`;
    console.log(`  ${a.mod.id.padEnd(8)} becsult koltseg a meresre: ${cost}`);
  }

  if (DRY) {
    console.log('\nDRY-RUN vege. Eles futas: node bench/bakeoff.mjs --run\n');
    return;
  }

  const rows = [];
  for (const a of adapters) {
    if (!a.ready) {
      console.log(`\n[${a.mod.id}] KIHAGYVA - nincs beallitva (kulcs/binaris hianyzik).`);
      rows.push({ adapter: a.mod.id, sample: '-', status: 'KIHAGYVA (nincs beallitva)' });
      continue;
    }

    // 1) Pozitiv kontroll ELOSZOR.
    process.stdout.write(`\n[${a.mod.id}] pozitiv kontroll... `);
    const pc = await positiveControl(a.mod, control.text);
    if (!pc.ok) {
      console.log(`BUKOTT: ${pc.reason}`);
      console.log(`  -> ${a.mod.id} tovabbi leletei ERVENYTELENEK (a meroeszkoz nem mukodott).`);
      rows.push({ adapter: a.mod.id, sample: '-', status: `KONTROLL BUKOTT: ${pc.reason}` });
      continue;
    }
    console.log(`OK (${pc.sec.toFixed(1)}s)`);

    // 2) A valodi minták.
    for (const c of cases) {
      process.stdout.write(`  ${c.name} (${c.text.length} kar)... `);
      const t0 = process.hrtime.bigint();
      try {
        const r = await a.mod.synthesize({ text: c.text });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        const sec = pcmDurationSec(r.audio.length, r.sampleRate);
        const expected = c.text.length / CHARS_PER_SEC;
        const rtf = ms / 1000 / sec; // <1 = valos idonel gyorsabb
        const path = join(OUT, `${a.mod.id}--${c.name}.wav`);
        await writeFile(path, pcmToWav(r.audio, r.sampleRate));
        const anomaly = sec < expected * 0.5 || sec > expected * 2
          ? ` ⚠ hossz-anomalia (vart ~${expected.toFixed(0)}s)` : '';
        console.log(`${sec.toFixed(1)}s, RTF ${rtf.toFixed(2)}${anomaly}`);
        rows.push({
          adapter: a.mod.id, sample: c.name, chars: c.text.length,
          sec: sec.toFixed(1), expectedSec: expected.toFixed(0), rtf: rtf.toFixed(2),
          status: anomaly ? 'HOSSZ-ANOMALIA' : 'ok', file: `out/${a.mod.id}--${c.name}.wav`,
        });
      } catch (err) {
        console.log(`HIBA: ${err.message}`);
        rows.push({ adapter: a.mod.id, sample: c.name, status: `HIBA: ${err.message}` });
      }
    }
  }

  // 3) Merési tablazat - a KIERTEKELES rovatai szandekosan uresek.
  let md = `# F0 mérési eredmény\n\n`;
  md += `> A gépi rovatokat a \`bakeoff.mjs\` töltötte ki. **A minőségi rovatok üresek:\n`;
  md += `> azokat a szerző tölti ki MEGHALLGATÁS után.** A hangminőségről nem a táblázat dönt.\n\n`;
  md += `## Gépi mérés\n\n`;
  md += `| Adapter | Minta | Karakter | Hossz | Várt | RTF | Állapot | Fájl |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.adapter} | ${r.sample} | ${r.chars ?? '-'} | ${r.sec ?? '-'} | ${r.expectedSec ?? '-'} | ${r.rtf ?? '-'} | ${r.status} | ${r.file ?? '-'} |\n`;
  }
  md += `\n## Emberi kiértékelés (a szerző tölti ki, meghallgatás után)\n\n`;
  md += `| Adapter | Magyar kiejtés (1-5) | Kiejtési hibák (sorold) | Párbeszéd-intonáció (1-5) | Hallható a szakaszhatár? | Hangoskönyvre alkalmas? |\n|---|---|---|---|---|---|\n`;
  for (const a of adapters) md += `| ${a.mod.id} |  |  |  |  |  |\n`;
  md += `\n**Döntés:** _(a kiértékelés után írd be, melyik adapter a draft- és melyik a final-szint)_\n`;

  await writeFile(join(OUT, 'MERES.md'), md);
  console.log(`\nTablazat: bench/out/MERES.md`);
  console.log(`Hangfajlok: bench/out/*.wav  <- EZEKET HALLGASD MEG\n`);
}

main().catch((e) => { console.error(`\nVEGZETES: ${e.message}`); process.exit(1); });
