import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
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

const [
  { eeTrack },
  { csTrack },
  { eeMathTrack },
  { eePhysicsTrack },
  { eeCombinedTrack },
  { ceTrack },
  { applyPlanMigrations },
] = await Promise.all([
  loadTranspiledModule('src/data/tracks/ee.ts'),
  loadTranspiledModule('src/data/tracks/cs.ts'),
  loadTranspiledModule('src/data/tracks/ee_math.ts'),
  loadTranspiledModule('src/data/tracks/ee_physics.ts'),
  loadTranspiledModule('src/data/tracks/ee_combined.ts'),
  loadTranspiledModule('src/data/tracks/ce.ts'),
  loadTranspiledModule('src/store/planStore.ts'),
]);

const tracks = {
  ee: eeTrack,
  cs: csTrack,
  ee_math: eeMathTrack,
  ee_physics: eePhysicsTrack,
  ee_combined: eeCombinedTrack,
  ce: ceTrack,
};

const EXPECTED_CATALOG_2526 = {
  ee: {
    totalCreditsRequired: 157.5,
    mandatoryCredits: 106,
    electiveCreditsRequired: 39.5,
    generalCreditsRequired: 12,
    specializationGroupsRequired: 3,
    recommended: {
      1: ['00440102', '01040012', '01040064', '01140071', '01140032', '02340117', '03240033'],
      2: ['00440252', '01040013', '01040038', '01040136', '01140075'],
      3: ['00440105', '00440268', '00440157', '01040214', '01040215', '01040220', '01140073'],
      4: ['00440127', '00440131', '00440140', '01040034'],
      5: ['00440137', '00440148', '00440202', '00440158', '00440124'],
      6: ['00440167'],
      7: ['00440169'],
    },
  },
  cs: {
    totalCreditsRequired: 159.5,
    mandatoryCredits: 106.5,
    electiveCreditsRequired: 41,
    generalCreditsRequired: 12,
    specializationGroupsRequired: 2,
    recommended: {
      1: ['00440102', '01040012', '01040064', '01140071', '02340117', '03240033'],
      2: ['00440252', '01040013', '01040038', '01040136', '01140075'],
      3: ['00440105', '00440114', '00440268', '01040134', '01040214', '01040215', '01040220'],
      4: ['00440127', '00440131', '00440157', '00440101', '00460002', '01040034'],
      5: ['00440137', '00460209', '00460210', '00440334', '00460267'],
      6: ['00440167'],
      7: ['00440169'],
    },
  },
  ee_math: {
    totalCreditsRequired: 162,
    mandatoryCredits: 125,
    electiveCreditsRequired: 25,
    generalCreditsRequired: 12,
    specializationGroupsRequired: 2,
    recommended: {
      1: ['00440102', '01040000', '01040002', '01040195', '01040066', '01140071', '01140032', '02340117'],
      2: ['00440252', '01040281', '01040168', '01140075', '03240033'],
      3: ['00440105', '00440268', '01040286', '01040214', '01040295', '01040285', '01040122'],
      4: ['00440131', '00440127', '00440157', '00440140', '01040222', '01040030'],
      5: ['00440137', '00440202', '00440158', '01040142', '01040158'],
      6: ['00440167', '00440148'],
      7: ['00440169', '01040165'],
    },
  },
  ee_physics: {
    totalCreditsRequired: 162,
    mandatoryCredits: 124.5,
    electiveCreditsRequired: 25.5,
    generalCreditsRequired: 12,
    specializationGroupsRequired: 2,
    recommended: {
      1: ['00440102', '01040012', '01040064', '01140020', '01140074', '02340117', '03240033'],
      2: ['00440252', '01040013', '01040038', '01040136', '01140030', '01140076'],
      3: ['00440105', '00440268', '01040034', '01040214', '01040215', '01040220', '01140101'],
      4: ['00440131', '00440127', '00440157', '00440140', '01040222'],
      5: ['00440137', '00440202', '00440158', '01040142', '01040158'],
      6: ['00440167', '00440148', '01140035'],
      7: ['00440169', '01140252'],
    },
  },
  ee_combined: {
    totalCreditsRequired: 178,
    mandatoryCredits: 136,
    electiveCreditsRequired: 30,
    generalCreditsRequired: 12,
    specializationGroupsRequired: 2,
    recommended: {
      1: ['00440102', '01040012', '01140020', '01140074', '02340117', '03240033', '01040064'],
      2: ['00440252', '01040013', '01040038', '01040136', '01140030', '01140076'],
      3: ['00440105', '00440268', '01040034', '01040214', '01040215', '01040220', '01140101'],
      4: ['00440127', '00440131', '00440157', '01150203', '01140036', '01140246', '00440140'],
      5: ['00440137', '00440148', '00440202', '01150204', '01160217'],
      6: ['00440158', '00440167', '01140035'],
      7: ['00440169', '01140037', '01240108'],
      8: ['01140250', '01140252'],
    },
  },
  ce: {
    totalCreditsRequired: 158.5,
    mandatoryCredits: 113.5,
    electiveCreditsRequired: 27,
    generalCreditsRequired: 12,
    specializationGroupsRequired: 2,
    recommended: {
      1: ['00440102', '01040012', '02340129', '01140071', '02340114', '01040064'],
      2: ['01040013', '02340125', '01040136', '01140075', '00440252'],
      3: ['02340124', '02340141', '00440105', '01040220', '01040215', '01040214', '03240033'],
      4: ['00440131', '01040034', '00440127', '02340218', '02340118', '01140073'],
      5: ['00440137', '00440157', '02340123', '01040134', '02340247', '00460267'],
      6: ['00440167'],
      7: ['00440169'],
    },
  },
};

