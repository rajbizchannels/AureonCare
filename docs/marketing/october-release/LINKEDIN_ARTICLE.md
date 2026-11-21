# LinkedIn article — The October release

**Based on:** M10–M12, the October release cuts
(`docs/demo/video-library/marketing/m1[0-2]-*`)
**Video references:** `[ M10 LINK ]`, `[ M11 LINK ]`, `[ M12 LINK ]` — not yet supplied
**Call to action:** https://app.aureoncare.tech

Everything in a fenced block is **copy verbatim** into LinkedIn — no editing,
no internal notes mixed in. Everything outside a fenced block is production
notes for whoever publishes, and does not get pasted anywhere.

> **This is an article, not a newsletter issue.** The numbered newsletter in
> `../linkedin/` runs one issue per *training* video and its numbering tracks
> the V-series. This piece covers a release and is led by the marketing cuts,
> so it sits here rather than taking a number in that sequence. If it is later
> decided that releases should get newsletter issues too, start a separate
> numbered series rather than interleaving them — readers who subscribed for
> "how do I do X" should not get release notes under the same masthead.

> **Three video links are placeholders.** `[ M10 LINK ]`, `[ M11 LINK ]` and
> `[ M12 LINK ]` each appear once in the body. Replace all three before
> publishing and strip any `?si=` share token, as in the newsletter issues.
> Keep each on its own line with nothing else, or LinkedIn renders blue text
> instead of a preview card.

> **Ordering is deliberate and worth preserving.** Camps leads, even though
> locations shipped first and is a dependency, because camps is the only one
> of the three that a reader can picture. Locations then reads as the thing
> that made camps possible rather than as plumbing, and the setup wizard
> closes on the strongest claim. Reordering by ship date would open on a
> database entity, which is where readers leave.

> **The sponsor-report paragraph is the one to check before publishing.** It
> describes what the report contains and what the product does to small
> groups. It deliberately does not say "HIPAA compliant", "anonymised" or
> "de-identified" — those are defined terms with legal weight that this copy
> is not entitled to invoke. If legal wants a stronger claim, that is their
> call to make in their words, not a tightening of this paragraph.

---

## Title `67 chars`

```
What we shipped in October: camps, sites, and a setup that waits
```

## Cover image

Use the M10 thumbnail (`m10-two-hundred-people-in-a-field.thumbnail.png`,
1920×1080). LinkedIn crops article covers to roughly 2:1 from the centre, and
that frame survives the crop — the headline sits centre-left and the camp
header is the only other element.

## Body

Paste as-is. LinkedIn's editor keeps bold and headings but not markdown
syntax, so apply **bold** and the `Heading 2` style by hand where marked.
Image placements are called out between blocks — upload each at that point in
the article, not all at the end.

```
Three things shipped in October. One of them is a module we have wanted to build since we started, one is the unglamorous entity that made it possible, and one is a setup wizard whose most important feature is a thing it refuses to do.

They are connected, and the order they shipped in is the opposite of the order they make sense in.
```

**→ Insert `m10-two-hundred-people-in-a-field.thumbnail.png` here.**

```
A camp is a clinic that moved for the day

Plenty of practices run outreach. Screening camps, school vision days, a mobile unit that parks somewhere different each week. The clinical work is real work — it is the same clinicians, doing the same examinations, finding the same conditions they would find in the building.

The record-keeping is almost never real in the same way.

The standard setup is a table at the gate, a paper register, a stack of consent forms, and a box that comes back to the office at the end of the day. Somebody types up what they can, two or three weeks later, when there is a gap. The attendance number survives. The clinical findings mostly do not. The follow-up that was supposed to happen at the practice depends on a person remembering to make a phone call from a list that was never built.

So half the value of the camp evaporates somewhere between the field and the filing cabinet. Not because anyone was careless — because the day was busy and the tooling was a biro.

Medical camps covers the whole day, in the four parts the day actually has.

[ M10 LINK ]
```

```
Planning that knows a camp costs you a Tuesday

The planning screen holds the four things a camp needs before it can open: the services it offers, the people on duty, the stations attendees walk through, and the supplies that leave the store.

The staffing section is the one with teeth, and it is worth describing because it is where most outreach planning quietly goes wrong.

Roster a clinician who already has clinic appointments inside the camp window, and the system does not simply accept it. It lists the clashes — this appointment, that one, this one — and offers to roster them anyway as a deliberate second step.

That is the whole feature. A camp does not happen in addition to the week; it happens instead of part of it. Three clinic appointments on the camp morning are three patients who will be phoned and moved, and the time to find that out is while you are still planning, not on the day when somebody notices the surgery has nobody in it.

Stations work the same way — attendees walk through them in order, and a clinical station will not accept somebody whose consent has not been recorded. Not a reminder. The station will not take them.
```

**→ Insert a frame of the registration desk here (the token panel, with the attendee list visible to its right).**

