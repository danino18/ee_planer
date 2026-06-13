import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../scripts/lib/tsImport.mjs';

const { selectPrimaryCategory, resolveStatistic, computeGeneralStatistic, GENERAL_MIN_SEMESTERS } = await loadTsModule('src/domain/gradeStatistics/select.ts');

test('Finals is preferred when available', () => {
  assert.equal(selectPrimaryCategory({ Exam_A: {}, Final_A: {}, Finals: {} }), 'Finals');
});

test('Final_A used when Finals is unavailable', () => {
  assert.equal(selectPrimaryCategory({ Exam_A: {}, Final_A: {} }), 'Final_A');
});

test('Exam_A used when both finals categories are unavailable', () => {
  assert.equal(selectPrimaryCategory({ Exam_A: {}, Exam_B: {} }), 'Exam_A');
});

test('no supported category → null; arrays (Staff) ignored', () => {
  assert.equal(selectPrimaryCategory({ Staff: [], Exam_B: {} }), null);
});

function rec(semester, over = {}) {
  return { courseNumber: '02340114', semester, category: 'Finals', average: 70, median: 72, students: 100, source: 'cheesefork', ...over };
}

test('latest available selects the newest semester record', () => {
  const records = [rec('202301', { average: 60 }), rec('202501', { average: 90 }), rec('202401', { average: 75 })];
  const r = resolveStatistic(records, 'latest');
  assert.equal(r.kind, 'semester');
  assert.equal(r.semester, '202501');
  assert.equal(r.average, 90);
});

test('general aggregate averages the semester averages and medians (>= 3 semesters)', () => {
  assert.equal(GENERAL_MIN_SEMESTERS, 3);
  const records = [
    rec('202301', { average: 60, median: 62, students: 100 }),
    rec('202401', { average: 70, median: 72, students: 200 }),
    rec('202501', { average: 80, median: 79, students: 300 }),
  ];
  const g = resolveStatistic(records, 'general');
  assert.equal(g.kind, 'general');
  assert.equal(g.semester, null);
  assert.equal(g.average, 70);   // mean of 60,70,80
  assert.equal(g.median, 71);    // mean of 62,72,79 = 71
  assert.equal(g.students, 200); // mean examinees per semester (100,200,300)
  assert.equal(g.semesterCount, 3);
});

test('general aggregate ignores null fields when averaging', () => {
  const records = [
    rec('202301', { average: 60, median: null }),
    rec('202401', { average: null, median: 72 }),
    rec('202501', { average: 80, median: 78 }),
  ];
  const g = computeGeneralStatistic(records);
  assert.equal(g.average, 70); // mean of 60,80
  assert.equal(g.median, 75);  // mean of 72,78
});

test('general falls back to latest semester for fewer than 3 semesters', () => {
  const records = [rec('202301', { average: 60 }), rec('202401', { average: 90 })];
  const r = resolveStatistic(records, 'general');
  assert.equal(r.kind, 'semester');
  assert.equal(r.semester, '202401');
  assert.equal(r.average, 90);
  assert.equal(computeGeneralStatistic(records), null);
});

test('specific semester never falls back to another', () => {
  const records = [rec('202401', { average: 75 })];
  assert.equal(resolveStatistic(records, '202402'), null);
  assert.equal(resolveStatistic(records, '202401').average, 75);
});

test('selected category is retained for display', () => {
  const records = [rec('202401', { category: 'Final_A' })];
  assert.equal(resolveStatistic(records, 'latest').category, 'Final_A');
});

test('average and median can independently be unavailable', () => {
  const records = [rec('202401', { average: null, median: 72 })];
  const r = resolveStatistic(records, 'latest');
  assert.equal(r.average, null);
  assert.equal(r.median, 72);
});

test('no records → null', () => {
  assert.equal(resolveStatistic([], 'latest'), null);
  assert.equal(resolveStatistic(undefined, 'latest'), null);
});
