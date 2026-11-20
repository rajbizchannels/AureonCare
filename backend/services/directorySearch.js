// Directory search (Phase 3): one search box over SEARCHABLE practice profiles.
//
// What can ever appear: practices whose admins chose "Searchable" (and whose tenant is
// active), and providers who CONSENTED to be listed and were not hidden — with only the
// details they chose. Nothing else is in the corpus, so nothing else can leak into results.
//
// The query is read, not logged: this module never writes it anywhere, the route takes it
// in the POST body (never the URL, so hosting logs do not see it) and answers no-store.
//
// Ranking is neutral and explainable — specialty match, place match, name similarity, then
// distance (when the visitor shared a rounded location and the practice published map
// coordinates), then name. There is no paid placement.
//
// The corpus is small and public, so it is built from the database and ranked in memory,
// cached briefly. When the directory grows past ~10k practices, move this to a database
// index (pg_trgm / full text) behind the same interface.

const P = require('./practiceProfile');

// Everyday words for each specialty in the catalogue (US and UK spellings, lay terms).
const SYNONYMS = {
  general_practice: ['gp', 'general practitioner', 'family doctor', 'family medicine', 'family physician', 'primary care', 'general practice'],
  internal_medicine: ['internist', 'internal medicine'],
  paediatrics: ['pediatrician', 'paediatrician', 'pediatrics', 'paediatrics', 'children doctor', 'childrens doctor', 'child doctor', 'kids doctor'],
  paediatric_cardiology: ['pediatric cardiologist', 'paediatric cardiologist', 'pediatric cardiology'],
  neonatology: ['neonatologist', 'newborn'],
  obstetrics_gynae: ['obgyn', 'ob gyn', 'ob/gyn', 'obstetrician', 'gynecologist', 'gynaecologist', 'gynecology', 'gynaecology', 'obstetrics', 'womens health', 'pregnancy', 'maternity'],
  dentistry: ['dentist', 'dental', 'teeth', 'tooth'],
  orthodontics: ['orthodontist', 'braces', 'aligners'],
  endodontics: ['endodontist', 'root canal'],
  periodontics: ['periodontist', 'gums', 'gum disease'],
  oral_surgery: ['oral surgeon', 'maxillofacial', 'wisdom teeth'],
  ophthalmology: ['ophthalmologist', 'eye doctor', 'eye specialist', 'eyes', 'eye'],
  retina: ['retina', 'retina specialist'],
  cornea: ['lasik', 'cornea', 'refractive surgery'],
  ent: ['ent', 'ear nose throat', 'ear nose and throat', 'otolaryngologist', 'otolaryngology'],
  dermatology: ['dermatologist', 'skin doctor', 'skin specialist', 'skin', 'acne', 'eczema'],
  orthopaedics: ['orthopedic', 'orthopaedic', 'orthopedics', 'orthopaedics', 'orthopedist', 'bone doctor', 'bones', 'fracture'],
  spine_surgery: ['spine surgeon', 'spine', 'back surgery'],
  sports_medicine: ['sports medicine', 'sports doctor', 'sports injury'],
  joint_replacement: ['joint replacement', 'knee replacement', 'hip replacement'],
  cardiology: ['cardiologist', 'heart doctor', 'heart specialist', 'heart', 'cardiac'],
  interventional_cardiology: ['interventional cardiologist', 'angioplasty', 'stent'],
  electrophysiology: ['electrophysiologist', 'arrhythmia', 'pacemaker'],
  neurology: ['neurologist', 'brain doctor', 'nerve', 'nerves', 'epilepsy', 'migraine'],
  gastroenterology: ['gastroenterologist', 'gi doctor', 'stomach', 'digestive', 'gut', 'colonoscopy'],
  pulmonology: ['pulmonologist', 'lung doctor', 'lungs', 'lung', 'asthma', 'chest physician'],
  nephrology: ['nephrologist', 'kidney', 'kidneys', 'dialysis'],
  urology: ['urologist', 'bladder', 'prostate'],
  endocrinology: ['endocrinologist', 'diabetes', 'diabetologist', 'thyroid', 'hormones', 'hormone'],
  oncology: ['oncologist', 'cancer', 'chemotherapy'],
  rheumatology: ['rheumatologist', 'arthritis', 'lupus'],
  psychiatry: ['psychiatrist', 'mental health'],
  behavioral_health: ['counsellor', 'counselor', 'counselling', 'counseling', 'therapist', 'therapy', 'psychologist', 'psychotherapy'],
  physiotherapy: ['physio', 'physiotherapist', 'physiotherapy', 'physical therapy', 'physical therapist', 'rehab', 'rehabilitation'],
  fertility: ['ivf', 'fertility', 'infertility'],
  radiology: ['radiologist', 'xray', 'x ray', 'x-ray', 'mri', 'ct scan', 'ultrasound', 'imaging', 'scan'],
  pathology: ['pathology', 'lab', 'laboratory', 'blood test', 'blood tests'],
  anaesthesiology: ['anesthesiologist', 'anaesthetist', 'anesthesiology', 'anaesthesiology'],
  general_surgery: ['surgeon', 'general surgeon', 'surgery'],
  plastic_surgery: ['plastic surgeon', 'cosmetic surgery', 'cosmetic surgeon', 'reconstructive'],
  vascular_surgery: ['vascular surgeon', 'veins', 'varicose'],
  neurosurgery: ['neurosurgeon', 'brain surgeon'],
  cardiac_surgery: ['heart surgeon', 'cardiothoracic surgeon', 'cardiac surgeon'],
  emergency_medicine: ['emergency', 'urgent care', 'er', 'a&e', 'a and e'],
  geriatrics: ['geriatrician', 'elderly care', 'senior care', 'older adults'],
  nutrition: ['dietitian', 'dietician', 'nutritionist', 'nutrition', 'diet'],
  audiology: ['audiologist', 'hearing', 'speech therapist', 'speech therapy'],
  podiatry: ['podiatrist', 'chiropodist', 'foot doctor', 'feet', 'foot'],
  occupational_health: ['occupational health', 'occupational medicine', 'workplace health'],
};

