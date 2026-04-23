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

const { isSportCourseId } = await loadTranspiledModule('src/data/generalRequirements/courseClassification.ts');
const { GENERAL_REQUIREMENTS_RULES } = await loadTranspiledModule('src/data/generalRequirements/generalRules.ts');
const { calculateGeneralRequirements } = await loadTranspiledModule('src/domain/generalRequirements/rulesEngine.ts');

test('sport matcher includes the 03940800-03940820 range and excludes ids outside it', () => {
  assert.equal(isSportCourseId('03940800'), true);
  assert.equal(isSportCourseId('03940810'), true);
  assert.equal(isSportCourseId('03940820'), true);
  assert.equal(isSportCourseId('03940821'), false);
  assert.equal(isSportCourseId('03940902'), true);
});

test('mid-range sport ids count toward sport and general elective requirements', () => {
  const progress = calculateGeneralRequirements(
    [
      {
        courseId: '03940810',
        name: 'Sport course in range',
        credits: 1.5,
        language: 'HE',
        isLab: false,
      },
    ],
    GENERAL_REQUIREMENTS_RULES,
  );

  const sportRequirement = progress.find((requirement) => requirement.requirementId === 'sport');
  const generalElectivesRequirement = progress.find((requirement) => requirement.requirementId === 'general_electives');

  assert.equal(sportRequirement?.completedValue, 1.5);
  assert.deepEqual(sportRequirement?.countedCourses.map((course) => course.courseId), ['03940810']);
  assert.equal(generalElectivesRequirement?.completedValue, 1.5);
  assert.deepEqual(generalElectivesRequirement?.countedCourses.map((course) => course.courseId), ['03940810']);
});

test('semester sport warnings still derive from the shared sport matcher', () => {
  const semesterGridSource = readFileSync(join(repoRoot, 'src/components/SemesterGrid.tsx'), 'utf8');
  assert.match(
    semesterGridSource,
    /const sportCount = ids\.filter\(\(id\) => isSportCourseId\(id\)\)\.length;/,
  );

  const sportCount = ['03940810', '03940902'].filter((id) => isSportCourseId(id)).length;
  assert.equal(sportCount, 2);
  assert.equal(sportCount > 1, true);
});
