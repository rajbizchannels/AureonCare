# Narration recordings

Drop human recordings here to replace the placeholder synthesiser voice. One
file per spoken line, named for its position in the video:

```
narration/<video-slug>/00.wav
narration/<video-slug>/01.wav
…
```

`SCRIPT.md` in each folder is the recording sheet: the exact lines, in order,
with the file name each one belongs in and how long the matching shot currently
stays on screen. Regenerate the sheets after any re-record with:

```bash
node docs/demo/video-harness/narration-scripts.js
```

Then produce the video with the human voice:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v04     # one video
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js all     # the wave
```

wav is preferred; m4a, mp3, flac and aac are accepted. A missing line is
reported and left silent rather than failing the run, so a partly recorded
video can still be previewed.

## Room echo is handled for you

Supplied recordings pass through a de-reverb chain before they are mixed: a
high-pass to lose room rumble, a spectral pass that takes out the diffuse tail,
a dip at 300 Hz where rooms boom, a presence lift so words stay crisp, a
downward expander that drops what is left of the tail between words, and a
de-esser.

It was tuned on `_reference/sample-original.m4a` and measured, not eyeballed:
the reverb tail moved from 15 dB below the word to 26 dB below it, and the
noise floor fell from -50 to -77 dBFS, with the speech itself untouched.
`_reference/sample-de-echoed.m4a` is that sample after the chain, so you can
hear what your room will sound like before recording a hundred lines.

Gating harder than this starts clipping word endings — that was tried and
measured too. If your recordings are already treated, skip the chain with
`VOICE_DEVERB=0`.

## Recording notes

- Same mic, same room, same distance for every line — the videos cut between
  them without crossfades.
- Leave a beat of silence at the head and tail of each take; it is trimmed
  automatically.
- Coming in under the "fits" time is ideal, but going over is safe: re-running
  the recorder re-times the picture to the audio, so nothing drifts out of sync.
- Levels do not matter. Everything is normalised to -16 LUFS, which is what
  YouTube targets.
