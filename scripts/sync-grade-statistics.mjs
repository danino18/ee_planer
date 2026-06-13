/**
 * Grade-statistics synchronization.
 *
 * Discovers Technion course numbers from the public
 * michael-maltsev/technion-histograms data (the same data CheeseFork consumes),
 * fetches each course's machine-readable histogram JSON, parses the primary
 * grade statistic per semester, and writes a minimal dataset to
 * `public/grade-statistics.json`.
 *
 * Idempotent and independent of the SAP sync. The app reads only the generated
 * file at runtime; this script is the only thing that talks to GitHub.
 *
 * Usage:
 *   node scripts/sync-grade-statistics.mjs [--dry-run] [--limit N]
 *        [--courses 234114,044101] [--base <url>] [--concurrency N]
 */
import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule } from './lib/tsImport.mjs';

const { parseCourseHistogram } = await loadTsModule('src/domain/gradeStatistics/parse.ts');
const { normalizeCourseNumberStrict } = await loadTsModule('src/utils/courseNumberNormalize.ts');

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(rootDir, '../public/grade-statistics.json');

const DEFAULT_BASE =
  process.env.GRADE_STATS_BASE ||
  'https://raw.githubusercontent.com/michael-maltsev/technion-histograms/gh-pages';
const USER_AGENT = 'technion-ee-planner-grade-sync/1.0';
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRIES = 4;

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, courses: null, base: DEFAULT_BASE, concurrency: 16 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--courses') args.courses = argv[++i];
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch JSON with retry/backoff. Returns:
 *   { status: 'ok', json }        on 200 + valid JSON
 *   { status: 'missing' }         on 404 (no histogram data)
 *   { status: 'malformed', reason } on invalid JSON
 *   { status: 'failed', reason }  on exhausted retries / other HTTP errors
 */
async function fetchCourseJson(url) {
  let lastReason = 'unknown';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchText(url);
      if (res.status === 404) return { status: 'missing' };
      if (res.ok) {
        const text = await res.text();
        try {
          return { status: 'ok', json: JSON.parse(text) };
        } catch (e) {
          return { status: 'malformed', reason: `invalid JSON: ${e.message}` };
        }
      }
      lastReason = `HTTP ${res.status}`;
      // 5xx / 429 are retryable; other 4xx are not.
      if (res.status < 500 && res.status !== 429) {
        return { status: 'failed', reason: lastReason };
      }
    } catch (e) {
      lastReason = e.name === 'AbortError' ? 'timeout' : e.message;
    }
    if (attempt < MAX_RETRIES) await sleep(2000 * 2 ** attempt);
  }
  return { status: 'failed', reason: lastReason };
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function discoverCourseNumbers(base) {
  const res = await fetchText(`${base}/README.md`);
  if (!res.ok) throw new Error(`Failed to fetch manifest README.md: HTTP ${res.status}`);
  const text = await res.text();
  const numbers = [...text.matchAll(/\]\((\d{8})\/\)/g)].map((m) => m[1]);
  return [...new Set(numbers)];
}

function toRawRecord(record) {
  return {
    semester: record.semester,
    category: record.category,
    average: record.average,
    median: record.median,
    students: record.students,
  };
}

function recordsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.semester !== y.semester || x.category !== y.category ||
      x.average !== y.average || x.median !== y.median || x.students !== y.students
    ) return false;
  }
  return true;
}

