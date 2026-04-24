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
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
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

const { buildGeneralRequirementsProgress } = await loadTranspiledModule('src/domain/generalRequirements/progressBuilder.ts');
const { sanitizeStudentPlan } = await loadTranspiledModule('src/services/planValidation.ts');

const courses = new Map([
  ['03940810', { id: '03940810', name: 'Sport course', credits: 1.5, isEnglish: false }],
  ['00214119', { id: '00214119', name: 'Free elective', credits: 2, isEnglish: false }],
]);

const trackDef = {
  generalCreditsRequired: 12,
};

test('sport course does not count toward sport or general electives when only placed in plan', () => {
  const progress = buildGeneralRequirementsProgress({
    courses,
    trackDef,
    semesters: { 0: ['03940810'] },
    completedCourses: [],
    explicitSportCompletions: [],
    completedInstances: [],
    grades: {},
    binaryPass: {},
    englishTaughtCourses: [],
    miluimCredits: 0,
    englishScore: undefined,
  });

  const sport = progress.find((requirement) => requirement.requirementId === 'sport');
  const general = progress.find((requirement) => requirement.requirementId === 'general_electives');

  assert.equal(sport?.completedValue, 0);
  assert.equal(general?.completedValue, 0);
});

test('sport course counts toward both requirements after explicit completion', () => {
  const progress = buildGeneralRequirementsProgress({
    courses,
    trackDef,
    semesters: { 1: ['03940810'] },
    completedCourses: [],
    explicitSportCompletions: [],
    completedInstances: ['03940810__1__0'],
    grades: {},
    binaryPass: {},
    englishTaughtCourses: [],
    miluimCredits: 0,
    englishScore: undefined,
  });

  const sport = progress.find((requirement) => requirement.requirementId === 'sport');
  const general = progress.find((requirement) => requirement.requirementId === 'general_electives');

  assert.equal(sport?.completedValue, 1.5);
  assert.equal(general?.completedValue, 1.5);
});

test('grade-driven sport completion also counts toward both requirements', () => {
  const progress = buildGeneralRequirementsProgress({
    courses,
    trackDef,
    semesters: { 1: ['03940810'] },
    completedCourses: ['03940810'],
    explicitSportCompletions: ['03940810'],
    completedInstances: [],
    grades: { '03940810__1': 95 },
    binaryPass: {},
    englishTaughtCourses: [],
    miluimCredits: 0,
    englishScore: undefined,
  });

  const sport = progress.find((requirement) => requirement.requirementId === 'sport');
  const general = progress.find((requirement) => requirement.requirementId === 'general_electives');

  assert.equal(sport?.completedValue, 1.5);
  assert.equal(general?.completedValue, 1.5);
});

test('non-sport counted courses keep their existing behavior', () => {
  const progress = buildGeneralRequirementsProgress({
    courses,
    trackDef,
    semesters: { 0: ['00214119'] },
    completedCourses: [],
    explicitSportCompletions: [],
    completedInstances: [],
    grades: {},
    binaryPass: {},
    englishTaughtCourses: [],
    miluimCredits: 0,
    englishScore: undefined,
  });

  const freeElective = progress.find((requirement) => requirement.requirementId === 'free_elective');
  const general = progress.find((requirement) => requirement.requirementId === 'general_electives');

  assert.equal(freeElective?.completedValue, 2);
  assert.equal(general?.completedValue, 2);
});

test('plan validation accepts the explicit sport completion field', () => {
  const plan = sanitizeStudentPlan({
    trackId: 'ee',
    semesters: { 0: ['03940810'], 1: [] },
    completedCourses: ['03940810'],
    selectedSpecializations: [],
    favorites: [],
    grades: {},
    substitutions: {},
    maxSemester: 1,
    selectedPrereqGroups: {},
    summerSemesters: [],
    currentSemester: null,
    semesterOrder: [1],
    explicitSportCompletions: ['03940810'],
  });

  assert.deepEqual(plan?.explicitSportCompletions, ['03940810']);
});
