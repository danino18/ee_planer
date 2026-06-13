import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { convertCourseNumber, normalizeIdList, normalizePrerequisiteGroups } from '../scripts/migrate-historical-courses/normalize.mjs';
import { mapGeneralToSapCourse } from '../scripts/migrate-historical-courses/transform.mjs';
import { mergeSemesters } from '../scripts/migrate-historical-courses/merge.mjs';
import { buildMigrationPlan } from '../scripts/migrate-historical-courses/plan.mjs';
import { writeGeneratedFile } from '../scripts/migrate-historical-courses/writeOutput.mjs';

function semesterFile(label, semesterKey, records) {
  return { label, semesterKey, records };
}

function generalRecord(overrides = {}) {
  return {
    'מספר מקצוע': '999999',
    'שם מקצוע': 'קורס',
    'נקודות': '3',
    'פקולטה': 'חשמל',
    ...overrides,
  };
}

// 1. 234122 -> 02340122
test('converts a 6-digit course number using the AAABBB -> 0AAA0BBB rule', async () => {
  const result = await convertCourseNumber('234122');
  assert.equal(result.ok, true);
  assert.equal(result.normalized, '02340122');
});

// 2. 044101 -> 00440101, leading zeros preserved
test('converts a 6-digit course number with leading zeros', async () => {
  const result = await convertCourseNumber('044101');
  assert.equal(result.ok, true);
  assert.equal(result.normalized, '00440101');
});

// 3. valid 8-digit course number remains unchanged
test('leaves a valid 8-digit course number unchanged', async () => {
  const result = await convertCourseNumber('01040824');
  assert.equal(result.ok, true);
  assert.equal(result.normalized, '01040824');
});

// 4. invalid course number is rejected
test('rejects a course number that cannot be normalized to 8 digits', async () => {
  const result = await convertCourseNumber('1234');
  assert.equal(result.ok, false);
  assert.match(result.reason, /cannot normalize/);

  const nonNumeric = await convertCourseNumber('ABC123');
  assert.equal(nonNumeric.ok, false);
});

// 10. course numbers remain strings and preserve leading zeros
test('normalized course numbers are strings with leading zeros preserved', async () => {
  const result = await convertCourseNumber('044101');
  assert.equal(typeof result.normalized, 'string');
  assert.equal(result.normalized[0], '0');
  assert.equal(result.normalized.length, 8);
});

// 11. prerequisite and related-course identifiers normalized to 8 digits
test('normalizes 6-digit prerequisite references to 8 digits, grouped by OR', async () => {
  const groups = await normalizePrerequisiteGroups('104004 או 104022 או 104044');
  assert.deepEqual(groups, [['01040004'], ['01040022'], ['01040044']]);
});

test('normalizes AND-groups within a single OR alternative', async () => {
  const groups = await normalizePrerequisiteGroups('234114 044141 או 104004');
  assert.deepEqual(groups, [['02340114', '00440141'], ['01040004']]);
});

test('normalizes a list of equivalent/no-additional-credit course ids', async () => {
  const ids = await normalizeIdList('034058 094480 094481');
  assert.deepEqual(ids, ['00340058', '00940480', '00940481']);
});

// 12. mapGeneralToSapCourse produces only the supported fields (no syllabus/exam/schedule)
test('mapGeneralToSapCourse maps only the supported SapCourse fields', async () => {
  const general = generalRecord({
    'מספר מקצוע': '044101',
    'שם מקצוע': 'מבוא לחשמל',
    'נקודות': '5',
    'סילבוס': 'should not be imported',
    'מועד א': '01-01-2023 09:00',
    'מועד ב': '01-02-2023 09:00',
    'מקצועות צמודים': '044102',
    'הרצאה': '3',
    'תרגיל': '1',
    'הערות': 'some note',
  });

  const course = await mapGeneralToSapCourse(general, '00440101');

  assert.deepEqual(Object.keys(course).sort(), [
    'containedCourseIds',
    'credits',
    'faculty',
    'id',
    'name',
    'noAdditionalCreditIds',
    'prerequisites',
  ].sort());

  assert.equal(course.id, '00440101');
  assert.equal(course.name, 'מבוא לחשמל');
  assert.equal(course.credits, 5);
  assert.equal(course.faculty, 'חשמל');
  assert.ok(!('syllabus' in course));
  assert.ok(!('examMoed1' in course));
  assert.ok(!('examMoed2' in course));
  assert.ok(!('schedule' in course));
});

// 6. course appearing in several semester files is inserted only once
test('mergeSemesters de-duplicates a course appearing in multiple semesters', async () => {
  const files = [
    semesterFile('202201', 20221, [{ general: generalRecord({ 'מספר מקצוע': '044101', 'שם מקצוע': 'ישן' }) }]),
    semesterFile('202301', 20231, [{ general: generalRecord({ 'מספר מקצוע': '044101', 'שם מקצוע': 'חדש' }) }]),
  ];

  const result = await mergeSemesters(files);
  assert.equal(result.courses.size, 1);
  assert.equal(result.courses.get('00440101').name, 'חדש');
});

// 7. the most recent semester version is selected as the primary record
test('mergeSemesters prefers the newest semester as the primary record', async () => {
  const files = [
    semesterFile('201701', 20171, [{ general: generalRecord({ 'מספר מקצוע': '044101', 'שם מקצוע': 'ישן', 'נקודות': '3' }) }]),
    semesterFile('202301', 20231, [{ general: generalRecord({ 'מספר מקצוע': '044101', 'שם מקצוע': 'חדש', 'נקודות': '4' }) }]),
  ];

  const result = await mergeSemesters(files);
  const course = result.courses.get('00440101');
  assert.equal(course.name, 'חדש');
  assert.equal(course.credits, 4);
  assert.equal(result.latestSemesterById.get('00440101'), '202301');
});

