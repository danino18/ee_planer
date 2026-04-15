import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const planStoreSource = readFileSync(join(repoRoot, 'src/store/planStore.ts'), 'utf8');

test('renameVersion trims names and updates version timestamp for cloud sync', () => {
  assert.match(
    planStoreSource,
    /const trimmedName = name\.trim\(\);/,
    'renameVersion should normalize whitespace before persisting a version name',
  );
  assert.match(
    planStoreSource,
    /if \(!trimmedName\) return state;/,
    'renameVersion should ignore empty names',
  );
  assert.match(
    planStoreSource,
    /name: trimmedName, updatedAt: now/,
    'renameVersion should update updatedAt so the cloud envelope has a sync-visible change',
  );
});
