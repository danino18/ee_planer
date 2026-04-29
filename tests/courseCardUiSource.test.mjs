import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('course card exposes the remove action in the top action group', () => {
  const source = readFileSync(join(repoRoot, 'src', 'components', 'CourseCard.tsx'), 'utf8');

  assert.match(source, /absolute top-0 left-0 flex items-center/);
  assert.match(source, /relative overflow-hidden/);
  assert.doesNotMatch(source, /absolute top-0 left-0 z-10 flex items-center/);
  assert.match(source, /removeCourseFromSemester\(course\.id, semester, instanceKey\)/);
  assert.match(source, /text-xl leading-none font-semibold text-gray-300 hover:text-red-500/);
  assert.doesNotMatch(source, /absolute bottom-0 left-0/);
});

test('sport requirement help renders through a fixed portal tooltip', () => {
  const source = readFileSync(join(repoRoot, 'src', 'components', 'RequirementsPanel.tsx'), 'utf8');

  assert.match(source, /createPortal/);
  assert.match(source, /document\.body/);
  assert.match(source, /className="fixed z-\[200\]/);
  assert.match(source, /getBoundingClientRect\(\)/);
});
