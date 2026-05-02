import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());

const appSource = readFileSync(join(repoRoot, 'src/App.tsx'), 'utf8');
const wrapperSource = readFileSync(join(repoRoot, 'src/components/ShareModeWrapper.tsx'), 'utf8');
const storeSource = readFileSync(join(repoRoot, 'src/store/planStore.ts'), 'utf8');

test('owner share review uses share document freshness and ref-safe cleanup', () => {
  assert.match(wrapperSource, /const shareUpdatedAt = response\.share\.updatedAt;/);
  assert.doesNotMatch(wrapperSource, /Math\.max\([^)]*envelope\.versions/s);
  assert.match(wrapperSource, /const stateRef = useRef<ShareLoadState>/);
  assert.match(wrapperSource, /stateRef\.current = \{\s*status: 'ready'/s);
  assert.match(wrapperSource, /share-last-seen-\$\{shareId\}/);
  assert.match(wrapperSource, /loadShareReviewEnvelope\(/);
});

test('share mode suppresses owner plan cloud sync while preserving partner share saves', () => {
  assert.match(appSource, /if \(shareMode\) return;/);
  assert.match(appSource, /if \(!shareMode\?\.canEdit \|\| shareMode\.isOwner\) return;/);
  assert.match(appSource, /copyShareReviewToEditableVersion/);
});

test('store separates normal and internal version limits and guards share review edits', () => {
  assert.match(storeSource, /export const NORMAL_VERSION_LIMIT = 4;/);
  assert.match(storeSource, /export const INTERNAL_VERSION_LIMIT = 6;/);
  assert.match(storeSource, /copyShareReviewToEditableVersion/);
  assert.match(storeSource, /reason: 'no_share_review' \| 'capacity_full'/);
  assert.match(storeSource, /if \(isShareReviewReadOnly\(state\)\) return state;/);
  assert.match(storeSource, /state\.versions\.length >= NORMAL_VERSION_LIMIT/);
  assert.match(storeSource, /state\.versions\.length >= INTERNAL_VERSION_LIMIT/);
});
