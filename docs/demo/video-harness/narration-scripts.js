#!/usr/bin/env node
/**
 * Generates a recording sheet per video, so the narration can be re-voiced by
 * a person without anyone having to work out what to say or in what order.
 *
 * The lines come from each video's .srt, which is written from the same text
 * the recorder spoke, in the same order. Line N of the sheet becomes
 * narration/<slug>/NN.wav, which is exactly where VOICE_ENGINE=files looks.
 *
 *   node docs/demo/video-harness/narration-scripts.js
 */

const fs = require('fs');
const path = require('path');

const { speakable } = require('./voice');

const WAVE_DIR = process.env.WAVE_DIR
  || path.join(__dirname, '..', 'video-library', 'wave1');
const NARRATION_DIR = path.join(__dirname, 'narration');

/** Parse an .srt into { index, start, end, text } entries. */
function parseSrt(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const times = (lines[1] || '').split('-->').map((t) => t.trim());
      return {
        index: Number(lines[0]),
        start: times[0],
        end: times[1],
        text: lines.slice(2).join(' ').trim(),
      };
    })
    .filter((e) => e.text);
}

const toSeconds = (stamp = '') => {
  const m = stamp.match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
};

function main() {
  const srts = fs.readdirSync(WAVE_DIR).filter((f) => f.endsWith('.srt')).sort();
  if (!srts.length) {
    console.error(`No .srt files in ${WAVE_DIR}`);
    process.exit(1);
  }

  let totalLines = 0;
  let totalSeconds = 0;

  for (const srt of srts) {
    const slug = srt.replace(/\.srt$/, '');
    const entries = parseSrt(path.join(WAVE_DIR, srt));
    const dir = path.join(NARRATION_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });

    const rows = entries.map((e, i) => {
      const seconds = Math.max(0, toSeconds(e.end) - toSeconds(e.start));
      totalSeconds += seconds;
      // Read what will be spoken, not the caption markup: the ▸ in a
      // navigation path is a comma out loud.
      return `| \`${String(i).padStart(2, '0')}.wav\` | ${seconds.toFixed(1)}s | ${speakable(e.text)} |`;
    });
    totalLines += entries.length;

    const sheet = `# Recording sheet — ${slug}

${entries.length} lines. Record each one as its own file in this folder, named
exactly as in the first column. WAV is preferred; m4a, mp3, flac and aac also work.

The "fits" column is how long the matching shot stays on screen in the current
cut. Coming in a little under is ideal. Going over is fine too — the recorder
re-times the picture to the audio when the video is re-run, so nothing falls out
of sync; the video simply gets slightly longer.

Read at a steady pace, leave a beat of silence at the top and tail of each take,
and keep the same mic and room across all of them. Room echo is dealt with
automatically — see ../README.md.

| File | Fits | Line |
| --- | --- | --- |
${rows.join('\n')}

When every line is recorded:

\`\`\`bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \\
  node docs/demo/video-harness/record.js ${slug.slice(0, 3)}
\`\`\`
`;
    fs.writeFileSync(path.join(dir, 'SCRIPT.md'), sheet, 'utf8');
    console.log(`${slug}: ${entries.length} lines → ${path.relative(process.cwd(), dir)}/SCRIPT.md`);
  }

  console.log(`\n${totalLines} lines across ${srts.length} videos, `
    + `about ${Math.round(totalSeconds / 60)} minutes of speech in total.`);
}

main();