function defaultRecommendedBySemester(trackDef) {
  return Object.fromEntries(
    trackDef.semesterSchedule.map((entry) => [
      entry.semester,
      [
        ...entry.courses,
        ...(entry.alternativeGroups?.flatMap((group) => (
          group.showBoth ? group.courseIds : [group.defaultCourseId ?? group.courseIds[0]]
        )) ?? []),
      ],
    ]),
  );
}

function createPlan(trackId, overrides = {}) {
  return {
    trackId,
    semesters: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
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
    explicitSportCompletions: [],
    completedInstances: [],
    dismissedRecommendedCourses: {},
    facultyColorOverrides: {},
    coreToChainOverrides: [],
    courseChainAssignments: {},
    electiveCreditAssignments: {},
    noAdditionalCreditOverrides: {},
    roboticsMinorEnabled: false,
    entrepreneurshipMinorEnabled: false,
    quantumComputingMinorEnabled: false,
    initializedTracks: [trackId],
    targetGraduationSemesterId: null,
    loadProfile: 'fulltime',
    ...overrides,
  };
}

test('track definitions keep the 2025/2026 mandatory totals and recommended schedules', () => {
  for (const [trackId, expected] of Object.entries(EXPECTED_CATALOG_2526)) {
    const track = tracks[trackId];
    assert.equal(track.totalCreditsRequired, expected.totalCreditsRequired, `${trackId} total credits`);
    assert.equal(track.mandatoryCredits, expected.mandatoryCredits, `${trackId} mandatory credits`);
    assert.equal(track.electiveCreditsRequired, expected.electiveCreditsRequired, `${trackId} elective credits`);
    assert.equal(track.generalCreditsRequired, expected.generalCreditsRequired, `${trackId} general credits`);
    assert.equal(track.specializationGroupsRequired, expected.specializationGroupsRequired, `${trackId} specialization groups`);
    assert.deepEqual(defaultRecommendedBySemester(track), expected.recommended, `${trackId} recommended schedule`);
  }
});

test('plan migration restores missing 2025/2026 recommended courses for persisted tracks', () => {
  const migrated = applyPlanMigrations(createPlan('cs'));

  assert.ok(migrated.semesters[4].includes('00440101'), 'CS software intro should be restored to the recommended plan');
  assert.ok(!migrated.semesters[1].includes('01140032'), 'old CS physics lab recommendation should stay removed');
});

test('persisted catalog migration covers saved tracks and respects dismissed recommended courses', () => {
  const migrated = applyPlanMigrations(createPlan('ee', {
    dismissedRecommendedCourses: { ce: ['01140073'] },
    savedTracks: {
      ce: createPlan('ce', {
        semesters: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
        dismissedRecommendedCourses: { ce: ['01140073'] },
      }),
    },
  }), { restoreCatalog2526Recommended: true });

  assert.ok(migrated.savedTracks.ce.semesters[4].includes('00440131'), 'CE saved track should receive catalog recommendations');
  assert.ok(!migrated.savedTracks.ce.semesters[4].includes('01140073'), 'dismissed CE recommendation should not be re-added');
});
