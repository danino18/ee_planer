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
  computeNoAdditionalCreditConflicts,
  getNoAdditionalCreditCourseIds,
  getNoAdditionalCreditPairKey,
} = await loadTranspiledModule('src/domain/noAdditionalCredit.ts');
const { computeWeightedAverage } = await loadTranspiledModule('src/utils/courseGrades.ts');
const { buildCourseAssignments } = await loadTranspiledModule('src/domain/degreeCompletion/helpers.ts');

function makeCourses() {
  return new Map([
    ['00440252', {
      id: '00440252',
      name: 'מערכות ספרתיות ומבנה המחשב',
      credits: 5,
      prerequisites: [],
      noAdditionalCreditIds: ['00440262'],
      faculty: 'הפקולטה להנדסת חשמל ומחשבים',
    }],
    ['00440262', {
      id: '00440262',
      name: 'תכן לוגי ומבוא למחשבים',
      credits: 3.5,
      prerequisites: [],
      noAdditionalCreditIds: ['00440252'],
      faculty: 'הפקולטה להנדסת חשמל ומחשבים',
    }],
  ]);
}

function makeInput(overrides = {}) {
  return {
    completedCourses: [],
    semesters: {
      1: ['00440252'],
      2: ['00440262'],
    },
    semesterOrder: [1, 2],
    ...overrides,
  };
}

test('later course receives no additional credit by default', () => {
  const courses = makeCourses();
  const conflicts = computeNoAdditionalCreditConflicts(courses, makeInput());

  assert.deepEqual([...getNoAdditionalCreditCourseIds(conflicts)], ['00440262']);
  assert.equal(conflicts.get('00440262')?.[0].conflictingCourseId, '00440252');
});

test('override can move no additional credit to the earlier course', () => {
  const courses = makeCourses();
  const pairKey = getNoAdditionalCreditPairKey('00440252', '00440262');
  const conflicts = computeNoAdditionalCreditConflicts(
    courses,
    makeInput({ noAdditionalCreditOverrides: { [pairKey]: '00440252' } }),
  );

  assert.deepEqual([...getNoAdditionalCreditCourseIds(conflicts)], ['00440252']);
  assert.equal(conflicts.get('00440252')?.[0].conflictingCourseId, '00440262');
});

test('weighted average excludes courses without additional credit', () => {
  const courses = makeCourses();
  const conflicts = computeNoAdditionalCreditConflicts(courses, makeInput());
  const noAdditionalCreditCourseIds = getNoAdditionalCreditCourseIds(conflicts);

  const average = computeWeightedAverage({
    semesters: {
      1: ['00440252'],
      2: ['00440262'],
    },
    grades: {
      '00440252': 80,
      '00440262': 100,
    },
    binaryPass: {},
    noAdditionalCreditCourseIds,
  }, courses);

  assert.equal(average, 80);
});

test('degree course assignments mark the uncredited conflicting course as uncounted', () => {
  const courses = makeCourses();
  const trackDef = {
    id: 'ee',
    name: 'test',
    totalCreditsRequired: 8.5,
    mandatoryCredits: 0,
    electiveCreditsRequired: 8.5,
    generalCreditsRequired: 0,
    semesterSchedule: [],
    specializationGroupsRequired: 0,
    description: '',
  };
  const catalog = {
    trackId: 'ee',
    trackFolder: '',
    groups: [],
    diagnostics: [],
    hasErrors: false,
    interactionDisabled: false,
  };
  const assignments = buildCourseAssignments(
    {
      ...makeInput(),
      explicitSportCompletions: [],
      completedInstances: [],
      grades: {},
      binaryPass: {},
      selectedSpecializations: [],
      doubleSpecializations: [],
      hasEnglishExemption: false,
      miluimCredits: 0,
      englishScore: undefined,
      englishTaughtCourses: [],
      coreToChainOverrides: [],
      roboticsMinorEnabled: false,
      entrepreneurshipMinorEnabled: false,
    },
    courses,
    trackDef,
    catalog,
  );

  assert.deepEqual(assignments, [
    {
      courseId: '00440252',
      bucket: 'faculty_elective',
      credits: 5,
      specializationGroupIds: [],
    },
    {
      courseId: '00440262',
      bucket: 'uncounted',
      credits: 0,
      specializationGroupIds: [],
    },
  ]);
});
