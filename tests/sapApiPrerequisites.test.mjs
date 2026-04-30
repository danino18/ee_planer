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
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
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

test('addPrerequisiteOption appends a new OR-group without changing existing groups', async () => {
  const { addPrerequisiteOption } = await loadTranspiledModule('src/services/sapApi.ts');
  const course = {
    id: '00460267',
    name: 'מבנה מחשבים',
    credits: 3,
    prerequisites: [['00440105'], ['00440127', '00440131']],
    faculty: 'חשמל',
  };

  addPrerequisiteOption(course, ['02340124', '00440252']);

  assert.deepEqual(course.prerequisites, [
    ['00440105'],
    ['00440127', '00440131'],
    ['02340124', '00440252'],
  ]);
});

test('addPrerequisiteOption does not duplicate an existing OR-group', async () => {
  const { addPrerequisiteOption } = await loadTranspiledModule('src/services/sapApi.ts');
  const course = {
    id: '00460267',
    name: 'מבנה מחשבים',
    credits: 3,
    prerequisites: [['00440105'], ['02340124', '00440252']],
    faculty: 'חשמל',
  };

  addPrerequisiteOption(course, ['02340124', '00440252']);

  assert.deepEqual(course.prerequisites, [
    ['00440105'],
    ['02340124', '00440252'],
  ]);
});

test('parseNoAdditionalCreditIds extracts unique SAP course IDs', async () => {
  const { parseNoAdditionalCreditIds } = await loadTranspiledModule('src/services/sapApi.ts');

  assert.deepEqual(
    parseNoAdditionalCreditIds('00440252 02340252 00440252 02340262'),
    ['00440252', '02340252', '02340262'],
  );
});
