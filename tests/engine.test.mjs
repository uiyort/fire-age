import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParams, fwdSolve, fiYears, fiNeed, assetsAt, bwdSolve, monteCarlo, dualAges, savingsRate, longRunInflation } from '../site/js/engine.js';

const FX = { USD: 1, CNY: 6.6688, MYR: 4.08 };
const base = (o = {}) => buildParams({
  age: 30, life: 95, assets: 500000, income: 300000, expense: 120000, growth: 2,
  retExp: 120000, pension: 36000, pAge: 63, tAge: 45, eq: 60, eqReal: 5, bondY: 1.65,
  infl: 1.5, drag: 0.2, fxDrift: 0, swr: 3.9, autoSwr: true, sigEq: 0.17, sigBd: 0.06,
  rho: 0.2, wCur: 'CNY', rCur: 'CNY', ...o }, FX);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} !~ ${b}`);

test('regression: forward result matches the published calculator', () => {
  const p = base();
  near(p.r, 0.0286, 1e-9);
  near(p.sigma, 0.1094, 1e-3);
  const t = fwdSolve(p);
  assert.equal(p.age + t, 41);
  near(fiNeed(p, t), 3177478, 1);
  near(assetsAt(p, t), 3352547, 1);
});

test('regression: Monte Carlo is reproducible with the default seed', () => {
  const p = base();
  const a = monteCarlo(p, fwdSolve(p), null);
  const b = monteCarlo(p, fwdSolve(p), null);
  near(a.success, 0.587, 0.001);
  assert.equal(a.success, b.success);
  assert.equal(a.paths, 2000);
  assert.equal(a.seed, 20261026);
});

test('backward solutions round-trip', () => {
  const p = base();
  const b = bwdSolve(p);
  near(b.need, 3041559, 1);
  near(assetsAt(p, b.n, { s0: b.s0 }), b.need, 1);
  near(fiNeed(p, b.n, b.maxE), b.An, 1);
  near(b.reqR, 0.0055, 1e-4);
});

test('fiYears falls inside the solved year and is fractional', () => {
  const p = base();
  const t = fwdSolve(p), y = fiYears(p);
  assert.ok(y > t - 1 && y <= t);
  assert.equal(fiYears(base({ assets: 1e9 })), 0);
});

test('pension gives two ages, and no pension gives equal ages', () => {
  const d = dualAges(base());
  assert.ok(d.withPension < d.withoutPension);
  const n = dualAges(base({ pension: 0 }));
  assert.equal(n.withPension, n.withoutPension);
});

test('spending at or above income never produces NaN', () => {
  for (const o of [{ income: 100000, expense: 120000 }, { income: 0 }, { income: 0, expense: 0, assets: 0 }]) {
    const p = base(o);
    const t = fwdSolve(p);
    assert.ok(t === null || Number.isInteger(t));
    const y = fiYears(p);
    assert.ok(y === null || Number.isFinite(y));
    const b = bwdSolve(p);
    for (const k of ['need', 's0', 'maxE', 'reqA0', 'An']) assert.ok(Number.isFinite(b[k]), k);
    assert.ok(!Number.isNaN(b.reqR));
  }
  assert.equal(savingsRate(base({ income: 0 })), null);
});

test('age extremes and absurd assumptions stay finite', () => {
  for (const o of [{ age: 94, tAge: 94 }, { age: 70, pAge: 63 }, { eqReal: -500 }, { retExp: 0, pension: 0 }]) {
    const p = base(o);
    assert.ok(p.r >= -0.5);
    const mc = monteCarlo(p, fwdSolve(p), null, { paths: 50 });
    for (const row of mc.bands) for (const v of row) assert.ok(Number.isFinite(v));
  }
});

test('long-run inflation is the midpoint of CPI and target', () => {
  assert.equal(longRunInflation(0.9, 2), 1.5);
  assert.equal(longRunInflation(4, 2.5), 3.3);
});
