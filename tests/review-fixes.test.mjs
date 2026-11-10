// Regressions for defects found in the whole-branch review.
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { assetsAt, bwdSolve, dualAges, fiNeed, fwdSolve, monteCarlo } from '../site/js/engine.js';
import { defaultState, loadState, setField, setRetireCountry, setWorkCountry, toParams } from '../site/js/state.js';
import { goalFor, headlineText, impactSentence, leversHtml, tilesHtml } from '../site/js/views.js';
import { impactOf } from '../site/js/levers.js';
import { PARAMS } from '../site/js/params.js';
import { goalApplies, makeGoal } from '../site/js/goals.js';
import { toCsv, toJson } from '../site/js/export.js';
import { assertFresh, mergeField } from '../scripts/update-data.mjs';

const make = (fields = {}, { workC = 'CN', retC = 'CN' } = {}) => {
  let S = setRetireCountry(setWorkCountry(defaultState(DATA), workC, DATA), retC, DATA);
  for (const [id, v] of Object.entries(fields)) S = setField(S, id, String(v), DATA);
  return toParams(S, DATA);
};

test('C1: a pension never delays the holiday, at any allocation', () => {
  for (const eq of [0, 20, 40, 60, 80, 100]) {
    for (const pension of [1, 6000, 24000, 60000, 120000]) {
      const p = make({ eq, pension });
      const { withPension, withoutPension } = dualAges(p);
      assert.ok(withPension <= withoutPension, `eq ${eq}, pension ${pension}: ${withPension} vs ${withoutPension}`);
      assert.ok(fiNeed(p, 5) <= fiNeed({ ...p, pension: 0 }, 5) + 1e-6, `need, eq ${eq}, pension ${pension}`);
    }
  }
});

test('C1: more pension never needs more assets', () => {
  const needs = [0, 1, 1000, 10000, 50000, 100000].map(pension => fiNeed(make({ eq: 0, pension }), 3));
  needs.reduce((a, b) => { assert.ok(b <= a + 1e-6, `${b} after ${a}`); return b; });
});

test('I1: a half-typed value does not become the fallback for a blank field', () => {
  let S = setField(defaultState(DATA), 'age', '35', DATA);
  S = setField(S, 'age', '3', DATA, { commit: false });
  S = setField(S, 'age', '', DATA, { commit: false });
  assert.equal(toParams(S, DATA).age, 35);
});

test('I2: a negative savings rate is not shown', () => {
  const p = make({ income: 100000, expense: 120000 });
  const html = tilesHtml({ mode: 'fwd', p, t: fwdSolve(p), bwd: bwdSolve(p), mc: null, dispCur: 'CNY' });
  assert.ok(!html.includes('-20%'), html);
  assert.match(html, /存不下钱/);
});

test('I2: the savings goal only offers rates between 0 and 100%', () => {
  assert.equal(goalFor('saveRate', make({ income: 100000, expense: 120000 })), null);
  assert.equal(goalFor('saveRate', make({ income: 100000, expense: 0 })), null);
  assert.ok(goalFor('saveRate', make({ income: 100000, expense: 80000 })));
});

test('I3: no lever and no savings explains the shortfall instead of a dead end', () => {
  const p = make({ income: 60000, expense: 120000, assets: 0 });
  const html = leversHtml([], p);
  assert.match(html, /超过支出/);
  assert.ok(!html.includes('单改一项'));
});

test('I4: spending above income leads with that fact even when an age exists', () => {
  const p = make({ income: 96000, expense: 120000, assets: 0 });
  const t = fwdSolve(p);
  assert.notEqual(t, null);
  const { say } = headlineText({ mode: 'fwd', p, t, bwd: bwdSolve(p), dual: dualAges(p), dispCur: 'CNY' });
  assert.match(say, /存不下钱/);
});

test('I4: the deterministic path and the simulation use one rule for running out', () => {
  const p = { ...make({ income: 96000, expense: 120000, assets: 0 }), sigma: 0 };
  const mc = monteCarlo(p, null, null, { paths: 1 });
  for (const t of [1, 5, 20, 40]) assert.ok(Math.abs(assetsAt(p, t) - mc.bands[t][2]) < 1e-6, `year ${t}`);
});

