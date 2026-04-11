import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

export function collectBundleMetrics(distDir) {
  const assetDir = join(distDir, 'assets');
  const files = walk(assetDir).map((filePath) => {
    const rawBytes = statSync(filePath).size;
    const gzipBytes = gzipSync(readFileSync(filePath)).length;
    const name = basename(filePath);

    return {
      filePath,
      relativePath: relative(distDir, filePath),
      name,
      ext: extname(filePath),
      rawBytes,
      gzipBytes,
      isEntry: /^index-/.test(name),
    };
  });

  const jsFiles = files.filter((file) => file.ext === '.js');
  const cssFiles = files.filter((file) => file.ext === '.css');
  const entryJs = jsFiles.find((file) => file.isEntry) ?? null;
  const entryCss = cssFiles.find((file) => file.isEntry) ?? null;
  const largestJs = jsFiles.reduce((largest, file) => (
    !largest || file.rawBytes > largest.rawBytes ? file : largest
  ), null);

  return {
    files,
    jsFiles,
    cssFiles,
    entryJs,
    entryCss,
    largestJs,
    totals: {
      jsRawBytes: jsFiles.reduce((sum, file) => sum + file.rawBytes, 0),
      jsGzipBytes: jsFiles.reduce((sum, file) => sum + file.gzipBytes, 0),
      cssRawBytes: cssFiles.reduce((sum, file) => sum + file.rawBytes, 0),
      cssGzipBytes: cssFiles.reduce((sum, file) => sum + file.gzipBytes, 0),
    },
  };
}

export function evaluateBundleBudget(metrics, budget) {
  const violations = [];

  if (metrics.entryJs && metrics.entryJs.rawBytes > budget.entryJsRawBytes) {
    violations.push(
      `Entry JS raw size ${formatKiB(metrics.entryJs.rawBytes)} exceeds ${formatKiB(budget.entryJsRawBytes)}.`,
    );
  }

  if (metrics.entryJs && metrics.entryJs.gzipBytes > budget.entryJsGzipBytes) {
    violations.push(
      `Entry JS gzip size ${formatKiB(metrics.entryJs.gzipBytes)} exceeds ${formatKiB(budget.entryJsGzipBytes)}.`,
    );
  }

  if (metrics.largestJs && metrics.largestJs.gzipBytes > budget.largestJsGzipBytes) {
    violations.push(
      `Largest JS gzip size ${formatKiB(metrics.largestJs.gzipBytes)} exceeds ${formatKiB(budget.largestJsGzipBytes)}.`,
    );
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function formatBundleReport(metrics, budgetCheck) {
  const lines = [
    'Bundle metrics:',
    `- Entry JS: ${metrics.entryJs ? `${metrics.entryJs.relativePath} (${formatKiB(metrics.entryJs.rawBytes)} raw / ${formatKiB(metrics.entryJs.gzipBytes)} gzip)` : 'missing'}`,
    `- Largest JS: ${metrics.largestJs ? `${metrics.largestJs.relativePath} (${formatKiB(metrics.largestJs.rawBytes)} raw / ${formatKiB(metrics.largestJs.gzipBytes)} gzip)` : 'missing'}`,
    `- Total JS: ${formatKiB(metrics.totals.jsRawBytes)} raw / ${formatKiB(metrics.totals.jsGzipBytes)} gzip`,
    `- Entry CSS: ${metrics.entryCss ? `${metrics.entryCss.relativePath} (${formatKiB(metrics.entryCss.rawBytes)} raw / ${formatKiB(metrics.entryCss.gzipBytes)} gzip)` : 'missing'}`,
  ];

  if (!budgetCheck.ok) {
    lines.push('Budget violations:');
    for (const violation of budgetCheck.violations) {
      lines.push(`- ${violation}`);
    }
  }

  return lines.join('\n');
}
