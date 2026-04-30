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
  buildPreciseMandatorySet,
  buildLabSets,
  buildCoreLockedSet,
  buildChainEligibleCourseSet,
  buildCourseAssignments,
  buildRequirementChecks,
} = await loadTranspiledModule('src/domain/degreeCompletion/helpers.ts');
const { buildGeneralRequirementsProgress } = await loadTranspiledModule('src/domain/generalRequirements/progressBuilder.ts');
const { evaluateSpecializationGroup } = await loadTranspiledModule('src/domain/specializations/engine.ts');

const { eeTrack } = await loadTranspiledModule('src/data/tracks/ee.ts');
const { csTrack } = await loadTranspiledModule('src/data/tracks/cs.ts');
const { ceTrack } = await loadTranspiledModule('src/data/tracks/ce.ts');

// EE lab pool IDs (from ee.ts labPool.courses)
const EE_LAB_IDS = [
  '00450100','00450101','00450102','00450103','00450104',
  '00450105','00450106','00450107','00450108','00450109',
  '00450110','00450111','00450112','00450113','00450114',
  '00450115','00450116','00450117','00450118','00450119',
  '00450120',
];

// EE semester 1 mandatory course
const EE_MANDATORY_ID = '00440102';
// Sport course in the 03940800-03940820 range
const SPORT_ID = '03940810';
const SPORTS_TEAM_ID = '03940902';
const CHOIR_ID = '03940587';
// MELAG (free elective) course
const MELAG_ID = '00214119';
// CS core course
const CS_CORE_ID = '00440140';

function makeInput(overrides = {}) {
  return {
    semesters: {},
    completedCourses: [],
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
    semesterOrder: [],
    coreToChainOverrides: [],
    roboticsMinorEnabled: false,
    entrepreneurshipMinorEnabled: false,
    ...overrides,
  };
}

function makeCourses(entries) {
  return new Map(
    Object.entries(entries).map(([id, credits]) => [id, {
      id,
      credits,
      name: id,
      faculty: id.startsWith('004') ? 'הנדסת חשמל ומחשבים' : '',
      prerequisites: [],
    }]),
  );
}

function buildGeneralProgress(input, courses, trackDef = eeTrack) {
  const progress = buildGeneralRequirementsProgress({
    courses,
    trackDef,
    semesters: input.semesters,
    completedCourses: input.completedCourses,
    explicitSportCompletions: input.explicitSportCompletions,
    completedInstances: input.completedInstances,
    grades: input.grades,
    binaryPass: input.binaryPass,
    englishTaughtCourses: input.englishTaughtCourses,
    miluimCredits: input.miluimCredits,
    englishScore: input.englishScore,
  });
  return Object.fromEntries(progress.map((requirement) => [requirement.requirementId, requirement]));
}

const emptyCatalog = { groups: [], trackId: 'ee' };

function makeChoiceRule(courseIds) {
  return {
    kind: 'choice_rule',
    type: 'choose_1_from',
    count: 1,
    options: courseIds.map((id) => ({
      kind: 'course',
      courseNumber: id,
      courseName: id,
    })),
  };
}

function makeSpecializationGroup({ id, name, mandatoryCourses, mandatoryChoiceCourses, additionalCourses }) {
  const courseIds = [...new Set([
    ...mandatoryCourses,
    ...mandatoryChoiceCourses,
    ...additionalCourses,
  ])];
  return {
    id,
    trackId: 'cs',
    title: name,
    name,
    sourceFile: `${id}.json`,
    courses: courseIds.map((courseNumber) => ({ courseNumber, courseName: courseNumber })),
    mandatoryCourses,
    mandatoryOptions: [mandatoryChoiceCourses],
    electiveCourses: additionalCourses,
    minCoursesToComplete: 3,
    notes: [],
    modeState: 'single_only',
    supportedModes: ['single'],
    canBeDouble: false,
    requirementsByMode: {
      single: {
        totalCoursesRequiredForGroup: 3,
        mandatoryCourses: mandatoryCourses.map((courseNumber) => ({ courseNumber, courseName: courseNumber })),
        mandatoryChoiceRules: [makeChoiceRule(mandatoryChoiceCourses)],
        selectionRule: null,
        additionalCoursesRequired: 1,
        additionalCourseSelectionRule: makeChoiceRule(additionalCourses),
        logicalExpression: null,
      },
      double: null,
    },
    mutualExclusionRules: [],
    replacementRules: [],
    diagnostics: [],
  };
}

