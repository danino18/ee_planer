import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../scripts/lib/tsImport.mjs';

const {
  defaultFilters,
  matchesSubjects,
  matchesAverageRange,
  matchesMedianRange,
  matchesMinStudents,
  computeVisibleCourses,
} = await loadTsModule('src/domain/gradeStatistics/filters.ts');

const EE = '00440101';
const MATH = '01040031';
const PHYS = '01140071';
const CS = '02340114';

function stat(over = {}) {
  return { semester: '202401', category: 'Finals', average: 80, median: 82, students: 100, ...over };
}

test('selecting one subject filters correctly', () => {
  assert.equal(matchesSubjects(EE, ['ee']), true);
  assert.equal(matchesSubjects(MATH, ['ee']), false);
});

test('multiple selected subjects use OR behavior', () => {
  assert.equal(matchesSubjects(MATH, ['ee', 'math']), true);
  assert.equal(matchesSubjects(PHYS, ['ee', 'math']), false);
});

test('no selected subject means no subject filtering', () => {
  assert.equal(matchesSubjects(CS, []), true);
});

test('minimum average filtering works', () => {
  assert.equal(matchesAverageRange(stat({ average: 80 }), 75, null), true);
  assert.equal(matchesAverageRange(stat({ average: 70 }), 75, null), false);
});

test('maximum average filtering works', () => {
  assert.equal(matchesAverageRange(stat({ average: 80 }), null, 85), true);
  assert.equal(matchesAverageRange(stat({ average: 90 }), null, 85), false);
});

test('average range filtering works', () => {
  assert.equal(matchesAverageRange(stat({ average: 80 }), 70, 90), true);
  assert.equal(matchesAverageRange(stat({ average: 95 }), 70, 90), false);
});

test('median range filtering works', () => {
  assert.equal(matchesMedianRange(stat({ median: 82 }), 80, 90), true);
  assert.equal(matchesMedianRange(stat({ median: 70 }), 80, 90), false);
});

test('min-students filtering works', () => {
  assert.equal(matchesMinStudents(stat({ students: 100 }), 50), true);
  assert.equal(matchesMinStudents(stat({ students: 30 }), 50), false);
  assert.equal(matchesMinStudents(stat({ students: null }), 50), false);
});

test('courses without data are excluded only when a relevant filter is active', () => {
  assert.equal(matchesAverageRange(null, null, null), true); // inactive → kept
  assert.equal(matchesAverageRange(null, 60, null), false); // active → excluded
  assert.equal(matchesMinStudents(null, null), true);
  assert.equal(matchesMinStudents(null, 10), false);
});

test('average and median filters work together (both must pass)', () => {
  const courses = [
    { id: CS, name: 'A', credits: 3 },
    { id: EE, name: 'B', credits: 3 },
  ];
  const stats = { [CS]: stat({ average: 80, median: 82 }), [EE]: stat({ average: 80, median: 60 }) };
  const filters = { ...defaultFilters(), averageMin: 75, medianMin: 80 };
  const visible = computeVisibleCourses(courses, (c) => stats[c.id], filters);
  assert.deepEqual(visible.map((c) => c.id), [CS]);
});

test('reset filters restores the default state', () => {
  const d = defaultFilters();
  assert.deepEqual(d.subjects, []);
  assert.equal(d.statisticsSemester, 'latest');
  assert.equal(d.averageMin, null);
  assert.equal(d.sortBy, 'default');
});
