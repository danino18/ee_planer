import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../scripts/lib/tsImport.mjs';

const {
  parseGradeValue,
  parseStudents,
  parsePassFail,
  parseCourseHistogram,
} = await loadTsModule('src/domain/gradeStatistics/parse.ts');

test('parses a valid average from a string', () => {
  assert.deepEqual(parseGradeValue('68.67'), { value: 68.67, empty: false, invalid: false });
});

test('parses a valid median from a numeric value', () => {
  assert.deepEqual(parseGradeValue(82), { value: 82, empty: false, invalid: false });
});

test('empty string and placeholders become null (not zero)', () => {
  assert.equal(parseGradeValue('').value, null);
  assert.equal(parseGradeValue('-').value, null);
  assert.equal(parseGradeValue('').empty, true);
});

test('rejects values outside 0..100 → null + invalid', () => {
  assert.deepEqual(parseGradeValue('104'), { value: null, empty: false, invalid: true });
  assert.deepEqual(parseGradeValue('-3'), { value: null, empty: false, invalid: true });
});

test('rejects NaN and Infinity', () => {
  assert.equal(parseGradeValue('NaN').value, null);
  assert.equal(parseGradeValue(Infinity).value, null);
  assert.equal(parseGradeValue('abc').value, null);
});

test('parses passFail "311/62"', () => {
  assert.deepEqual(parsePassFail('311/62'), { passed: 311, failed: 62 });
  assert.equal(parsePassFail('bad'), null);
});

test('parses students as a non-negative integer', () => {
  assert.equal(parseStudents('373').value, 373);
  assert.equal(parseStudents('1.5').value, null);
  assert.equal(parseStudents('-2').value, null);
});

test('selects the primary category (Finals) and keeps record despite max=104', () => {
  const json = {
    '202401': {
      Staff: [{ name: 'X' }],
      Exam_A: { students: '403', average: '56.658', median: '55', min: '12', max: '104' },
      Finals: { students: '373', average: '68.67', median: '69', min: '24', max: '100' },
    },
  };
  const { records } = parseCourseHistogram('02340114', json);
  assert.equal(records.length, 1);
  assert.equal(records[0].category, 'Finals');
  assert.equal(records[0].average, 68.67);
  assert.equal(records[0].median, 69);
  assert.equal(records[0].students, 373);
});

test('out-of-range secondary field becomes null but record is kept; warning reported', () => {
  const json = {
    '202401': { Finals: { students: '10', average: '120', median: '70' } },
  };
  const { records, warnings } = parseCourseHistogram('02340114', json);
  assert.equal(records.length, 1);
  assert.equal(records[0].average, null);
  assert.equal(records[0].median, 70);
  assert.ok(warnings.some((w) => w.field === 'average'));
});

test('record is dropped only when both average and median are invalid', () => {
  const json = { '202401': { Finals: { students: '10', average: '', median: '' } } };
  const { records } = parseCourseHistogram('02340114', json);
  assert.equal(records.length, 0);
});

test('a missing/unsupported category yields no record', () => {
  const json = { '202401': { Exam_B: { average: '70', median: '71' }, Staff: [] } };
  const { records } = parseCourseHistogram('02340114', json);
  assert.equal(records.length, 0);
});

test('handles a course with no histogram data', () => {
  assert.deepEqual(parseCourseHistogram('02340114', {}).records, []);
});

test('handles malformed / non-object JSON without throwing', () => {
  assert.deepEqual(parseCourseHistogram('02340114', null).records, []);
  assert.deepEqual(parseCourseHistogram('02340114', 'oops').records, []);
  assert.deepEqual(parseCourseHistogram('02340114', [1, 2, 3]).records, []);
});
