import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

  const resolvedPath = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
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
  if (transpiled.includes('import.meta.glob')) {
    transpiled = `const __importMetaGlob = () => ({});\n${transpiled.replaceAll('import.meta.glob', '__importMetaGlob')}`;
  }

  const specifiers = [...transpiled.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);

  for (const specifier of new Set(specifiers)) {
    if (specifier.startsWith('node:')) continue;
    const dependencyUrl = specifier.startsWith('.')
      ? transpileToDataUrl(resolveTypeScriptModule(dirname(absolutePath), specifier))
      : import.meta.resolve(specifier);
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

const { computeRequirementsProgress } = await loadTranspiledModule('src/hooks/usePlan.ts');
const { buildTrackSpecializationCatalogs } = await loadTranspiledModule('src/domain/specializations/engine.ts');
const { eeTrack } = await loadTranspiledModule('src/data/tracks/ee.ts');
const { csTrack } = await loadTranspiledModule('src/data/tracks/cs.ts');
const { eePhysicsTrack } = await loadTranspiledModule('src/data/tracks/ee_physics.ts');
const { eeCombinedTrack } = await loadTranspiledModule('src/data/tracks/ee_combined.ts');
const { eeMathTrack } = await loadTranspiledModule('src/data/tracks/ee_math.ts');
const { sanitizeStudentPlan } = await loadTranspiledModule('src/services/planValidation.ts');

const filesRoot = join(repoRoot, 'files', 'קבוצות התמחות');
const TRACK_SPECIALIZATION_FOLDERS = {
  ee: 'מסלול הנדסת חשמל',
  cs: 'מסלול הנדסת מחשבים ותוכנה',
  ee_math: 'מסלול הנדסת חשמל ומתמטיקה',
  ee_physics: 'מסלול הנדסת חשמל ופיזיקה',
  ee_combined: 'מסלול משולב-חשמל-פיסיקה(178 נקז)',
  ce: 'מסלול הנדסת מחשבים',
};

function course(id, credits, faculty = '') {
  return {
    id,
    name: `Course ${id}`,
    credits,
    prerequisites: [],
    faculty,
  };
}

const courses = new Map([
  ['00460001', course('00460001', 18)],
  ['00460002', course('00460002', 22)],
  ['00460010', course('00460010', 3)],
  ['00460195', course('00460195', 3)],
  ['00460202', course('00460202', 3)],
  ['01040000', course('01040000', 3.5)],
  ['01040293', course('01040293', 5)],
  ['01160210', course('01160210', 5)],
  ['00940312', course('00940312', 4)],
  ['00960570', course('00960570', 4)],
  ['00970317', course('00970317', 4)],
  ['01240120', course('01240120', 5)],
  ['03360504', course('03360504', 3.5)],
  ['00214119', course('00214119', 2)],
  ['03940810', course('03940810', 1.5)],
]);

function buildSpecializationCatalogsFromFiles() {
  return buildTrackSpecializationCatalogs(
    Object.fromEntries(
      Object.entries(TRACK_SPECIALIZATION_FOLDERS).map(([trackId, folder]) => {
        const dir = join(filesRoot, folder);
        const files = readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => {
            const path = join(dir, entry.name);
            return {
              path,
              content: readFileSync(path, 'utf8'),
            };
          });
        return [trackId, files];
      }),
    ),
  );
}

function emptyCatalog(trackId) {
  return {
    trackId,
    trackFolder: '',
    groups: [],
    diagnostics: [],
    hasErrors: false,
    interactionDisabled: false,
  };
}

function progressFor(trackDef, placedIds, overrides = {}) {
  return computeRequirementsProgress(
    {
      semesters: { 0: placedIds },
      completedCourses: overrides.completedCourses ?? [],
      completedInstances: [],
      grades: {},
      binaryPass: {},
      selectedSpecializations: [],
      doubleSpecializations: [],
      hasEnglishExemption: false,
      miluimCredits: 0,
      englishScore: undefined,
      englishTaughtCourses: [],
      semesterOrder: [1],
      coreToChainOverrides: [],
      courseChainAssignments: {},
      electiveCreditAssignments: overrides.electiveCreditAssignments,
      roboticsMinorEnabled: false,
      entrepreneurshipMinorEnabled: false,
    },
    courses,
    trackDef,
    emptyCatalog(trackDef.id),
    null,
  );
}

function area(progress, areaId) {
  return progress.electiveBreakdown.areaRequirements.find((requirement) => requirement.area === areaId);
}

