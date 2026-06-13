// Fetches historical semester files from technion-ug-info-fetcher (gh-pages),
// and loads the current set of course ids the application already knows about
// (via the live fetchCourses() in src/services/sapApi.ts).
//
// GitHub's REST/contents API (api.github.com) is not reachable from this
// environment, but raw.githubusercontent.com is. File discovery therefore
// probes the expected `courses_{year}{semester}.json` filename pattern via
// HTTP HEAD requests rather than listing the repo directory. This naturally
// excludes *.min.js and *.without_sap_enrichment.json files, which never
// match the pattern.

import { loadTranspiledModule } from './tsModuleLoader.mjs';

const HISTORICAL_BASE_URL = 'https://raw.githubusercontent.com/michael-maltsev/technion-ug-info-fetcher/gh-pages';
const SEMESTERS = ['01', '02', '03'];

/**
 * Probes courses_{year}{semester}.json for year in [startYear, endYear] and
 * semester in ['01','02','03'], returning the ones that exist.
 */
export async function discoverHistoricalFiles({ startYear = 2010, endYear } = {}) {
  const lastYear = endYear ?? new Date().getFullYear() + 1;
  const candidates = [];

  for (let year = startYear; year <= lastYear; year++) {
    for (const semester of SEMESTERS) {
      const label = `${year}${semester}`;
      candidates.push({
        year,
        semester,
        label,
        semesterKey: year * 10 + Number(semester),
        url: `${HISTORICAL_BASE_URL}/courses_${label}.json`,
      });
    }
  }

  const checks = await Promise.all(candidates.map(async (candidate) => {
    try {
      const res = await fetch(candidate.url, { method: 'HEAD' });
      return res.ok ? candidate : null;
    } catch {
      return null;
    }
  }));

  return checks.filter((c) => c !== null).sort((a, b) => a.semesterKey - b.semesterKey);
}

/** Fetches and parses one courses_YYYYSS.json file (array of { general, schedule }). */
export async function fetchHistoricalSemester(file) {
  const res = await fetch(file.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${file.url}: ${res.status}`);
  }
  const data = await res.json();
  const records = Array.isArray(data) ? data : Object.values(data);
  return { ...file, records };
}

/** Returns the set of course ids the application currently has available. */
export async function loadCurrentCourseIds() {
  const { fetchCourses } = await loadTranspiledModule('src/services/sapApi.ts');
  const courses = await fetchCourses();
  return new Set(courses.keys());
}
