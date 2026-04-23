import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const filesRoot = join(repoRoot, 'files', 'קבוצות התמחות');
const enginePath = join(repoRoot, 'src', 'domain', 'specializations', 'engine.ts');
const TRACK_SPECIALIZATION_FOLDERS = {
  ee: 'מסלול הנדסת חשמל',
  cs: 'מסלול הנדסת מחשבים ותוכנה',
  ee_math: 'מסלול הנדסת חשמל ומתמטיקה',
  ee_physics: 'מסלול הנדסת חשמל ופיזיקה',
  ee_combined: 'מסלול משולב-חשמל-פיסיקה(178 נקז)',
  ce: 'מסלול הנדסת מחשבים',
};

const engineSource = readFileSync(enginePath, 'utf8');
const transpiledEngine = ts.transpileModule(engineSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const engineModuleUrl = `data:text/javascript;base64,${Buffer.from(transpiledEngine).toString('base64')}`;
const {
  buildTrackSpecializationCatalogs,
  evaluateSpecializationGroup,
} = await import(engineModuleUrl);

function buildSourcesFromFiles() {
  return Object.fromEntries(
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
  );
}

function findGroup(catalog, nameFragment) {
  const group = catalog.groups.find((entry) => entry.name.includes(nameFragment));
  assert.ok(group, `Expected group containing "${nameFragment}" in ${catalog.trackId}`);
  return group;
}

test('track-specific specialization catalogs load and validate correctly', () => {
  const sources = buildSourcesFromFiles();
  const catalogs = buildTrackSpecializationCatalogs(sources);

  assert.ok(catalogs.ee.groups.length > 0, 'EE track should load specialization groups');
  assert.ok(catalogs.cs.groups.length > 0, 'CS track should load specialization groups');
  assert.notDeepEqual(
    catalogs.ee.groups.map((group) => group.name).sort(),
    catalogs.cs.groups.map((group) => group.name).sort(),
    'Different tracks should load different specialization sets',
  );
  for (const trackSources of Object.values(sources)) {
    assert.ok(
      trackSources.every((entry) => relative(filesRoot, entry.path).split(sep).filter(Boolean).length >= 2),
      'Track specialization sources should stay grouped under a track-specific folder',
    );
  }

  const eeComm = findGroup(catalogs.ee, 'תקשורת');
  const eeCommResult = evaluateSpecializationGroup(
    eeComm,
    ['00460206', '00460205', '00440214'],
    'single',
  );
  assert.equal(eeCommResult.complete, true, 'EE communication group should complete with EE-specific required courses');
  const eeQuantum = findGroup(catalogs.ee, 'טכנולוגיות קוונטיות');
  const eeMathQuantum = findGroup(catalogs.ee_math, 'טכנולוגיות קוונטיות');
  assert.equal(eeQuantum.canBeDouble, true, 'Quantum specialization should allow double mode in EE');
  assert.equal(eeMathQuantum.canBeDouble, false, 'Same specialization name should behave differently in EE+Math');

  const csCommunication = findGroup(catalogs.cs, 'תקשורת');
  const csCommunicationEvaluation = evaluateSpecializationGroup(
    csCommunication,
    ['00460206', '00460205'],
    'single',
  );
  assert.equal(
    csCommunication.mandatoryCourses.includes('00460205'),
    false,
    'Choice-rule course should not be flattened into legacy mandatory courses',
  );
  assert.deepEqual(
    csCommunicationEvaluation.ruleBlocks.map((block) => block.kind),
    ['mandatory_courses', 'mandatory_choice', 'additional_courses'],
    'Communication group should expose separate rule blocks for mandatory, OR choice, and additional courses',
  );
  assert.deepEqual(
    csCommunicationEvaluation.ruleBlocks[0].options.map((option) => option.courseNumber),
    ['00460206'],
    'Mandatory block should contain only the true mandatory course',
  );
  assert.deepEqual(
    csCommunicationEvaluation.ruleBlocks[1].options.map((option) => option.courseNumber).sort(),
    ['00460204', '00460205', '00460208', '00460733', '02360309'].sort(),
    'Mandatory choice block should contain only the OR-required communication courses',
  );
  assert.equal(
    csCommunicationEvaluation.ruleBlocks[2].requiredCount,
    1,
    'Additional-course block should preserve the number of extra courses required',
  );
  assert.equal(
    csCommunicationEvaluation.ruleBlocks[2].isSatisfied,
    false,
    'Taking only the mandatory course and one OR choice should still leave the additional-course block incomplete',
  );
  const csCommunicationComplete = evaluateSpecializationGroup(
    csCommunication,
    ['00460206', '00460205', '00440214'],
    'single',
  );
  assert.equal(csCommunicationComplete.complete, true, 'Communication group should complete once the additional course is taken');
  assert.equal(
    csCommunicationComplete.ruleBlocks[2].isSatisfied,
    true,
    'Additional-course block should complete when one extra course from the wide list is taken',
  );

  const eeBio = findGroup(catalogs.ee, 'ביולוג');
  const bioMissingMandatory = evaluateSpecializationGroup(
    eeBio,
    ['00440191', '00460010'],
    'single',
  );
  assert.equal(bioMissingMandatory.mandatoryCoursesSatisfied, false, 'Mandatory course should be enforced');
  assert.equal(bioMissingMandatory.complete, false, 'Group should fail when mandatory course is missing');

  const bioMissingChoice = evaluateSpecializationGroup(
    eeBio,
    ['00460326', '00460010'],
    'single',
  );
  assert.equal(bioMissingChoice.mandatoryChoicesSatisfied, false, 'Mandatory choice rule should be enforced');

  const ceIntelligent = findGroup(catalogs.ce, 'מערכות נבונות');
  const ceMutualExclusion = evaluateSpecializationGroup(
    ceIntelligent,
    ['00460345', '02360216', '00460212', '02360927', '00460195'],
    'single',
  );
  assert.equal(ceMutualExclusion.mutualExclusionSatisfied, false, 'Mutual exclusion rules should be enforced');
  assert.equal(ceMutualExclusion.complete, false, 'Conflicting mutually exclusive courses should fail completion');

  const csAlgorithms = findGroup(catalogs.cs, 'אלגוריתמים');
  const replacementSatisfied = evaluateSpecializationGroup(
    csAlgorithms,
    ['00460195', '01040193', '00460205'],
    'single',
  );
  assert.equal(replacementSatisfied.complete, true, 'Replacement rules should satisfy the replaced course slot');

  assert.equal(findGroup(catalogs.ee_math, 'תקשורת').canBeDouble, false, 'EE+Math must ignore double specialization');
  assert.equal(findGroup(catalogs.ce, 'טכנולוגיות קוונטיות').canBeDouble, false, 'Computer Engineering must ignore double specialization');
  assert.equal(findGroup(catalogs.cs, 'תקשורת').canBeDouble, false, 'Computer Engineering and Software must ignore double specialization');

  assert.equal(eeComm.canBeDouble, true, 'EE communication group should still allow double specialization');
  assert.ok(
    (eeComm.doubleMinCoursesToComplete ?? 0) > eeComm.minCoursesToComplete,
    'Double specialization should keep its larger course requirement where allowed',
  );

  const malformedCatalogs = buildTrackSpecializationCatalogs({
    ...sources,
    ee: [...sources.ee, { path: 'broken.json', content: '{ this is not json' }],
  });
  assert.equal(malformedCatalogs.ee.hasErrors, true, 'Malformed JSON should produce a track error');
  assert.equal(malformedCatalogs.ee.interactionDisabled, true, 'Malformed JSON should disable specialization interactions');
  assert.ok(
    malformedCatalogs.ee.diagnostics.some((diagnostic) => diagnostic.code === 'malformed-specialization-json'),
    'Malformed JSON diagnostic should be reported',
  );

  const missingCatalogs = buildTrackSpecializationCatalogs({
    ...sources,
    cs: [],
  });
  assert.equal(missingCatalogs.cs.hasErrors, true, 'Missing track folder should produce an error');
  assert.ok(
    missingCatalogs.cs.diagnostics.some((diagnostic) => diagnostic.code === 'missing-track-specialization-files'),
    'Missing track folder diagnostic should be reported',
  );
});


