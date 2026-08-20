// Nyers PCM -> WAV. Azert sajat, mert az F0 meres nem tetelezheti fel az ffmpeg-et
// (a PC1-en 2026-08-20-an nem volt telepitve; lasd DEVLOG "Lelet 4").

/** 16 bites mono nyers PCM korbecsomagolasa WAV konteneribe. */
export function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2; // mono, 16 bit
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);        // fmt chunk hossz
  header.writeUInt16LE(1, 20);         // PCM
  header.writeUInt16LE(1, 22);         // csatornak
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);         // block align
  header.writeUInt16LE(16, 34);        // bit/minta
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Hang hossza masodpercben, a TENYLEGES bajtszambol.
 *
 * Miert nem a fajl letezeset ellenorizzuk: egy 0 bajtos, csonka vagy teljesen
 * csendes fajl is letrejon, es a puszta letezes-ellenorzes nema szenzor (km23).
 * A hosszt a hivo a VART hosszal veti ossze (karakter/18 ~ masodperc).
 */
export function pcmDurationSec(byteLength, sampleRate) {
  return byteLength / (sampleRate * 2);
}

/** WAV fejlec levagasa, ha van (a Piper WAV-ot ad, a felho nyers PCM-et). */
export function stripWavHeader(buf) {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF') {
    // A 'data' chunk megkeresese - nem fix 44 bajt, mert lehet LIST/fact chunk is.
    let off = 12;
    while (off + 8 <= buf.length) {
      const id = buf.toString('ascii', off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (id === 'data') return buf.subarray(off + 8, off + 8 + size);
      off += 8 + size + (size % 2);
    }
  }
  return buf;
}