test('I4: required capital still counts the overspending it must cover', () => {
  const p = make({ income: 96000, expense: 120000, assets: 0, tAge: 45, growth: 0 });
  assert.ok(bwdSolve(p).reqA0 > fiNeed(p, p.tAge - p.age) / Math.pow(1 + p.r, p.tAge - p.age));
});

test('I6: assumptions nobody edited follow new monthly data', () => {
  const saved = { ...defaultState(DATA), bondY: 9.9, infl: 9.9, drag: 9.9, pAge: 99 };
  const S = loadState(DATA, { getItem: () => JSON.stringify(saved) });
  assert.equal(S.bondY, DATA.countries.CN.y10.value);
  assert.notEqual(S.infl, 9.9);
  assert.equal(S.drag, DATA.countries.CN.drag.value);
  assert.equal(S.pAge, DATA.countries.CN.pAge.value);
});

test('I6: an assumption the person edited is kept', () => {
  const edited = setField(defaultState(DATA), 'bondY', '4.2', DATA);
  const S = loadState(DATA, { getItem: () => JSON.stringify(edited) });
  assert.equal(S.bondY, 4.2);
  assert.equal(S.infl, defaultState(DATA).infl);
});

test('I7: most you can spend counts a pension larger than your assets', () => {
  const p = make({ age: 60, assets: 10000, income: 0, expense: 0, retExp: 60000, pension: 120000, pAge: 60, tAge: 65 });
  assert.ok(bwdSolve(p).maxE >= 120000);
});

test('I7: no assets still leaves the pension to spend', () => {
  const p = make({ age: 60, assets: 0, income: 0, expense: 0, retExp: 60000, pension: 120000, pAge: 60, tAge: 65 });
  assert.ok(bwdSolve(p).maxE >= 119000);
});

test('I8: currency drift has no effect when both places use one currency', () => {
  const flat = make({});
  const drifted = make({ fxDrift: 2 });
  assert.equal(fiNeed(flat, 10), fiNeed(drifted, 10));
  const impact = impactOf(drifted, 'fxDrift');
  assert.equal(impact.gainYears, null);
  assert.match(impact.stepLabel, /同一种货币/);
});

test('I8: drift still applies across borders', () => {
  const flat = make({}, { retC: 'TH' });
  const drifted = make({ fxDrift: 2 }, { retC: 'TH' });
  assert.ok(fiNeed(drifted, 10) > fiNeed(flat, 10));
});

test('I8: the simulation freezes drift at retirement, as the need calculation does', () => {
  const p = { ...make({ fxDrift: 2 }, { retC: 'TH' }), sigma: 0 };
  const t = fwdSolve(p);
  assert.equal(monteCarlo(p, t, null, { paths: 1 }).success, 1);
});

const exportFixture = {
  mode: 'bwd', view: 'pro', dispCur: 'USD', retireT: 1, dataVersion: '2026-11',
  p: { age: 30, life: 32, r: 0.03, wCur: 'CNY', rCur: 'CNY', fx: { USD: 1, CNY: 2 } },
  bwd: { s0: 5000 },
  mc: { seed: 20261026, paths: 2000, success: 0.5, bands: [[2, 4, 6, 8, 10], [2, 4, 6, 8, 10], [2, 4, 6, 8, 10]] },
  target: [20, 22, 24],
};

test('I9: the CSV is in the currency on screen and says so', () => {
  const lines = toCsv(exportFixture).replace(/^﻿/, '').trim().split(/\r?\n/);
  assert.ok(lines.includes('# currency,USD'));
  assert.ok(lines.includes('30,1,2,3,4,5,10'));
});

test('I9: the CSV carries its assumptions', () => {
  const csv = toCsv(exportFixture);
  for (const needle of ['# seed,20261026', '# paths,2000', '# dataVersion,2026-11', '# mode,bwd', '# requiredSavings,5000', '# r,0.03']) {
    assert.ok(csv.includes(needle), needle);
  }
});

test('I9: the JSON can reproduce a backward run', () => {
  const j = JSON.parse(toJson(exportFixture));
  assert.equal(j.mode, 'bwd');
  assert.equal(j.requiredSavings, 5000);
  assert.equal(j.displayCurrency, 'USD');
});

test('I10: a goal does not survive a change of work currency', () => {
  const cn = make();
  const goal = makeGoal('expense', 108000, cn, '2026-11-07');
  assert.equal(goal.cur, 'CNY');
  assert.equal(goalApplies(goal, cn), true);
  assert.equal(goalApplies(goal, make({}, { workC: 'US' })), false);
});

