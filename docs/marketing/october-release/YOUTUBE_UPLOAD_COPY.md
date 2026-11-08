# October release — YouTube upload copy

Paste-ready text for each video, split by the field it goes into in YouTube
Studio. Everything in a fenced block is **copy verbatim** — no editing, no
internal notes mixed in.

The per-video `.metadata.md` files beside the cuts are the production record
and contain notes that must *not* be published (which `.srt` to attach, which
narration engine rendered the track). This file is the publishing view: only
what a viewer should see.

Timestamps match the `en-US-Neural2-D` renders in
`../../demo/video-library/marketing/`. Re-render and these move by a second or
two — check them against the finished files before pasting.

These three are marketing cuts, not training videos. They do not assume the
Getting Started series and they do not teach navigation; each one is built to
be the first thing somebody sees.

---

## The playlist

These join the existing marketing playlist rather than starting a new one.

### Playlist title `30 chars`

```
AureonCare — See It Work
```

Add the three videos to it in order (M10, M11, M12) after the existing nine.

---

## M10 — Medical camps `1:30`

### Title `62 chars`

```
Running a medical camp without losing the records | AureonCare
```

### Description

```
Outreach camps are run on paper almost everywhere: a table at the gate, a register, and a box of forms that someone types up weeks later — if at all. This follows one camp through the four parts of the module, in the order the day happens.

Planning that knows a camp takes clinicians away from the clinic, and says which appointments clash before anyone is rostered. A registration desk that issues a queue token and creates a real record at the gate. A live station board showing where the queue is building. And a sponsor report that is counts only — no names, no dates of birth, with small groups combined so a single case cannot identify anyone.

00:00 Two hundred people, one field
00:12 The camp plan
00:25 Rostering someone who is already booked
00:42 The registration desk
00:58 The live station board
01:10 Outcomes, and what the sponsor gets

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, medical camp, health camp software, outreach clinic, community health, screening camp, queue management, health camp report, patient registration, healthcare IT
```

### Thumbnail

`m10-two-hundred-people-in-a-field.thumbnail.png`

### Subtitles

Upload `m10-two-hundred-people-in-a-field.srt`.

---

## M11 — Locations `0:45`

### Title `63 chars`

```
Running more than one site without running two systems | AureonCare
```

### Description

```
The moment a practice opens a second site, every number needs a qualifier: which site, whose patients, which room. Most systems answer that with a free-text address field and hope.

Locations makes a site a real thing the rest of the product can point at — clinics, camp venues, mobile units and partner premises, all the same kind of object. One is primary, and anything not assigned to a site belongs to it. Deactivating a site takes it out of every picker without rewriting the history that already references it.

00:00 Which site was that?
00:08 Every place the practice works
00:22 A hall you do not own is still a site
00:33 The primary site catches the rest

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, multi site practice, clinic management, healthcare operations, practice management software, multi location, medical practice, healthcare IT
```

### Thumbnail

`m11-which-site-was-that.thumbnail.png`

### Subtitles

Upload `m11-which-site-was-that.srt`.

---

## M12 — Specialty setup `0:54`

### Title `58 chars`

```
Specialty setup that never overwrites your edits | AureonCare
```

### Description

```
Every practice management system starts the same way: generic. Every module switched on, no services, and a week of typing before it resembles the practice using it.

The specialty wizard asks what this practice actually does and creates the services, appointment types and forms to match. The part worth watching is the preview: nothing is written until the final step, and anything the practice has already edited is listed and then left exactly as it is. A later pack update will not quietly restore its own version over yours.

00:00 Every system starts generic
00:09 Six steps, nothing written yet
00:18 Picking what the practice is
00:33 The preview, before anything changes
00:42 The two it refuses to touch

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, practice setup, EHR onboarding, specialty configuration, clinic software setup, healthcare implementation, practice management, healthcare IT
```

### Thumbnail

`m12-it-will-not-overwrite-what-you-changed.thumbnail.png`

### Subtitles

Upload `m12-it-will-not-overwrite-what-you-changed.srt`.

---

## Before publishing

The chapter timestamps above are derived from the cut structure, not read off
the finished files one by one. YouTube silently drops a chapter list if the
first entry is not `00:00` or if any entry runs past the end, so scrub each
video once against its list before saving the description.

Once the three are live, replace the `[ M10 LINK ]`, `[ M11 LINK ]` and
`[ M12 LINK ]` placeholders in `SOCIAL_POSTS.md` and `LINKEDIN_ARTICLE.md`,
stripping the `?si=` share token from each URL.