// 8. missing fields completed from older records without overwriting newer values
test('mergeSemesters fills missing fields from an older record without overwriting newer non-empty fields', async () => {
  const files = [
    semesterFile('201701', 20171, [{
      general: generalRecord({
        'מספר מקצוע': '044101',
        'שם מקצוע': 'ישן',
        'נקודות': '3',
        'מקצועות ללא זיכוי נוסף': '034058',
      }),
    }]),
    semesterFile('202301', 20231, [{
      general: generalRecord({
        'מספר מקצוע': '044101',
        'שם מקצוע': 'חדש',
        'נקודות': '4',
        // no 'מקצועות ללא זיכוי נוסף' field -> missing in the newer record
      }),
    }]),
  ];

  const result = await mergeSemesters(files);
  const course = result.courses.get('00440101');

  // newer non-empty values are kept
  assert.equal(course.name, 'חדש');
  assert.equal(course.credits, 4);
  // missing field is completed from the older record
  assert.deepEqual(course.noAdditionalCreditIds, ['00340058']);
});

test('mergeSemesters records a conflict when both versions provide differing non-empty values', async () => {
  const files = [
    semesterFile('201701', 20171, [{ general: generalRecord({ 'מספר מקצוע': '044101', 'פקולטה': 'פקולטה א' }) }]),
    semesterFile('202301', 20231, [{ general: generalRecord({ 'מספר מקצוע': '044101', 'פקולטה': 'פקולטה ב' }) }]),
  ];

  const result = await mergeSemesters(files);
  assert.equal(result.courses.get('00440101').faculty, 'פקולטה ב');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].id, '00440101');
  const facultyConflict = result.conflicts[0].fields.find((f) => f.field === 'faculty');
  assert.equal(facultyConflict.kept, 'פקולטה ב');
  assert.equal(facultyConflict.discarded, 'פקולטה א');
});

// 4 (record-level). invalid course number in source data is rejected, not inserted
test('mergeSemesters rejects records whose own course number cannot be normalized', async () => {
  const files = [
    semesterFile('202301', 20231, [
      { general: generalRecord({ 'מספר מקצוע': '044101' }) },
      { general: generalRecord({ 'מספר מקצוע': '1234', 'שם מקצוע': 'לא תקין' }) },
    ]),
  ];

  const result = await mergeSemesters(files);
  assert.equal(result.courses.size, 1);
  assert.equal(result.rejections.length, 1);
  assert.equal(result.rejections[0].original, '1234');
  assert.match(result.rejections[0].reason, /cannot normalize/);
});

// 5. an existing SAP course is not inserted again
test('buildMigrationPlan does not insert a course whose id already exists in the current system', async () => {
  const files = [
    semesterFile('202301', 20231, [
      { general: generalRecord({ 'מספר מקצוע': '044101', 'שם מקצוע': 'קיים' }) },
      { general: generalRecord({ 'מספר מקצוע': '044102', 'שם מקצוע': 'חדש' }) },
    ]),
  ];

  const historical = await mergeSemesters(files);
  const plan = await buildMigrationPlan({ historical, existingIds: ['00440101'] });

  assert.deepEqual(plan.alreadyExists, ['00440101']);
  assert.equal(plan.toInsert.length, 1);
  assert.equal(plan.toInsert[0].id, '00440102');
});

// 13. existing courses are not updated or modified
test('buildMigrationPlan leaves existing course ids out of toInsert entirely', async () => {
  const files = [
    semesterFile('202301', 20231, [
      { general: generalRecord({ 'מספר מקצוע': '044101', 'שם מקצוע': 'גרסה היסטורית' }) },
    ]),
  ];

  const existingIds = ['00440101'];
  const historical = await mergeSemesters(files);
  const plan = await buildMigrationPlan({ historical, existingIds });

  assert.ok(!plan.toInsert.some((c) => c.id === '00440101'));
  // existingIds is untouched
  assert.deepEqual(existingIds, ['00440101']);
});

// 9. running the migration twice does not create additional records
test('buildMigrationPlan produces zero new inserts on a second run', async () => {
  const files = [
    semesterFile('202301', 20231, [
      { general: generalRecord({ 'מספר מקצוע': '044102', 'שם מקצוע': 'חדש' }) },
    ]),
  ];

  const historical = await mergeSemesters(files);

  const firstPlan = await buildMigrationPlan({ historical, existingIds: ['00440101'] });
  assert.equal(firstPlan.toInsert.length, 1);

  const existingHistoricalIds = new Set(firstPlan.toInsert.map((c) => c.id));
  const secondPlan = await buildMigrationPlan({ historical, existingIds: ['00440101'], existingHistoricalIds });

  assert.equal(secondPlan.toInsert.length, 0);
  // still correctly reported as missing from current SAP
  assert.equal(secondPlan.missingFromCurrent.length, 1);
});

// 14. dry-run mode performs no writes
test('writeGeneratedFile performs no filesystem writes in dry-run mode', async () => {
  const path = join(tmpdir(), `historical-courses-dry-run-${process.pid}.ts`);
  rmSync(path, { force: true });

  const dryResult = await writeGeneratedFile(path, 'export const x = 1;', { dryRun: true });
  assert.equal(dryResult.written, false);
  assert.equal(existsSync(path), false);

  const realResult = await writeGeneratedFile(path, 'export const x = 1;', { dryRun: false });
  assert.equal(realResult.written, true);
  assert.equal(existsSync(path), true);
  assert.equal(readFileSync(path, 'utf8'), 'export const x = 1;');

  rmSync(path, { force: true });
});
