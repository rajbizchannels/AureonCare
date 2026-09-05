# LinkedIn newsletter

Issues of the AureonCare LinkedIn newsletter, one per training video in
`docs/demo/video-library/`. Each issue turns a video into something a practice
manager can read on a phone in three minutes and forward to whoever is training
the new hire.

| Issue | Source video | Video link | File |
| --- | --- | --- | --- |
| 01 | V01 — Find your way around AureonCare | *pending* | [`v01-find-your-way-around.md`](v01-find-your-way-around.md) |
| 02 | V02 — Register a new patient | [`o63zQ53LEow`](https://youtu.be/o63zQ53LEow) | [`v02-register-a-new-patient.md`](v02-register-a-new-patient.md) |
| 03 | V03 — Book an appointment | [`faMT4PZbVsY`](https://youtu.be/faMT4PZbVsY) | [`v03-book-an-appointment.md`](v03-book-an-appointment.md) |
| 04 | V04 — Read your day on the dashboard | *pending* | [`v04-read-your-day-on-the-dashboard.md`](v04-read-your-day-on-the-dashboard.md) |

Each issue file is a publishing document, not a draft: fenced blocks are pasted
verbatim into LinkedIn, everything outside them is production notes. Assets are
listed at the bottom of each issue with the point in the article they belong at.

Every issue closes on the same call to action, `https://app.aureoncare.tech`,
carried by a matching `06-cta.png` card. Keep that consistent as issues are
added — a newsletter that sends readers somewhere different each month teaches
them to ignore the ending.

Each issue also links its source video, on its own line so LinkedIn renders a
preview card rather than blue text. From Issue 03 the link is repeated through
the body with an explicit invitation to watch, rather than parked at the end.
Video URLs are published without their `?si=` share token. Issues 01 and 04
carry `[ VIDEO n LINK ]` placeholders until their URLs are supplied.

## This branch

`marketing/linkedin-newsletter` exists so the newsletter has somewhere durable to
live without touching a product branch. It branches from `main` and carries only
`docs/marketing/`.

Vercel deployment is disabled for it in `vercel.json` via
`git.deploymentEnabled` — Vercel reads that file from the branch being deployed,
so the setting travels with the branch. Nothing here is deployable and a preview
build would only burn minutes. If the branch is ever renamed, update that key or
deployments come back.

## Visual assets

`build-assets.js` renders every image with Playwright, using the same brand kit
as the video harness (`docs/demo/video-harness/harness.js`) so the newsletter and
the videos read as one system.

```bash
NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js       # everything
NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js v04   # one issue
```

Output is `assets/<issue>/NN-name.png`, plus `assets/newsletter-logo.png`, which
is shared by every issue because LinkedIn sets it once on the newsletter itself.
The files are committed rather than treated as build junk — they are the
deliverable, and whoever schedules the post should not need a Node toolchain to
get at them. That is the opposite of the video `.mp4` and `.thumbnail.png` files,
which really are build output and stay out of git.

Adding an issue means adding one object to `ISSUES` in the script. The shared
pieces — cover, recap, CTA, statement card, search field, chips, columns, the
frame itself — are already factored out, so a new issue is mostly copy.

## House rules for the images

**One idea per image.** A LinkedIn card gets about a second of attention on a
phone, so each asset carries a single claim in large type with a lot of empty
space around it. Four items is the ceiling, and three is better; when an idea
needs more than that, it needs its own image.

**Nothing may touch the edge.** The frame is `space-between`, so long copy
pushes content off the bottom rather than shrinking it. Every card is looked at
after rendering, and headlines get shortened until they sit on one or two lines —
an orphaned last word is a rewrite, not a font-size change.

**The palette is the logo's, not invented:** amber `#f0b000`, teal `#00b0a0`,
ink `#041016`, with the amber-to-teal rule marking every surface.

**Copy matches the narration.** Wording is taken from the video's spoken lines
where possible, so a reader who watches afterwards hears the same sentences.
Second person, and no statistic that is not ours to quote.
