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
  buildEffectiveChainAssignments,
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

  const eeControlRobotics = findGroup(catalogs.ee, 'בקרה ורובוטיקה');
  const controlRoboticsMissingAdditionalFromControl2 = evaluateSpecializationGroup(
    eeControlRobotics,
    ['00440191', '00460192'],
    'single',
  );
  assert.equal(
    controlRoboticsMissingAdditionalFromControl2.mandatoryChoicesSatisfied,
    true,
    'mandatory_choice_groups should satisfy the OR requirement when Control 2 is taken',
  );
  assert.equal(
    controlRoboticsMissingAdditionalFromControl2.additionalRuleSatisfied,
    false,
    'Taking only Control 1 and Control 2 should still miss the additional course requirement',
  );
  const controlRoboticsMissingAdditionalFromIntro = evaluateSpecializationGroup(
    eeControlRobotics,
    ['00440191', '00460212'],
    'single',
  );
  assert.equal(
    controlRoboticsMissingAdditionalFromIntro.mandatoryChoicesSatisfied,
    true,
    'mandatory_choice_groups should satisfy the OR requirement when Intro to Robotics is taken',
  );
  assert.equal(
    controlRoboticsMissingAdditionalFromIntro.additionalRuleSatisfied,
    false,
    'Taking only Control 1 and Intro to Robotics should still miss the additional course requirement',
  );
  const controlRoboticsCompleteWithElectiveFromControl2 = evaluateSpecializationGroup(
    eeControlRobotics,
    ['00440191', '00460192', '00440139'],
    'single',
  );
  assert.equal(
    controlRoboticsCompleteWithElectiveFromControl2.complete,
    true,
    'Control and Robotics should complete with Control 1, one mandatory-choice course, and one elective',
  );
  const controlRoboticsCompleteWithElectiveFromIntro = evaluateSpecializationGroup(
    eeControlRobotics,
    ['00440191', '00460212', '00440139'],
    'single',
  );
  assert.equal(
    controlRoboticsCompleteWithElectiveFromIntro.complete,
    true,
    'Control and Robotics should also complete with the robotics intro path plus one elective',
  );
  const controlRoboticsCompleteUsingBothChoiceCourses = evaluateSpecializationGroup(
    eeControlRobotics,
    ['00440191', '00460192', '00460212'],
    'single',
  );
  assert.equal(
    controlRoboticsCompleteUsingBothChoiceCourses.complete,
    true,
    'The unconsumed course from the mandatory choice pair should remain available as the third course',
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

test('evaluateSpecializationGroup: a course cross-assigned to another chain can still bypass its own chain\'s mandatory-course slot', () => {
  const sources = buildSourcesFromFiles();
  const catalogs = buildTrackSpecializationCatalogs(sources);
  const eeControlRobotics = findGroup(catalogs.ee, 'בקרה ורובוטיקה');
  const eeMachineLearning = findGroup(catalogs.ee, 'למידת מכונה');

  // 00460195 ("מערכות לומדות") is the mandatory course of eeMachineLearning, but it's also a
  // valid "additional course" option for eeControlRobotics. 00440191 is eeControlRobotics's own
  // mandatory course, but also appears as an elective option in eeMachineLearning. Both are
  // ambiguous between the two selected chains, so they need an explicit assignment.
  const allTakenEE = ['00460195', '00440191', '00460192', '00460202', '00460217', '00460010'];
  const explicitAssignments = { '00460195': eeControlRobotics.id, '00440191': eeControlRobotics.id };
  const effectiveAssignments = buildEffectiveChainAssignments(
    new Set(allTakenEE),
    [eeControlRobotics, eeMachineLearning],
    explicitAssignments,
  );

  const controlEval = evaluateSpecializationGroup(eeControlRobotics, allTakenEE, 'single', effectiveAssignments, allTakenEE);
  assert.equal(controlEval.complete, true, 'Control & Robotics should close using the cross-assigned מערכות לומדות course');

  const mlEval = evaluateSpecializationGroup(eeMachineLearning, allTakenEE, 'single', effectiveAssignments, allTakenEE);
  assert.equal(
    mlEval.complete,
    true,
    'ML/IS chain should still close via the bypass: 00460202+00460217+00460010 satisfy the 3-course quota without counting the cross-assigned mandatory course',
  );
  assert.deepEqual(mlEval.bypassedMandatoryCourseNumbers, ['00460195']);

  // Regression guard: same effective assignments, but WITHOUT the new allTakenCourseNumbers
  // argument — the cross-assigned mandatory course must NOT bypass under the legacy call shape.
  const mlEvalNoBypassParam = evaluateSpecializationGroup(eeMachineLearning, allTakenEE, 'single', effectiveAssignments);
  assert.equal(mlEvalNoBypassParam.complete, false, 'legacy call shape (no allTakenCourseNumbers) keeps today\'s behavior');

  // Regression guard: mandatory course never taken by anyone at all must still block completion,
  // even with 3+ other chain courses present and the bypass parameter supplied.
  const noMandatoryAtAll = ['00460192', '00460202', '00460217', '00460010'];
  const effectiveAssignments2 = buildEffectiveChainAssignments(
    new Set(noMandatoryAtAll),
    [eeControlRobotics, eeMachineLearning],
    {},
  );
  const mlEvalNeverTaken = evaluateSpecializationGroup(
    eeMachineLearning,
    noMandatoryAtAll,
    'single',
    effectiveAssignments2,
    noMandatoryAtAll,
  );
  assert.equal(mlEvalNeverTaken.doneCount, 3, 'sanity check: quota is met by the other 3 courses');
  assert.equal(mlEvalNeverTaken.complete, false, '00460195 was never taken anywhere, so it must not be bypassable');
  assert.equal(mlEvalNeverTaken.bypassedMandatoryCourseNumbers.length, 0);
});


