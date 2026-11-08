#!/usr/bin/env node
/**
 * Uploads the marketing cuts to YouTube: video, thumbnail, subtitles, playlist.
 *
 *   node docs/demo/video-harness/youtube-upload.js auth
 *   node docs/demo/video-harness/youtube-upload.js upload --dry-run
 *   node docs/demo/video-harness/youtube-upload.js upload --privacy=unlisted
 *   node docs/demo/video-harness/youtube-upload.js upload --only=m10,m11,m12
 *
 * No dependencies: Node 22's fetch does all of it. The YouTube Data API needs
 * an OAuth user consent with the youtube.upload scope — an API key cannot
 * upload, which is why `auth` exists at all and why this cannot run
 * unattended the first time.
 *
 * Setup, once:
 *   1. Google Cloud console → APIs & Services → Enable "YouTube Data API v3".
 *   2. Credentials → Create OAuth client ID → Desktop app.
 *   3. export YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=...
 *   4. node …/youtube-upload.js auth   (opens a URL, you paste back the code)
 *
 * The refresh token is written to .youtube-token.json beside this script and is
 * gitignored. Treat it as a credential: it grants upload rights to the channel
 * that authorised it until revoked.
 *
 * Re-running is safe. Every upload is recorded in the marketing library's
 * youtube-ids.json, and a slug already listed there is skipped rather than
 * uploaded twice — so an interrupted run resumes instead of duplicating.
 *
 * Quota, which is the thing that will actually bite: a videos.insert costs
 * ~1600 units against a default daily quota of 10000. That is six videos a day.
 * The whole marketing set is twelve, so a first full run WILL stop partway with
 * a quotaExceeded error. That is expected, not a failure — the ids file means
 * tomorrow's run picks up exactly where it stopped.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const HERE = __dirname;
const LIBRARY = path.join(HERE, '..', 'video-library', 'marketing');
const SPECS = path.join(HERE, 'scripts', 'marketing');
const TOKEN_FILE = path.join(HERE, '.youtube-token.json');
const IDS_FILE = path.join(LIBRARY, 'youtube-ids.json');

const PLAYLIST_TITLE = 'AureonCare — See It Work';
const PLAYLIST_DESCRIPTION =
  'Short films showing AureonCare doing the job, with nothing staged and no slides. '
  + 'Each one follows a single piece of work end to end in the real product.\n\n'
  + 'Try it: https://app.aureoncare.tech';
// 28 = Science & Technology. 27 is Education, if these ever get re-pitched as
// training rather than product films.
const CATEGORY_ID = '28';
const CTA = 'Try it: https://app.aureoncare.tech';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl', // captions.insert needs this
].join(' ');

/* ──────────────────────────────── helpers ───────────────────────────────── */

const args = process.argv.slice(2);
const command = args[0] || 'upload';
const flag = (name, fallback = undefined) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => args.includes(`--${name}`);

const DRY_RUN = has('dry-run');
const PRIVACY = flag('privacy', 'private');
const ONLY = (flag('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
};
const writeJson = (file, data) =>
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const ask = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
});

function credentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set. See the header of this file.'
    );
  }
  return { clientId, clientSecret };
}

/** A short-lived access token, refreshed from the stored refresh token. */
async function accessToken() {
  const stored = readJson(TOKEN_FILE, null);
  if (!stored || !stored.refresh_token) {
    throw new Error(`No stored token. Run: node ${path.relative(process.cwd(), __filename)} auth`);
  }
  const { clientId, clientSecret } = credentials();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: stored.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

/**
 * Google's errors are the useful part of this script's output, so they are
 * surfaced whole rather than reduced to a status code. quotaExceeded in
 * particular is a normal end to a run, not a bug to chase.
 */
async function api(token, url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const reason = parsed?.error?.errors?.[0]?.reason || '';
    const err = new Error(`${method} ${url} → ${res.status} ${text}`);
    err.reason = reason;
    throw err;
  }
  return parsed;
}

/* ───────────────────────────────── auth ─────────────────────────────────── */

