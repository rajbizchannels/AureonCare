# Recording sheet — v07-create-and-submit-a-claim

12 lines. Record each one as its own file in this folder, named
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
| `00.wav` | 7.5s | Create and submit a claim, Billing, Claims, Build a claim from a visit, code it, and send it to the clearinghouse. |
| `01.wav` | 4.8s | Billing, Claims is the money pipeline: every claim and where it has got to. |
| `02.wav` | 10.3s | Status is the whole story, draft not sent, submitted waiting, paid settled, denied needs work. |
| `03.wav` | 8.5s | Pick the patient and the claim inherits their insurance, no re-keying policy numbers. |
| `04.wav` | 5.9s | Service date and charge come from the visit you are billing for. |
| `05.wav` | 13.4s | Diagnosis codes are searched, not remembered, type the code or the words and pick from the list. |
| `06.wav` | 13.5s | The procedure code is what you are billing; the diagnosis is why. Payers check that the two agree. |
| `07.wav` | 8.9s | Created as a draft. Nothing has been sent yet, drafts are safe to fix. |
| `08.wav` | 4.9s | Submit E D I 8 3 7 sends it to the clearinghouse in the format payers expect. |
| `09.wav` | 5.5s | From here it comes back paid, or denied with a reason, and a denial goes straight to the Denials queue. |
| `10.wav` | 13.9s | What you just did |
| `11.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v07
```
