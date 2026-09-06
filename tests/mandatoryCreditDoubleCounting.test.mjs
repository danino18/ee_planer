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

const { computeRequirementsProgress } = await loadTranspiledModule('src/hooks/usePlan.ts');
const { resolveTrackForYear } = await loadTranspiledModule('src/domain/resolveTrack.ts');
const { getAllSemesterEntryCourseIds } = await loadTranspiledModule('src/data/tracks/semesterSchedule.ts');
const { eeTrack } = await loadTranspiledModule('src/data/tracks/ee.ts');
const { csTrack } = await loadTranspiledModule('src/data/tracks/cs.ts');
const { ceTrack } = await loadTranspiledModule('src/data/tracks/ce.ts');
const { eeMathTrack } = await loadTranspiledModule('src/data/tracks/ee_math.ts');
const { eePhysicsTrack } = await loadTranspiledModule('src/data/tracks/ee_physics.ts');
const { eeCombinedTrack } = await loadTranspiledModule('src/data/tracks/ee_combined.ts');

function course(id, credits) {
  return { id, name: `Course ${id}`, credits, prerequisites: [], faculty: '' };
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

function mandatoryEarnedFor(trackDef, courses, placedIds) {
  const progress = computeRequirementsProgress(
    {
      semesters: { 0: placedIds },
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
    trackDef,
    emptyCatalog(trackDef.id),
    null,
  );
  return progress.mandatory.earned;
}

function mandatoryRequiredFor(trackDef, courses, placedIds, englishScore) {
  const progress = computeRequirementsProgress(
    {
      semesters: { 0: placedIds },
      completedCourses: [],
      completedInstances: [],
      grades: {},
      binaryPass: {},
      selectedSpecializations: [],
      doubleSpecializations: [],
      hasEnglishExemption: false,
      miluimCredits: 0,
      englishScore,
      englishTaughtCourses: [],
      semesterOrder: [1],
      coreToChainOverrides: [],
      courseChainAssignments: {},
      electiveCreditAssignments: {},
      roboticsMinorEnabled: false,
      entrepreneurshipMinorEnabled: false,
    },
    courses,
    trackDef,
    emptyCatalog(trackDef.id),
    null,
  );
  return progress.mandatory.required;
}

// Regression test for the reported bug: in the 2025/26 and 2026/27 ee.ts year
// variants, semester 1 listed 01140071 (פיזיקה 1מ') and 01140032 (the lab
// alternative-group default) both directly in `courses` AND inside
// `alternativeGroups`, so computeRequirementsProgress's two-pass mandatory
// loop (courses, then alternativeGroups) credited each of them twice.
for (const year of [2025, 2026]) {
  test(`ee ${year} track does not double-count semester-1 physics defaults in mandatory credits`, () => {
    const trackDef = resolveTrackForYear(eeTrack, year);
    const courses = new Map([
      ['01140071', course('01140071', 3.5)],
      ['01140074', course('01140074', 5)],
      ['01140032', course('01140032', 4)],
      ['01140020', course('01140020', 1.5)],
    ]);

    assert.equal(mandatoryEarnedFor(trackDef, courses, ['01140071']), 3.5);
    assert.equal(mandatoryEarnedFor(trackDef, courses, ['01140032']), 4);
    assert.equal(
      mandatoryEarnedFor(trackDef, courses, ['01140071', '01140032']),
      7.5,
    );
  });
}

// General structural guard: no semesterSchedule entry (base or any year
// variant, any track) should list the same course ID in both its plain
// `courses` array and its `alternativeGroups`, since computeRequirementsProgress
// sums both as separate, non-deduplicated passes.
test('no track semesterSchedule entry lists a course in both courses and alternativeGroups', () => {
  const tracks = [eeTrack, csTrack, ceTrack, eeMathTrack, eePhysicsTrack, eeCombinedTrack];
  const offenders = [];

  for (const track of tracks) {
    const years = [null, ...Object.keys(track.yearVariants ?? {}).map(Number)];
    for (const year of years) {
      const resolved = year === null ? track : resolveTrackForYear(track, year);
      for (const entry of resolved.semesterSchedule) {
        const courseIds = new Set(entry.courses);
        const altIds = new Set((entry.alternativeGroups ?? []).flatMap((group) => group.courseIds));
        const overlap = [...courseIds].filter((id) => altIds.has(id));
        if (overlap.length > 0) {
          offenders.push(`${track.id} / year ${year ?? 'base'} / semester ${entry.semester}: ${overlap.join(', ')}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, []);
});

// getAllSemesterEntryCourseIds is used to build the mandatory-course-id set
// (getVisibleMandatoryCourseIds); confirm the fixed ee track still recognizes
// both defaults as mandatory even though they were removed from `courses`.
test('ee 2025 semester 1 still recognizes the physics defaults as mandatory via alternativeGroups', () => {
  const trackDef = resolveTrackForYear(eeTrack, 2025);
  const semester1 = trackDef.semesterSchedule.find((entry) => entry.semester === 1);
  const allIds = new Set(getAllSemesterEntryCourseIds(semester1));

  assert.ok(allIds.has('01140071'));
  assert.ok(allIds.has('01140032'));
});

// English exemption (englishScore >= 134): the Advanced English B course
// (03240033) is already hidden from mandatoryIds at that threshold; this
// verifies the required mandatory-credit total is reduced by that course's
// real credits to match, on the plain track path and the CE project-profile
// path, and that the narrower 120-133 partial-exemption band (Advanced
// English A only) does not affect the total.
{
  const englishAdvancedBCourse = { id: '03240033', name: "אנגלית טכנית-מתקדמים ב'", credits: 3, prerequisites: [], faculty: '' };

  test('ee 2025 track: no exemption keeps mandatory required at the base total', () => {
    const trackDef = resolveTrackForYear(eeTrack, 2025);
    const courses = new Map([[englishAdvancedBCourse.id, englishAdvancedBCourse]]);
    assert.equal(mandatoryRequiredFor(trackDef, courses, [], undefined), 106);
  });

  test('ee 2025 track: englishScore >= 134 reduces mandatory required by 3', () => {
    const trackDef = resolveTrackForYear(eeTrack, 2025);
    const courses = new Map([[englishAdvancedBCourse.id, englishAdvancedBCourse]]);
    assert.equal(mandatoryRequiredFor(trackDef, courses, [], 134), 103);
  });

  test('ee 2025 track: englishScore in the 120-133 partial band does not reduce mandatory required', () => {
    const trackDef = resolveTrackForYear(eeTrack, 2025);
    const courses = new Map([[englishAdvancedBCourse.id, englishAdvancedBCourse]]);
    assert.equal(mandatoryRequiredFor(trackDef, courses, [], 125), 106);
  });

  test('ce track: English exemption reduces mandatory required on top of the CS-project profile', () => {
    const trackDef = resolveTrackForYear(ceTrack, 2025);
    const csProjectA = { id: '02340991', name: 'פרויקט א', credits: 4, prerequisites: [], faculty: '' };
    const csProjectB = { id: '02340992', name: 'פרויקט ב', credits: 4, prerequisites: [], faculty: '' };
    const courses = new Map([
      [englishAdvancedBCourse.id, englishAdvancedBCourse],
      [csProjectA.id, csProjectA],
      [csProjectB.id, csProjectB],
    ]);
    const placedIds = [csProjectA.id, csProjectB.id];

    assert.equal(mandatoryRequiredFor(trackDef, courses, placedIds, undefined), 112.5);
    assert.equal(mandatoryRequiredFor(trackDef, courses, placedIds, 134), 109.5);
  });
}