test('external math course counts as general Technion elective, not faculty elective', () => {
  const eeProgress = progressFor(eeTrack, ['01040000']);
  const physicsProgress = progressFor(eePhysicsTrack, ['01040000']);

  assert.equal(eeProgress.elective.earned, 0);
  assert.equal(eeProgress.general.earned, 3.5);
  assert.deepEqual(eeProgress.electiveBreakdown.generalCourseIds, ['01040000']);

  assert.equal(physicsProgress.elective.earned, 0);
  assert.equal(physicsProgress.general.earned, 3.5);
  assert.deepEqual(physicsProgress.electiveBreakdown.generalCourseIds, ['01040000']);
});

test('free elective and sport courses stay out of faculty elective counting', () => {
  const progress = progressFor(
    eeTrack,
    ['00214119', '03940810'],
    {
      completedCourses: ['00214119', '03940810'],
    },
  );

  assert.equal(progress.elective.earned, 0);
  // MELAG fills the enrichment floor; sport fills the sport floor.
  assert.equal(progress.generalElectivesBreakdown.enrichmentFloor.recognized, 2);
  assert.equal(progress.generalElectivesBreakdown.sportFloor.recognized, 1.5);
});

test('recognized external faculty electives count toward faculty elective up to 9 credits', () => {
  const progress = progressFor(eeTrack, ['00940312', '00960570', '00970317']);

  assert.equal(progress.elective.earned, 9);
  assert.equal(progress.general.earned, 3);
  assert.equal(progress.electiveBreakdown.externalFaculty.earned, 9);
  assert.deepEqual(
    progress.electiveBreakdown.externalFaculty.courseIds,
    ['00940312', '00960570', '00970317'],
  );
});

test('external faculty elective partial-credit exception splits 01240120', () => {
  const progress = progressFor(eeTrack, ['01240120']);

  assert.equal(progress.elective.earned, 3);
  assert.equal(progress.general.earned, 2);
  assert.equal(progress.electiveBreakdown.externalFaculty.earned, 3);
  assert.equal(progress.electiveBreakdown.generalCreditsByCourseId['01240120'], 2);
});

test('external specialization course counts fully outside the 9 credit cap', () => {
  const catalogs = buildSpecializationCatalogsFromFiles();
  const progress = computeRequirementsProgress(
    {
      semesters: { 0: ['03360504', '00940312', '00960570', '00970317'] },
      completedCourses: [],
      completedInstances: [],
      grades: {},
      binaryPass: {},
      selectedSpecializations: [],
      doubleSpecializations: [],
      hasEnglishExemption: false,
      miluimCredits: 0,
      englishScore: undefined,
      englishTaughtCourses: [],
      semesterOrder: [1],
      coreToChainOverrides: [],
      courseChainAssignments: {},
      electiveCreditAssignments: {},
      roboticsMinorEnabled: false,
      entrepreneurshipMinorEnabled: false,
    },
    courses,
    eeTrack,
    catalogs.ee,
    null,
  );

  assert.equal(progress.elective.earned, 12.5);
  assert.equal(progress.general.earned, 3);
  assert.equal(progress.electiveBreakdown.externalFaculty.earned, 9);
});

test('external faculty electives do not satisfy track-specific area minimums', () => {
  const physicsProgress = progressFor(eePhysicsTrack, ['00940312']);
  const mathProgress = progressFor(eeMathTrack, ['00940312']);

  assert.equal(physicsProgress.elective.earned, 4);
  assert.equal(area(physicsProgress, 'ee')?.earned, 0);
  assert.equal(area(physicsProgress, 'physics')?.earned, 0);

  assert.equal(mathProgress.elective.earned, 4);
  assert.equal(area(mathProgress, 'ee')?.earned, 0);
  assert.equal(area(mathProgress, 'math')?.earned, 0);
});

test('ee_physics separates electrical and physics elective credits and required physics course condition', () => {
  const progress = progressFor(eePhysicsTrack, ['00460001', '01160210']);

  assert.equal(progress.elective.earned, 23);
  assert.equal(area(progress, 'ee')?.earned, 18);
  assert.equal(area(progress, 'ee')?.required, 18);
  assert.equal(area(progress, 'physics')?.earned, 5);
  assert.equal(area(progress, 'physics')?.required, 5);
  assert.equal(area(progress, 'physics')?.requiredAnyOfDone, true);
});

