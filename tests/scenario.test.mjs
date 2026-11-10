import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { fiYears, fwdSolve, lifePath, monteCarlo } from '../site/js/engine.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { labPlan } from '../site/js/levers.js';
import { PARAMS, PARAM_GROUPS } from '../site/js/params.js';
import { SCENARIOS, answerValues, baselineOf, cleanAnswers, countBody, scenarioOptions } from '../site/js/scenario.js';
import { scenarioHtml, viewsBannerHtml } from '../site/js/views.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const person = (fields = {}) => {
  let S = defaultState(DATA);
  for (const [id, value] of Object.entries(fields)) S = setField(S, id, String(value), DATA);
  return toParams(S, DATA);
};
const base = baselineOf(DATA, 'CN');
const params = Object.fromEntries(PARAMS.map(c => [c.id, c]));

test('every question is about the years ahead and sets a real parameter', () => {
  assert.ok(SCENARIOS.length >= 5);
  for (const s of SCENARIOS) {
    assert.ok(s.question && s.insight, s.id);
    assert.ok(params[s.param], s.param);
    assert.equal(scenarioOptions(s, base).length, 3, s.id);
    for (const o of scenarioOptions(s, base)) assert.ok(o.label && Number.isFinite(o.value), s.id);
  }
});

test('one answer is always the default assumption, so saying no change changes nothing', () => {
  for (const s of SCENARIOS) assert.ok(scenarioOptions(s, base).some(o => o.value === base[s.param]), s.id);
});

test('question copy passes the compliance rules, and the stock share is not advice', () => {
  for (const s of SCENARIOS) assert.deepEqual(findBannedCopy(JSON.stringify([s, scenarioOptions(s, base)])), [], s.id);
  const eq = SCENARIOS.find(s => s.param === 'eq');
  assert.match(eq.insight, /不是建议/);
});

test('answers become parameter values, and are the same every time they are applied', () => {
  const answers = { [SCENARIOS[0].id]: 0, [SCENARIOS[1].id]: 2 };
  const values = answerValues(answers, base);
  assert.equal(Object.keys(values).length, 2);
  assert.deepEqual(values, answerValues(answers, base));
  assert.deepEqual(answerValues({}, base), {});
  assert.deepEqual(answerValues({ gone: 1 }, base), {});
});

test('stored answers keep only current questions with a valid option', () => {
  assert.deepEqual(cleanAnswers({ market: 9, crash: 1, stocks: -1, prices: 1.5, rates: '2', wages: 0, gone: 1, nerve: 1 }), { crash: 1, wages: 0 });
  for (const bad of [null, 'x', 7, [1, 2]]) assert.deepEqual(cleanAnswers(bad), {});
});

test('only a full set of current answers is sent for counting', () => {
  const full = Object.fromEntries(SCENARIOS.map(s => [s.id, 2]));
  assert.deepEqual(countBody({ ...full, gone: 1 }), { a: full });
  const { market: _m, ...partial } = full;
  assert.equal(countBody(partial), null);
});

test('a darker view of the market pushes the holiday back', () => {
  const p = person();
  const low = SCENARIOS.find(s => s.param === 'eqReal');
  const q = labPlan(p, { values: answerValues({ [low.id]: 0 }, base) });
  assert.ok(fiYears(q) > fiYears(p));
});

test('with no cut set, the simulation is unchanged', () => {
  const p = person();
  const t = fwdSolve(p);
  const without = monteCarlo({ ...p, flexCut: undefined }, t, null);
  assert.deepEqual(monteCarlo({ ...p, flexCut: 0 }, t, null).bands, without.bands);
});

test('spending less after a bad year raises the success rate without moving the age', () => {
  const p = person();
  const t = fwdSolve(p);
  const q = { ...p, flexCut: 30 };
  assert.ok(monteCarlo(q, t, null).success > monteCarlo(p, t, null).success);
  assert.equal(fwdSolve(q), t);
});

test('a drawn life with a cut still matches the simulation for its seed', () => {
  const p = { ...person(), flexCut: 30 };
  const t = fwdSolve(p);
  const path = lifePath(p, t, null, 777);
  const mc = monteCarlo(p, t, null, { paths: 1, seed: 777 });
  path.years.forEach((y, i) => assert.ok(Math.abs(y.assets - mc.bands[i][2]) < 1e-6, `year ${i}`));
});

test('a cut only applies to spending, never below what a pension already covers', () => {
  const p = { ...person({ pension: 240000, pAge: 30 }), flexCut: 50 };
  assert.equal(monteCarlo(p, 0, null, { paths: 50 }).success, 1);
});

