import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const transpiledModuleUrls = new Map();

function resolveTypeScriptModule(fromDir, specifier) {
  const basePath = resolve(fromDir, specifier);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
    basePath,
  ];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(`Unable to resolve module "${specifier}" from ${fromDir}`);
  }
  return resolvedPath;
}

function transpileToDataUrl(absolutePath) {
  const cached = transpiledModuleUrls.get(absolutePath);
  if (cached) return cached;

  const source = readFileSync(absolutePath, 'utf8');
  let transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const specifiers = [...transpiled.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'));

  for (const specifier of new Set(specifiers)) {
    const dependencyPath = resolveTypeScriptModule(dirname(absolutePath), specifier);
    const dependencyUrl = transpileToDataUrl(dependencyPath);
    transpiled = transpiled
      .replaceAll(`'${specifier}'`, `'${dependencyUrl}'`)
      .replaceAll(`"${specifier}"`, `"${dependencyUrl}"`);
  }

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  transpiledModuleUrls.set(absolutePath, moduleUrl);
  return moduleUrl;
}

function loadTranspiledModule(relativePath) {
  const absolutePath = join(repoRoot, ...relativePath.split('/'));
  return import(transpileToDataUrl(absolutePath));
}

const {
  computeContainingSubstitutions,
  buildContainingMaps,
} = await loadTranspiledModule('src/domain/containingCourse.ts');
const {
  computeNoAdditionalCreditConflicts,
  getNoAdditionalCreditCourseIds,
  getNoAdditionalCreditPairKey,
} = await loadTranspiledModule('src/domain/noAdditionalCredit.ts');

// X = contained mandatory course (אלגברה 1/מורחב), Y = containing course (אלגברה אמ').
function makeCourses() {
  return new Map([
    ['01040016', {
      id: '01040016',
      name: 'אלגברה 1/מורחב',
      credits: 5.5,
      prerequisites: [],
      faculty: 'מתמטיקה',
    }],
    ['01040166', {
      id: '01040166',
      name: "אלגברה אמ'",
      credits: 5,
      prerequisites: [],
      containedCourseIds: ['01040016', '01040064', '01040065'],
      faculty: 'מתמטיקה',
    }],
  ]);
}

const mandatoryIds = new Set(['01040016']);

function makeInput(overrides = {}) {
  const semesters = overrides.semesters ?? { 1: ['01040166'] };
  const completedCourses = overrides.completedCourses ?? [];
  const placedIds = new Set([...completedCourses, ...Object.values(semesters).flat()]);
  return {
    completedCourses,
    semesters,
    semesterOrder: overrides.semesterOrder ?? Object.keys(semesters).map(Number),
    mandatoryIds,
    placedIds,
    noAdditionalCreditCourseIds: overrides.noAdditionalCreditCourseIds ?? new Set(),
  };
}

test('containing course fills the mandatory slot of an unplaced contained course', () => {
  const subs = computeContainingSubstitutions(makeCourses(), makeInput());
  assert.equal(subs.length, 1);
  assert.deepEqual(subs[0], {
    containingCourseId: '01040166',
    containedCourseId: '01040016',
    mandatoryCredits: 5, // min(5.5, 5) — capped at the smaller course
    excessCredits: 0,    // 5 - 5.5 clamped to 0
  });

  const { mandatoryCreditByContainer, filledMandatoryIds } = buildContainingMaps(subs);
  assert.equal(mandatoryCreditByContainer.get('01040166'), 5);
  assert.ok(filledMandatoryIds.has('01040016'));
});

test('excess credits spill to free choice when the containing course is larger', () => {
  const courses = makeCourses();
  courses.get('01040166').credits = 7; // larger than the 5.5 contained course
  const subs = computeContainingSubstitutions(courses, makeInput());
  assert.equal(subs[0].mandatoryCredits, 5.5);
  assert.equal(subs[0].excessCredits, 1.5);
});

test('no substitution when the contained course is itself placed (and keeps its credit)', () => {
  const subs = computeContainingSubstitutions(
    makeCourses(),
    makeInput({ semesters: { 1: ['01040166', '01040016'] } }),
  );
  assert.deepEqual(subs, []);
});

test('substitution applies when both placed but the contained course lost credit via NAC', () => {
  // Both placed → the contains relationship is a NAC conflict. By default the later
  // course (01040016 in sem 2) loses credit, so 01040166 should fill the slot.
  const courses = makeCourses();
  const nacInput = {
    completedCourses: [],
    semesters: { 1: ['01040166'], 2: ['01040016'] },
    semesterOrder: [1, 2],
  };
  const noAdditionalCreditCourseIds = getNoAdditionalCreditCourseIds(
    computeNoAdditionalCreditConflicts(courses, nacInput),
  );
  assert.ok(noAdditionalCreditCourseIds.has('01040016'));

  const subs = computeContainingSubstitutions(courses, {
    ...nacInput,
    mandatoryIds,
    placedIds: new Set(['01040166', '01040016']),
    noAdditionalCreditCourseIds,
  });
  assert.equal(subs.length, 1);
  assert.equal(subs[0].containingCourseId, '01040166');
});

test('a containing course fills at most one mandatory slot', () => {
  const courses = makeCourses();
  // Make two of the contained courses mandatory in the track.
  courses.set('01040064', { id: '01040064', name: 'אלגברה 1מ1', credits: 4, prerequisites: [], faculty: 'מתמטיקה' });
  const subs = computeContainingSubstitutions(courses, {
    ...makeInput(),
    mandatoryIds: new Set(['01040016', '01040064']),
  });
  assert.equal(subs.length, 1); // only one slot filled
});

test('a containing course that lost credit via NAC does not fill a slot', () => {
  const subs = computeContainingSubstitutions(
    makeCourses(),
    makeInput({ noAdditionalCreditCourseIds: new Set(['01040166']) }),
  );
  assert.deepEqual(subs, []);
});

test('contains relationship is treated as a no-additional-credit conflict when both placed', () => {
  const courses = makeCourses();
  const pairKey = getNoAdditionalCreditPairKey('01040166', '01040016');
  const conflicts = computeNoAdditionalCreditConflicts(courses, {
    completedCourses: [],
    semesters: { 1: ['01040166'], 2: ['01040016'] },
    semesterOrder: [1, 2],
  });
  assert.deepEqual([...getNoAdditionalCreditCourseIds(conflicts)], ['01040016']);
  // The override mechanism can flip which one keeps credit.
  const flipped = computeNoAdditionalCreditConflicts(courses, {
    completedCourses: [],
    semesters: { 1: ['01040166'], 2: ['01040016'] },
    semesterOrder: [1, 2],
    noAdditionalCreditOverrides: { [pairKey]: '01040166' },
  });
  assert.deepEqual([...getNoAdditionalCreditCourseIds(flipped)], ['01040166']);
});
