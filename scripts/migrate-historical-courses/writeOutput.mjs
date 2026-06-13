// Single write step for the (future) real run. In dry-run mode this performs
// no filesystem access at all, so the dry run is guaranteed read-only.

import { writeFile } from 'node:fs/promises';

/**
 * @param {string} path Absolute path to write to.
 * @param {string} content File content.
 * @param {{ dryRun: boolean }} options
 * @returns {Promise<{ written: boolean, path: string }>}
 */
export async function writeGeneratedFile(path, content, { dryRun }) {
  if (dryRun) {
    return { written: false, path };
  }
  await writeFile(path, content, 'utf8');
  return { written: true, path };
}