const csMachineLearningGroup = makeSpecializationGroup({
  id: 'cs-ml',
  name: 'למידת מכונה ומערכות נבונות',
  mandatoryCourses: ['00460195'],
  mandatoryChoiceCourses: ['00460202'],
  additionalCourses: ['00440191', '00460010'],
});

const csControlRoboticsGroup = makeSpecializationGroup({
  id: 'cs-control',
  name: 'בקרה ורובוטיקה',
  mandatoryCourses: ['00440191'],
  mandatoryChoiceCourses: ['00460212'],
  additionalCourses: ['00460195', '00440139'],
});

// ── buildLabSets ──────────────────────────────────────────────────────────────

test('buildLabSets: empty plan returns all empty sets', () => {
  const input = makeInput();
  const result = buildLabSets(input, eeTrack);
  assert.equal(result.mandatoryLabIds.size, 0);
  assert.equal(result.optionalLabIds.size, 0);
  assert.equal(result.excessLabIds.size, 0);
});

test('buildLabSets: track without labPool returns all empty sets', () => {
  const input = makeInput({ semesters: { 1: [CS_CORE_ID] }, semesterOrder: [1] });
  const result = buildLabSets(input, csTrack);
  assert.equal(result.mandatoryLabIds.size, 0);
  assert.equal(result.optionalLabIds.size, 0);
  assert.equal(result.excessLabIds.size, 0);
});

test('buildLabSets: first 3 labs become mandatory, 4th becomes optional', () => {
  const [l1, l2, l3, l4] = EE_LAB_IDS;
  const input = makeInput({
    semesters: { 1: [l1, l2, l3, l4] },
    semesterOrder: [1],
  });
  const { mandatoryLabIds, optionalLabIds, excessLabIds } = buildLabSets(input, eeTrack);
  assert.deepEqual([...mandatoryLabIds].sort(), [l1, l2, l3].sort());
  assert.deepEqual([...optionalLabIds], [l4]);
  assert.equal(excessLabIds.size, 0);
});

test('buildLabSets: completedCourses are prioritised before semester labs', () => {
  const [l1, l2, l3, l4] = EE_LAB_IDS;
  // l4 is in completedCourses; l1-l3 are in semester — l4 should come first
  const input = makeInput({
    completedCourses: [l4],
    semesters: { 1: [l1, l2, l3] },
    semesterOrder: [1],
  });
  const { mandatoryLabIds } = buildLabSets(input, eeTrack);
  // l4 (completedCourses) + l1 + l2 = 3 mandatory; l3 = optional
  assert.ok(mandatoryLabIds.has(l4), 'completedCourse lab should be mandatory');
  assert.ok(mandatoryLabIds.has(l1));
  assert.ok(mandatoryLabIds.has(l2));
  assert.ok(!mandatoryLabIds.has(l3));
});

test('buildLabSets: 5 labs with max=4 — last one is excess', () => {
  const [l1, l2, l3, l4, l5] = EE_LAB_IDS;
  const input = makeInput({
    semesters: { 1: [l1, l2, l3, l4, l5] },
    semesterOrder: [1],
  });
  const { mandatoryLabIds, optionalLabIds, excessLabIds } = buildLabSets(input, eeTrack);
  assert.equal(mandatoryLabIds.size, 3);
  assert.equal(optionalLabIds.size, 1);
  assert.equal(excessLabIds.size, 1);
  assert.ok(excessLabIds.has(l5));
});

// ── buildPreciseMandatorySet ──────────────────────────────────────────────────

