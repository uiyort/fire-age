// Working backward to the age the person is now: what are the odds of stopping today with what they have?
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { bwdSolve } from '../site/js/engine.js';
import { bwdOdds, dualOdds, successAt } from '../site/js/odds.js';
import { heroModel } from '../site/js/holiday.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { headlineText, heroHtml, solvesHtml } from '../site/js/views.js';
import { summaryCardSpec } from '../site/js/card.js';
import { toCsv } from '../site/js/export.js';

// 35 years old, 25 times a yearly spend of ¥72,000, earning what is spent.
const plan = (o = {}) => {
  let S = { ...defaultState(DATA), mode: 'bwd' };
  for (const [id, v] of Object.entries({ age: 35, tAge: 35, assets: 1800000, income: 72000, expense: 72000, retExp: 72000, ...o })) S = setField(S, id, String(v), DATA);
  return toParams(S, DATA);
};

test('the target age may be the age itself, and is never moved past it', () => {
  assert.equal(plan().tAge, 35);
  assert.equal(plan({ tAge: 30 }).tAge, 35);
});

test('stopping today: the odds are those of today\'s savings, and there is no year left to save in', () => {
  const p = plan();
  const odds = bwdOdds(p);
  assert.equal(odds.n, 0);
  assert.equal(odds.s0, null);
  assert.equal(odds.success, successAt(p, 0, null));
  assert.equal(odds.enough, odds.success >= 0.8);
  assert.ok(odds.success > 0.2 && odds.success < 0.4, `about 3 in 10, got ${odds.success}`);
  const bwd = bwdSolve(p);
  assert.equal(bwd.n, 0);
  assert.equal(bwd.s0, null);
  assert.ok(Number.isFinite(bwd.reqA0) && bwd.reqA0 > p.assets);
  assert.ok(Number.isFinite(bwd.maxE) && bwd.maxE > 0 && bwd.maxE < p.retExp);
});

test('with enough today, stopping today is enough', () => {
  const odds = bwdOdds(plan({ assets: 5000000 }));
  assert.equal(odds.enough, true);
  assert.equal(odds.s0, null);
});

test('the headline offers waiting, never a monthly saving there is no time for', () => {
  const p = plan();
  const odds = bwdOdds(p);
  const { say } = headlineText({ mode: 'bwd', p, t: null, odds, eightAge: 50, dual: dualOdds(p), dispCur: 'CNY' });
  assert.match(say, /如果今天就放假/);
  assert.match(say, /等到 50 岁/);
  assert.doesNotMatch(say, /每月需存/);
  const { say: pro } = headlineText({ mode: 'bwd', p, t: null, odds, eightAge: 50, dual: dualOdds(p), dispCur: 'CNY', view: 'pro' });
  assert.doesNotMatch(pro, /储蓄|NaN|null/);
});

test('stopping today, saving more is not one of the ways, and the others are on the 8-in-10 standard', () => {
  const p = plan();
  const html = solvesHtml({ p, bwd: bwdSolve(p), odds: bwdOdds(p), dispCur: 'CNY' });
  assert.doesNotMatch(html, /多存|约五成/);
  assert.match(html, /少花：放假后每年最多花（八成把握）/);
  assert.match(html, /本金：今天需要有（八成把握）/);
  assert.match(html, /少花/);
  assert.match(html, /本金/);
  assert.doesNotMatch(html, /NaN|null|Infinity/);
});

test('the hero says the holiday starts today without claiming it is safe', () => {
  const p = plan();
  const odds = bwdOdds(p);
  const h = heroModel({ mode: 'bwd', p, t: null, bwd: bwdSolve(p), success: odds.success });
  const html = heroHtml(h, { p, dispCur: 'CNY' });
  assert.match(html, /今天就停，钱要花 <b>60<\/b> 年/);
  assert.doesNotMatch(html, /现在就能放假|今天起放假/);
  // The bar is green only for the years the money lasts without returns, and says so.
  assert.match(html, /class="rest-open"/);
  assert.match(html, /按不涨不跌算，现有的钱够花/);
});

test('the card says the holiday starts today, not a saving of nothing', () => {
  const type = { code: 'EHTS', name: '采菊人', emoji: '🌼', group: '归园派', blurb: '早早收工，回家种花。', weakness: '', axes: [] };
  const hero = { reachable: true, startAge: 35, holidayAge: 35, endAge: 95, workYears: 0, holidayYears: 60, mondays: 0, people: 3, months: 300, fund: { share: 0.6 } };
  const s = summaryCardSpec({ mode: 'bwd', type, hero, enough: false, monthlyText: null, privacy: { money: true, now: true } });
  assert.doesNotMatch(JSON.stringify(s), /每月存|再上 0 年班/);
  assert.match(JSON.stringify(s), /今天就放假/);
});

test('the export leaves the saving out when there is no year to save in', () => {
  const p = plan();
  const csv = toCsv({ p, mc: { seed: 1, paths: 2000, success: 0.3, bands: [] }, retireT: 0, dataVersion: DATA.version, mode: 'bwd', bwd: bwdSolve(p), odds: bwdOdds(p) });
  assert.match(csv, /# requiredSavings,\r?\n/);
});

test('stopping today short of 8 in 10 is never called a holiday already covered', async () => {
  const { holidayType } = await import('../site/js/holiday.js');
  const p = plan();
  const odds = bwdOdds(p);
  const type = holidayType(p, DATA, { workC: 'CN', retC: 'CN', retireT: 0, success: odds.success });
  assert.notEqual(type.status.id, 'reached');
  assert.equal(type.status.name, '今天就停');
  assert.match(type.blurb, /把握是 \d 成，还不到八成/);
  assert.match(type.status.why, /等到 \d+ 岁再放，就有八成把握/);
  assert.match(type.axes.find(a => a.key === 'fare').value, /全部来自已有的存款/);
  assert.doesNotMatch(type.status.why, /已经够/);
  // With 8 in 10 or better, today is a holiday already covered.
  const rich = plan({ assets: 5000000 });
  assert.equal(holidayType(rich, DATA, { workC: 'CN', retC: 'CN', retireT: 0, success: bwdOdds(rich).success }).status.id, 'reached');
});

test('the professional headline gives the odds to one decimal, so 29.7% does not read as 30% beside 2 in 10', () => {
  const p = plan();
  const { say } = headlineText({ mode: 'bwd', p, t: null, odds: bwdOdds(p), eightAge: 51, dual: dualOdds(p), dispCur: 'CNY', view: 'pro' });
  assert.match(say, /29\.7%/);
});
