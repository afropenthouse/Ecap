const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const path = require('node:path');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/pages/HR/Analytics/SelectionEvidence.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const componentModule = { exports: {} };
new Function('exports', 'require', compiled)(componentModule.exports, require);
const render = people => renderToStaticMarkup(React.createElement(componentModule.exports.default, { people, individual: true }));
const reviewed = { role: 'EMPLOYEE', competency: 80, performance: null, source: 'ASSESSOR', aligned: false, fresh: true };
test('empty selection asks for an employee without reporting missing evidence', () => {
  const html = render([]);
  assert.match(html, /Select an employee/);
  assert.doesNotMatch(html, /No completed|aligned assessor|0 with/);
});
test('competency review is visible even without a performance appraisal', () => {
  const html = render([reviewed]);
  assert.match(html, /Completed assessor competency review available/);
  assert.match(html, /No completed assessor performance appraisal in this period/);
  assert.doesNotMatch(html, /No completed competency review/);
});
test('succession planning does not report optional performance as missing', () => {
  const html = renderToStaticMarkup(React.createElement(componentModule.exports.default, { people: [reviewed], individual: true, performanceOptional: true }));
  assert.match(html, /Completed assessor competency review available/);
  assert.doesNotMatch(html, /No completed assessor performance/);
});
test('reviews from different periods remain visible with a separate date explanation', () => {
  const html = render([{ ...reviewed, performance: 80 }]);
  assert.match(html, /Completed assessor competency review available/);
  assert.match(html, /Completed assessor performance appraisal available/);
  assert.match(html, /more than 90 days apart/);
});
