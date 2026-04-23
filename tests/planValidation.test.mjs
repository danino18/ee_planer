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
const { sanitizePlanPayload } = await loadTranspiledModule('functions/src/services/planValidation.ts');

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
        roboticsMinorEnabled: true,
        entrepreneurshipMinorEnabled: false,
      },
    },
    miluimCredits: 2,
    englishScore: 120,
    englishTaughtCourses: [],
    dismissedRecommendedCourses: {},
    facultyColorOverrides: {},
    coreToChainOverrides: ['02340117'],
    roboticsMinorEnabled: true,
    entrepreneurshipMinorEnabled: true,
  };
}

test('client sanitizer accepts current StudentPlan fields in plan and savedTracks payloads', () => {
  const sanitized = sanitizeStudentPlan(createPlanPayload());

  assert.ok(sanitized, 'expected payload to sanitize successfully');
  assert.deepEqual(sanitized.coreToChainOverrides, ['02340117']);
  assert.deepEqual(sanitized.savedTracks.cs.coreToChainOverrides, ['02340117']);
  assert.equal(sanitized.roboticsMinorEnabled, true);
  assert.equal(sanitized.entrepreneurshipMinorEnabled, true);
  assert.equal(sanitized.savedTracks.cs.roboticsMinorEnabled, true);
  assert.equal(sanitized.savedTracks.cs.entrepreneurshipMinorEnabled, false);
});

test('client sanitizer accepts nested savedTracks (real-world multi-track-switch data)', () => {
  // When a user switches tracks A→B→A, serializePlanState produces savedTracks where
  // each sub-plan itself has a savedTracks field (captured at switch time). Validation
  // must silently drop the nested savedTracks rather than rejecting the whole envelope.
  const planWithNestedSavedTracks = {
    ...createPlanPayload(),
    savedTracks: {
      cs: {
        ...createPlanPayload().savedTracks.cs,
        savedTracks: {
          ce: {
            trackId: 'ce',
            semesters: { 0: [], 1: [] },
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
            coreToChainOverrides: [],
            roboticsMinorEnabled: false,
            entrepreneurshipMinorEnabled: false,
          },
        },
      },
    },
  };

  const sanitized = sanitizeStudentPlan(planWithNestedSavedTracks);
  assert.ok(sanitized, 'expected nested savedTracks payload to sanitize successfully');
  assert.ok(sanitized.savedTracks?.cs, 'cs savedTrack should be present');
  assert.equal(sanitized.savedTracks.cs.savedTracks, undefined, 'nested savedTracks should be stripped');
});

test('server security validator accepts current StudentPlan fields in plan and savedTracks payloads', () => {
  const validated = validateStudentPlanPayload(createPlanPayload());

  assert.equal(validated.ok, true);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  assert.deepEqual(validated.value.coreToChainOverrides, ['02340117']);
  assert.deepEqual(validated.value.savedTracks.cs.coreToChainOverrides, ['02340117']);
  assert.equal(validated.value.roboticsMinorEnabled, true);
  assert.equal(validated.value.entrepreneurshipMinorEnabled, true);
  assert.equal(validated.value.savedTracks.cs.roboticsMinorEnabled, true);
  assert.equal(validated.value.savedTracks.cs.entrepreneurshipMinorEnabled, false);
});

test('server service sanitizer accepts minor flags in plan and savedTracks payloads', () => {
  const sanitized = sanitizePlanPayload(createPlanPayload());

  assert.equal(sanitized.roboticsMinorEnabled, true);
  assert.equal(sanitized.entrepreneurshipMinorEnabled, true);
  assert.equal(sanitized.savedTracks.cs.roboticsMinorEnabled, true);
  assert.equal(sanitized.savedTracks.cs.entrepreneurshipMinorEnabled, false);
});

test('cloud sync schema stays aligned for minor flags', () => {
  const serializerSource = readFileSync(join(repoRoot, 'src/services/planStateSerialization.ts'), 'utf8');
  const clientValidatorSource = readFileSync(join(repoRoot, 'src/services/planValidation.ts'), 'utf8');
  const securityValidatorSource = readFileSync(join(repoRoot, 'functions/src/security/planValidation.ts'), 'utf8');
  const serviceValidatorSource = readFileSync(join(repoRoot, 'functions/src/services/planValidation.ts'), 'utf8');

  for (const key of ['roboticsMinorEnabled', 'entrepreneurshipMinorEnabled']) {
    assert.match(serializerSource, new RegExp(`${key}: state\\.${key}`), `serializePlanState must include ${key}`);
    assert.match(clientValidatorSource, new RegExp(`['"]${key}['"]`), `client validator must allow ${key}`);
    assert.match(securityValidatorSource, new RegExp(`["']${key}["']`), `security validator must allow ${key}`);
    assert.match(serviceValidatorSource, new RegExp(`${key}: cleanBoolean`), `service sanitizer must clean ${key}`);
  }
});
