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