async function readExisting() {
  try {
    const text = await readFile(OUTPUT_PATH, 'utf8');
    const parsed = JSON.parse(text);
    return parsed.courses ?? {};
  } catch {
    return {};
  }
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const report = {
    coursesChecked: 0,
    coursesWithStats: 0,
    coursesWithoutStats: 0,
    semesterRecords: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    fieldsNulled: 0,
    rejectedCourses: 0,
    requestFailures: 0,
    failureReasons: {},
    nulledReasons: {},
  };
  const addFailure = (reason) => { report.failureReasons[reason] = (report.failureReasons[reason] ?? 0) + 1; };
  const addNulled = (reason) => { report.nulledReasons[reason] = (report.nulledReasons[reason] ?? 0) + 1; };

  console.error(`Grade-statistics sync — base: ${args.base}${args.dryRun ? ' (dry-run)' : ''}`);

  // 1. Discover / receive course numbers, strict-normalize them.
  let rawNumbers;
  if (args.courses) {
    rawNumbers = args.courses.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    console.error('Discovering course numbers from manifest…');
    rawNumbers = await discoverCourseNumbers(args.base);
  }

  const courseNumbers = [];
  for (const raw of rawNumbers) {
    const norm = normalizeCourseNumberStrict(raw);
    if (!norm.ok) {
      report.rejectedCourses++;
      addFailure(`normalize: ${norm.reason}`);
      continue;
    }
    courseNumbers.push(norm.value);
  }
  const unique = [...new Set(courseNumbers)];
  const targets = args.limit ? unique.slice(0, args.limit) : unique;
  console.error(`Fetching ${targets.length} course(s) with concurrency ${args.concurrency}…`);

  const existing = await readExisting();
  const output = {};
  let done = 0;

  await runPool(targets, args.concurrency, async (courseNumber) => {
    report.coursesChecked++;
    const url = `${args.base}/${courseNumber}/index.min.json`;
    const result = await fetchCourseJson(url);

    if (result.status === 'missing') {
      report.coursesWithoutStats++;
    } else if (result.status === 'failed') {
      report.requestFailures++;
      addFailure(result.reason);
    } else if (result.status === 'malformed') {
      report.requestFailures++;
      addFailure(result.reason);
    } else {
      const { records, warnings } = parseCourseHistogram(courseNumber, result.json);
      for (const w of warnings) { report.fieldsNulled++; addNulled(`${w.field}: ${w.reason}`); }
      if (records.length > 0) {
        records.sort((a, b) => (a.semester < b.semester ? 1 : a.semester > b.semester ? -1 : 0));
        output[courseNumber] = records.map(toRawRecord);
        report.coursesWithStats++;
        report.semesterRecords += records.length;
      } else {
        report.coursesWithoutStats++;
      }
    }

    done++;
    if (done % 200 === 0 || done === targets.length) {
      console.error(`  …${done}/${targets.length} (with stats: ${report.coursesWithStats})`);
    }
  });

  // 2. Diff against existing dataset (insert / update / unchanged).
  for (const [courseNumber, records] of Object.entries(output)) {
    const prev = existing[courseNumber];
    if (!prev) report.inserted++;
    else if (recordsEqual(prev, records)) report.unchanged++;
    else report.updated++;
  }

  // Stable ordering: sort courses by number for deterministic output.
  const sortedCourses = {};
  for (const key of Object.keys(output).sort()) sortedCourses[key] = output[key];

  const dataset = {
    generatedAt: new Date().toISOString(),
    source: 'technion-histograms',
    courses: sortedCourses,
  };

  const minified = JSON.stringify(dataset);
  const pretty = JSON.stringify(dataset, null, 2);
  const gzipped = gzipSync(minified);

  if (!args.dryRun) {
    await writeFile(OUTPUT_PATH, minified, 'utf8');
  }

  // 3. Report.
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const courseCount = Object.keys(sortedCourses).length;
  const recordCount = Object.values(sortedCourses).reduce((n, r) => n + r.length, 0);

  console.error('\n──────── Import report ────────');
  console.error(`Courses checked:        ${report.coursesChecked}`);
  console.error(`  with statistics:      ${report.coursesWithStats}`);
  console.error(`  without statistics:   ${report.coursesWithoutStats}`);
  console.error(`Semester records found: ${report.semesterRecords}`);
  console.error(`Records inserted:       ${report.inserted}`);
  console.error(`Records updated:        ${report.updated}`);
  console.error(`Records unchanged:      ${report.unchanged}`);
  console.error(`Fields nulled:          ${report.fieldsNulled}`);
  console.error(`Rejected course ids:    ${report.rejectedCourses}`);
  console.error(`Request failures:       ${report.requestFailures}`);
  if (Object.keys(report.failureReasons).length) {
    console.error('Failure reasons:');
    for (const [reason, count] of Object.entries(report.failureReasons)) console.error(`  - ${reason}: ${count}`);
  }
  if (Object.keys(report.nulledReasons).length) {
    console.error('Nulled-field reasons (top 10):');
    for (const [reason, count] of Object.entries(report.nulledReasons).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.error(`  - ${reason}: ${count}`);
    }
  }
  console.error('Generated dataset:');
  console.error(`  courses:     ${courseCount}`);
  console.error(`  records:     ${recordCount}`);
  console.error(`  raw (pretty):${fmtBytes(Buffer.byteLength(pretty))}`);
  console.error(`  minified:    ${fmtBytes(Buffer.byteLength(minified))}`);
  console.error(`  gzip:        ${fmtBytes(gzipped.length)}`);
  console.error(`Total time:   ${elapsed}s`);
  console.error(args.dryRun ? '(dry-run — file not written)' : `Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
