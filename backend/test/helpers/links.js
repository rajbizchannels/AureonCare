// Follow a short link (/s/<code>) to the full URL it stands for, as a recipient's browser
// would. Full URLs are returned unchanged.
async function expandLink(url, base) {
  const m = /\/s\/([A-Za-z0-9]{12})\b/.exec(String(url || ''));
  if (!m) return url;
  const r = await fetch(`${base}/s/${m[1]}`, { redirect: 'manual' });
  return r.headers.get('location') || null;
}
/** The first link in an email body: a short link if present, else any http(s) URL. */
const firstLinkIn = (html) => {
  const s = /https?:\/\/[^\s"'<>]+\/s\/[A-Za-z0-9]{12}/.exec(html || '');
  return s ? s[0] : null;
};
const tokenOf = (url) => { try { return new URL(url).searchParams.get('token'); } catch { return null; } };
module.exports = { expandLink, firstLinkIn, tokenOf };
