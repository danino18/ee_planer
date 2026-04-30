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

  const specifiers = [...transpiled.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((s) => s.startsWith('.'));

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

function loadModule(relativePath) {
  return import(transpileToDataUrl(join(repoRoot, ...relativePath.split('/'))));
}

const { allocateGeneralElectives } = await loadModule('src/domain/generalRequirements/electivesAllocator.ts');
const { calculateSpecialEnrichmentAllocation } = await loadModule('src/domain/generalRequirements/specialAllocation.ts');

const baseAllocation = calculateSpecialEnrichmentAllocation({
  choirOrOrchestraCredits: 0,
  sportsTeamCredits: 0,
});

function callAllocator(overrides = {}) {
  return allocateGeneralElectives({
    regularSportCredits: 0,
    melagCredits: 0,
    externalFacultyCredits: 0,
    recognizedChoirCredits: 0,
    recognizedSportsTeamCredits: 0,
    unrecognizedSpecialCredits: 0,
    allocation: baseAllocation,
    generalCreditsTarget: 12,
    ...overrides,
  });
}

test('default floors are 2 sport / 6 enrichment / 4 free-choice = 12', () => {
  const breakdown = callAllocator();
  assert.equal(breakdown.sportFloor.target, 2);
  assert.equal(breakdown.enrichmentFloor.target, 6);
  assert.equal(breakdown.freeChoice.target, 4);
  assert.equal(breakdown.total.target, 12);
});

test('regular sport beyond floor spills into free-choice', () => {
  const breakdown = callAllocator({ regularSportCredits: 4 });
  assert.equal(breakdown.sportFloor.recognized, 2);
  assert.equal(breakdown.freeChoice.recognized, 2);
  assert.equal(breakdown.contributors.regularSportToFloor, 2);
  assert.equal(breakdown.contributors.regularSportToFreeChoice, 2);
  assert.equal(breakdown.contributors.surplusBeyond12, 0);
  assert.equal(breakdown.total.recognized, 4);
});

test('regular sport beyond sport-floor + free-choice becomes surplus', () => {
  const breakdown = callAllocator({ regularSportCredits: 9 });
  assert.equal(breakdown.sportFloor.recognized, 2);
  assert.equal(breakdown.freeChoice.recognized, 4);
  assert.equal(breakdown.contributors.regularSportToFloor, 2);
  assert.equal(breakdown.contributors.regularSportToFreeChoice, 4);
  assert.equal(breakdown.contributors.surplusBeyond12, 3);
  assert.equal(breakdown.total.recognized, 6);
});

test('MELAG fills enrichment floor first, then spills into free-choice', () => {
  const breakdown = callAllocator({ melagCredits: 8 });
  assert.equal(breakdown.enrichmentFloor.recognized, 6);
  assert.equal(breakdown.freeChoice.recognized, 2);
  assert.equal(breakdown.contributors.melagToFloor, 6);
  assert.equal(breakdown.contributors.melagToFreeChoice, 2);
  assert.equal(breakdown.total.recognized, 8);
});

test('external-faculty electives only enter free-choice (cannot satisfy sport or enrichment)', () => {
  const breakdown = callAllocator({ externalFacultyCredits: 4 });
  assert.equal(breakdown.sportFloor.recognized, 0);
  assert.equal(breakdown.enrichmentFloor.recognized, 0);
  assert.equal(breakdown.freeChoice.recognized, 4);
  assert.equal(breakdown.contributors.externalFacultyToFreeChoice, 4);
});

test('combined sport + MELAG + external fills the 12 nkz exactly', () => {
  const breakdown = callAllocator({
    regularSportCredits: 2,
    melagCredits: 6,
    externalFacultyCredits: 4,
  });
  assert.equal(breakdown.total.recognized, 12);
  assert.equal(breakdown.contributors.surplusBeyond12, 0);
  assert.equal(breakdown.sportFloor.recognized, 2);
  assert.equal(breakdown.enrichmentFloor.recognized, 6);
  assert.equal(breakdown.freeChoice.recognized, 4);
});

test('choir credits reduce floors via the table; recognized credits land in total', () => {
  const allocation = calculateSpecialEnrichmentAllocation({
    choirOrOrchestraCredits: 6,
    sportsTeamCredits: 0,
  });
  // Per the table: 6 choir → recognized 6, enrichment 4, freeChoice 0, sport 2
  const breakdown = allocateGeneralElectives({
    regularSportCredits: 0,
    melagCredits: 0,
    externalFacultyCredits: 0,
    recognizedChoirCredits: allocation.recognizedChoirOrOrchestraCredits,
    recognizedSportsTeamCredits: 0,
    unrecognizedSpecialCredits: allocation.unrecognizedSpecialCredits,
    allocation,
    generalCreditsTarget: 12,
  });
  assert.equal(breakdown.enrichmentFloor.target, 4);
  assert.equal(breakdown.contributors.choirRecognized, 6);
  assert.equal(breakdown.total.recognized, 6);
});

test('unrecognized special credits never enter the total', () => {
  const allocation = calculateSpecialEnrichmentAllocation({
    choirOrOrchestraCredits: 12,
    sportsTeamCredits: 0,
  });
  // 12 choir credits — table caps recognition at 8.
  const breakdown = allocateGeneralElectives({
    regularSportCredits: 0,
    melagCredits: 0,
    externalFacultyCredits: 0,
    recognizedChoirCredits: allocation.recognizedChoirOrOrchestraCredits,
    recognizedSportsTeamCredits: 0,
    unrecognizedSpecialCredits: allocation.unrecognizedSpecialCredits,
    allocation,
    generalCreditsTarget: 12,
  });
  assert.equal(breakdown.contributors.choirRecognized, 8);
  assert.equal(breakdown.contributors.unrecognizedSpecialCredits, 4);
  assert.ok(breakdown.total.recognized <= 12);
});

test('total never exceeds the generalCreditsTarget (e.g. with miluim subtraction)', () => {
  const breakdown = callAllocator({
    regularSportCredits: 10,
    melagCredits: 10,
    externalFacultyCredits: 10,
    generalCreditsTarget: 8,
  });
  assert.equal(breakdown.total.target, 8);
  assert.ok(breakdown.total.recognized <= 8);
});
