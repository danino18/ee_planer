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
  if (!resolvedPath) throw new Error(`Unable to resolve "${specifier}" from ${fromDir}`);
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

  const specifiers = [...transpiled.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
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

function loadModule(relativePath) {
  return import(transpileToDataUrl(join(repoRoot, ...relativePath.split('/'))));
}

const { buildGeneralRequirementsProgress } = await loadModule('src/domain/generalRequirements/progressBuilder.ts');
const { eeTrack } = await loadModule('src/data/tracks/ee.ts');

const SPORTS_TEAM_ID = '03940902';
const CHOIR_ID = '03940587';

function makeCourses(creditsById) {
  const map = new Map();
  for (const [id, credits] of Object.entries(creditsById)) {
    map.set(id, { id, name: `Course ${id}`, credits, prerequisites: [], faculty: '' });
  }
  return map;
}

test('sports-team courses count automatically when placed (no per-instance signal needed)', () => {
  const courses = makeCourses({ [SPORTS_TEAM_ID]: 1.5 });
  const result = buildGeneralRequirementsProgress({
    courses,
    trackDef: eeTrack,
    semesters: { 1: [SPORTS_TEAM_ID, SPORTS_TEAM_ID] },
    completedCourses: [],
    englishTaughtCourses: [],
    miluimCredits: 0,
  });

  // 3 sports-team credits → table row: sport=0, freeChoice=3, enrichment=6.
  // Floors: sport canonical 2 fills via the table (2 nkz); free-choice fills 1 nkz.
  assert.equal(result.generalElectivesBreakdown.contributors.sportsTeamRecognized, 3);
  assert.equal(result.generalElectivesBreakdown.sportFloor.recognized, 2);
  assert.equal(result.generalElectivesBreakdown.total.recognized, 3);
});

test('choir/orchestra courses count automatically when placed multiple times', () => {
  const courses = makeCourses({ [CHOIR_ID]: 2 });
  const result = buildGeneralRequirementsProgress({
    courses,
    trackDef: eeTrack,
    semesters: { 1: [CHOIR_ID, CHOIR_ID, CHOIR_ID] },
    completedCourses: [],
    englishTaughtCourses: [],
    miluimCredits: 0,
  });

  // 6 choir credits → table: enrichment=4 (filled 2), freeChoice=0 (filled 4), sport=2.
  assert.equal(result.generalElectivesBreakdown.contributors.choirRecognized, 6);
  assert.equal(result.generalElectivesBreakdown.enrichmentFloor.recognized, 2);
  assert.equal(result.generalElectivesBreakdown.freeChoice.recognized, 4);
  assert.equal(result.generalElectivesBreakdown.total.recognized, 6);
});
