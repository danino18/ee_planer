/**
 * Technion course number format helpers.
 * Ported from Optigrade (https://github.com/Galsiegel/Optigrade).
 *
 * Legacy format: 6 digits (e.g. `234114`)
 * SAP format:    8 digits with zeros at positions 0 and 4 (e.g. `02340114`)
 * 7-digit:       `0` + faculty(3) + course(4) → eight digits
 *
 * Example: `234114` ↔ `02340114`; `3940800` ↔ `03940800`.
 */

const SAP_PADDED_8 = /^0(\d{3})0(\d{3})$/;

/** If `0XXX0XXX`, return legacy `XXXXXX`; otherwise return trimmed input unchanged. */
export function normalizeCourseIdKey(raw: string): string {
  const d = raw.replace(/\s+/g, '');
  const m = SAP_PADDED_8.exec(d);
  if (m) return m[1] + m[2];
  return d;
}

/**
 * Canonical id for storage: SAP `0XXX0XXX` when the id is 6 or 7 digits.
 * Already SAP-shaped values are returned as-is; other strings are returned trimmed.
 */
export function toSapEightDigitCourseIdForStorage(raw: string): string {
  const d = raw.replace(/\s+/g, '');
  if (SAP_PADDED_8.test(d)) return d;
  if (/^\d{6}$/.test(d)) return `0${d.slice(0, 3)}0${d.slice(3)}`;
  if (/^\d{7}$/.test(d)) return `0${d.slice(0, 3)}${d.slice(3)}`;
  return d;
}

/** All string variants for equality / Technion map lookup (deduped). */
export function expandCourseIdVariants(raw: string): string[] {
  const d = raw.replace(/\s+/g, '');
  const sap = toSapEightDigitCourseIdForStorage(d);
  const leg = normalizeCourseIdKey(sap);
  return [...new Set([d, sap, leg])];
}

export type StrictNormalizeResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/**
 * Strictly normalize a raw course identifier to the canonical 8-digit
 * `0XXX0XXX` form, rejecting (rather than silently passing through) anything
 * that is not a valid 6/7/8-digit Technion course number. Reuses
 * `toSapEightDigitCourseIdForStorage` for the actual conversion — it does NOT
 * reimplement the `AAABBB → 0AAA0BBB` rule, and never uses `padStart(8, …)`.
 */
export function normalizeCourseNumberStrict(raw: string): StrictNormalizeResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'not a string' };
  }
  const d = raw.replace(/\s+/g, '');
  if (d.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (!/^\d+$/.test(d)) {
    return { ok: false, reason: `non-numeric: "${raw}"` };
  }
  if (d.length === 8) {
    if (!SAP_PADDED_8.test(d)) {
      return { ok: false, reason: `malformed 8-digit (not 0XXX0XXX): "${d}"` };
    }
    return { ok: true, value: d };
  }
  if (d.length === 6 || d.length === 7) {
    return { ok: true, value: toSapEightDigitCourseIdForStorage(d) };
  }
  return { ok: false, reason: `unexpected length ${d.length}: "${d}"` };
}
