/**
 * Narration for the AureonCare training videos.
 *
 * Every on-screen caption is also the narration line, so the spoken track, the
 * burned-in caption and the .srt stay in lockstep by construction. Clips are
 * synthesised before the caption is shown, and the caption is then held for at
 * least as long as its audio — which is what keeps voice and picture in sync.
 *
 * Engines
 * -------
 *   espeak  (default) offline espeak-ng, optionally through an mbrola voice.
 *           Always available, but audibly synthetic.
 *   google  Google Cloud Text-to-Speech — the voice family Google Maps
 *           navigation speaks with. Needs GOOGLE_TTS_API_KEY.
 *   files   pre-recorded audio: narration/<slug>/<NN>.wav, numbered in the order
 *           the lines are spoken. This is the path for a human or a commercial
 *           voice — drop the files in and re-run; no script changes.
 *   none    silent track, as before.
 *
 * Swap engines with VOICE_ENGINE. Everything else (timing, mixing, mastering)
 * is identical, so upgrading the voice never means re-recording the picture.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ENGINE = process.env.VOICE_ENGINE || 'espeak';
const VOICE = process.env.VOICE_NAME || 'mb-us2';
const RATE = process.env.VOICE_RATE || '160';
const PITCH = process.env.VOICE_PITCH || '42';
const CACHE_DIR = process.env.VOICE_CACHE || path.join(__dirname, '.voice-cache');

/**
 * Google Cloud Text-to-Speech settings.
 *
 * en-US-Neural2-D is the male US voice from the family Google Maps navigation
 * speaks with: measured, mid-pitched, unhurried. It is not guaranteed to be
 * byte-identical to the model Maps ships — Google does not publish that — but
 * it is the same vendor, the same language and the same character, and unlike
 * a cloned voice it is licensed for this use through Google Cloud.
 *
 * Alternatives worth trying: en-US-Studio-M (best for long narration),
 * en-US-Wavenet-D (the older, most instantly recognisable male), en-US-Neural2-J.
 */
const GOOGLE_VOICE = process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-D';
const GOOGLE_LANG = process.env.GOOGLE_TTS_LANG || 'en-US';
/** Navigation instructions are read a touch under conversational pace. */
const GOOGLE_RATE = Number(process.env.GOOGLE_TTS_RATE || 0.96);
const GOOGLE_PITCH = Number(process.env.GOOGLE_TTS_PITCH || -1.0);
const NARRATION_DIR = path.join(__dirname, 'narration');
/** Room cleanup on supplied recordings; set VOICE_DEVERB=0 for already-treated audio. */
const DEVERB_SUPPLIED = process.env.VOICE_DEVERB !== '0';

function ffmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const bin = require('ffmpeg-static');
    if (bin && fs.existsSync(bin)) return bin;
  } catch (_) { /* fall through */ }
  return 'ffmpeg';
}

/**
 * Turn caption markup into something worth listening to.
 *
 * The captions carry HTML emphasis and the ▸ used for navigation paths; spoken
 * aloud those become noise, so they are rewritten into ordinary prose.
 */
function speakable(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, ' and ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s*▸\s*/g, ', ')
    .replace(/\s*·\s*/g, ', ')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/https?:\/\/\S+/g, 'the meeting link')
    .replace(/\bEDI 837\b/g, 'E D I 8 3 7')
    .replace(/\bICD-10\b/g, 'I C D ten')
    .replace(/\bCPT\b/g, 'C P T')
    .replace(/\bMRN\b/g, 'M R N')
    .replace(/\bHbA1c\b/g, 'H b A one c')
    .replace(/\bFHIR\b/g, 'fire')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureCache() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/** Duration of an audio file, in seconds. */
