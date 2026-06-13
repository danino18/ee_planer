#!/usr/bin/env node
// One-time migration: import historical Technion courses from
// michael-maltsev/technion-ug-info-fetcher (gh-pages) that no longer exist in
// the current SAP catalog.
//
// Usage:
//   node scripts/migrate-historical-courses/run.mjs --dry-run
//   node scripts/migrate-historical-courses/run.mjs
//
// This is a self-contained, removable migration. It does not become part of
// the regular SAP sync flow (src/services/sapApi.ts's fetchCourses is only
// read here, never modified).

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverHistoricalFiles, fetchHistoricalSemester, loadCurrentCourseIds } from './fetchData.mjs';
import { mergeSemesters } from './merge.mjs';
import { buildMigrationPlan } from './plan.mjs';
import { buildSizeReport } from './sizeReport.mjs';
import { loadTranspiledModule } from './tsModuleLoader.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HISTORICAL_COURSES_PATH = join(repoRoot, 'src/data/historicalCourses.ts');
const isDryRun = process.argv.includes('--dry-run');

async function loadExistingHistoricalIds() {
  if (!existsSync(HISTORICAL_COURSES_PATH)) return new Set();
  const mod = await loadTranspiledModule('src/data/historicalCourses.ts');
  const list = mod.historicalFallbackCourses ?? [];
  return new Set(list.map((course) => course.id));
}

async function main() {
  console.error('[1/5] Discovering historical semester files...');
  const files = await discoverHistoricalFiles();
  console.error(`       found ${files.length} files: ${files.map((f) => f.label).join(', ')}`);

  console.error('[2/5] Fetching historical semester data...');
  const semesterFiles = await Promise.all(files.map((file) => fetchHistoricalSemester(file)));
  const totalHistoricalRecords = semesterFiles.reduce((sum, file) => sum + file.records.length, 0);

  console.error('[3/5] Merging semesters...');
  const historical = await mergeSemesters(semesterFiles);

  console.error('[4/5] Loading current course ids (fetchCourses + existing fallbacks)...');
  const existingIds = await loadCurrentCourseIds();
  const existingHistoricalIds = await loadExistingHistoricalIds();

  console.error('[5/5] Building migration plan and size report...');
  const plan = await buildMigrationPlan({ historical, existingIds, existingHistoricalIds });
  const sizeReport = buildSizeReport(plan.toInsert);

  const report = {
    dryRun: isDryRun,
    semesterFilesProcessed: semesterFiles.length,
    semesterFiles: semesterFiles.map((file) => file.label),
    totalHistoricalRecords,
    uniqueNormalizedHistoricalCourses: plan.uniqueHistoricalCount,
    alreadyExistingInCurrentSystem: plan.alreadyExists.length,
    missingFromCurrentSystem: plan.missingFromCurrent.length,
    previouslyInserted: existingHistoricalIds.size,
    wouldInsertCount: plan.toInsert.length,
    insertedCount: isDryRun ? 0 : plan.toInsert.length,
    rejectedCount: plan.rejections.length,
    rejections: plan.rejections,
    conversions: plan.conversions,
    conflicts: plan.conflicts,
    insertedCourseIds: plan.toInsert.map((course) => course.id),
    sizeReport,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!isDryRun) {
    console.error('Real-run write step is not implemented yet (storage format pending decision); no files written.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