test('buildPreciseMandatorySet: empty plan returns empty set', () => {
  const input = makeInput();
  const courses = makeCourses({ [EE_MANDATORY_ID]: 3 });
  const result = buildPreciseMandatorySet(input, courses, eeTrack);
  assert.equal(result.size, 0);
});

test('buildPreciseMandatorySet: placed mandatory course is included', () => {
  const input = makeInput({
    semesters: { 1: [EE_MANDATORY_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [EE_MANDATORY_ID]: 3 });
  const result = buildPreciseMandatorySet(input, courses, eeTrack);
  assert.ok(result.has(EE_MANDATORY_ID));
});

test('buildPreciseMandatorySet: unplaced mandatory course is not included', () => {
  const input = makeInput({
    semesters: { 1: ['99999999'] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [EE_MANDATORY_ID]: 3 });
  const result = buildPreciseMandatorySet(input, courses, eeTrack);
  assert.ok(!result.has(EE_MANDATORY_ID));
});

test('buildPreciseMandatorySet: alt-group winner is included, loser is not', () => {
  // Build a synthetic track with one alternativeGroup entry
  const ALT_A = 'ALT_A_001';
  const ALT_B = 'ALT_B_002';
  const syntheticTrack = {
    ...eeTrack,
    semesterSchedule: [
      {
        semester: 1,
        courses: [],
        alternativeGroups: [{ courseIds: [ALT_A, ALT_B] }],
      },
    ],
  };
  const courses = makeCourses({ [ALT_A]: 3, [ALT_B]: 3 });
  // Place only ALT_B
  const input = makeInput({
    semesters: { 1: [ALT_B] },
    semesterOrder: [1],
  });
  const result = buildPreciseMandatorySet(input, courses, syntheticTrack);
  assert.ok(result.has(ALT_B), 'placed alt should be in set');
  assert.ok(!result.has(ALT_A), 'unplaced alt should not be in set');
});

// ── buildCoreLockedSet ────────────────────────────────────────────────────────

test('buildCoreLockedSet: EE track (no coreRequirement) returns empty set', () => {
  const input = makeInput({
    semesters: { 1: [EE_MANDATORY_ID] },
    semesterOrder: [1],
  });
  const result = buildCoreLockedSet(input, eeTrack);
  assert.equal(result.size, 0);
});

test('buildCoreLockedSet: placed core courses are locked', () => {
  const input = makeInput({
    semesters: { 1: [CS_CORE_ID] },
    semesterOrder: [1],
  });
  const result = buildCoreLockedSet(input, csTrack);
  assert.ok(result.has(CS_CORE_ID));
});

test('buildCoreLockedSet: coreToChainOverride releases a course from the locked set', () => {
  const input = makeInput({
    semesters: { 1: [CS_CORE_ID] },
    semesterOrder: [1],
    coreToChainOverrides: [CS_CORE_ID],
  });
  const result = buildCoreLockedSet(input, csTrack);
  assert.ok(!result.has(CS_CORE_ID));
});

test('buildChainEligibleCourseSet: CS core-locked courses do not complete specialization chains', () => {
  const input = makeInput({
    semesters: {
      1: [
        '00460195',
        '00440191',
        '00440140',
        '00440198',
        '00460202',
        '00460212',
      ],
    },
    semesterOrder: [1],
    selectedSpecializations: [csMachineLearningGroup.id, csControlRoboticsGroup.id],
  });
  const coreLockedSet = buildCoreLockedSet(input, csTrack);
  const chainEligibleCourseIds = buildChainEligibleCourseSet(input, csTrack);
  const ml = evaluateSpecializationGroup(csMachineLearningGroup, chainEligibleCourseIds);
  const control = evaluateSpecializationGroup(csControlRoboticsGroup, chainEligibleCourseIds);

  assert.deepEqual([...coreLockedSet].sort(), ['00440140', '00440191', '00440198', '00460195'].sort());
  assert.equal(ml.complete, false, 'Machine-learning chain should not complete from locked core courses');
  assert.equal(control.complete, false, 'Control chain should not complete from locked core courses');
});

test('buildChainEligibleCourseSet: released CS core course can satisfy a specialization chain instead of core', () => {
  const input = makeInput({
    semesters: {
      1: [
        '00460195',
        '00440191',
        '00440140',
        '00440198',
        '00460202',
        '00460010',
      ],
    },
    semesterOrder: [1],
    selectedSpecializations: [csMachineLearningGroup.id],
    coreToChainOverrides: ['00460195'],
  });
  const coreLockedSet = buildCoreLockedSet(input, csTrack);
  const chainEligibleCourseIds = buildChainEligibleCourseSet(input, csTrack);
  const ml = evaluateSpecializationGroup(csMachineLearningGroup, chainEligibleCourseIds);

  assert.equal(coreLockedSet.size, 3);
  assert.equal(coreLockedSet.has('00460195'), false);
  assert.equal(ml.complete, true, 'Released machine-learning core course should satisfy the chain');
});

test('buildCoreLockedSet: CE orGroup — only first placed member is locked, second is blocked', () => {
  // CE orGroups: [['02360334', '00440334']]
  const OR_A = '02360334';
  const OR_B = '00440334';
  const input = makeInput({
    semesters: { 1: [OR_A, OR_B] },
    semesterOrder: [1],
  });
  const result = buildCoreLockedSet(input, ceTrack);
  assert.ok(result.has(OR_A), 'first OR member should be locked');
  assert.ok(!result.has(OR_B), 'second OR member should be blocked (not locked)');
});

// ── buildCourseAssignments ────────────────────────────────────────────────────

test('buildCourseAssignments: empty plan returns empty array', () => {
  const input = makeInput();
  const courses = makeCourses({});
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  assert.deepEqual(result, []);
});

test('buildCourseAssignments: mandatory course gets mandatory bucket', () => {
  const input = makeInput({
    semesters: { 1: [EE_MANDATORY_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [EE_MANDATORY_ID]: 3 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  const assignment = result.find((a) => a.courseId === EE_MANDATORY_ID);
  assert.equal(assignment?.bucket, 'mandatory');
});

test('buildCourseAssignments: lab course gets mandatory_lab bucket', () => {
  const [l1, l2, l3] = EE_LAB_IDS;
  const input = makeInput({
    semesters: { 1: [l1, l2, l3] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [l1]: 1, [l2]: 1, [l3]: 1 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  for (const lab of [l1, l2, l3]) {
    assert.equal(result.find((a) => a.courseId === lab)?.bucket, 'mandatory_lab');
  }
});

test('buildCourseAssignments: 5th lab beyond max=4 gets excess_lab bucket', () => {
  const [l1, l2, l3, l4, l5] = EE_LAB_IDS;
  const input = makeInput({
    semesters: { 1: [l1, l2, l3, l4, l5] },
    semesterOrder: [1],
  });
  const courses = makeCourses(Object.fromEntries(EE_LAB_IDS.slice(0, 5).map((id) => [id, 1])));
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  assert.equal(result.find((a) => a.courseId === l5)?.bucket, 'excess_lab');
});

test('buildCourseAssignments: sport without explicit completion gets uncounted bucket', () => {
  const input = makeInput({
    semesters: { 1: [SPORT_ID] },
    semesterOrder: [1],
    explicitSportCompletions: [],
  });
  const courses = makeCourses({ [SPORT_ID]: 1.5 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  assert.equal(result.find((a) => a.courseId === SPORT_ID)?.bucket, 'uncounted');
});

test('buildCourseAssignments: sport with explicit completion gets sport bucket', () => {
  const input = makeInput({
    semesters: { 1: [SPORT_ID] },
    semesterOrder: [1],
    explicitSportCompletions: [SPORT_ID],
  });
  const courses = makeCourses({ [SPORT_ID]: 1.5 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  assert.equal(result.find((a) => a.courseId === SPORT_ID)?.bucket, 'sport');
});

test('buildCourseAssignments: free elective (MELAG) course gets melag bucket', () => {
  const input = makeInput({
    semesters: { 1: [MELAG_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [MELAG_ID]: 2 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  assert.equal(result.find((a) => a.courseId === MELAG_ID)?.bucket, 'melag');
});

test('buildCourseAssignments: non-mandatory electrical course gets faculty_elective bucket', () => {
  const ELECTIVE_ID = '00460999';
  const input = makeInput({
    semesters: { 1: [ELECTIVE_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [ELECTIVE_ID]: 3 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  assert.equal(result.find((a) => a.courseId === ELECTIVE_ID)?.bucket, 'faculty_elective');
});

test('buildCourseAssignments: recognized external faculty elective splits overflow into general bucket', () => {
  const EXTERNAL_A = '00940312';
  const EXTERNAL_B = '00960570';
  const EXTERNAL_C = '00970317';
  const input = makeInput({
    semesters: { 1: [EXTERNAL_A, EXTERNAL_B, EXTERNAL_C] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [EXTERNAL_A]: 4, [EXTERNAL_B]: 4, [EXTERNAL_C]: 4 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);

  assert.equal(result.find((a) => a.courseId === EXTERNAL_A)?.bucket, 'faculty_elective');
  assert.equal(result.find((a) => a.courseId === EXTERNAL_B)?.bucket, 'faculty_elective');
  assert.deepEqual(
    result
      .filter((a) => a.courseId === EXTERNAL_C)
      .map((a) => [a.bucket, a.credits]),
    [
      ['faculty_elective', 1],
      ['general_elective', 3],
    ],
  );
});

test('buildCourseAssignments: 01240120 uses only 3 faculty elective credits', () => {
  const SPLIT_ID = '01240120';
  const input = makeInput({
    semesters: { 1: [SPLIT_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [SPLIT_ID]: 5 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);

  assert.deepEqual(
    result.map((a) => [a.bucket, a.credits]),
    [
      ['faculty_elective', 3],
      ['general_elective', 2],
    ],
  );
});

test('buildCourseAssignments: core course gets core bucket', () => {
  const input = makeInput({
    semesters: { 1: [CS_CORE_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [CS_CORE_ID]: 3 });
  const result = buildCourseAssignments(input, courses, csTrack, emptyCatalog);
  assert.equal(result.find((a) => a.courseId === CS_CORE_ID)?.bucket, 'core');
});

test('buildCourseAssignments: each courseId appears at most once (no duplicates)', () => {
  const [l1, l2, l3] = EE_LAB_IDS;
  const ELECTIVE_ID = 'ELECTIVE456';
  const input = makeInput({
    semesters: { 1: [EE_MANDATORY_ID, l1, l2, l3, SPORT_ID, MELAG_ID, ELECTIVE_ID] },
    semesterOrder: [1],
    explicitSportCompletions: [SPORT_ID],
  });
  const courses = makeCourses({
    [EE_MANDATORY_ID]: 3,
    [l1]: 1, [l2]: 1, [l3]: 1,
    [SPORT_ID]: 1.5,
    [MELAG_ID]: 2,
    [ELECTIVE_ID]: 3,
  });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  const ids = result.map((a) => a.courseId);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, 'courseIds should be unique');
});

test('buildCourseAssignments: specialization course has correct specializationGroupIds', () => {
  const SPEC_COURSE = 'SPEC001';
  const GROUP_ID = 'group_test';
  const catalog = {
    groups: [{ id: GROUP_ID, courses: [{ courseNumber: SPEC_COURSE }] }],
    trackId: 'ee',
  };
  const input = makeInput({
    semesters: { 1: [SPEC_COURSE] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [SPEC_COURSE]: 3 });
  const result = buildCourseAssignments(input, courses, eeTrack, catalog);
  const assignment = result.find((a) => a.courseId === SPEC_COURSE);
  assert.deepEqual(assignment?.specializationGroupIds, [GROUP_ID]);
});

// ── buildRequirementChecks ────────────────────────────────────────────────────

function makeProgress(overrides = {}) {
  return {
    mandatory: { earned: 0, required: 106 },
    elective: { earned: 0, required: 39.5 },
    total: { earned: 0, required: 157.5 },
    specializationGroups: { completed: 0, required: 3, unavailable: false },
    sport: { earned: 0, required: 1 },
    general: { earned: 0, required: 12 },
    freeElective: { earned: 0, required: 0 },
    labPoolProgress: null,
    coreRequirementProgress: null,
    english: { score: undefined, hasExemption: false, requirements: [], englishInPlan: [] },
    isReady: false,
    ...overrides,
  };
}

test('buildRequirementChecks: all-zero progress produces all missing/partial statuses', () => {
  const progress = makeProgress();
  const checks = buildRequirementChecks(progress, []);
  for (const check of checks) {
    assert.equal(check.status, 'missing', `expected missing for ${check.id}`);
  }
});

test('buildRequirementChecks: completed mandatory produces completed status with missingValue 0', () => {
  const progress = makeProgress({ mandatory: { earned: 106, required: 106 } });
  const checks = buildRequirementChecks(progress, []);
  const mandatory = checks.find((c) => c.id === 'mandatory_credits');
  assert.equal(mandatory?.status, 'completed');
  assert.equal(mandatory?.missingValue, 0);
});

test('buildRequirementChecks: partial mandatory produces partial status', () => {
  const progress = makeProgress({ mandatory: { earned: 50, required: 106 } });
  const checks = buildRequirementChecks(progress, []);
  const mandatory = checks.find((c) => c.id === 'mandatory_credits');
  assert.equal(mandatory?.status, 'partial');
  assert.equal(mandatory?.missingValue, 56);
});

test('buildRequirementChecks: labs check omitted when labPoolProgress is null', () => {
  const progress = makeProgress({ labPoolProgress: null });
  const checks = buildRequirementChecks(progress, []);
  assert.ok(!checks.some((c) => c.id === 'labs'));
});

test('buildRequirementChecks: labs check present when labPoolProgress is set', () => {
  const progress = makeProgress({
    labPoolProgress: { earned: 2, required: 3, mandatory: true },
  });
  const checks = buildRequirementChecks(progress, []);
  const labs = checks.find((c) => c.id === 'labs');
  assert.ok(labs);
  assert.equal(labs.earned, 2);
  assert.equal(labs.required, 3);
  assert.equal(labs.status, 'partial');
});

test('buildRequirementChecks: core check omitted when coreRequirementProgress is null (EE track)', () => {
  const progress = makeProgress({ coreRequirementProgress: null });
  const checks = buildRequirementChecks(progress, []);
  assert.ok(!checks.some((c) => c.id === 'core_requirement'));
});

test('buildRequirementChecks: core check present when coreRequirementProgress is set (CS track)', () => {
  const progress = makeProgress({
    coreRequirementProgress: { completed: 4, required: 4, total: 7 },
  });
  const checks = buildRequirementChecks(progress, []);
  const core = checks.find((c) => c.id === 'core_requirement');
  assert.ok(core);
  assert.equal(core.status, 'completed');
  assert.equal(core.missingValue, 0);
});

test('buildRequirementChecks: english exemption forces completed status', () => {
  const progress = makeProgress({
    english: {
      score: undefined,
      hasExemption: true,
      requirements: [{ done: false }, { done: false }],
      englishInPlan: [],
    },
  });
  const checks = buildRequirementChecks(progress, []);
  const english = checks.find((c) => c.id === 'english');
  assert.ok(english);
  assert.equal(english.status, 'completed');
  assert.equal(english.missingValue, 0);
});

test('buildRequirementChecks: specialization check omitted when unavailable', () => {
  const progress = makeProgress({
    specializationGroups: { completed: 0, required: 3, unavailable: true },
  });
  const checks = buildRequirementChecks(progress, []);
  assert.ok(!checks.some((c) => c.id === 'specialization_groups'));
});

test('buildRequirementChecks: countedCourseIds for mandatory_credits includes mandatory and mandatory_lab buckets', () => {
  const [l1] = EE_LAB_IDS;
  const assignments = [
    { courseId: EE_MANDATORY_ID, bucket: 'mandatory', credits: 3, specializationGroupIds: [] },
    { courseId: l1, bucket: 'mandatory_lab', credits: 1, specializationGroupIds: [] },
    { courseId: MELAG_ID, bucket: 'melag', credits: 2, specializationGroupIds: [] },
  ];
  const progress = makeProgress({ mandatory: { earned: 4, required: 106 } });
  const checks = buildRequirementChecks(progress, assignments);
  const mandatory = checks.find((c) => c.id === 'mandatory_credits');
  assert.ok(mandatory?.countedCourseIds.includes(EE_MANDATORY_ID));
  assert.ok(mandatory?.countedCourseIds.includes(l1));
  assert.ok(!mandatory?.countedCourseIds.includes(MELAG_ID));
});

test('computeRequirementsProgress: 1.5 sports-team credits still require 1 regular PE credit', () => {
  const input = makeInput({
    semesters: { 1: [SPORTS_TEAM_ID] },
    semesterOrder: [1],
    completedInstances: [`${SPORTS_TEAM_ID}__1__0`],
  });
  const courses = makeCourses({ [SPORTS_TEAM_ID]: 1.5 });

  const progress = buildGeneralProgress(input, courses);

  assert.equal(progress.sport.targetValue, 1);
  assert.equal(progress.sport.completedValue, 0);
  assert.equal(progress.general_electives.completedValue, 1.5);
});

test('computeRequirementsProgress: 3 sports-team credits complete PE without regular sport', () => {
  const input = makeInput({
    semesters: { 1: [SPORTS_TEAM_ID], 2: [SPORTS_TEAM_ID] },
    semesterOrder: [1, 2],
    completedInstances: [`${SPORTS_TEAM_ID}__1__0`, `${SPORTS_TEAM_ID}__2__0`],
  });
  const courses = makeCourses({ [SPORTS_TEAM_ID]: 1.5 });

  const progress = buildGeneralProgress(input, courses);

  assert.equal(progress.sport.targetValue, 0);
  assert.equal(progress.sport.completedValue, 0);
  assert.equal(progress.general_electives.completedValue, 3);
});

test('computeRequirementsProgress: choir/orchestra never satisfies sport', () => {
  const input = makeInput({
    semesters: { 1: [CHOIR_ID, CHOIR_ID, CHOIR_ID, CHOIR_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [CHOIR_ID]: 2 });

  const progress = buildGeneralProgress(input, courses);

  assert.equal(progress.sport.targetValue, 2);
  assert.equal(progress.sport.completedValue, 0);
  assert.equal(progress.free_elective.targetValue, 2);
  assert.equal(progress.general_electives.completedValue, 8);
});

test('computeRequirementsProgress: special enrichment minimum does not drop below 2', () => {
  const input = makeInput({
    semesters: { 1: [CHOIR_ID, CHOIR_ID, CHOIR_ID, CHOIR_ID, CHOIR_ID, CHOIR_ID] },
    semesterOrder: [1],
  });
  const courses = makeCourses({ [CHOIR_ID]: 2 });

  const progress = buildGeneralProgress(input, courses);

  assert.equal(progress.free_elective.targetValue, 2);
  assert.equal(progress.general_electives.completedValue, 8);
});

test('buildCourseAssignments: recognized special credits use the special_general bucket', () => {
  const input = makeInput({
    semesters: { 1: [SPORTS_TEAM_ID], 2: [SPORTS_TEAM_ID] },
    semesterOrder: [1, 2],
    completedInstances: [`${SPORTS_TEAM_ID}__1__0`, `${SPORTS_TEAM_ID}__2__0`],
  });
  const courses = makeCourses({ [SPORTS_TEAM_ID]: 1.5 });
  const result = buildCourseAssignments(input, courses, eeTrack, emptyCatalog);
  const assignment = result.find((a) => a.courseId === SPORTS_TEAM_ID);

  assert.equal(assignment?.bucket, 'special_general');
  assert.equal(assignment?.credits, 3);
});
