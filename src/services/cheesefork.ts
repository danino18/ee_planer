const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/cheesefork-de9af/databases/(default)/documents/courseFeedback';

export interface CheeseForkPost {
  timestamp: number;
  author: string;
  semester: string;
  text: string;
  difficultyRank: number | null;
  generalRank: number | null;
}

export interface CheeseForkFeedback {
  posts: CheeseForkPost[];
}

/**
 * Round the average of a list of 1-5 rank values to one decimal place.
 * Returns `null` for an empty list.
 */
export function averageRank(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Average `generalRank` across all posts that have one. Returns `null` if
 * there is no feedback or no post carries a generalRank value.
 */
export function averageGeneralRank(feedback: CheeseForkFeedback | null | undefined): number | null {
  if (!feedback) return null;
  const values = feedback.posts
    .map((p) => p.generalRank)
    .filter((n): n is number => n !== null);
  return averageRank(values);
}

const cache = new Map<string, CheeseForkFeedback | null>();
const inflight = new Map<string, Promise<CheeseForkFeedback | null>>();

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

function unwrapFirestore(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    const fields = value.mapValue.fields ?? {};
    for (const [k, v] of Object.entries(fields)) out[k] = unwrapFirestore(v);
    return out;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(unwrapFirestore);
  }
  return undefined;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

function toStringOr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function parsePosts(raw: unknown): CheeseForkPost[] {
  if (!Array.isArray(raw)) return [];
  const posts: CheeseForkPost[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    posts.push({
      timestamp: toNumberOrNull(o.timestamp) ?? 0,
      author: toStringOr(o.author),
      semester: toStringOr(o.semester),
      text: toStringOr(o.text),
      difficultyRank: toNumberOrNull(o.difficultyRank),
      generalRank: toNumberOrNull(o.generalRank),
    });
  }
  return posts;
}

/**
 * Synchronously inspect the cache without triggering a fetch.
 * Returns `undefined` if nothing is cached yet, matching Map#get semantics.
 */
export function peekCheeseForkFeedback(
  courseId8: string,
): CheeseForkFeedback | null | undefined {
  return cache.has(courseId8) ? cache.get(courseId8) ?? null : undefined;
}

export async function fetchCheeseForkFeedback(
  courseId8: string,
): Promise<CheeseForkFeedback | null> {
  if (cache.has(courseId8)) return cache.get(courseId8) ?? null;
  const existing = inflight.get(courseId8);
  if (existing) return existing;

  const promise = (async (): Promise<CheeseForkFeedback | null> => {
    try {
      const res = await fetch(`${FIRESTORE_BASE}/${encodeURIComponent(courseId8)}`);
      if (res.status === 404) {
        cache.set(courseId8, null);
        return null;
      }
      if (!res.ok) {
        // 403, network-ish errors etc. Don't cache negatively — rules may flap.
        return null;
      }
      const json = (await res.json()) as { fields?: Record<string, FirestoreValue> };
      const unwrapped = unwrapFirestore({ mapValue: { fields: json.fields ?? {} } }) as
        | { posts?: unknown }
        | undefined;
      const posts = parsePosts(unwrapped?.posts);
      const feedback: CheeseForkFeedback = { posts };
      cache.set(courseId8, feedback);
      return feedback;
    } catch {
      return null;
    } finally {
      inflight.delete(courseId8);
    }
  })();

  inflight.set(courseId8, promise);
  return promise;
}

/**
 * Format a CheeseFork semester code (Technion convention "YYYY01" / "YYYY02" / "YYYY03"
 * where 01=חורף, 02=אביב, 03=קיץ and YYYY is the academic-year start) into Hebrew.
 * Falls back to the raw value if the pattern doesn't match.
 */
export function formatCheeseForkSemester(semester: string): string {
  const match = /^(\d{4})(0[123])$/.exec(semester);
  if (!match) return semester;
  const start = Number(match[1]);
  const end = start + 1;
  switch (match[2]) {
    case '01': return `סמסטר חורף ${start}-${end}`;
    case '02': return `סמסטר אביב ${end}`;
    case '03': return `סמסטר קיץ ${end}`;
    default: return semester;
  }
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatCheeseForkDate(timestampMs: number): string {
  if (!timestampMs || isNaN(timestampMs)) return '';
  return dateFormatter.format(new Date(timestampMs));
}

const LECTURER_LABEL = /שם\s+המרצה\s*:\s*([^\n\r]+)/;
const TA_LABEL = /שם\s+המתרגל(?:\/ת|ת)?\s*:\s*([^\n\r]+)/;
const MAX_NAME_LEN = 80;

function cleanExtractedName(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Bound the captured tail so we don't accidentally grab a paragraph.
  return trimmed.slice(0, MAX_NAME_LEN).trim() || null;
}

/**
 * Extract a lecturer and/or TA name from a CheeseFork review body.
 * Reviewers conventionally tag them as `שם המרצה: <name>` / `שם המתרגל/ת: <name>`.
 * Returns null for fields that aren't tagged; matches are tail-trimmed to a single line.
 */
export function extractInstructorNames(
  text: string,
): { lecturer: string | null; ta: string | null } {
  if (!text) return { lecturer: null, ta: null };
  const lecMatch = LECTURER_LABEL.exec(text);
  const taMatch = TA_LABEL.exec(text);
  return {
    lecturer: cleanExtractedName(lecMatch?.[1]),
    ta: cleanExtractedName(taMatch?.[1]),
  };
}

const HEBREW_FINAL_MAP: Record<string, string> = {
  'ם': 'מ', 'ן': 'נ', 'ך': 'כ', 'ף': 'פ', 'ץ': 'צ',
};

function foldFinals(s: string): string {
  let out = '';
  for (const ch of s) out += HEBREW_FINAL_MAP[ch] ?? ch;
  return out;
}

// Hebrew diacritics (niqqud + cantillation), quote-like marks, separators.
const STRIP_PUNCT = /[֑-ׇ.\-־"'`׳״]/g;

// Junk tokens commonly attached to instructor names: titles, recording markers,
// content qualifiers, conjunctions. Pre-folded to match post-fold tokens.
const BLOCKED_TOKENS = new Set(
  [
    'מוקלט', 'מוקלטת', 'מוקלטות', 'מוקלטים',
    'הקלט', 'הקלטה', 'הקלטות',
    'פיראטי', 'פירטי', 'פיראטית',
    'מצגת', 'מצגות', 'סיכום', 'סיכומים',
    'חצי', 'סמסטר',
    'קצת', 'הרבה', 'מעט', 'בעיקר',
    'ואז', 'וגם', 'אבל',
    // Titles
    'פרופ', 'דר', 'מר', 'גב',
  ].map((t) => foldFinals(t).toLowerCase()),
);

// Phrases at which we cut and discard the remainder: "X / Y" → keep X; "X ואז Y" → keep X.
const CUT_RE = /\s+(?:\/|,|ואז|וגם|אבל)\s+|\s*\/\s*|\s*,\s*/;

function stripParens(s: string): string {
  let prev = s;
  let next = s.replace(/\([^)]*\)/g, ' ');
  while (next !== prev) {
    prev = next;
    next = next.replace(/\([^)]*\)/g, ' ');
  }
  return next.replace(/[()]/g, ' ');
}

/**
 * Clean an instructor name into a list of meaningful name tokens.
 * Removes parenthesized noise, cuts at multi-person separators ("/", "ואז"),
 * strips titles ("פרופ׳", "ד\"ר") and recording markers ("מוקלט", "הקלטה").
 * Returns tokens in original order, post-final-letter-folding.
 */
export function instructorTokens(name: string): string[] {
  if (!name) return [];
  let s = stripParens(name);
  const cutMatch = CUT_RE.exec(s);
  if (cutMatch && cutMatch.index > 0) {
    s = s.slice(0, cutMatch.index);
  }
  s = s.replace(STRIP_PUNCT, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const folded = foldFinals(t).toLowerCase();
    if (!folded) continue;
    if (BLOCKED_TOKENS.has(folded)) continue;
    out.push(folded);
  }
  return out;
}

/**
 * Collapse a raw instructor name into a stable cluster key. Two names whose
 * cleaned token sets are equal will produce the same key. Used for grouping.
 */
export function normalizeInstructorName(name: string): string {
  const tokens = instructorTokens(name);
  return [...new Set(tokens)].sort().join(' ');
}

/**
 * Reconstruct a display-friendly canonical name from a raw entry, preserving
 * original casing and word order while dropping the same noise that
 * instructorTokens drops. Used to suggest a clean merge target.
 */
function canonicalizeForDisplay(raw: string): string {
  if (!raw) return raw;
  let s = stripParens(raw);
  const cutMatch = CUT_RE.exec(s);
  if (cutMatch && cutMatch.index > 0) {
    s = s.slice(0, cutMatch.index);
  }
  s = s.replace(STRIP_PUNCT, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const folded = foldFinals(t).toLowerCase();
    if (BLOCKED_TOKENS.has(folded)) continue;
    out.push(t);
  }
  const cleaned = out.join(' ').trim();
  return cleaned || raw.trim();
}

export interface InstructorCluster {
  clusterKey: string;
  canonicalName: string;
  rawNames: string[];
}

/**
 * Group raw instructor names into merge clusters. Two raw names cluster when:
 *  - their cleaned-token sets are equal (handles spelling/order variants), or
 *  - one name's tokens are a strict subset of exactly one other name's tokens
 *    (handles "ניר" being a short form of "ניר קציר" when there's no other Nir).
 *
 * Names with no surviving tokens (all-noise) are excluded.
 * Returns only clusters that contain ≥2 distinct raw names — i.e. merge candidates.
 */
export function buildInstructorClusters(
  rawCounts: Map<string, number>,
): InstructorCluster[] {
  interface Bucket {
    key: string;
    tokens: Set<string>;
    members: Map<string, number>;
  }

  const buckets = new Map<string, Bucket>();
  for (const [raw, count] of rawCounts) {
    const tokens = new Set(instructorTokens(raw));
    if (tokens.size === 0) continue;
    const key = [...tokens].sort().join(' ');
    let b = buckets.get(key);
    if (!b) {
      b = { key, tokens, members: new Map() };
      buckets.set(key, b);
    }
    b.members.set(raw, (b.members.get(raw) ?? 0) + count);
  }

  const all = Array.from(buckets.values()).sort((a, b) => b.tokens.size - a.tokens.size);

  // For each smaller bucket, find supersets among the larger ones.
  const redirect = new Map<string, string>(); // smallKey → bigKey
  for (const small of all) {
    const supersets = all.filter(
      (big) =>
        big.key !== small.key &&
        big.tokens.size > small.tokens.size &&
        [...small.tokens].every((t) => big.tokens.has(t)),
    );
    if (supersets.length === 1) {
      redirect.set(small.key, supersets[0].key);
    }
  }

  function resolveTarget(key: string): string {
    let cur = key;
    const seen = new Set<string>();
    while (redirect.has(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      cur = redirect.get(cur)!;
    }
    return cur;
  }

  const merged = new Map<string, Bucket>();
  for (const b of all) {
    const targetKey = resolveTarget(b.key);
    let tgt = merged.get(targetKey);
    if (!tgt) {
      const base = buckets.get(targetKey)!;
      tgt = { key: targetKey, tokens: base.tokens, members: new Map() };
      merged.set(targetKey, tgt);
    }
    for (const [raw, count] of b.members) {
      tgt.members.set(raw, (tgt.members.get(raw) ?? 0) + count);
    }
  }

  const out: InstructorCluster[] = [];
  for (const b of merged.values()) {
    if (b.members.size < 2) continue;
    // Pick the raw whose cleaned form is most "complete" and least noisy.
    const ranked = Array.from(b.members.entries())
      .map(([raw, count]) => {
        const cleanedTokens = instructorTokens(raw).length;
        const totalTokens = raw.trim().split(/\s+/).filter(Boolean).length || 1;
        return {
          raw,
          count,
          cleanedTokens,
          noiseRatio: 1 - cleanedTokens / totalTokens,
        };
      })
      .sort((a, b2) => {
        if (b2.cleanedTokens !== a.cleanedTokens) return b2.cleanedTokens - a.cleanedTokens;
        if (b2.count !== a.count) return b2.count - a.count;
        if (a.noiseRatio !== b2.noiseRatio) return a.noiseRatio - b2.noiseRatio;
        return a.raw.length - b2.raw.length;
      });
    const canonicalName = canonicalizeForDisplay(ranked[0].raw);
    const rawNames = Array.from(b.members.keys());
    out.push({ clusterKey: b.key, canonicalName, rawNames });
  }
  return out;
}
