const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const moduleUnderTest = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../src/utils/gapEvidence.ts'), 'utf8');
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleUnderTest.exports);
const { matchingSelf, currentAssignment, agreementPercentage } = moduleUnderTest.exports;
test('historical reviews match their cycle regardless of server ordering', () => {
  const old = { employeeId: 'person', type: 'SELF', status: 'COMPLETED', createdAt: '2026-01-01' };
  const recent = { ...old, createdAt: '2026-03-01' };
  const review = { ...old, type: 'ASSESSOR', status: 'REVIEWED', createdAt: '2026-02-01' };
  assert.equal(matchingSelf([recent, { ...old, status: 'IN_PROGRESS', createdAt: '2026-01-20' }, old], review), old);
  assert.equal(matchingSelf([recent], review), undefined);
});
test('opposing differences cannot cancel out and invalid ratings are ignored', () => {
  assert.equal(agreementPercentage([[1, 5], [5, 1]]), 0);
  assert.equal(agreementPercentage([[3, 3], [NaN, 5]]), 100);
  assert.equal(agreementPercentage([[2, 3]]), 75);
  assert.equal(agreementPercentage([[1, 10]], 9), 0);
});
test('current job excludes future roles and picks the latest effective assignment', () => {
  const rows = [{ employeeId: 'person', jobId: 'future', startDate: '2027-01-01' }, { employeeId: 'person', jobId: 'old', startDate: '2025-01-01' }, { employeeId: 'person', jobId: 'current', startDate: '2026-01-01' }];
  assert.equal(currentAssignment(rows, 'person', Date.parse('2026-10-14')).jobId, 'current');
});
