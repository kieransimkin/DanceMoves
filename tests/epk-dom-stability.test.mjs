import assert from 'node:assert/strict';
import test from 'node:test';
import { assessGrowth } from '../tools/epk-dom-stability.mjs';

const sample = (domElements, generatedCssChars, generatedCssRules) => ({ domElements, generatedCssChars, generatedCssRules });

test('stable EPK passes despite small dynamic node variation', () => {
  const samples = [sample(400, 900, 2), sample(404, 900, 2), sample(398, 900, 2), sample(406, 900, 2), sample(402, 900, 2), sample(405, 900, 2)];
  assert.equal(assessGrowth(samples).pass, true);
});

test('unbounded DOM insertion fails for any EPK page', () => {
  const samples = [400, 402, 404, 440, 470, 500].map(nodes => sample(nodes, 900, 2));
  const result = assessGrowth(samples);
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.metric === 'domElements').pass, false);
});

test('stylesheet growth fails even if DOM node count stays flat', () => {
  const samples = [sample(400, 900, 2), sample(400, 1800, 4), sample(400, 2700, 6), sample(400, 3600, 8), sample(400, 4500, 10), sample(400, 5400, 12)];
  const result = assessGrowth(samples);
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.metric === 'domElements').pass, true);
  assert.equal(result.checks.find(check => check.metric === 'generatedCssChars').pass, false);
});
