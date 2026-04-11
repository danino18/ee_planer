import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  collectBundleMetrics,
  evaluateBundleBudget,
  formatBundleReport,
} from '../scripts/lib/bundleMetrics.mjs';

test('collectBundleMetrics identifies entry assets and totals', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'bundle-metrics-'));
  const assetsDir = join(fixtureDir, 'assets');
  const viteDir = join(fixtureDir, '.vite');
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(viteDir, { recursive: true });

  writeFileSync(join(assetsDir, 'index-abc.js'), 'console.log("entry");');
  writeFileSync(join(assetsDir, 'vendor-def.js'), 'console.log("vendor vendor vendor");');
  writeFileSync(join(assetsDir, 'CourseDetailModal-xyz.js'), 'console.log("lazy");');
  writeFileSync(join(assetsDir, 'index-abc.css'), 'body{color:black}');
  writeFileSync(join(viteDir, 'manifest.json'), JSON.stringify({
    'index.html': {
      file: 'assets/index-abc.js',
      isEntry: true,
    },
    'src/components/CourseDetailModal.tsx': {
      file: 'assets/CourseDetailModal-xyz.js',
      isDynamicEntry: true,
    },
  }));

  try {
    const metrics = collectBundleMetrics(fixtureDir);
    assert.equal(metrics.entryJs?.name, 'index-abc.js');
    assert.equal(metrics.entryCss?.name, 'index-abc.css');
    assert.equal(metrics.jsFiles.length, 3);
    assert.ok(metrics.totals.jsRawBytes > 0);
    assert.equal(metrics.dynamicEntries.length, 1);
    assert.equal(metrics.dynamicEntries[0].source, 'src/components/CourseDetailModal.tsx');
    assert.ok(metrics.dynamicEntries[0].gzipBytes !== null);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('evaluateBundleBudget reports violations clearly', () => {
  const metrics = {
    entryJs: { rawBytes: 500, gzipBytes: 300, relativePath: 'assets/index.js' },
    largestJs: { rawBytes: 800, gzipBytes: 400, relativePath: 'assets/vendor.js' },
    entryCss: null,
    dynamicEntries: [],
    totals: { jsRawBytes: 1300, jsGzipBytes: 700, cssRawBytes: 0, cssGzipBytes: 0 },
  };

  const budgetCheck = evaluateBundleBudget(metrics, {
    entryJsRawBytes: 200,
    entryJsGzipBytes: 150,
    largestJsGzipBytes: 250,
    requiredDynamicEntries: {
      'src/components/CourseDetailModal.tsx': {
        maxGzipBytes: 10,
      },
    },
  });

  assert.equal(budgetCheck.ok, false);
  assert.equal(budgetCheck.violations.length, 4);
  assert.match(formatBundleReport(metrics, budgetCheck), /Budget violations:/);
});
