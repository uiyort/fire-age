import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, toParams, setField } from '../site/js/state.js';
import { rankLevers, impactOf, personalLever } from '../site/js/levers.js';

test('the personal lever skips the place move everyone shares, and speaks in the person\'s own money', () => {
  const p = toParams(defaultState(DATA), DATA);
  const D = v => `¥${Math.round(v).toLocaleString('en-US')}`;
  const levers = rankLevers(p, DATA, { retC: 'CN' });
  assert.ok(!levers.some(l => l.id === 'place'), 'moving away is not a way to retire earlier');
  const lever = personalLever(levers, p, D);
  assert.equal(lever.action, '每月少花 10%（约 ¥600）');
  assert.ok(lever.gain > 0);
  const save = personalLever([{ id: 'saveRate', gainYears: 0.5, unlocks: false }], p, D);
  assert.equal(save.action, '每月多存 ¥600');
  assert.equal(personalLever([{ id: 'place', gainYears: 4 }], p, D), null);
  const unlock = personalLever([{ id: 'growth', unlocks: true, afterYears: 20 }], p, D);
  assert.deepEqual(unlock, { action: '收入每年多涨 1 个百分点', plain: '收入每年多涨 1 个百分点', unlockAge: p.age + 20 });
  assert.equal(personalLever([{ id: 'spend', gainYears: 1, unlocks: false }], p, D).plain, '每月少花一成');
  assert.ok(!/[¥\d,]{4,}/.test(personalLever([{ id: 'saveRate', gainYears: 1, unlocks: false }], p, D).plain));
});
import { PARAMS } from '../site/js/params.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const p = (edits = {}) => {
  let s = defaultState(DATA);
  for (const [k, v] of Object.entries(edits)) s = setField(s, k, String(v));
  return toParams(s, DATA);
};

test('levers are sorted by years gained and capped at three', () => {
  const out = rankLevers(p(), DATA, { retC: 'CN' });
  assert.ok(out.length <= 3 && out.length > 0);
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].gainYears >= out[i].gainYears);
  for (const l of out) assert.ok(l.gainYears > 0);
});

test('a lever that makes the goal reachable ranks first', () => {
  // Explicit return assumptions keep this case stable as monthly data changes: the baseline never reaches the goal.
  const stuck = p({ assets: 0, income: 120000, expense: 120000, growth: 0, retExp: 120000, pension: 0, eq: 60, eqReal: 5, bondY: 1.65, infl: 1.5, drag: 0.2 });
  const out = rankLevers(stuck, DATA, { retC: 'CN' });
  assert.equal(out[0].unlocks, true);
  assert.equal(out[0].beforeYears, null);
  assert.ok(Number.isFinite(out[0].afterYears));
  assert.equal(out[0].gainYears, null);
});

test('a zero fee drops out of the fee lever', () => {
  const out = rankLevers(p({ drag: 0 }), DATA, { retC: 'CN', top: 9 });
  assert.ok(!out.some(l => l.id === 'fee'));
});

test('retiring in the cheapest place offers no place lever', () => {
  const cheapest = Object.entries(DATA.countries).sort((a, b) => a[1].priceLevel.value - b[1].priceLevel.value)[0][0];
  const out = rankLevers(p(), DATA, { retC: cheapest, top: 9 });
  assert.ok(!out.some(l => l.id === 'place'));
});

test('allocation is never offered as a lever', () => {
  const out = rankLevers(p(), DATA, { retC: 'CN', top: 9 });
  assert.ok(!out.some(l => /股票|配置/.test(l.label)));
});

test('every adjustable input has a learning card', () => {
  const ids = new Set(PARAMS.map(c => c.id));
  for (const id of ['age', 'assets', 'income', 'expense', 'growth', 'retExp', 'life', 'pension', 'pAge', 'eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr', 'sigEq', 'sigBd', 'rho']) {
    assert.ok(ids.has(id), id);
  }
  for (const c of PARAMS) assert.ok(c.range ? c.range.sourceUrl : c.noRangeReason, c.id);
});

test('learning-card copy passes the compliance lint', () => {
  for (const c of PARAMS) assert.deepEqual(findBannedCopy(`${c.what} ${c.improve}`), [], c.id);
  assert.ok(findBannedCopy('这只基金稳赚').length > 0);
});

test('impact is reported per step in years', () => {
  const i = impactOf(p(), 'eqReal');
  assert.ok(i.stepLabel);
  assert.ok(Number.isFinite(i.gainYears) && i.gainYears > 0);
});

test('volatility moves the holiday age, because the age is counted by the odds', () => {
  assert.ok(impactOf(p(), 'sigEq').gainYears < 0);
  assert.ok(impactOf(p(), 'flexCut').gainYears > 0);
  assert.equal(impactOf(p(), 'swr').gainYears, null);
});

test('every card has an impact description that does not crash', () => {
  for (const c of PARAMS) assert.ok(impactOf(p(), c.id).stepLabel, c.id);
});