function durationOf(file) {
  try {
    execFileSync(ffmpeg(), ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    const m = String(err.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return 0;
}

/**
 * Room cleanup for human recordings.
 *
 * A voice recorded in an ordinary room carries a reverb tail that a synth clip
 * does not, and that tail is what reads as "echo". The chain below cuts the
 * rumble the room adds, removes the diffuse tail spectrally, dips the 300 Hz
 * boom, lifts presence so words stay crisp after the cut, then expands
 * downward so what is left of the tail falls away between words.
 *
 * Tuned on the reference sample supplied with this repo: it moved the tail
 * from 15 dB below the word to 26 dB below it, and dropped the noise floor
 * from -50 to -77 dBFS, while leaving the speech itself intact. Gating harder
 * than this starts eating word endings — measured, not guessed.
 */
const DEREVERB = [
  'highpass=f=95',
  'afftdn=nf=-25:tn=1',
  'equalizer=f=300:t=q:w=1.2:g=-4',
  'equalizer=f=3200:t=q:w=1.5:g=2.5',
  'agate=threshold=0.015:ratio=3:attack=6:release=140:knee=3',
  'deesser=i=0.4',
];

/**
 * Master a clip: trim the silence at both ends, keep it inside a speech band,
 * even out the level, and normalise to the loudness YouTube targets so no
 * per-video gain riding is needed later. Supplied human audio gets the room
 * cleanup first.
 */
function master(inFile, outFile, { deverb = false } = {}) {
  execFileSync(ffmpeg(), [
    '-y', '-i', inFile,
    '-af', [
      ...(deverb ? DEREVERB : []),
      'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
      'areverse',
      'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
      'areverse',
      ...(deverb ? [] : ['highpass=f=85']),
      'lowpass=f=8500',
      'acompressor=threshold=-18dB:ratio=3:attack=15:release=180',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'aresample=48000',
    ].join(','),
    '-ac', '2',
    outFile,
  ], { stdio: 'ignore' });
}

/**
 * One line through Google Cloud Text-to-Speech.
 *
 * Called synchronously (via curl) because the director times a caption against
 * the clip it has just made; going async here would ripple through every
 * script for no gain. LINEAR16 comes back as a WAV, base64-encoded.
 */
function googleSynthesise(text, rawFile) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) {
    throw new Error(
      'GOOGLE_TTS_API_KEY is not set. Create a key with the Cloud '
      + 'Text-to-Speech API enabled and export it before recording.'
    );
  }
  const payloadFile = `${rawFile}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify({
    input: { text },
    voice: { languageCode: GOOGLE_LANG, name: GOOGLE_VOICE },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 48000,
      speakingRate: GOOGLE_RATE,
      pitch: GOOGLE_PITCH,
    },
  }));
  try {
    const out = execFileSync('curl', [
      '-sS', '--max-time', '45', '-X', 'POST',
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
      '-H', 'Content-Type: application/json',
      '--data-binary', `@${payloadFile}`,
    ], { maxBuffer: 128 * 1024 * 1024 }).toString();
    const body = JSON.parse(out);
    if (!body.audioContent) {
      throw new Error(body.error ? body.error.message : 'no audio in response');
    }
    fs.writeFileSync(rawFile, Buffer.from(body.audioContent, 'base64'));
  } finally {
    try { fs.unlinkSync(payloadFile); } catch (_) { /* already gone */ }
  }
}

/**
 * Synthesise one narration line.
 * @returns {{file: string, duration: number, text: string}|null}
 */
function synthesise(html, { slug, index } = {}) {
  if (ENGINE === 'none') return null;
  const text = speakable(html);
  if (!text) return null;

  ensureCache();

  if (ENGINE === 'files') {
    const stem = path.join(NARRATION_DIR, slug || '', String(index).padStart(2, '0'));
    const supplied = ['.wav', '.m4a', '.mp3', '.flac', '.aac']
      .map((ext) => stem + ext).find((f) => fs.existsSync(f));
    if (!supplied) {
      console.warn(`   [voice] no recording for ${slug} line ${index} — that line will be silent`);
      return null;
    }
    const out = path.join(CACHE_DIR, `${slug}-${index}-mastered.wav`);
    if (!fs.existsSync(out)) master(supplied, out, { deverb: DEVERB_SUPPLIED });
    return { file: out, duration: durationOf(out), text };
  }

  const signature = ENGINE === 'google'
    ? `google|${GOOGLE_VOICE}|${GOOGLE_RATE}|${GOOGLE_PITCH}|${text}`
    : `${ENGINE}|${VOICE}|${RATE}|${PITCH}|${text}`;
  const key = crypto.createHash('sha1').update(signature).digest('hex').slice(0, 16);
  const out = path.join(CACHE_DIR, `${key}.wav`);
  if (!fs.existsSync(out)) {
    const raw = path.join(CACHE_DIR, `${key}.raw.wav`);
    try {
      if (ENGINE === 'google') {
        googleSynthesise(text, raw);
      } else {
        const args = ['-v', VOICE, '-s', RATE, '-w', raw, text];
        // mbrola voices ignore -p, and passing it makes espeak-ng complain.
        if (!VOICE.startsWith('mb-')) args.splice(4, 0, '-p', PITCH);
        execFileSync('espeak-ng', args, { stdio: 'ignore' });
      }
      master(raw, out);
    } catch (err) {
      // A missing key or a quota refusal should stop the run, not quietly
      // produce eight silent videos.
      if (ENGINE === 'google') throw err;
      console.warn('   [voice] synthesis failed:', String(err.message).split('\n')[0]);
      return null;
    } finally {
      try { fs.unlinkSync(raw); } catch (_) { /* already gone */ }
    }
  }
  return { file: out, duration: durationOf(out), text };
}

/**
 * Mix the narration clips onto the recorded picture and encode for YouTube.
 *
 * Each clip is delayed to the moment its caption appeared, so sync comes from
 * the recording itself rather than from hand-aligning afterwards.
 */
function muxNarration(videoIn, clips, videoOut, { fps = 30, startAt = 0 } = {}) {
  const ff = ffmpeg();
  const seek = startAt > 0.05 ? ['-ss', startAt.toFixed(3)] : [];
  const usable = clips
    .filter((c) => c && c.file && fs.existsSync(c.file))
    .map((c) => ({ ...c, start: Math.max(0, c.start - startAt) }));

  if (!usable.length) {
    execFileSync(ff, [
      '-y', ...seek, '-i', videoIn,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-shortest',
      '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '20',
      '-r', String(fps), '-g', String(fps * 2), '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      videoOut,
    ], { stdio: 'ignore' });
    return 0;
  }

  const inputs = [];
  const filters = [];
  usable.forEach((clip, i) => {
    inputs.push('-i', clip.file);
    const ms = Math.max(0, Math.round(clip.start * 1000));
    filters.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=1.0[n${i}]`);
  });
  const mix = `${usable.map((_, i) => `[n${i}]`).join('')}amix=inputs=${usable.length}:duration=longest:normalize=0[voice]`;
  const tail = '[voice]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad[a]';

  execFileSync(ff, [
    '-y', ...seek, '-i', videoIn, ...inputs,
    '-filter_complex', [...filters, mix, tail].join(';'),
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '20',
    '-r', String(fps), '-g', String(fps * 2), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest',
    videoOut,
  ], { stdio: 'ignore' });

  return usable.length;
}

const activeVoice = () => (ENGINE === 'google' ? GOOGLE_VOICE : VOICE);

module.exports = {
  ENGINE, VOICE, GOOGLE_VOICE, activeVoice,
  speakable, synthesise, muxNarration, durationOf, master, DEREVERB,
};