test('ee_combined applies the 22 electrical / 5 physics / 30 total policy', () => {
  const progress = progressFor(eeCombinedTrack, ['00460002', '01160210']);

  assert.equal(progress.elective.required, 30);
  assert.equal(eeCombinedTrack.specializationGroupsRequired, 2);
  assert.equal(progress.elective.earned, 27);
  assert.equal(area(progress, 'ee')?.earned, 22);
  assert.equal(area(progress, 'ee')?.required, 22);
  assert.equal(area(progress, 'physics')?.earned, 5);
  assert.equal(area(progress, 'physics')?.required, 5);
});

test('cs specialization progress excludes core-locked courses from selected specialization groups', () => {
  const catalogs = buildSpecializationCatalogsFromFiles();
  const machineLearning = catalogs.cs.groups.find((group) => group.name.includes('למידת מכונה'));
  assert.ok(machineLearning, 'Expected CS machine learning specialization group');

  const progress = computeRequirementsProgress(
    {
      semesters: { 0: ['00460195', '00460202', '00460010'] },
      completedCourses: [],
      completedInstances: [],
      grades: {},
      binaryPass: {},
      selectedSpecializations: [machineLearning.id],
      doubleSpecializations: [],
      hasEnglishExemption: false,
      miluimCredits: 0,
      englishScore: undefined,
      englishTaughtCourses: [],
      semesterOrder: [1],
      coreToChainOverrides: [],
      courseChainAssignments: {},
      electiveCreditAssignments: {},
      roboticsMinorEnabled: false,
      entrepreneurshipMinorEnabled: false,
    },
    courses,
    csTrack,
    catalogs.cs,
    null,
  );

  assert.equal(progress.specializationGroups.completed, 0);
  assert.equal(progress.groupDetails[0]?.done, 2);
  assert.equal(progress.groupDetails[0]?.min, 3);
  assert.equal(progress.groupDetails[0]?.complete, false);

  const releasedProgress = computeRequirementsProgress(
    {
      semesters: { 0: ['00460195', '00460202', '00460010'] },
      completedCourses: [],
      completedInstances: [],
      grades: {},
      binaryPass: {},
      selectedSpecializations: [machineLearning.id],
      doubleSpecializations: [],
      hasEnglishExemption: false,
      miluimCredits: 0,
      englishScore: undefined,
      englishTaughtCourses: [],
      semesterOrder: [1],
      coreToChainOverrides: ['00460195'],
      courseChainAssignments: {},
      electiveCreditAssignments: {},
      roboticsMinorEnabled: false,
      entrepreneurshipMinorEnabled: false,
    },
    courses,
    csTrack,
    catalogs.cs,
    null,
  );

  assert.equal(releasedProgress.specializationGroups.completed, 1);
  assert.equal(releasedProgress.groupDetails[0]?.done, 3);
  assert.equal(releasedProgress.groupDetails[0]?.min, 3);
  assert.equal(releasedProgress.groupDetails[0]?.complete, true);
});

test('ee_math separates electrical and math elective credits', () => {
  const progress = progressFor(eeMathTrack, ['00460001', '01040293']);

  assert.equal(progress.elective.required, 25);
  assert.equal(progress.elective.earned, 23);
  assert.equal(area(progress, 'ee')?.earned, 18);
  assert.equal(area(progress, 'ee')?.required, 18);
  assert.equal(area(progress, 'math')?.earned, 5);
  assert.equal(area(progress, 'math')?.required, 5);
});

test('manual assignment can move an ambiguous physics elective and is accepted by plan validation', () => {
  const automatic = progressFor(eePhysicsTrack, ['01160210']);
  const overridden = progressFor(eePhysicsTrack, ['01160210'], {
    electiveCreditAssignments: { '01160210': 'ee' },
  });

  assert.equal(area(automatic, 'physics')?.earned, 5);
  assert.equal(area(automatic, 'ee')?.earned, 0);
  assert.equal(area(overridden, 'physics')?.earned, 0);
  assert.equal(area(overridden, 'ee')?.earned, 5);
  assert.deepEqual(overridden.electiveBreakdown.assignmentChoices[0]?.options, ['physics', 'ee', 'general']);

  const plan = sanitizeStudentPlan({
    trackId: 'ee_physics',
    semesters: { 0: ['01160210'], 1: [] },
    completedCourses: [],
    selectedSpecializations: [],
    favorites: [],
    grades: {},
    substitutions: {},
    maxSemester: 1,
    selectedPrereqGroups: {},
    summerSemesters: [],
    currentSemester: null,
    semesterOrder: [1],
    electiveCreditAssignments: { '01160210': 'ee' },
  });

  assert.deepEqual(plan?.electiveCreditAssignments, { '01160210': 'ee' });
});
