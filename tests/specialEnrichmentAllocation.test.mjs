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
  calculateSpecialEnrichmentAllocation,
} = await loadTranspiledModule('src/domain/generalRequirements/specialAllocation.ts');

test('choir/orchestra 4-year allocation follows the Technion table', () => {
  const cases = [
    { credits: 0, enrichment: 6, freeChoice: 4, recognized: 0, surplus: 0 },
    { credits: 2, enrichment: 6, freeChoice: 2, recognized: 2, surplus: 0 },
    { credits: 4, enrichment: 6, freeChoice: 0, recognized: 4, surplus: 0 },
    { credits: 6, enrichment: 4, freeChoice: 0, recognized: 6, surplus: 0 },
    { credits: 8, enrichment: 2, freeChoice: 0, recognized: 8, surplus: 0 },
    { credits: 10, enrichment: 2, freeChoice: 0, recognized: 8, surplus: 2 },
    { credits: 12, enrichment: 2, freeChoice: 0, recognized: 8, surplus: 4 },
  ];

  for (const entry of cases) {
    const allocation = calculateSpecialEnrichmentAllocation({
      choirOrOrchestraCredits: entry.credits,
      sportsTeamCredits: 0,
    });

    assert.equal(allocation.enrichmentRequired, entry.enrichment);
    assert.equal(allocation.freeChoiceRequired, entry.freeChoice);
    assert.equal(allocation.sportRequired, 2);
    assert.equal(allocation.recognizedChoirOrOrchestraCredits, entry.recognized);
    assert.equal(allocation.unrecognizedSpecialCredits, entry.surplus);
  }
});

test('sports-team 4-year allocation follows the Technion table', () => {
  const cases = [
    { credits: 0, enrichment: 6, freeChoice: 4, sport: 2, recognized: 0, surplus: 0 },
    { credits: 1.5, enrichment: 6, freeChoice: 3.5, sport: 1, recognized: 1.5, surplus: 0 },
    { credits: 3, enrichment: 6, freeChoice: 3, sport: 0, recognized: 3, surplus: 0 },
    { credits: 4.5, enrichment: 6, freeChoice: 1.5, sport: 0, recognized: 4.5, surplus: 0 },
    { credits: 6, enrichment: 4, freeChoice: 2, sport: 0, recognized: 6, surplus: 0 },
    { credits: 7.5, enrichment: 4, freeChoice: 0.5, sport: 0, recognized: 7.5, surplus: 0 },
    { credits: 9, enrichment: 2, freeChoice: 1, sport: 0, recognized: 9, surplus: 0 },
    { credits: 10.5, enrichment: 2, freeChoice: 1, sport: 0, recognized: 9, surplus: 1.5 },
    { credits: 12, enrichment: 2, freeChoice: 1, sport: 0, recognized: 9, surplus: 3 },
  ];

  for (const entry of cases) {
    const allocation = calculateSpecialEnrichmentAllocation({
      choirOrOrchestraCredits: 0,
      sportsTeamCredits: entry.credits,
    });

    assert.equal(allocation.enrichmentRequired, entry.enrichment);
    assert.equal(allocation.freeChoiceRequired, entry.freeChoice);
    assert.equal(allocation.sportRequired, entry.sport);
    assert.equal(allocation.recognizedSportsTeamCredits, entry.recognized);
    assert.equal(allocation.unrecognizedSpecialCredits, entry.surplus);
  }
});