// Words that carry no meaning for matching.
const STOP = new Set(['a', 'an', 'the', 'for', 'of', 'and', 'or', 'with', 'my', 'me', 'find', 'best', 'good', 'top',
  'clinic', 'clinics', 'practice', 'practices', 'hospital', 'centre', 'center', 'doctor', 'doctors', 'specialist',
  'specialists', 'dr', 'near', 'nearby', 'in', 'at', 'around', 'close', 'to', 'by']);

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9\s/-]/g, ' ').replace(/[/-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Dice coefficient on character trigrams — tolerant of typos in names. */
function similarity(a, b) {
  a = ` ${norm(a)} `; b = ` ${norm(b)} `;
  if (a.trim() === '' || b.trim() === '') return 0;
  if (a === b) return 1;
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 2; i++) { const g = s.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const ga = grams(a); const gb = grams(b);
  let inter = 0; let total = 0;
  for (const [g, n] of ga) { total += n; if (gb.has(g)) inter += Math.min(n, gb.get(g)); }
  for (const n of gb.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

/** Best similarity of `term` against any word-window of `text` (a name inside a longer name). */
function bestWithin(term, text) {
  const t = norm(text).split(' ').filter(Boolean);
  const k = norm(term).split(' ').filter(Boolean).length || 1;
  let best = similarity(term, text);
  for (let i = 0; i < t.length; i++) best = Math.max(best, similarity(term, t.slice(i, i + k).join(' ')));
  return best;
}

// ── the corpus ───────────────────────────────────────────────────────────────────────
let cache = { at: 0, corpus: null, specialties: null };
const TTL_MS = 60 * 1000;
function invalidate() { cache = { at: 0, corpus: null, specialties: null }; }

async function loadCorpus(pool) {
  if (cache.corpus && Date.now() - cache.at < TTL_MS) return cache;
  const { rows: specs } = await pool.query('SELECT code, name FROM public.specialties WHERE COALESCE(is_active, true)');
  const specialties = new Map(specs.map((s) => [s.code, s.name]));
  const { rows: profiles } = await pool.query(
    `SELECT pp.practice_id, pp.slug, pp.display_name, pp.about, pp.specialty_codes, pp.locations, pp.logo_photo_id, pr.name AS practice_name
       FROM public.practice_profiles pp
       JOIN public.practices pr ON pr.id = pp.practice_id
       JOIN control.tenants t ON t.practice_id = pp.practice_id AND t.status = 'active'
      WHERE pp.visibility = 'searchable' AND pp.slug IS NOT NULL`);
  const corpus = [];
  for (const p of profiles) {
    const providers = (await P.practiceProviders(pool, p.practice_id)).map(P.publicProvider).filter(Boolean);
    const provSpecCodes = providers.flatMap((x) => x.specialty_codes);
    const codes = [...new Set([...(p.specialty_codes || []), ...provSpecCodes])];
    const locations = (Array.isArray(p.locations) ? p.locations : []).map((l) => ({
      name: l.name, city: l.city, state: l.state, postal_code: l.postal_code, country: l.country,
      lat: Number.isFinite(l.latitude) ? l.latitude : null, lng: Number.isFinite(l.longitude) ? l.longitude : null,
      text: norm([l.city, l.state, l.postal_code, l.country, l.name].filter(Boolean).join(' ')),
    }));
    corpus.push({
      practiceId: p.practice_id, slug: p.slug, name: p.display_name || p.practice_name,
      specialtyCodes: codes, ownSpecialtyCodes: p.specialty_codes || [],
      specialtyText: norm([...codes.map((c) => specialties.get(c)), ...providers.map((x) => x.specialization)].filter(Boolean).join(' ')),
      locations, logoPhotoId: p.logo_photo_id,
      providers: providers.map((x) => ({ id: x.id, name: x.name, specialization: x.specialization, specialtyCodes: x.specialty_codes })),
    });
  }
  cache = { at: Date.now(), corpus, specialties };
  return cache;
}

// ── reading the query ────────────────────────────────────────────────────────────────
function detectSpecialties(qn, specialties) {
  const found = new Set();
  const hits = [];   // spans of the query consumed by a specialty phrase
  const consider = (code, phrase) => {
    const ph = norm(phrase);
    if (!ph) return;
    const re = new RegExp(`(^| )${ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
    if (re.test(qn)) { found.add(code); hits.push(ph); }
  };
  for (const [code, name] of specialties) {
    consider(code, name);
    for (const part of String(name).split(/[/&]| and /)) consider(code, part);
    // "dermatologist" -> Dermatology, "cardiologist" -> Cardiology
    const base = norm(name).split(' ')[0];
    if (/ology$/.test(base)) consider(code, base.replace(/ology$/, 'ologist'));
    for (const syn of SYNONYMS[code] || []) consider(code, syn);
  }
  return { codes: [...found], consumed: hits };
}

/**
 * Split a free-text query into specialties, a place, and name words.
 * `places` is the set of known city / region / postcode / country terms in the corpus.
 */
function parseQuery(q, specialties, places) {
  let qn = norm(q).slice(0, 200);
  const { codes, consumed } = detectSpecialties(qn, specialties);
  for (const ph of consumed.sort((a, b) => b.length - a.length)) qn = ` ${qn} `.replace(` ${ph} `, ' ').trim();

  // An explicit place: "... in Springfield", "near 62701", "at Austin TX".
  let place = null;
  const m = /(?:^| )(?:in|near|at|around)\s+(.+)$/.exec(qn);
  if (m) { place = m[1].trim(); qn = qn.slice(0, m.index).trim(); }
  // Otherwise any words that are a known place in the directory.
  if (!place) {
    const words = qn.split(' ').filter(Boolean);
    for (let n = Math.min(3, words.length); n >= 1 && !place; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        const cand = words.slice(i, i + n).join(' ');
        if (!STOP.has(cand) && places.has(cand)) { place = cand; words.splice(i, n); qn = words.join(' '); break; }
      }
    }
  }
  const nameWords = qn.split(' ').filter((w) => w && !STOP.has(w) && w.length > 1);
  return { specialtyCodes: codes, place: place || null, name: nameWords.join(' ') || null };
}

const haversineKm = (a, b) => {
  const R = 6371; const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * @param {object} pool
 * @param {{ q?: string, lat?: number, lng?: number, radiusKm?: number, limit?: number, offset?: number }} opts
 */
async function search(pool, { q = '', lat = null, lng = null, radiusKm = 100, limit = 20, offset = 0 } = {}) {
  const { corpus, specialties } = await loadCorpus(pool);
  const places = new Set();
  for (const c of corpus) for (const l of c.locations) for (const v of [l.city, l.state, l.postal_code, l.country]) if (v) places.add(norm(v));
  const parsed = parseQuery(q, specialties, places);
  const here = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  let nameMatched = false;
  const scored = [];
  for (const c of corpus) {
    let score = 0;
    // Specialty: required when asked for.
    let matchedProviders = c.providers;
    if (parsed.specialtyCodes.length) {
      const own = parsed.specialtyCodes.some((code) => c.specialtyCodes.includes(code));
      const textual = parsed.specialtyCodes.some((code) => c.specialtyText.includes(norm(specialties.get(code))));
      if (!own && !textual) continue;
      score += 50;
      const provMatch = c.providers.filter((x) => parsed.specialtyCodes.some((code) => x.specialtyCodes.includes(code))
        || (x.specialization && parsed.specialtyCodes.some((code) => norm(x.specialization).includes(norm(specialties.get(code)).split(' ')[0]))));
      if (provMatch.length) matchedProviders = provMatch;
    }
    // Place: required when asked for.
    let placeHit = null;
    if (parsed.place) {
      const pn = norm(parsed.place);
      placeHit = c.locations.find((l) => l.text.includes(pn) || pn.split(' ').every((w) => l.text.split(' ').includes(w)));
      if (!placeHit) continue;
      score += 30;
    }
    // Names: practice or listed provider.
    let nameScore = 0;
    if (parsed.name) {
      nameScore = bestWithin(parsed.name, c.name);
      for (const x of c.providers) {
        const s = bestWithin(parsed.name, x.name.replace(/^Dr\.?\s*/, ''));
        if (s > nameScore) nameScore = s;
        if (s >= 0.5) matchedProviders = [x, ...matchedProviders.filter((y) => y.id !== x.id)];
      }
      if (nameScore >= 0.5) nameMatched = true;
    }
    // Distance, when both sides have coordinates.
    let distanceKm = null;
    if (here) {
      const ds = c.locations.filter((l) => l.lat != null && l.lng != null).map((l) => haversineKm(here, l));
      if (ds.length) distanceKm = Math.min(...ds);
      if (distanceKm != null && distanceKm > radiusKm && !parsed.place) continue;
    }
    scored.push({ c, score, nameScore, distanceKm, matchedProviders, placeHit });
  }
  // Name words that match nothing are treated as noise ("best", typos of nothing) rather
  // than emptying the results; when they do match, they filter.
  let rows = scored;
  if (parsed.name && nameMatched) rows = scored.filter((r) => r.nameScore >= 0.5);
  rows = rows.map((r) => ({ ...r, total: r.score + (nameMatched ? r.nameScore * 40 : 0) }));
  rows.sort((a, b) => (b.total - a.total)
    || ((a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    || a.c.name.localeCompare(b.c.name));

  const total = rows.length;
  const page = rows.slice(offset, offset + limit).map((r) => {
    const loc = r.placeHit || r.c.locations[0] || null;
    return {
      name: r.c.name,
      url: `/p/${r.c.slug}`,
      logo: r.c.logoPhotoId ? `/p/${r.c.slug}/photo/${r.c.logoPhotoId}` : null,
      specialties: r.c.ownSpecialtyCodes.map((code) => specialties.get(code)).filter(Boolean),
      place: loc ? [loc.city, loc.state].filter(Boolean).join(', ') || loc.country || null : null,
      locations: r.c.locations.length,
      distanceKm: r.distanceKm == null ? null : Math.round(r.distanceKm * 10) / 10,
      providers: r.matchedProviders.slice(0, 3).map((x) => ({ name: x.name, specialization: x.specialization })),
      moreProviders: Math.max(0, r.matchedProviders.length - 3),
    };
  });
  return {
    total,
    results: page,
    understood: {
      specialties: parsed.specialtyCodes.map((code) => specialties.get(code)).filter(Boolean),
      place: parsed.place,
      name: parsed.name && nameMatched ? parsed.name : null,
      nearby: Boolean(here),
    },
  };
}

/** Readable addresses of every searchable profile, for the sitemap. */
async function searchableUrls(pool) {
  const { corpus } = await loadCorpus(pool);
  return corpus.map((c) => `/p/${c.slug}`);
}

module.exports = { search, parseQuery, similarity, invalidate, searchableUrls, SYNONYMS, norm };
