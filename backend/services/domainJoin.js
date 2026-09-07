// Domain-based self-service joining.
//
// Every decision about whether an email address grants access to a practice lives here, so
// there is one place to audit rather than a rule re-implemented per signup route.
//
// The rule, in full: an address grants nothing unless the practice has PROVEN control of
// the domain (a DNS TXT record we placed and verified) AND the signup has PROVEN control
// of the address (a verified OAuth email, or a clicked verification link). Either one
// alone is worthless — a domain claim without address proof lets anyone type
// "ceo@theclinic.com", and address proof without a domain claim tells us nothing about
// which practice the person belongs to.

const dns = require('dns').promises;
const crypto = require('crypto');

const TXT_PREFIX = 'aureoncare-domain-verification=';

/** Domains nobody may claim: control of a mailbox here says nothing about an employer. */
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net', 'mail.com',
  'yandex.com', 'zoho.com', 'fastmail.com', 'tutanota.com', 'hey.com', 'qq.com',
  '163.com', '126.com', 'naver.com', 'rediffmail.com',
]);

/** The domain part of an address, lowercased. Null when the input is not an address. */
function domainOf(email) {
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email || '').trim().toLowerCase());
  return m ? m[1] : null;
}

/**
 * Is this something a practice may claim at all?
 *
 * Rejecting the public mailbox providers is the single most important check here. Without
 * it, one practice claiming gmail.com would capture the signup of every Gmail user on the
 * platform — and because a Google OAuth email IS provider-verified, they would sail
 * straight through the address-proof half of the rule too.
 */
function isClaimable(domain) {
  const d = String(domain || '').trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) {
    return { ok: false, reason: 'That does not look like a domain name.' };
  }
  if (d.length > 253) return { ok: false, reason: 'That domain name is too long.' };
  if (PUBLIC_EMAIL_DOMAINS.has(d)) {
    return {
      ok: false,
      reason: 'Public email providers cannot be claimed — an address there does not show '
        + 'who someone works for. Use a domain your practice controls.',
    };
  }
  // A bare TLD has no apex to publish a record at, and claiming one would be absurd.
  if (d.split('.').length < 2) return { ok: false, reason: 'Claim a full domain, e.g. clinic.com.' };
  return { ok: true, domain: d };
}

const newToken = () => TXT_PREFIX + crypto.randomBytes(24).toString('base64url');

/**
 * Look for the claim token in the domain's TXT records.
 *
 * Checks the apex and the _aureoncare subdomain, because plenty of DNS setups already have
 * an apex TXT record they would rather not touch.
 */
async function checkDnsToken(domain, token) {
  const names = [domain, `_aureoncare.${domain}`];
  const seen = [];
  for (const name of names) {
    let records;
    try {
      records = await dns.resolveTxt(name);
    } catch (err) {
      // NXDOMAIN/ENODATA on the subdomain is entirely normal; keep looking.
      seen.push(`${name}: ${err.code || 'lookup failed'}`);
      continue;
    }
    // Long TXT values arrive split into chunks; join before comparing.
    const values = records.map((chunks) => chunks.join(''));
    if (values.includes(token)) return { verified: true, foundAt: name };
    seen.push(`${name}: ${values.length} record(s), none matching`);
  }
  return { verified: false, detail: seen.join('; ') };
}

/**
 * Which practice, if any, should a signup at this address join — and on what terms?
 *
 * Returns null when nothing matches, which is the common case and must stay cheap.
 * `verified_at IS NOT NULL` is in the WHERE clause rather than checked afterwards: an
 * unverified claim must never be able to influence a signup, so it should not be able to
 * reach the caller at all.
 */
async function resolveDomainClaim(pool, email) {
  const domain = domainOf(email);
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null;

  const { rows } = await pool.query(
    `SELECT d.id, d.practice_id, d.domain, d.join_policy, d.default_role, p.name AS practice_name
       FROM public.practice_domains d
       JOIN public.practices p ON p.id = d.practice_id
      WHERE LOWER(d.domain) = $1
        AND d.verified_at IS NOT NULL
        AND d.join_policy <> 'disabled'
      LIMIT 1`,
    [domain]
  );
  return rows[0] || null;
}

module.exports = {
  domainOf,
  isClaimable,
  newToken,
  checkDnsToken,
  resolveDomainClaim,
  PUBLIC_EMAIL_DOMAINS,
  TXT_PREFIX,
};
