# Recording sheet — v05-document-a-visit

13 lines. Record each one as its own file in this folder, named
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
| `00.wav` | 7.7s | Document a visit, Patients, Patient History, Read the chart, record what you found, and know what the patient will see. |
| `01.wav` | 9.1s | Patients, Patient History is the longitudinal chart, every visit, not just today’s. |
| `02.wav` | 5.3s | Opening a patient gives you the whole record on one set of tabs. |
| `03.wav` | 11.5s | The Patient Chart tab carries demographics, medical history and allergies, read the allergies first, always. |
| `04.wav` | 7.8s | Diagnoses is the active problem list, what this patient is being treated for. |
| `05.wav` | 9.7s | Records holds the notes from previous visits, newest first. |
| `06.wav` | 7.2s | Edit Patient Chart is where today’s findings go, grouped into tabs. |
| `07.wav` | 7.2s | Physical takes the measurements you just did, they chart over time automatically. |
| `08.wav` | 9.5s | Allergies and history live here. What you add is what every other clinician sees at the next visit. |
| `09.wav` | 4.1s | Saved to the chart, one record, visible to the whole care team immediately. |
| `10.wav` | 6.3s | And to the patient: records, diagnoses and prescriptions appear in their portal, so write for both readers. |
| `11.wav` | 13.1s | What you just did |
| `12.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v05
```
