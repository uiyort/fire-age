import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toJson } from '../site/js/export.js';

const result = {
  p: { age: 30, life: 32, r: 0.0286, sigma: 0.11, wCur: 'CNY' },
  retireT: 1,
  mc: { seed: 20261026, paths: 2000, success: 0.5, bands: [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5]] },
  target: [10, 11, 12], dataVersion: '2026-11',
};

test('CSV has one row per year with percentiles and the target line', () => {
  const lines = toCsv(result).replace(/^﻿/, '').trim().split(/\r?\n/);
  assert.equal(lines[0], 'age,p10,p25,p50,p75,p90,target');
  assert.equal(lines.length, 4);
  assert.equal(lines[1], '30,1,2,3,4,5,10');
});

test('CSV starts with a byte order mark so Excel reads it correctly', () => {
  assert.equal(toCsv(result).charCodeAt(0), 0xFEFF);
});

test('JSON states everything needed to reproduce the run', () => {
  const j = JSON.parse(toJson(result));
  assert.equal(j.seed, 20261026);
  assert.equal(j.paths, 2000);
  assert.equal(j.dataVersion, '2026-11');
  assert.equal(j.assumptions.r, 0.0286);
  assert.equal(j.currency, 'CNY');
  assert.equal(j.retireYearIndex, 1);
  assert.equal(j.success, 0.5);
  assert.equal(j.yearly.length, 3);
  assert.deepEqual(j.yearly[0], { age: 30, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5, target: 10 });
});

test('exchange rates are part of the assumptions but functions are not', () => {
  const j = JSON.parse(toJson({ ...result, p: { ...result.p, fx: { USD: 1, CNY: 6.67 } } }));
  assert.equal(j.assumptions.fx.CNY, 6.67);
});
