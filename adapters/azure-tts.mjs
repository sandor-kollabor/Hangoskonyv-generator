// Azure AI Speech - DETERMINISZTIKUS adapter, hu-HU neuralis hangokkal.
//
// Arszint: a szerzo az F0 (Free) szintet allitja be a portalon. Az F0 a kvota
// eleresekor HIBAT ad, nem szamlat (fail-closed, penzre alkalmazva - lasd
// docs/DEVLOG.md "Lelet 5": a 0,5 M-os ingyenes kvota mechanikaja dokumentalt
// szamla-meglepetes-forras, ezert nem az S0 + "benne van az 500K" bizalomra epitunk).

import { stripWavHeader } from '../core/wav.mjs';

const SAMPLE_RATE = 24000;

export const id = 'azure';

export function capabilities() {
  return {
    languages: ['hu-HU'],
    voices: ['hu-HU-NoemiNeural', 'hu-HU-TamasNeural'],
    defaultVoice: 'hu-HU-NoemiNeural',
    maxChars: 8000,            // SSML kereses/kerules elott biztonsagos hatar
    supportsSSML: true,
    supportsCloning: false,
    pricePerMillionChars: 16,  // S0 listaar; F0 szinten 0,5 M/honap ingyenes
    deterministic: true,       // <- nem LLM: nem beszel vissza, nem valt hangot
    sampleRate: SAMPLE_RATE,
  };
}

export function configured() {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function synthesize({ text, voice, lang = 'hu-HU', speed = 1.0 }) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION nincs beallitva (.env)');

  const v = voice || capabilities().defaultVoice;
  const rate = speed === 1.0 ? '0%' : `${Math.round((speed - 1) * 100)}%`;
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${v}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`;

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      // Kulcs HEADERBEN, nem URL query-stringben - az utobbi proxy- es
      // szerver-naplokba kerul (a prototipus ezt megsertette).
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': `raw-${SAMPLE_RATE / 1000}khz-16bit-mono-pcm`,
      'User-Agent': 'hangoskonyv-generator',
    },
    body: ssml,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // A 429 itt kvota-kimerules is lehet (F0 szinten ez a fail-closed jel).
    throw new Error(`Azure ${res.status}: ${body.slice(0, 300) || '(ures torzs)'}`);
  }

  const pcm = stripWavHeader(Buffer.from(await res.arrayBuffer()));
  if (pcm.length === 0) throw new Error('Azure: 0 bajt hangadat (nema valasz, nem siker)');

  return {
    audio: pcm,
    format: 'pcm16',
    sampleRate: SAMPLE_RATE,
    chars: text.length,
    providerMeta: { voice: v, region },
  };
}
