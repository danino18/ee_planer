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
import { buildSizeReport, renderTsMinified } from './sizeReport.mjs';
import { loadTranspiledModule } from './tsModuleLoader.mjs';
import { writeGeneratedFile } from './writeOutput.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HISTORICAL_COURSES_PATH = join(repoRoot, 'src/data/historicalCourses.ts');
const isDryRun = process.argv.includes('--dry-run');

async function loadExistingHistoricalCourses() {
  if (!existsSync(HISTORICAL_COURSES_PATH)) return { ids: new Set(), courses: [] };
  const mod = await loadTranspiledModule('src/data/historicalCourses.ts');
  const courses = mod.historicalFallbackCourses ?? [];
  return { ids: new Set(courses.map((course) => course.id)), courses };
}

async function main() {
  console.error('[1/6] Discovering historical semester files...');
  const files = await discoverHistoricalFiles();
  console.error(`       found ${files.length} files: ${files.map((f) => f.label).join(', ')}`);

  console.error('[2/6] Fetching historical semester data...');
  const semesterFiles = await Promise.all(files.map((file) => fetchHistoricalSemester(file)));
  const totalHistoricalRecords = semesterFiles.reduce((sum, file) => sum + file.records.length, 0);

  console.error('[3/6] Merging semesters...');
  const historical = await mergeSemesters(semesterFiles);

  console.error('[4/6] Loading current course ids (fetchCourses + existing fallbacks)...');
  const existingIds = await loadCurrentCourseIds();
  const existingHistorical = await loadExistingHistoricalCourses();

  console.error('[5/6] Building migration plan and size report...');
  const plan = await buildMigrationPlan({ historical, existingIds, existingHistoricalIds: existingHistorical.ids });
  const sizeReport = buildSizeReport(plan.toInsert);

  console.error('[6/6] Writing generated dataset...');
  const finalCourses = [...existingHistorical.courses, ...plan.toInsert];
  const content = renderTsMinified(finalCourses);
  const writeResult = await writeGeneratedFile(HISTORICAL_COURSES_PATH, content, { dryRun: isDryRun });

  const report = {
    dryRun: isDryRun,
    semesterFilesProcessed: semesterFiles.length,
    semesterFiles: semesterFiles.map((file) => file.label),
    totalHistoricalRecords,
    uniqueNormalizedHistoricalCourses: plan.uniqueHistoricalCount,
    alreadyExistingInCurrentSystem: plan.alreadyExists.length,
    missingFromCurrentSystem: plan.missingFromCurrent.length,
    previouslyInserted: existingHistorical.ids.size,
    wouldInsertCount: plan.toInsert.length,
    insertedCount: isDryRun ? 0 : plan.toInsert.length,
    rejectedCount: plan.rejections.length,
    rejections: plan.rejections,
    conversions: plan.conversions,
    conflicts: plan.conflicts,
    insertedCourseIds: plan.toInsert.map((course) => course.id),
    sizeReport,
    writeResult,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
