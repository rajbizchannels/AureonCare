# October release — content pack

Marketing assets for the October 2026 release: medical camps, locations and
the specialty configuration wizard.

| File | What it is |
| --- | --- |
| [`LINKEDIN_ARTICLE.md`](LINKEDIN_ARTICLE.md) | Long-form article covering all three features |
| [`SOCIAL_POSTS.md`](SOCIAL_POSTS.md) | LinkedIn, Instagram, X and Facebook short copy |
| [`YOUTUBE_UPLOAD_COPY.md`](YOUTUBE_UPLOAD_COPY.md) | Per-video upload fields, paste-ready |

The videos themselves are in `../../demo/video-library/marketing/`, cut from
the specs in `../../demo/video-harness/scripts/marketing/`.

| Video | Feature | Audience |
| --- | --- | --- |
| M10 — Two hundred people in a field | Medical camps | Practice owner, outreach lead, CMO |
| M11 — Which site was that? | Locations | Practice manager, multi-site owner |
| M12 — It will not overwrite the thing you changed | Specialty setup | New practice owner, implementation lead |

## Conventions

Same rules as the newsletter in `../linkedin/`: anything in a fenced block is
pasted verbatim, anything outside one is production notes and never gets
published. Every piece closes on `https://app.aureoncare.tech`.

Video URLs are placeholders (`[ M10 LINK ]` and friends) until the uploads
exist. Replace them all and strip any `?si=` share token before publishing.

## Why this is not a newsletter issue

The numbered newsletter runs one issue per *training* video and its numbering
tracks the V-series. This pack covers a release and is led by the marketing
cuts, so it sits alongside rather than taking a number in that sequence.
Readers who subscribed for "how do I do X" should not start receiving release
notes under the same masthead. If releases should get their own newsletter,
start a second numbered series rather than interleaving the two.

## What is not here

**Mobile.** The October release also brought the mobile app up to parity with
the web app and derived its shell from the user's role. There is no video for
it: the app is React Native and the recording harness drives a browser, so
capturing it needs a simulator and a different toolchain than everything else
here uses. It is worth covering — the role-derived shell is a genuinely good
story — but not by faking it in a responsive browser window, which would show
something that is not the product.

**Reels.** M10–M12 are landscape only. The 9:16 treatment used for M6–M9 works
for a single-idea cut of twenty-odd seconds; these three are feature
walkthroughs, and cropping them to vertical loses the screen content the
narration is pointing at. If vertical is wanted for these, the right move is to
cut three new short specs rather than reframe the long ones.

## Ordering

The article leads on camps, even though locations shipped first and camps
depends on it. Camps is the only one of the three a reader can picture;
locations then reads as the thing that made it possible rather than as
plumbing. Keep that order — sorting by ship date opens the piece on a database
entity, which is where readers leave.
