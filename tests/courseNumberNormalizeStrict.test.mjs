import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../scripts/lib/tsImport.mjs';

const { normalizeCourseNumberStrict } = await loadTsModule('src/utils/courseNumberNormalize.ts');

test('234122 → 02340122', () => {
  assert.deepEqual(normalizeCourseNumberStrict('234122'), { ok: true, value: '02340122' });
});

test('044101 → 00440101', () => {
  assert.deepEqual(normalizeCourseNumberStrict('044101'), { ok: true, value: '00440101' });
});

test('104824 → 01040824', () => {
  assert.deepEqual(normalizeCourseNumberStrict('104824'), { ok: true, value: '01040824' });
});

test('a valid 8-digit number is unchanged', () => {
  assert.deepEqual(normalizeCourseNumberStrict('02340114'), { ok: true, value: '02340114' });
});

test('leading zeroes preserved (string output)', () => {
  const r = normalizeCourseNumberStrict('044101');
  assert.equal(r.ok && r.value, '00440101');
  assert.equal(typeof (r.ok && r.value), 'string');
});

test('malformed identifiers are rejected with a reason', () => {
  assert.equal(normalizeCourseNumberStrict('abc').ok, false);
  assert.equal(normalizeCourseNumberStrict('').ok, false);
  assert.equal(normalizeCourseNumberStrict('123').ok, false);
  assert.equal(normalizeCourseNumberStrict('99999999').ok, false); // 8-digit but not 0XXX0XXX
});
