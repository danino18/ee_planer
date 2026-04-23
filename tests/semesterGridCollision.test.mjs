import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { closestCenter, closestCorners, pointerWithin, rectIntersection } from '@dnd-kit/core';

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

const { createSemesterGridCollisionDetection } = await loadTranspiledModule('src/utils/semesterGridCollision.ts');

function rect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function createDroppableContainer(id) {
  return {
    id,
    key: `${id}-key`,
    data: { current: {} },
    disabled: false,
    node: { current: null },
    rect: { current: null },
  };
}

function createCollisionArgs({
  activeId,
  collisionRect,
  droppableRects,
  pointerCoordinates = null,
}) {
  const rectEntries = Object.entries(droppableRects);

  return {
    active: {
      id: activeId,
      data: { current: {} },
      rect: { current: { initial: collisionRect, translated: collisionRect } },
    },
    collisionRect,
    droppableRects: new Map(rectEntries),
    droppableContainers: rectEntries.map(([id]) => createDroppableContainer(id)),
    pointerCoordinates,
  };
}

const collisionDetection = createSemesterGridCollisionDetection({
  closestCenter,
  closestCorners,
  pointerWithin,
  rectIntersection,
});

test('course dragging ignores column droppables and returns semester targets only', () => {
  const collisions = collisionDetection(createCollisionArgs({
    activeId: '044252__1__0',
    collisionRect: rect(100, 10, 40, 40),
    pointerCoordinates: { x: 120, y: 30 },
    droppableRects: {
      'col-2': rect(80, 0, 100, 120),
      'semester-2': rect(80, 0, 100, 120),
    },
  }));

  assert.deepEqual(collisions.map(({ id }) => id), ['semester-2']);
});

test('pointerWithin wins immediately when the pointer enters a semester column', () => {
  const collisions = collisionDetection(createCollisionArgs({
    activeId: '044252__1__0',
    collisionRect: rect(20, 20, 80, 80),
    pointerCoordinates: { x: 230, y: 60 },
    droppableRects: {
      'semester-1': rect(0, 0, 120, 120),
      'semester-2': rect(200, 0, 120, 120),
    },
  }));

  assert.equal(collisions[0]?.id, 'semester-2');
});

test('rectIntersection handles course dragging when pointer coordinates are unavailable', () => {
  const collisions = collisionDetection(createCollisionArgs({
    activeId: '044252__1__0',
    collisionRect: rect(150, 10, 80, 80),
    pointerCoordinates: null,
    droppableRects: {
      'semester-1': rect(0, 0, 120, 120),
      'semester-2': rect(140, 0, 120, 120),
    },
  }));

  assert.equal(collisions[0]?.id, 'semester-2');
});

test('column dragging keeps closestCenter scoped to column targets', () => {
  const calls = [];
  const columnCollisionDetection = createSemesterGridCollisionDetection({
    closestCenter: (args) => {
      calls.push(args.droppableContainers.map(({ id }) => id));
      return [{ id: 'col-2' }];
    },
    closestCorners: () => {
      throw new Error('closestCorners should not run for column dragging');
    },
    pointerWithin: () => {
      throw new Error('pointerWithin should not run for column dragging');
    },
    rectIntersection: () => {
      throw new Error('rectIntersection should not run for column dragging');
    },
  });

  const collisions = columnCollisionDetection(createCollisionArgs({
    activeId: 'col-1',
    collisionRect: rect(0, 0, 40, 40),
    pointerCoordinates: { x: 10, y: 10 },
    droppableRects: {
      'col-2': rect(80, 0, 100, 120),
      'semester-2': rect(0, 0, 100, 120),
      'col-3': rect(200, 0, 100, 120),
    },
  }));

  assert.deepEqual(calls, [['col-2', 'col-3']]);
  assert.equal(collisions[0]?.id, 'col-2');
});
