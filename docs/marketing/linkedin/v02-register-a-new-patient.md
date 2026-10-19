# LinkedIn newsletter — Issue 02

**Based on:** Video 2, *Register a new patient*
(`docs/demo/video-library/wave1/v02-register-a-new-patient.*`, 2:25)
**Video reference:** https://youtu.be/o63zQ53LEow
**Call to action:** https://app.aureoncare.tech

Everything in a fenced block is **copy verbatim** into LinkedIn — no editing, no
internal notes mixed in. Everything outside a fenced block is production notes
for whoever publishes and does not get pasted anywhere.

> **Two things to confirm before publishing.**
> 1. The YouTube link above was supplied for this issue and is used as the
>    Video 2 reference throughout. It has not been opened or verified from here —
>    check it resolves to *Register a New Patient* and not another video in the
>    series before this goes out.
> 2. The `?si=` parameter has been stripped. That is a share-attribution token
>    tied to whoever copied the link; it does not affect playback and does not
>    belong in published copy.

---

## Issue 02

### Title `56 chars`

```
Register a new patient — and the three fields that matter
```

### Cover image

`assets/v02/01-cover.png` (1200×627).

### Body

Paste as-is. LinkedIn's editor keeps bold and headings; it does not keep
markdown syntax, so apply **bold** and the `Heading 2` style by hand where
marked. Image placements are called out in the notes between blocks — upload
each one at that point in the article, not all at the end.

```
A denied claim is almost never a billing mistake. It is a typing mistake, made three weeks earlier, by someone who was not thinking about billing at all.

Patient registration looks like the most junior task in the practice. It is actually the one that decides whether the next month goes smoothly: whether claims go out clean, whether the patient can log in to see their results, whether anyone can find the record when the phone rings.

The good news is that it comes down to three fields.
```

**→ Insert `assets/v02/02-downstream.png` here.**

```
Three fields, three consequences

Insurance is what claims are built from. A record saved without it will bill as self-pay — not as an error you will see that day, but as a problem that surfaces when the money does not arrive. If the card is not to hand, that is a reason to chase it, not a reason to skip the field.

Email is the portal invitation. It is how the patient later gets their results, their appointment reminders and their statements without phoning reception to ask. A typo here is not caught by anything downstream; it just quietly means that patient never gets online. Worth reading back to them at the desk.

The MRN you do not type at all. AureonCare generates it the moment you save, so there is no house convention to remember and no risk of two people inventing the same number on the same morning.

Everything else on the form can follow later.
```

**→ Insert `assets/v02/03-one-form.png` here.**

```
One form, four short sections

There is no wizard and no multi-step flow. New Patient opens a single form, in four blocks.

Identity — name, date of birth, gender. This is what makes the record findable and distinguishes the two patients who share a surname.

Contact — phone, email, address.

Insurance — the payer and the policy number.

Emergency contact — a name and a number. It takes ten seconds at registration and it matters on the worst day the practice has all year. It is the field most often left for later, and later is exactly when it is not there.

Required fields are marked, and you are not blocked on the ones that are not. AureonCare also asks for confirmation before it writes a new record, so a mistyped date of birth is a click away from being caught rather than a record you have to go and merge.
```

**→ Insert `assets/v02/04-find-again.png` here.**

```
Finding them again

The record joins the register the moment you save, with its MRN assigned.

From then on, patient search takes whatever the person in front of you actually has: a surname, an MRN, an email address or a phone number. That matters more than it sounds. The patient on the phone knows their name and their mobile; they do not know their medical record number. The insurer's correspondence knows the MRN and nothing else. One search box accepts both.
```

**→ Insert `assets/v02/05-recap.png` here.**

