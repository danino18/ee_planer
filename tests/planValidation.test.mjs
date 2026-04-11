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

const { sanitizeStudentPlan } = await loadTranspiledModule('src/services/planValidation.ts');
const { validateStudentPlanPayload } = await loadTranspiledModule('functions/src/security/planValidation.ts');

function createPlanPayload() {
  return {
    trackId: 'ce',
    semesters: { 0: [], 1: ['02340117'] },
    completedCourses: [],
    selectedSpecializations: [],
    favorites: [],
    grades: {},
    substitutions: {},
    maxSemester: 8,
    selectedPrereqGroups: {},
    summerSemesters: [],
    currentSemester: null,
    semesterOrder: [1, 2, 3, 4, 5, 6, 7, 8],
    semesterTypeOverrides: {},
    semesterWarningsIgnored: [],
    doubleSpecializations: [],
    hasEnglishExemption: false,
    manualSapAverages: {},
    binaryPass: {},
    completedInstances: [],
    savedTracks: {
      cs: {
        trackId: 'cs',
        semesters: { 0: [], 1: ['02340117'] },
        completedCourses: [],
        selectedSpecializations: [],
        favorites: [],
        grades: {},
        substitutions: {},
        maxSemester: 8,
        selectedPrereqGroups: {},
        summerSemesters: [],
        currentSemester: null,
        semesterOrder: [1, 2, 3, 4, 5, 6, 7, 8],
        semesterTypeOverrides: {},
        semesterWarningsIgnored: [],
        doubleSpecializations: [],
        hasEnglishExemption: false,
        manualSapAverages: {},
        binaryPass: {},
        completedInstances: [],
        dismissedRecommendedCourses: {},
        facultyColorOverrides: {},
        coreToChainOverrides: ['02340117'],
      },
    },
    miluimCredits: 2,
    englishScore: 120,
    englishTaughtCourses: [],
    dismissedRecommendedCourses: {},
    facultyColorOverrides: {},
    coreToChainOverrides: ['02340117'],
  };
}

test('client sanitizer accepts coreToChainOverrides in plan and savedTracks payloads', () => {
  const sanitized = sanitizeStudentPlan(createPlanPayload());

  assert.ok(sanitized, 'expected payload to sanitize successfully');
  assert.deepEqual(sanitized.coreToChainOverrides, ['02340117']);
  assert.deepEqual(sanitized.savedTracks.cs.coreToChainOverrides, ['02340117']);
});

test('server validator accepts coreToChainOverrides in plan and savedTracks payloads', () => {
  const validated = validateStudentPlanPayload(createPlanPayload());

  assert.equal(validated.ok, true);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  assert.deepEqual(validated.value.coreToChainOverrides, ['02340117']);
  assert.deepEqual(validated.value.savedTracks.cs.coreToChainOverrides, ['02340117']);
});
