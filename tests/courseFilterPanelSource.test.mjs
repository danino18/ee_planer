import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(repoRoot, ...p), 'utf8');

test('the old separate faculty buttons are removed from CourseSearch', () => {
  const source = read('src', 'components', 'CourseSearch.tsx');
  assert.doesNotMatch(source, /FACULTY_FILTER_OPTIONS/);
  assert.doesNotMatch(source, /selectedFaculty/);
  assert.doesNotMatch(source, /toggleFacultyFilter/);
  assert.match(source, /CourseFilterPanel/);
});

test('filters render as a compact wrapping toolbar (no permanent open panel)', () => {
  const source = read('src', 'components', 'CourseFilterPanel.tsx');
  assert.match(source, /flex flex-wrap items-center/);   // toolbar row
  assert.match(source, /ChipPopover/);                    // popover-based controls
  // No always-open bordered panel that pushes content down.
  assert.doesNotMatch(source, /md:block px-3 pb-3/);
  assert.doesNotMatch(source, /\[expanded\]/);
});

test('the Subjects control is a single accessible multi-select with select-all / clear', () => {
  const source = read('src', 'components', 'CourseFilterPanel.tsx');
  assert.match(source, /SubjectsChip/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /בחר הכל/);
  assert.match(source, /נקה/);
  assert.match(source, /from '\.\.\/utils\/subjects'/);
});

test('the toolbar exposes min-only grade filters, the כללי mode, sorting and reset', () => {
  const source = read('src', 'components', 'CourseFilterPanel.tsx');
  assert.match(source, /GradeStatsChip/);
  assert.match(source, /averageMin/);
  assert.match(source, /medianMin/);
  assert.match(source, /minStudents/);
  assert.match(source, /value="general">כללי/);     // כללי mode option
  assert.match(source, /איפוס סינון/);
  assert.match(source, /ממוצע: מהגבוה לנמוך/);
  assert.match(source, /חציון: מהגבוה לנמוך/);
  assert.match(source, /עשוי להציג סמסטר שונה/);
});

test('the course card uses explicit labels incl. general (no ∅ symbol)', () => {
  const source = read('src', 'components', 'CourseCard.tsx');
  assert.match(source, /ממוצע כללי/);
  assert.match(source, /חציון כללי/);
  assert.doesNotMatch(source, /∅/);
});
