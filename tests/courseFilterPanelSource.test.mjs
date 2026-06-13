import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(repoRoot, ...p), 'utf8');

test('the old separate faculty buttons are removed from CourseSearch', () => {
  const source = read('src', 'components', 'CourseSearch.tsx');
  // No inline faculty option table or single-select faculty state.
  assert.doesNotMatch(source, /FACULTY_FILTER_OPTIONS/);
  assert.doesNotMatch(source, /selectedFaculty/);
  assert.doesNotMatch(source, /toggleFacultyFilter/);
  // It delegates filtering/sorting to the unified panel.
  assert.match(source, /CourseFilterPanel/);
});

test('the Subjects control is a single multi-select with select-all / clear', () => {
  const source = read('src', 'components', 'CourseFilterPanel.tsx');
  assert.match(source, /SubjectsMultiSelect/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /aria-multiselectable/);
  assert.match(source, /בחר הכל/);
  assert.match(source, /נקה/);
  // Single source of truth for subjects.
  assert.match(source, /from '\.\.\/utils\/subjects'/);
});

test('the panel exposes grade filters, sorting and a reset action', () => {
  const source = read('src', 'components', 'CourseFilterPanel.tsx');
  assert.match(source, /averageMin/);
  assert.match(source, /medianMin/);
  assert.match(source, /minStudents/);
  assert.match(source, /איפוס סינון/);
  assert.match(source, /ממוצע: מהגבוה לנמוך/);
  assert.match(source, /חציון: מהגבוה לנמוך/);
  // "Latest available" caveat is surfaced.
  assert.match(source, /עשוי להציג סמסטר שונה/);
});

test('the course card uses explicit labels (no ∅ symbol) for stats', () => {
  const source = read('src', 'components', 'CourseCard.tsx');
  assert.match(source, /ממוצע /);
  assert.match(source, /חציון /);
  assert.doesNotMatch(source, /∅/);
});
