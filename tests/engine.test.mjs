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
  near(assetsAt(p, b.n, { r: b.reqR }), fiNeed(p, b.n, p.retExp, b.reqR), 1);
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

// ---- spending that ends at a known age ----
import { eventDelta, planFlows as planFlowsEv, savingsAt as savingsAtEv } from '../site/js/engine.js';
const mortgage = (o = {}) => ({ id: 'mortgage', amount: 36000, endAge: 50, nominal: true, ...o });
const kids = (o = {}) => ({ id: 'kids', amount: 24000, endAge: 40, nominal: false, ...o });

test('events: empty or missing events change no existing value', () => {
  const a = base(), b = base({ events: [] });
  assert.deepEqual(a.events, []);
  assert.equal(fiNeed(b, 10), fiNeed(a, 10));
  assert.equal(eventDelta(a, 7), 0);
  assert.equal(savingsAtEv(b, 5), savingsAtEv(a, 5));
});

test('events: a nominal payment is 0 in year 0, negative before it ends, minus the amount after', () => {
  const p = base({ events: [mortgage()] });
  assert.equal(eventDelta(p, 0), 0);
  assert.ok(eventDelta(p, 10) < 0);
  near(eventDelta(p, 10), 36000 * (Math.pow(1.015, -10) - 1), 1e-6);
  assert.equal(eventDelta(p, 20), -36000);
  assert.equal(eventDelta(p, 30), -36000);
});

test('events: a real-terms cost is 0 until it ends', () => {
  const p = base({ events: [kids()] });
  for (const t of [0, 3, 9]) assert.equal(eventDelta(p, t), 0);
  assert.equal(eventDelta(p, 10), -24000);
});

test('events: savings and planFlows pick the delta up, spending never goes negative', () => {
  const p = base({ events: [mortgage({ amount: 500000, endAge: 40 })] });
  assert.equal(savingsAtEv(p, 12), savingsAtEv(base(), 12) + 500000);
  near(savingsAtEv(p, 12, 1000), 1000 * Math.pow(1.02, 12) + 500000, 1e-6);
  const f = planFlowsEv(p, 5, null);
  for (let t = 0; t < f.full.length; t++) assert.ok(f.full[t] >= 0 && f.after[t] >= 0);
  assert.equal(f.full[20], 0);
});

test('events: the need falls once a payment ends, and never goes below zero', () => {
  const none = base({ pension: 0 }), one = base({ pension: 0, events: [mortgage()] });
  assert.ok(fiNeed(one, 5) < fiNeed(none, 5));
  const withPen = [base(), base({ events: [mortgage()] })];
  assert.ok(fiNeed(withPen[1], 5) < fiNeed(withPen[0], 5));
  assert.ok(fiNeed(withPen[1], 40) <= fiNeed(withPen[0], 40));
  const late = base({ pension: 0, events: [mortgage({ amount: 1e9, endAge: 33 })] });
  assert.equal(fiNeed(late, 5), 0);
});

test('events: the need drops in the pension-capped case too', () => {
  const q = e => base({ retExp: 72000, pension: 24000, expense: 72000, income: 144000, events: e });
  assert.ok(fiNeed(q([mortgage({ amount: 36000 })]), 10) < fiNeed(q([]), 10));
});
