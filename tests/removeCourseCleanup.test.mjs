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

const { usePlanStore } = await loadTranspiledModule('src/store/planStore.ts');

test('removing the last unassigned course occurrence clears related course metadata', () => {
  usePlanStore.getState().loadPlan({
    trackId: 'ee',
    semesters: { 0: ['03940810'], 1: [] },
    completedCourses: ['03940810'],
    selectedSpecializations: [],
    favorites: [],
    grades: { '03940810_1': 95 },
    substitutions: {},
    maxSemester: 1,
    selectedPrereqGroups: { '03940810': ['00440102'] },
    summerSemesters: [],
    currentSemester: null,
    semesterOrder: [1],
    binaryPass: { '03940810': true },
    explicitSportCompletions: ['03940810'],
    completedInstances: ['03940810__0__0'],
    englishTaughtCourses: ['03940810'],
    courseChainAssignments: { '03940810': 'chain-a' },
    electiveCreditAssignments: { '03940810': 'general' },
  });

  usePlanStore.getState().removeCourseFromSemester('03940810', 0, '03940810__0__0');

  const state = usePlanStore.getState();
  assert.deepEqual(state.semesters[0], []);
  assert.deepEqual(state.completedCourses, []);
  assert.deepEqual(state.grades, {});
  assert.deepEqual(state.binaryPass, {});
  assert.deepEqual(state.explicitSportCompletions, []);
  assert.deepEqual(state.completedInstances, []);
  assert.deepEqual(state.englishTaughtCourses, []);
  assert.deepEqual(state.courseChainAssignments, {});
  assert.deepEqual(state.electiveCreditAssignments, {});
  assert.deepEqual(state.selectedPrereqGroups, {});
});