test('I11: a run where most sources failed refuses to publish', () => {
  const fields = Array.from({ length: 10 }, (_, i) => [`f${i}`, { status: i < 6 ? 'carried' : 'official', carriedSince: '2026-11-07' }]);
  assert.throws(() => assertFresh(fields, '2026-11-07'), /sources failed/);
});

test('I11: a field stuck on an old value for over three months refuses to publish', () => {
  const fields = [['stale', { status: 'carried', carriedSince: '2026-07-01' }], ...Array.from({ length: 9 }, (_, i) => [`f${i}`, { status: 'official' }])];
  assert.throws(() => assertFresh(fields, '2026-11-07'), /stale/);
});

test('I11: a few recently carried fields and fixed assumptions still publish', () => {
  const fields = [['a', { status: 'carried', carriedSince: '2026-10-16' }], ['b', { status: 'assumed' }], ['c', { status: 'official' }], ['d', { status: 'official' }]];
  assert.doesNotThrow(() => assertFresh(fields, '2026-11-07'));
});

test('I11: a carried field remembers when carrying began', () => {
  const prev = { value: 10, status: 'official', fetchedAt: '2026-10-16' };
  const first = mergeField(prev, null, { now: '2026-11-16' });
  assert.equal(first.carriedSince, '2026-11-16');
  assert.equal(mergeField(first, null, { now: '2026-12-16' }).carriedSince, '2026-11-16');
  const recovered = mergeField(first, { value: 10.1, observedAt: '2026-12' }, { now: '2026-12-16' });
  assert.equal(recovered.carriedSince, undefined);
});

test('I12: an empty source cell is treated as missing, not as a jump or a null value', () => {
  const prev = { value: 1.5, status: 'official', fetchedAt: '2026-10-16' };
  for (const value of [null, NaN, undefined]) {
    const out = mergeField(prev, { value, observedAt: '2026-11' }, { now: '2026-11-16', kind: 'rate' });
    assert.equal(out.status, 'carried');
    assert.equal(out.value, 1.5);
    assert.match(out.note, /未取到/);
  }
});

test('I14: the equity impact sentence states its risk side', () => {
  const p = make();
  assert.match(impactSentence(impactOf(p, 'eq')), /波动/);
});

test('I14: no learning card points at a product type', () => {
  assert.ok(!JSON.stringify(PARAMS).includes('指数化'));
});


test('no visitor-facing text says 杠杆, 裸放 or 解锁', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['site/index.html', 'site/method.html', 'site/js/views.js', 'site/js/card.js', 'site/js/studio.js', 'site/js/app.js', 'site/js/holiday.js', 'site/js/levers.js']) {
    const visible = readFileSync(f, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    for (const word of ['杠杆', '裸放', '解锁']) assert.ok(!visible.includes(word), `${f}: ${word}`);
  }
});

test('the fare axis says where the money comes from, and the card says 50 岁前', async () => {
  const DATA = (await import('../site/js/data-latest.js')).default;
  const { defaultState, toParams } = await import('../site/js/state.js');
  const { holidayType } = await import('../site/js/holiday.js');
  const { summaryCardSpec } = await import('../site/js/card.js');
  const p = toParams(defaultState(DATA), DATA);
  const type = holidayType(p, DATA, { workC: 'CN', retC: 'CN' });
  assert.match(type.axes[3].value, /^\d+% 来自今天已有的存款$/);
  const hero = { reachable: true, startAge: 30, holidayAge: 44, endAge: 95, workYears: 14, holidayYears: 51, mondays: 730, people: 8, fund: { share: 0.2 } };
  const spec = summaryCardSpec({ mode: 'fwd', type: { ...type, axes: type.axes.map((a, i) => (i === 0 ? { ...a, letter: 'E' } : a)) }, hero });
  assert.equal(spec.departs, '50 岁前');
});

test('the copy lint flags 杠杆, 解锁 and 裸放', async () => {
  const { findBannedCopy } = await import('../scripts/lint-copy.mjs');
  assert.deepEqual(findBannedCopy('解锁专业模式，用杠杆，不能裸放'), ['杠杆', '解锁', '裸放']);
});