```
Fifteen seconds at the gate

The registration desk is built for a queue and nothing else. Name, age, consent, and a button.

What comes back is a queue token for the attendee and a real record for you — created at the point of contact, not transcribed from paper a fortnight later. If the person turns out to be an existing patient, the desk can match them to that record. If they are not, they can become one on the spot.

That is the difference between a camp that produces a number and a camp that produces patients.

The consent checkbox carries a line of text underneath it that is easy to skim past: without consent the attendee can still be registered, but no clinical station will accept them. Both halves matter. Somebody who declines consent is not turned away at the gate, because they might be there for something that needs no consent at all — but they also cannot quietly end up in front of a clinician without it.
```

```
A queue you can see

During the camp, the station board shows every station live: how many are waiting, how many are in progress, how many are done, and the longest wait at each.

The number that matters is the longest wait, not the average. In the demo, fourteen people are stacked at the doctor's station, thirty-six minutes deep, while vitals is nearly clear. That is a solvable problem for the person running the camp — move someone, open a second consult, change the order people are sent in — but only if they can see it before the queue walks out.

Camps lose attendees to waiting more than to anything else. The people who leave are rarely the ones who came for a chat.
```

```
What it was worth, and what the sponsor gets

Afterwards, two reports.

The first is for you: attendees registered, how many consented, how many now have a patient record at the practice, how many completed the whole pipeline, and how many left early. Then the number that decides whether outreach survives the next budget conversation — how many of those attendees went on to book a follow-up appointment at the practice.

The second is for whoever funded it, and it is deliberately a different kind of document. It contains counts. Attendance, age bands, gender, conditions screened. No names, no contact details, no dates of birth, no clinical notes. Groups too small to be safe are combined, so a single unusual case in a thin bucket cannot point at a person. The report records that minimum group size on its own face, so the sponsor can see the rule that was applied.

A sponsor asking for evidence of impact and a sponsor asking for a list of attendees are two different requests, and only one of them has a good answer.
```

**→ Insert `m11-which-site-was-that.thumbnail.png` here.**

```
The unglamorous one that made it work

Locations shipped a day before camps, and on its own it reads like plumbing: a site is now a first-class thing in the system rather than an address typed into whatever record needed one.

The reason it matters is visible the moment you look at the list. There are clinics on it. There is also a community hall the practice does not own, and a mobile screening van.

All three are the same kind of object.

That is what stops outreach from growing a parallel address book. A camp does not carry its own venue fields; it points at a site, in exactly the way an appointment at the main surgery points at a site. When the same hall is used again next year, it is the same hall, with the same history attached.

One site is primary, and anything not assigned to a site belongs to it — so nothing is stranded while a second location is still being set up. And deactivating a site removes it from every picker without rewriting the records that already reference it, which is the behaviour you want the first time you stop using a venue and discover that three years of history mentions it.

[ M11 LINK ]
```

**→ Insert the M12 preview frame here (the four-count row with "Left alone 2" visible).**

```
The feature is the thing it refuses to do

Every practice management system arrives generic. Every module switched on, no services, no appointment types, and a week of typing before it resembles the practice using it. Specialty hospitals have it worst: there is usually no way at all to say what the place actually does.

So October also brought a setup wizard. Six steps, pick your specialty, get the services and forms that match. Multi-specialty practices can pick several, and the first one leads where two packs disagree.

That part is unremarkable. Most vendors have a wizard.

Here is the part that is not. Nothing is written until the final step, and before anything happens you get a preview of exactly what will change, in four columns: what it will create, what it will update, what is already there, and what it is going to leave completely alone.

That last column exists because the practice already edited those rows.

If you changed the annual physical to forty minutes, it stays forty minutes. If your price for a well-child visit differs from the pack's, yours wins. The pack reports the difference and then does not touch it — and, just as importantly, a later pack update will not quietly restore the vendor's version over yours.

The rule underneath is that a pack never adopts a row it did not create. Stamping ownership on something the practice built itself would mean the next upgrade felt entitled to rewrite it, which is exactly how a configuration system turns into a thing people are afraid of.

Anyone who has watched an update hand back a year of local configuration knows why that column is on screen before the apply button, rather than in a changelog afterwards.

[ M12 LINK ]
```

```
What connects them

Outreach that keeps its records. Sites that are real objects rather than typed addresses. Configuration that treats your edits as more authoritative than ours.

None of these are features you would put on a banner. They are all the same bet, though: that the software should survive contact with how a practice actually works, including the parts that happen in a field, at a second address, or after somebody has already changed their mind about what an annual physical should take.

See it running: https://app.aureoncare.tech
```

---

## Asset checklist

| Asset | Where it comes from | Status |
| --- | --- | --- |
| Cover | `m10-…thumbnail.png` | generated with the video |
| Camps cover (in body) | same file | generated with the video |
| Registration desk frame | pull from M10 around the token beat | **needs cutting** |
| `m11-…thumbnail.png` | generated with the video | generated with the video |
| M12 preview frame | pull from M12 at the four-count row | **needs cutting** |

The two frames marked *needs cutting* are stills to pull from the finished
cuts rather than anything `build-assets.js` renders. The existing newsletter
assets are branded cards built by that script; these are screenshots, and
mixing the two registers in one article is fine as long as the screenshots are
full-width and uncropped, which is how the cuts already frame them.