async function doAuth() {
  const { clientId, clientSecret } = credentials();
  // The out-of-band desktop flow: no local server, the code is pasted back.
  const redirect = 'urn:ietf:wg:oauth:2.0:oob';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })}`;

  console.log('\nOpen this in the browser signed in to the AureonCare channel:\n');
  console.log(url);
  console.log('\nApprove, then paste the code back here.\n');
  const code = await ask('Code: ');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirect, grant_type: 'authorization_code',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Code exchange failed: ${JSON.stringify(body)}`);
  if (!body.refresh_token) {
    throw new Error('No refresh_token came back. Re-run — the consent screen must be shown.');
  }
  writeJson(TOKEN_FILE, { refresh_token: body.refresh_token });
  console.log(`\nStored in ${TOKEN_FILE}. It is gitignored; treat it as a credential.`);
}

/* ─────────────────────────── what to upload ─────────────────────────────── */

/**
 * The spec is the single source for the publishable text — the same file the
 * recorder read — so a title can never drift between the video and its upload.
 * Chapters come from the .chapters.txt the recorder wrote beside the video.
 */
function collect() {
  const specs = fs.readdirSync(SPECS).filter((f) => f.endsWith('.js')).sort();
  const out = [];
  for (const file of specs) {
    const spec = require(path.join(SPECS, file));
    if (ONLY.length && !ONLY.includes(spec.id.toLowerCase()) && !ONLY.some((o) => spec.slug.startsWith(o))) {
      continue;
    }
    const video = path.join(LIBRARY, `${spec.slug}.mp4`);
    if (!fs.existsSync(video)) {
      console.warn(`  ! ${spec.id} has no rendered video at ${video} — skipped`);
      continue;
    }
    out.push({
      id: spec.id,
      slug: spec.slug,
      video,
      thumbnail: path.join(LIBRARY, `${spec.slug}.thumbnail.png`),
      captions: path.join(LIBRARY, `${spec.slug}.srt`),
      chapters: path.join(LIBRARY, `${spec.slug}.chapters.txt`),
      title: spec.youtubeTitle || spec.title,
      description: spec.description || '',
      tags: spec.tags || [],
    });
  }
  return out;
}

function describe(item) {
  const parts = [item.description.trim()];
  // YouTube only renders a chapter list with three or more entries, the first
  // at 0:00. Below that it is just noise in the description, so it is dropped.
  const raw = fs.existsSync(item.chapters)
    ? fs.readFileSync(item.chapters, 'utf8').trim().split('\n').filter(Boolean)
    : [];
  if (raw.length >= 3 && raw[0].startsWith('0:00')) parts.push(raw.join('\n'));
  parts.push(CTA);
  return parts.join('\n\n');
}

/* ──────────────────────────────── upload ────────────────────────────────── */

async function uploadVideo(token, item) {
  const size = fs.statSync(item.video).size;
  const metadata = {
    snippet: {
      title: item.title,
      description: describe(item),
      tags: item.tags,
      categoryId: CATEGORY_ID,
    },
    status: {
      privacyStatus: PRIVACY,
      selfDeclaredMadeForKids: false,
      embeddable: true,
    },
  };

  // Resumable, because these are tens of megabytes and a multipart POST that
  // fails at 90% has to start again from nothing.
  const start = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': String(size),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  );
  if (!start.ok) {
    const text = await start.text();
    const err = new Error(`Upload init failed: ${start.status} ${text}`);
    try { err.reason = JSON.parse(text)?.error?.errors?.[0]?.reason; } catch (_) { /* leave unset */ }
    throw err;
  }
  const location = start.headers.get('location');
  if (!location) throw new Error('Upload init returned no Location header');

  const put = await fetch(location, {
    method: 'PUT',
    headers: { 'Content-Length': String(size), 'Content-Type': 'video/mp4' },
    body: fs.readFileSync(item.video),
  });
  const text = await put.text();
  if (!put.ok) throw new Error(`Upload failed: ${put.status} ${text}`);
  return JSON.parse(text).id;
}

