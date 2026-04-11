import { resolve } from 'node:path';
import {
  collectBundleMetrics,
  evaluateBundleBudget,
  formatBundleReport,
} from './lib/bundleMetrics.mjs';

const DIST_DIR = resolve(process.cwd(), 'dist');
const BUDGET = {
  entryJsRawBytes: 220 * 1024,
  entryJsGzipBytes: 70 * 1024,
  largestJsGzipBytes: 95 * 1024,
};

const metrics = collectBundleMetrics(DIST_DIR);
const budgetCheck = evaluateBundleBudget(metrics, BUDGET);
const report = formatBundleReport(metrics, budgetCheck);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ metrics, budgetCheck }, null, 2));
} else {
  console.log(report);
}

if (!budgetCheck.ok) {
  process.exitCode = 1;
}
