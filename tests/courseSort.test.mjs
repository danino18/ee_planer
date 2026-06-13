import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../scripts/lib/tsImport.mjs';

const { sortCourses } = await loadTsModule('src/domain/gradeStatistics/filters.ts');

const A = { id: '00440101', name: 'Alef', credits: 3 };
const B = { id: '00440102', name: 'Bet', credits: 4 };
const C = { id: '00440103', name: 'Gimel', credits: 5 };
const D = { id: '00440104', name: 'Dalet', credits: 2 };

function statMap(map) {
  return (course) => map[course.id] ?? null;
}

const stats = {
  '00440101': { average: 70, median: 75, students: 100 },
  '00440102': { average: 90, median: 60, students: 100 },
  '00440103': { average: 80, median: 80, students: 100 },
  // D has no stat → missing.
};

test('average descending sort works', () => {
  const out = sortCourses([A, B, C, D], statMap(stats), 'average', 'desc');
  assert.deepEqual(out.map((c) => c.id), ['00440102', '00440103', '00440101', '00440104']);
});

test('average ascending sort works', () => {
  const out = sortCourses([A, B, C, D], statMap(stats), 'average', 'asc');
  assert.deepEqual(out.map((c) => c.id), ['00440101', '00440103', '00440102', '00440104']);
});

test('median descending sort works', () => {
  const out = sortCourses([A, B, C, D], statMap(stats), 'median', 'desc');
  assert.deepEqual(out.map((c) => c.id), ['00440103', '00440101', '00440102', '00440104']);
});

test('median ascending sort works', () => {
  const out = sortCourses([A, B, C, D], statMap(stats), 'median', 'asc');
  assert.deepEqual(out.map((c) => c.id), ['00440102', '00440101', '00440103', '00440104']);
});

test('missing values are always placed last (both directions)', () => {
  const asc = sortCourses([D, A, B], statMap(stats), 'average', 'asc');
  const desc = sortCourses([D, A, B], statMap(stats), 'average', 'desc');
  assert.equal(asc[asc.length - 1].id, '00440104');
  assert.equal(desc[desc.length - 1].id, '00440104');
});

test('equal values use deterministic secondary sorting (by course number)', () => {
  const tie = { '00440101': { average: 80 }, '00440102': { average: 80 }, '00440103': { average: 80 } };
  const out = sortCourses([C, A, B], statMap(tie), 'average', 'desc');
  assert.deepEqual(out.map((c) => c.id), ['00440101', '00440102', '00440103']);
});

test('default order is stable', () => {
  const out = sortCourses([C, A, D, B], statMap(stats), 'default', 'asc');
  assert.deepEqual(out.map((c) => c.id), ['00440103', '00440101', '00440104', '00440102']);
});

test('sorting does not mutate the source array', () => {
  const source = [C, A, B, D];
  const snapshot = source.map((c) => c.id);
  sortCourses(source, statMap(stats), 'average', 'desc');
  assert.deepEqual(source.map((c) => c.id), snapshot);
});
