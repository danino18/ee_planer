import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadTranspiledModule(relativePath) {
  const absolutePath = join(repoRoot, ...relativePath.split('/'));
  const source = readFileSync(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

const { getComparisonSemesterLabel, getDifferingCourseIds } = await loadTranspiledModule('src/utils/versionComparison.ts');

function versionWithSemesters(semesters) {
  return { plan: { semesters } };
}

function sortedIds(courseIds) {
  return [...courseIds].sort();
}

test('shared courses are excluded and version-only courses are included', () => {
  const courseIds = getDifferingCourseIds([
    versionWithSemesters({ 1: ['A', 'B'] }),
    versionWithSemesters({ 1: ['A'], 2: ['C'] }),
  ]);

  assert.deepEqual(sortedIds(courseIds), ['B', 'C']);
});

test('moving the same course to a different semester is not a difference', () => {
  const courseIds = getDifferingCourseIds([
    versionWithSemesters({ 1: ['A'] }),
    versionWithSemesters({ 2: ['A'] }),
  ]);

  assert.deepEqual(sortedIds(courseIds), []);
});

test('courses present in only some selected versions are different', () => {
  const courseIds = getDifferingCourseIds([
    versionWithSemesters({ 1: ['A', 'B'] }),
    versionWithSemesters({ 1: ['A', 'B', 'C'] }),
    versionWithSemesters({ 1: ['A', 'C'] }),
    versionWithSemesters({ 1: ['A', 'C'] }),
  ]);

  assert.deepEqual(sortedIds(courseIds), ['B', 'C']);
});

test('repeat appearances in one version count as one presence', () => {
  const courseIds = getDifferingCourseIds([
    versionWithSemesters({ 1: ['A', 'A', 'B'] }),
    versionWithSemesters({ 1: ['A'] }),
  ]);

  assert.deepEqual(sortedIds(courseIds), ['B']);
});

test('a single selected version has no comparable differences', () => {
  const courseIds = getDifferingCourseIds([
    versionWithSemesters({ 1: ['A', 'B'] }),
  ]);

  assert.deepEqual(sortedIds(courseIds), []);
});

test('comparison semester labels count regular semesters normally without summers', () => {
  assert.equal(getComparisonSemesterLabel(1, [1, 2, 3], []), "סמ' א'");
  assert.equal(getComparisonSemesterLabel(2, [1, 2, 3], []), "סמ' ב'");
  assert.equal(getComparisonSemesterLabel(3, [1, 2, 3], []), "סמ' ג'");
});

test('comparison semester labels skip summer semesters for regular numbering', () => {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const summers = [9, 10];

  assert.equal(getComparisonSemesterLabel(9, order, summers), "קיץ א'");
  assert.equal(getComparisonSemesterLabel(10, order, summers), "קיץ ב'");
  assert.equal(getComparisonSemesterLabel(11, order, summers), "סמ' ט'");
});

test('comparison semester labels use display order for regular semester numbering', () => {
  const order = [1, 2, 9, 3, 4];
  const summers = [9];

  assert.equal(getComparisonSemesterLabel(9, order, summers), "קיץ א'");
  assert.equal(getComparisonSemesterLabel(3, order, summers), "סמ' ג'");
  assert.equal(getComparisonSemesterLabel(4, order, summers), "סמ' ד'");
});