async function setThumbnail(token, videoId, file) {
  if (!fs.existsSync(file)) return false;
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: fs.readFileSync(file),
    }
  );
  if (!res.ok) {
    // A channel without the "custom thumbnails" feature enabled refuses this,
    // and that must not take the whole run down with it.
    console.warn(`    thumbnail rejected (${res.status}) — the video itself is fine`);
    return false;
  }
  return true;
}

async function addCaptions(token, videoId, file) {
  if (!fs.existsSync(file)) return false;
  const boundary = `----aureoncare${Date.now()}`;
  const meta = JSON.stringify({
    snippet: { videoId, language: 'en', name: 'English', isDraft: false },
  });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fs.readFileSync(file),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    console.warn(`    captions rejected (${res.status}) — upload the .srt by hand`);
    return false;
  }
  return true;
}

async function ensurePlaylist(token, ids) {
  if (ids.playlistId) return ids.playlistId;
  const mine = await api(
    token,
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50'
  );
  const existing = (mine.items || []).find((p) => p.snippet.title === PLAYLIST_TITLE);
  if (existing) return existing.id;

  const created = await api(token, 'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: { title: PLAYLIST_TITLE, description: PLAYLIST_DESCRIPTION },
      status: { privacyStatus: PRIVACY === 'public' ? 'public' : 'unlisted' },
    }),
  });
  return created.id;
}

async function addToPlaylist(token, playlistId, videoId) {
  await api(token, 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
    }),
  });
}

/* ─────────────────────────── paste-ready copy ───────────────────────────── */

/**
 * Writes YOUTUBE_UPLOAD_COPY.md for whoever is uploading by hand.
 *
 * Generated rather than written, and for a specific reason: M1's description
 * used to carry a hand-maintained chapter list that fell out of step with the
 * video the first time it was re-cut, pointing its chapters at the wrong
 * moments. A second hand-kept copy of every title and description is that bug
 * waiting to happen twelve times over, so this file is derived from the specs
 * and the recorder's own .chapters.txt, and regenerated rather than edited.
 */
function doCopy() {
  const items = collect();
  const out = [];
  out.push('# Marketing cuts — YouTube upload copy');
  out.push('');
  out.push('**Generated file — do not edit by hand.** Regenerate with:');
  out.push('');
  out.push('```');
  out.push('node docs/demo/video-harness/youtube-upload.js copy');
  out.push('```');
  out.push('');
  out.push('Everything in a fenced block is **copy verbatim** into YouTube Studio.');
  out.push('Titles, descriptions and tags come from the specs in');
  out.push('`../../video-harness/scripts/marketing/`; chapter lists come from the');
  out.push('`.chapters.txt` the recorder wrote beside each video, so they always match the');
  out.push('cut that is actually in this folder.');
  out.push('');
  out.push('A chapter list is only included where the video has three or more chapters');
  out.push('starting at 0:00 — below that YouTube ignores it and it is noise in the');
  out.push('description.');
  out.push('');
  out.push('`youtube-upload.js` does all of this over the API, including thumbnails,');
  out.push('subtitles and the playlist. This file is the manual path.');
  out.push('');
  out.push('---');
  out.push('');
  out.push('## The playlist');
  out.push('');
  out.push(`### Playlist title \`${PLAYLIST_TITLE.length} chars\``);
  out.push('');
  out.push('```');
  out.push(PLAYLIST_TITLE);
  out.push('```');
  out.push('');
  out.push('### Playlist description');
  out.push('');
  out.push('```');
  out.push(PLAYLIST_DESCRIPTION);
  out.push('```');
  out.push('');

  for (const item of items) {
    const duration = durationOf(item.video);
    out.push('---');
    out.push('');
    out.push(`## ${item.id} — ${item.slug}${duration ? ` \`${duration}\`` : ''}`);
    out.push('');
    out.push(`### Title \`${item.title.length} chars\``);
    out.push('');
    out.push('```');
    out.push(item.title);
    out.push('```');
    out.push('');
    out.push('### Description');
    out.push('');
    out.push('```');
    out.push(describe(item));
    out.push('```');
    out.push('');
    out.push('### Tags');
    out.push('');
    out.push('```');
    out.push(item.tags.join(', '));
    out.push('```');
    out.push('');
    out.push('### Thumbnail and subtitles');
    out.push('');
    out.push(`Upload \`${path.basename(item.thumbnail)}\` and \`${path.basename(item.captions)}\`.`);
    out.push('');
  }

  const file = path.join(LIBRARY, 'YOUTUBE_UPLOAD_COPY.md');
  fs.writeFileSync(file, `${out.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), file)} (${items.length} videos)`);
}

