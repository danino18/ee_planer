import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../scripts/lib/tsImport.mjs';

const { selectPrimaryCategory, resolveStatistic } = await loadTsModule('src/domain/gradeStatistics/select.ts');

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
  assert.equal(r.semester, '202501');
  assert.equal(r.average, 90);
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
