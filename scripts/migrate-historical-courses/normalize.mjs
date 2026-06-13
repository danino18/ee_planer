// Course number normalization, reusing the project's canonical conversion rule
// from src/utils/courseNumberNormalize.ts (AAABBB -> 0AAA0BBB).

import { loadTranspiledModule } from './tsModuleLoader.mjs';

let normalizeModulePromise;
function getNormalizeModule() {
  if (!normalizeModulePromise) {
    normalizeModulePromise = loadTranspiledModule('src/utils/courseNumberNormalize.ts');
  }
  return normalizeModulePromise;
}

/**
 * Converts a raw course number to the canonical 8-digit SAP format.
 * Returns { ok: true, normalized, original } on success, or
 * { ok: false, reason, original } if the value cannot be converted
 * unambiguously into a valid 8-digit course number.
 */
export async function convertCourseNumber(raw) {
  if (raw === undefined || raw === null) {
    return { ok: false, reason: 'missing course number', original: raw };
  }

  const original = String(raw).replace(/\s+/g, '');
  if (!original) {
    return { ok: false, reason: 'empty course number', original: raw };
  }

  const { toSapEightDigitCourseIdForStorage } = await getNormalizeModule();
  const normalized = toSapEightDigitCourseIdForStorage(original);

  if (!/^\d{8}$/.test(normalized)) {
    return {
      ok: false,
      reason: `cannot normalize "${original}" to a valid 8-digit course number`,
      original,
    };
  }

  return { ok: true, normalized, original };
}

/**
 * Extracts all 6-8 digit course-number tokens from free text, normalizes each to
 * 8 digits, drops tokens that cannot be normalized, and de-duplicates.
 */
export async function normalizeIdList(text) {
  if (!text) return [];
  const tokens = text.match(/\d{6,8}/g) ?? [];
  const result = [];
  const seen = new Set();
  for (const token of tokens) {
    const conv = await convertCourseNumber(token);
    if (conv.ok && !seen.has(conv.normalized)) {
      seen.add(conv.normalized);
      result.push(conv.normalized);
    }
  }
  return result;
}

/**
 * Parses a prerequisites string of the form "(A ו-B) או C" into OR-groups of
 * normalized 8-digit course ids: [[A,B],[C]]. Mirrors parsePrerequisites in
 * src/services/sapApi.ts, but accepts 6-8 digit tokens (historical data uses
 * 6-digit course numbers) and normalizes each one.
 */
export async function normalizePrerequisiteGroups(text) {
  if (!text) return [];
  const orGroups = text.split(/\s+או\s+/);
  const result = [];
  for (const group of orGroups) {
    const ids = await normalizeIdList(group);
    if (ids.length > 0) result.push(ids);
  }
  return result;
}