/** mm:ss read off the container, so the copy cannot claim a stale length. */
function durationOf(file) {
  const ffmpeg = process.env.FFMPEG
    || '/opt/node22/lib/node_modules/ffmpeg-static/ffmpeg';
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync(ffmpeg, ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] })
      .toString();
    return (out.match(/Duration: (\d+):(\d+):(\d+)/) || []).slice(1, 4).join(':');
  } catch (err) {
    const text = (err.stderr || '').toString();
    const m = text.match(/Duration: 00:(\d+:\d+)/);
    return m ? m[1] : '';
  }
}

/* ───────────────────────────────── main ─────────────────────────────────── */

async function doUpload() {
  const items = collect();
  if (!items.length) {
    console.error('Nothing to upload.');
    process.exit(1);
  }

  console.log(`\n${items.length} video(s), privacy=${PRIVACY}${DRY_RUN ? ' (dry run)' : ''}\n`);
  if (DRY_RUN) {
    for (const item of items) {
      console.log(`${item.id}  ${item.title}`);
      console.log(`   video      ${path.basename(item.video)}`);
      console.log(`   thumbnail  ${fs.existsSync(item.thumbnail) ? 'yes' : 'MISSING'}`);
      console.log(`   subtitles  ${fs.existsSync(item.captions) ? 'yes' : 'MISSING'}`);
      console.log(`   tags       ${item.tags.length}`);
      console.log(`   description\n${describe(item).split('\n').map((l) => `     ${l}`).join('\n')}\n`);
    }
    console.log(`Playlist: ${PLAYLIST_TITLE}`);
    return;
  }

  const token = await accessToken();
  const ids = readJson(IDS_FILE, { playlistId: null, videos: {} });
  ids.playlistId = await ensurePlaylist(token, ids);
  writeJson(IDS_FILE, ids);
  console.log(`Playlist: ${ids.playlistId}\n`);

  for (const item of items) {
    if (ids.videos[item.slug]) {
      console.log(`= ${item.id} already uploaded (${ids.videos[item.slug]})`);
      continue;
    }
    process.stdout.write(`▲ ${item.id} ${item.title}\n`);
    try {
      const videoId = await uploadVideo(token, item);
      ids.videos[item.slug] = videoId;
      writeJson(IDS_FILE, ids); // written before the extras, so a crash cannot orphan the upload
      console.log(`    https://youtu.be/${videoId}`);
      await setThumbnail(token, videoId, item.thumbnail);
      await addCaptions(token, videoId, item.captions);
      await addToPlaylist(token, ids.playlistId, videoId);
    } catch (err) {
      if (err.reason === 'quotaExceeded' || /quotaExceeded/.test(err.message)) {
        console.error('\nDaily quota reached. This is the expected stopping point —');
        console.error('what uploaded is recorded, so re-run tomorrow to continue.\n');
        break;
      }
      throw err;
    }
  }

  writeJson(IDS_FILE, ids);
  console.log(`\nIds recorded in ${path.relative(process.cwd(), IDS_FILE)}`);
}

const main = command === 'auth' ? doAuth : command === 'copy' ? doCopy : doUpload;
// `copy` is synchronous while the other two are not, so the result is wrapped
// rather than assumed to be a promise.
Promise.resolve()
  .then(main)
  .catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
