import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const filesRoot = join(repoRoot, 'files', 'קבוצות התמחות');
const enginePath = join(repoRoot, 'src', 'domain', 'specializations', 'engine.ts');

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
  TRACK_SPECIALIZATION_FOLDERS,
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

  const rootLevelJsons = readdirSync(filesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
  assert.ok(rootLevelJsons.length > 0, 'Expected legacy root-level JSON files to exist for ignore test');
  for (const trackSources of Object.values(sources)) {
    assert.ok(trackSources.every((entry) => entry.path.split('קבוצות התמחות').at(-1).split('\\').length > 2));
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
