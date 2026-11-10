// Regressions for the UI review of 2026-11-10: people already there, people who never get there,
// the backward paths, and amounts told per month in the simple view.
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { bwdSolve } from '../site/js/engine.js';
import { bwdOdds, oddsRuler, oddsSolve } from '../site/js/odds.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { heroModel } from '../site/js/holiday.js';
import { fasterLead, headlineText, heroHtml, impactSentence, leversHtml, solvesHtml, tryValueText, wholeMoney } from '../site/js/views.js';
import { impactOf } from '../site/js/levers.js';
import { makeGoal } from '../site/js/goals.js';
import { summaryCardSpec } from '../site/js/card.js';
import { TYPES } from '../site/js/holiday.js';

// Simple-view inputs are monthly; the state holds years.
const make = (fields = {}) => {
  let S = defaultState(DATA);
  for (const [id, v] of Object.entries(fields)) S = setField(S, id, String(v), DATA);
  return toParams(S, DATA);
};
const hero = (p, mode = 'fwd') => {
  const t = oddsSolve(p);
  return heroModel({ mode, p, t, bwd: bwdSolve(p), success: null, ruler: mode === 'fwd' ? oddsRuler(p) : null });
};
const there = make({ age: 40, assets: 9000000, income: 144000, expense: 72000 });
const never = make({ age: 50, assets: 0, income: 36000, expense: 108000 });

test('someone already there is told so, not asked to earn more than they spend', () => {
  assert.equal(oddsSolve(there), 0);
  assert.equal(fasterLead([], { reached: true }), '已经到了，不用再提前。');
  const html = leversHtml([], there, { reached: true });
  assert.match(html, /不用再提前/);
  assert.doesNotMatch(html, /收入超过支出|单改一项/);
});

test('savings that cover every month to the end stop being counted in months', () => {
  const h = hero(there);
  assert.equal(h.covered, true);
  assert.equal(h.next, null);
  const html = heroHtml(h, { p: there, dispCur: 'CNY' });
  assert.match(html, /不算收益也够花到 95 岁/);
  assert.doesNotMatch(html, /再存|个月的假/);
});

test('someone who can stop today but whose savings run short of the end gets no next step', () => {
  const p = make({ age: 40, assets: 3000000, income: 144000, expense: 72000 });
  const h = hero(p);
  assert.equal(h.workYears, 0);
  assert.equal(h.covered, false);
  assert.equal(h.next, null);
});

test('someone who never gets there: no line repeating the headline, and no zero months', () => {
  const h = hero(never);
  assert.equal(h.reachable, false);
  const html = heroHtml(h, { p: never, dispCur: 'CNY' });
  assert.doesNotMatch(html, /hero-big|还没看到放假那天/);
  assert.doesNotMatch(html, />0<\/b> 个月/);
  assert.match(html, /还没开始攒假：存下 ¥10\.8万，就攒够一整年的假/);
});

test('a lab step that cannot reach the holiday says so instead of stopping mid-sentence', () => {
  const impact = impactOf(never, 'income');
  assert.equal(impact.reach, 'none');
  assert.match(impactSentence(impact), /，还是到不了放假。/);
  assert.equal(impactSentence({ stepLabel: '收入高 10%', gainYears: null, reach: 'unlocks' }), '收入高 10%，就能看到放假那天。');
});

test('backward paths print plain amounts, and say when one path alone cannot do it', () => {
  const p = make({ tAge: 45 });
  const html = solvesHtml({ p, bwd: bwdSolve(p), odds: bwdOdds(p), dispCur: 'CNY' });
  // Three figures at most: ¥5520, not ¥5517.39.
  assert.doesNotMatch(html, /\d{4}\.\d/);
  const far = make({ age: 45, assets: 0, income: 72000, expense: 68400, tAge: 47 });
  const farHtml = solvesHtml({ p: far, bwd: bwdSolve(far), odds: bwdOdds(far), dispCur: 'CNY' });
  assert.match(farHtml, /只靠多存做不到/);
  assert.doesNotMatch(farHtml, /储蓄率 \d{3,}%/);
});

test('the backward headline spaces the odds like the rest of the page', () => {
  const p = make({ tAge: 45 });
  const { say } = headlineText({ mode: 'bwd', p, t: oddsSolve(p), odds: bwdOdds(p), eightAge: null, dual: { withPension: null, withoutPension: null }, dispCur: 'CNY' });
  assert.match(say, /有 (?:不到 1|\d+) 成把握/);
});

test('simple-view lab amounts are per month, as they were typed', () => {
  const p = make();
  assert.equal(tryValueText(p.income, 'work', p, 'income'), '¥1.2万/月');
  assert.equal(tryValueText(p.expense, 'work', p, 'expense'), '¥6000/月');
  assert.doesNotMatch(tryValueText(p.assets, 'work', p, 'assets'), /\/月/);
  assert.equal(wholeMoney(200, 'CNY'), '¥200');
  assert.equal(makeGoal('expense', 64800, p, '2026-11-10').label, '每月支出降到 ¥5,400');
});

test('the card route does not repeat the age for someone who can stop today', () => {
  const h = hero(there);
  const spec = summaryCardSpec({ mode: 'fwd', type: { ...TYPES[0], axes: [{ letter: 'E', name: '启程', pole: '早' }] }, hero: h, privacy: { money: false, now: true } });
  assert.equal(spec.ticket.route, '40 → 95');
  assert.equal(spec.covered, true);
});