test('every parameter is either in a question or in the list, never both', () => {
  const listed = PARAM_GROUPS.flatMap(g => g.ids);
  const asked = SCENARIOS.map(s => s.param);
  assert.deepEqual([...listed, ...asked].sort(), PARAMS.map(c => c.id).sort());
});

test('a question shows its options, and after an answer teaches the parameter with its source', () => {
  const s = SCENARIOS.find(x => x.param === 'eqReal');
  const before = scenarioHtml({ index: SCENARIOS.indexOf(s), answers: {}, base, effect: '', params });
  assert.equal((before.match(/data-scn=/g) ?? []).length, 3);
  assert.ok(!before.includes('scn-reveal'));
  const after = scenarioHtml({ index: SCENARIOS.indexOf(s), answers: { [s.id]: 1 }, base, effect: '同样的年景，放假推后 2 年', params });
  assert.match(after, /scn-reveal/);
  assert.ok(after.includes(params.eqReal.what));
  assert.ok(after.includes(params.eqReal.range.sourceUrl));
  assert.match(after, /放假推后 2 年/);
});

test('the last screen lists what was answered, and each answer opens its question again', () => {
  const answers = Object.fromEntries(SCENARIOS.map(s => [s.id, 0]));
  const html = scenarioHtml({ index: SCENARIOS.length, answers, base, effect: '', params });
  assert.ok(!html.includes('scn-restart'), 'clearing everything lives in one place, next to the lives');
  assert.equal((html.match(/data-scn-goto=/g) ?? []).length, SCENARIOS.length);
  for (const s of SCENARIOS) assert.ok(html.includes(scenarioOptions(s, base)[0].label), s.id);
});

test('the professional banner lists answers and stays quiet when there are none', () => {
  assert.equal(viewsBannerHtml({}, base, params, false), '');
  const s = SCENARIOS[0];
  const html = viewsBannerHtml({ [s.id]: 0 }, base, params, false);
  assert.ok(html.includes(params[s.param].name));
  assert.match(html, /views-apply/);
  assert.match(viewsBannerHtml({ [s.id]: 0 }, base, params, true), /已带入/);
});

test('the stock question asks for the share people hold, not how much loss they can take', () => {
  const q = SCENARIOS.find(s => s.id === 'stocks');
  assert.equal(q.param, 'eq');
  assert.equal(q.question, '你现在的股票占比大概是多少？');
  assert.deepEqual(q.options(baselineOf(DATA, 'CN')), [['三成左右或更少', 30], ['六成左右', 60], ['八成左右或更多', 80]]);
  assert.match(q.insight, /不是建议/);
  assert.match(q.insight, /等你来写/);
  assert.ok(!SCENARIOS.some(s => s.id === 'nerve'));
  assert.deepEqual(cleanAnswers({ nerve: 1, stocks: 2 }), { stocks: 2 });
});

test('the crowd share of an answer counts only people who answered that question', async () => {
  const { scenarioHtml: html } = await import('../site/js/views.js');
  const crowd = { status: 'shown', total: 200, counts: { market: [50, 100, 50], stocks: [10, 20, 10] } };
  const base = baselineOf(DATA, 'CN');
  const params = Object.fromEntries(PARAMS.map(p => [p.id, p]));
  const out = html({ index: SCENARIOS.length, answers: { stocks: 1 }, base, effect: '', params, crowd });
  assert.match(out, /50% 也这么看/);
});

test('the written life tells its odds and the price of the chosen mix, and says it is not better', async () => {
  const { fifthOddsHtml } = await import('../site/js/views.js');
  const out = fifthOddsHtml({ mode: 'fwd', age: 47, success: 0.83, worstYear: -0.18, life: 95, baseAge: 45 });
  assert.match(out, /八成把握的放假年龄是 47 岁（原来 45 岁）/);
  // Forward, the age is the measure: the odds are not said a second time.
  assert.doesNotMatch(out, /8 成把握/);
  assert.match(fifthOddsHtml({ mode: 'fwd', age: 45, worstYear: -0.18, baseAge: 45 }), /和原来一样/);
  const back = fifthOddsHtml({ mode: 'bwd', age: 45, success: 0.62, baseSuccess: 0.83, worstYear: -0.18 });
  assert.match(back, /45 岁放假，6 成把握（原来 8 成把握）/);
  assert.match(out, /约跌 18%/);
  assert.match(out, /不代表更好/);
  assert.equal(fifthOddsHtml(null), '');
});
