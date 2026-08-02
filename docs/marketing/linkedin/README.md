# LinkedIn newsletter

Issues of the AureonCare LinkedIn newsletter, one per training video in
`docs/demo/video-library/`. Each issue turns a video into something a practice
manager can read on a phone in three minutes and forward to whoever is training
the new hire.

| Issue | Source video | File |
| --- | --- | --- |
| 01 | V01 — Find your way around AureonCare | [`v01-find-your-way-around.md`](v01-find-your-way-around.md) |

Each issue file is a publishing document, not a draft: fenced blocks are pasted
verbatim into LinkedIn, everything outside them is production notes. Assets are
listed at the bottom of each issue with the point in the article they belong at.

## Visual assets

`build-assets.js` renders every image with Playwright, using the same brand kit
as the video harness (`docs/demo/video-harness/harness.js`) so the newsletter and
the videos read as one system.

```bash
NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js
```

Output lands in `assets/` and **is committed** — these are deliverables, and
whoever schedules the post should not need a Node toolchain to get at them.
That is the opposite of the video `.mp4` and `.thumbnail.png` files, which are
build output and stay out of git.

### House rules for the images

One idea per image. A LinkedIn card gets about a second of attention on a phone,
so each asset carries a single claim in large type with a lot of empty space
around it — no second row, no legend, no more than three items. When an idea
needs more than that, it needs its own image.

The palette is the logo's, not invented: amber `#f0b000`, teal `#00b0a0`, ink
`#041016`, with the amber-to-teal rule marking every surface. Copy is second
person and matches the wording used in the video's narration, so a reader who
watches after reading hears the same sentences.
