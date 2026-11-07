import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { fiYears, fwdSolve, lifePath, monteCarlo } from '../site/js/engine.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { labPlan } from '../site/js/levers.js';
import { PARAMS, PARAM_GROUPS } from '../site/js/params.js';
import { SCENARIOS, answerValues, baselineOf, scenarioOptions } from '../site/js/scenario.js';
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

test('the last screen lists what was answered and offers a redo', () => {
  const answers = Object.fromEntries(SCENARIOS.map(s => [s.id, 0]));
  const html = scenarioHtml({ index: SCENARIOS.length, answers, base, effect: '', params });
  assert.match(html, /scn-restart/);
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
