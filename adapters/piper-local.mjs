// Piper - DETERMINISZTIKUS, helyi, ingyenes adapter (draft-szint).
//
// Miert a PC1 es nem a hetzner-docker: a PC1 folyamatosan uzemel, nem kell a
// 7 GB RAM-ot 8 kontenerrel osztania, es a kiadatlan kezirat nem hagyja el a
// hazat (docs/DEVLOG.md "Lelet 3").
//
// AMIT EZ NEM IGER: a Piper (VITS, medium magyar hangok) NEM hangoskonyv-osztaly
// irodalmi prozahoz. A draft-szint korrekturara van, nem szallitasra.
//
// Telepites (a szerzo lepese, lasd bench/README-TELEPITES.md):
//   pip install piper-tts
//   + hu_HU-anna-medium.onnx / .onnx.json a PIPER_VOICE_DIR-be

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripWavHeader } from '../core/wav.mjs';

const execFileAsync = promisify(execFile);
const SAMPLE_RATE = 22050; // a medium modellek natív mintavetele

export const id = 'piper';

export function capabilities() {
  return {
    languages: ['hu-HU'],
    voices: ['hu_HU-anna-medium', 'hu_HU-berta-medium', 'hu_HU-imre-medium'],
    defaultVoice: 'hu_HU-anna-medium',
    maxChars: 100000,          // helyi: nincs API-korlat
    supportsSSML: false,
    supportsCloning: false,
    pricePerMillionChars: 0,   // helyi futtatas
    deterministic: true,
    sampleRate: SAMPLE_RATE,
  };
}

export function configured() {
  return Boolean(process.env.PIPER_BIN && process.env.PIPER_VOICE_DIR);
}

export async function synthesize({ text, voice }) {
  const bin = process.env.PIPER_BIN;
  const voiceDir = process.env.PIPER_VOICE_DIR;
  if (!bin || !voiceDir) throw new Error('PIPER_BIN / PIPER_VOICE_DIR nincs beallitva (.env)');

  const v = voice || capabilities().defaultVoice;
  const model = join(voiceDir, `${v}.onnx`);
  const dir = await mkdtemp(join(tmpdir(), 'piper-'));
  const outPath = join(dir, 'out.wav');

  try {
    // A Piper stdin-rol olvas; a -f a kimeneti WAV.
    await execFileAsync(bin, ['-m', model, '-f', outPath], {
      input: text,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`Piper futasi hiba: ${(err.stderr || err.message || '').toString().slice(0, 300)}`);
  }

  const wav = await readFile(outPath);
  await unlink(outPath).catch(() => {});
  const pcm = stripWavHeader(wav);
  if (pcm.length === 0) throw new Error('Piper: 0 bajt hangadat (nema valasz, nem siker)');

  return {
    audio: pcm,
    format: 'pcm16',
    sampleRate: SAMPLE_RATE,
    chars: text.length,
    providerMeta: { voice: v, model },
  };
}
