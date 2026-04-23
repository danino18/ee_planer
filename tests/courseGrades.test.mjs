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

const {
  clearRepeatableCourseSemesterGrade,
  computeWeightedAverage,
  moveRepeatableCourseGrade,
  sanitizeRepeatableCourseGrades,
} = await loadTranspiledModule('src/utils/courseGrades.ts');

function buildCourses(creditsByCourseId) {
  return new Map(
    Object.entries(creditsByCourseId).map(([courseId, credits]) => [courseId, { id: courseId, credits }]),
  );
}

test('single graded semester yields the same semester and overall weighted average as the screenshot scenario', () => {
  const input = {
    semesters: {
      0: [],
      1: [
        '01040013',
        '01040064',
        '01140071',
        '02340117',
        '03240033',
        '00450001',
        '00450002',
        '03940902',
      ],
    },
    grades: {
      '01040013': 81,
      '01040064': 80,
      '01140071': 79,
      '02340117': 100,
      '03240033': 94,
      '00450001': 95,
      '00450002': 95,
      '03940902_1': 98,
    },
    binaryPass: {},
  };
  const courses = buildCourses({
    '01040013': 5.5,
    '01040064': 5,
    '01140071': 3.5,
    '02340117': 4,
    '03240033': 3,
    '00450001': 1,
    '00450002': 1,
    '03940902': 1.5,
  });

  const overallAverage = computeWeightedAverage(input, courses);
  const semesterAverage = computeWeightedAverage(input, courses, 1);

  assert.equal(Number(overallAverage?.toFixed(1)), 87.4);
  assert.equal(Number(semesterAverage?.toFixed(1)), 87.4);
});

test('orphan grades and unassigned courses do not affect the overall weighted average', () => {
  const input = {
    semesters: {
      0: ['UNASSIGNED'],
      1: ['PLACED'],
    },
    grades: {
      'PLACED': 90,
      'UNASSIGNED': 40,
      'ORPHAN': 20,
      '03940902_4': 10,
    },
    binaryPass: {},
  };
  const courses = buildCourses({
    'PLACED': 3,
    'UNASSIGNED': 4,
    'ORPHAN': 5,
    '03940902': 1.5,
  });

  assert.equal(computeWeightedAverage(input, courses), 90);
});

test('binary pass courses are excluded from semester and overall weighted average', () => {
  const input = {
    semesters: {
      0: [],
      1: ['NUMERIC', 'BINARY'],
    },
    grades: {
      'NUMERIC': 88,
      'BINARY': 55,
    },
    binaryPass: {
      BINARY: true,
    },
  };
  const courses = buildCourses({
    'NUMERIC': 3,
    'BINARY': 6,
  });

  assert.equal(computeWeightedAverage(input, courses), 88);
  assert.equal(computeWeightedAverage(input, courses, 1), 88);
});

test('moving a repeatable course between semesters carries its grade to the new semester key', () => {
  const movedGrades = moveRepeatableCourseGrade({ '03940902_1': 95 }, '03940902', 1, 2);

  assert.deepEqual(movedGrades, { '03940902_2': 95 });
});

test('sport courses in the 03940800-03940820 range use semester-scoped repeatable grade keys', () => {
  const movedGrades = moveRepeatableCourseGrade({ '03940810_1': 91 }, '03940810', 1, 2);

  assert.deepEqual(movedGrades, { '03940810_2': 91 });

  const sanitized = sanitizeRepeatableCourseGrades(
    { 0: ['03940810'], 1: ['03940810'], 2: [] },
    { '03940810_1': 91, '03940810_2': 88, REGULAR: 77 },
  );

  assert.deepEqual(sanitized, { '03940810_1': 91, REGULAR: 77 });
});

test('clearing or sanitizing repeatable-course semester grades removes orphaned grade keys', () => {
  const cleared = clearRepeatableCourseSemesterGrade(
    { '03940902_1': 95, '03940902_2': 87 },
    '03940902',
    1,
  );
  assert.deepEqual(cleared, { '03940902_2': 87 });

  const sanitized = sanitizeRepeatableCourseGrades(
    { 0: ['03940902'], 2: [] },
    { '03940902_1': 95, '03940902_2': 87, REGULAR: 91 },
  );
  assert.deepEqual(sanitized, { REGULAR: 91 });
});
