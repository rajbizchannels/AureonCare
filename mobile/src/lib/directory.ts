/**
 * "Find a practice" — the public directory (POST /api/directory/search), shaped for the
 * app. Plain logic, tested with node (tests/directory.test.mjs). The query travels in the
 * request body, never the URL, and the server keeps no search logs.
 */

export interface DirectoryResult {
  name: string;
  url: string;              // /p/<slug> on the same server
  logo: string | null;
  specialties: string[];
  place: string | null;
  locations: number;
  distanceKm: number | null;
  providers: { name: string; specialization?: string | null }[];
  moreProviders: number;
  matchedBy?: 'practice-name';
}

export interface DirectoryAnswer {
  total: number;
  results: DirectoryResult[];
  understood: { specialties: string[]; place: string | null; name: string | null; practiceName?: boolean; nearby: boolean };
}

/** The practice's public page, on the server the app is pointed at. */
export function profileUrl(serverUrl: string, r: Pick<DirectoryResult, 'url'>): string {
  return `${serverUrl.replace(/\/+$/, '')}${r.url.startsWith('/') ? r.url : `/${r.url}`}`;
}

/** "Dermatology · Springfield, IL · 2 locations". */
export function resultMeta(r: DirectoryResult): string {
  return [
    r.specialties.slice(0, 2).join(', ') || null,
    r.place,
    r.locations > 1 ? `${r.locations} locations` : null,
    r.distanceKm != null ? `${r.distanceKm} km` : null,
  ].filter(Boolean).join(' · ');
}

/** "Dr Rina Derm, Dr Arjun Patel +2 more". */
export function providerLine(r: DirectoryResult): string | null {
  if (!r.providers.length) return null;
  const names = r.providers.map((p) => p.name).join(', ');
  return r.moreProviders > 0 ? `${names} +${r.moreProviders} more` : names;
}

/** What the search understood, as one sentence — or null when it was a plain name search. */
export function understoodLine(u: DirectoryAnswer['understood']): string | null {
  const bits: string[] = [];
  if (u.practiceName) bits.push('a practice name');
  if (u.specialties.length) bits.push(u.specialties.join(' or '));
  if (u.place) bits.push(`in ${u.place}`);
  if (u.name && !u.practiceName) bits.push(`named “${u.name}”`);
  return bits.length ? `Showing ${bits.join(', ')}` : null;
}