```
Why this is the second video and not the tenth

Registration is where a practice's data quality is set. Every later job in AureonCare — booking, documenting, claiming, the portal — reads what the front desk typed on day one. You cannot fix a billing problem in the billing module if the cause was a blank insurance field at reception.

So this is video 2 of 8 in the Getting Started series, straight after learning your way around, and before booking an appointment. Two and a half minutes, with chapters and proper subtitles, so a new starter can watch it at the desk before their first shift.

Watch it here: https://youtu.be/o63zQ53LEow

Everything in the series is recorded in a demo environment with synthetic data. Elena Marchetti, her insurer and her policy number are all invented. No real patient information appears anywhere in it.

Next issue: booking an appointment — the calendar, appointment types, and what booking quietly sets in motion.
```

**→ Insert `assets/v02/06-cta.png` here.**

### Closing line and CTA

Paste at the very bottom, after the body:

```
Try it on a record of your own: https://app.aureoncare.tech

Subscribe to Running the Practice for a new walkthrough each month.
```

### Hashtags

Put these on the announcement post, not in the article body.

```
#PracticeManagement #HealthcareIT #MedicalPractice #RevenueCycle #ClinicOperations #PatientExperience
```

---

## Announcement post

The short post that goes out from the company page when the issue publishes.
LinkedIn truncates at roughly 200 characters, so the hook has to survive the
"…see more" fold.

```
A denied claim is almost never a billing mistake.

It is a typing mistake, made three weeks earlier, by someone who was not thinking about billing at all.

Issue 02 of Running the Practice is about patient registration — the most junior-looking task in the clinic, and the one that decides whether next month's claims go out clean, whether the patient can log in, and whether anyone can find the record when the phone rings.

It comes down to three fields. Insurance builds the claim. Email is the portal invitation. The MRN you never type at all.

Two and a half minute walkthrough: https://youtu.be/o63zQ53LEow
Try it yourself: https://app.aureoncare.tech

#PracticeManagement #HealthcareIT #MedicalPractice #RevenueCycle #ClinicOperations #PatientExperience
```

Attach `assets/v02/01-cover.png` to the post.

> If the post is published with the YouTube URL in the body, LinkedIn will build
> its own preview card from it and the attached image may be dropped. Pick one:
> either attach the cover and put the link in the first comment, or let the
> YouTube card be the visual. The cover image generally out-performs a YouTube
> thumbnail in-feed, so attaching the cover is the recommended default.

---

## Publishing checklist

| Step | Detail |
| --- | --- |
| 1 | Confirm the YouTube link resolves to *Register a New Patient* |
| 2 | Paste title, cover `v02/01-cover.png`, and the body blocks in order |
| 3 | Upload `02`–`06` at the five marked insertion points |
| 4 | Apply `Heading 2` to the four section headings, bold the first line |
| 5 | Check both links are live hyperlinks, not plain text |
| 6 | Publish, then post the announcement with `v02/01-cover.png` attached |

## Assets

| File | Size | Where it goes |
| --- | --- | --- |
| `assets/newsletter-logo.png` | 300×300 | Newsletter logo — shared, already set from Issue 01 |
| `assets/v02/01-cover.png` | 1200×627 | Article cover, and the announcement post |
| `assets/v02/02-downstream.png` | 1200×675 | Before "Three fields, three consequences" |
| `assets/v02/03-one-form.png` | 1200×675 | Before "One form, four short sections" |
| `assets/v02/04-find-again.png` | 1200×675 | Before "Finding them again" |
| `assets/v02/05-recap.png` | 1200×675 | Before "Why this is the second video…" |
| `assets/v02/06-cta.png` | 1200×675 | After the body, above the closing CTA |

Regenerate with:

```bash
NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js v02
```

## Sourcing

Every claim in the body traces to the video or its script: the four form
sections, insurance driving claims and a blank field billing as self-pay, the
email address being the portal invitation, the MRN being generated on save, the
confirmation step before the record is written, search accepting name / MRN /
email / phone, the 2:25 runtime and the position as video 2 of 8. No statistics
are quoted, because none in the source material are ours to quote — the opening
line about denied claims is framed as an observation about causation, not as a
measured rate.
