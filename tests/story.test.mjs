import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, toParams, setRetireCountry } from '../site/js/state.js';
import { firstDraw, planFlows, savingsAt } from '../site/js/engine.js';
import { needLine, oddsSolve } from '../site/js/odds.js';

const S = { ...defaultState(DATA), income: 360000, expense: 180000, retExp: 180000,
  real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
const solved = s => { const p = toParams(s, DATA, 2026); const t = oddsSolve(p); return { p, t, need: needLine(p)[t] }; };
const row = (rows, key) => rows.find(r => r.key === key);

test('firstDraw is the first holiday year\'s draw from savings', () => {
  const p = toParams(defaultState(DATA), DATA, 2026);
  assert.equal(firstDraw(p, 10), p.retExp);
  const q = solved(S);
  assert.equal(firstDraw(q.p, q.t), planFlows(q.p, q.t, null).full[q.t]);
  assert.ok(firstDraw(q.p, q.t) < q.p.retExp);
});

test('storyRows: section ① follows the engine', () => {
  const plan = solved(S); const { p, t } = plan;
  assert.ok(t > 1 && 30 + t < 50);
  const rows = storyRows(S, DATA, 2026, plan);
  assert.deepEqual(rows.filter(r => r.section === 'now').map(r => r.key), ['have', 'income', 'expense', 'mortgage', 'save', 'growth', 'saveLate']);
  assert.equal(row(rows, 'have').value, 200000); assert.equal(row(rows, 'income').value, 30000); assert.equal(row(rows, 'expense').value, 15000);
  assert.deepEqual([row(rows, 'mortgage').value, row(rows, 'mortgage').end, row(rows, 'mortgage').under], [7500, 2045, 'expense']);
  assert.equal(row(rows, 'save').value, 15000);
  assert.equal(row(rows, 'growth').label, '收入每年 +2%'); assert.equal(row(rows, 'growth').tag, '本工具设定');
  assert.equal(row(rows, 'saveLate').label, `→ ${30 + t - 1} 岁每月存下`);
  assert.equal(row(rows, 'saveLate').value, Math.round(savingsAt(p, t - 1) / 12));
});

test('storyRows: section ② ages, amounts, the line and the multiple', () => {
  const plan = solved(S); const { p, t, need } = plan;
  const rows = storyRows(S, DATA, 2026, plan);
  // With a plan the simple first row is what the engine spends the first holiday year (the mortgage at its real value).
  assert.deepEqual([row(rows, 'retExp').ages, row(rows, 'retExp').value, row(rows, 'retExp').status, row(rows, 'retExp').cur],
    [[30 + t, 49], Math.round(planFlows({ ...p, pension: 0, selfPay: 0 }, t, null).full[t] / 12), 'est', 'work']);
  assert.equal(storyRows(S, DATA, 2026, null).find(r => r.key === 'retExp').value, 15000);
  const after = row(rows, 'after:50');
  assert.deepEqual([after.ages, after.struck, after.value, after.under], [[50, null], ['月供'], 7500, 'retExp']);
  assert.deepEqual([row(rows, 'pension').value, row(rows, 'pension').field], [null, 'pension']);
  assert.equal(row(rows, 'need').label, `${30 + t} 岁放假要有`); assert.equal(row(rows, 'need').value, need);
  assert.equal(row(rows, 'times').value, Math.round(need / firstDraw(p, t)));
  assert.equal(row(rows, 'ret:mortgage').value, 7500);
});

test('storyRows: two end ages give two → rows; a third never appears', () => {
  const s = { ...S, real: { ...S.real, kids: { count: 1, age: 19, monthly: 3200 } } };
  const rows = storyRows(s, DATA, 2026, null).filter(r => r.key.startsWith('after:'));
  assert.deepEqual(rows.map(r => [r.ages[0], r.value]), [[33, 15000 - 3200], [50, 15000 - 3200 - 7500]]);   // 30 + (22 − 19)
});

test('storyRows: without a plan, plan rows are empty and the rest still shows', () => {
  const rows = storyRows(S, DATA, 2026, null);
  assert.equal(row(rows, 'saveLate'), undefined);
  assert.equal(row(rows, 'need').value, null); assert.equal(row(rows, 'times').value, null);
  assert.equal(row(rows, 'save').value, 15000);
});

test('storyRows: a blocked row carries the same relation as problems() and everything after it is empty', () => {
  const s = { ...S, expense: 84000 };
  const rows = storyRows(s, DATA, 2026, null);
  const m = row(rows, 'mortgage');
  assert.equal(m.status, 'block');
  assert.deepEqual(m.rel, problems(s, DATA, 2026).find(q => q.rule === 'A3').rel);
  const after = rows.slice(rows.indexOf(m) + 1).filter(r => !r.key.startsWith('ret:'));
  assert.ok(after.length > 0 && after.every(r => r.value === null));
  assert.equal(row(rows, 'ret:mortgage').value, 7500);
});

test('storyRows: a blank spending row waits and empties the rows after it', () => {
  const rows = storyRows({ ...S, expense: null }, DATA, 2026, null);
  assert.equal(row(rows, 'expense').status, 'blank');
  assert.equal(row(rows, 'save').value, null);
});

test('storyRows: the → row is flagged when typed spending leaves less than a quarter', () => {
  const s = { ...S, retExp: (7500 + 3000) * 12, touched: { retExp: true } };
  assert.equal(row(storyRows(s, DATA, 2026, null), 'after:50').status, 'flag');
});

test('storyRows: the professional view speaks in years and adds its rows', () => {
  const plan = solved(S);
  const rows = storyRows({ ...S, view: 'pro' }, DATA, 2026, plan);
  assert.equal(row(rows, 'income').label, '税后年收入 · 实际增长 +2%/年'); assert.equal(row(rows, 'income').value, 360000);
  assert.equal(row(rows, 'mortgage').value, 90000);
  for (const key of ['mortgageReal', 'floor', 'retReal', 'flexCut', 'fxDrift']) assert.ok(row(rows, key), key);
  assert.equal(row(rows, 'growth'), undefined); assert.equal(row(rows, 'fxDrift').value, null);
});

// ---- Beyond the brief: the spec's example numbers (§7.3) and the other row kinds.

test('storyRows: the professional ledger matches the spec example', () => {
  const plan = solved(S); const { p, t } = plan;
  const rows = storyRows({ ...S, view: 'pro' }, DATA, 2026, plan);
  assert.deepEqual(row(rows, 'save').values, [180000, 301536]);
  assert.equal(row(rows, 'retReal').value, 163066); assert.equal(row(rows, 'retReal').label, `月供实际变轻，${30 + t} 岁实付`);
  assert.equal(row(rows, 'mortgageReal').value, Math.round(90000 * Math.pow(1 + p.infl / 100, -(t - 1))));
  assert.equal(row(rows, 'mortgageReal').label, `月供实际 × (1 + ${p.infl}%)^−t`);
  assert.equal(row(rows, 'need').label, '放假线（每条路径倒推，取 80 分位）');
  assert.equal(row(rows, 'times').value, 24);
  assert.equal(row(rows, 'self').value, null); assert.equal(row(rows, 'cross'), undefined);
  assert.deepEqual(rows.filter(r => r.section === 'now').map(r => r.key), ['have', 'income', 'expense', 'mortgage', 'mortgageReal', 'save', 'floor']);
});

test('storyRows: A3 with both items gives one items row; A4 gives the retirement items row', () => {
  const kids = { count: 1, age: 5, monthly: 1700 };
  const a3 = { ...S, expense: 96000, real: { ...S.real, kids } };
  const rows = storyRows(a3, DATA, 2026, null);
  assert.equal(row(rows, 'mortgage'), undefined); assert.equal(row(rows, 'kids'), undefined);
  assert.deepEqual(row(rows, 'items').rel, problems(a3, DATA, 2026).find(q => q.rule === 'A3').rel);
  assert.equal(row(rows, 'items').status, 'block');
  const a4 = { ...S, retExp: 90000, touched: { retExp: true } };
  const r4 = storyRows(a4, DATA, 2026, null);
  assert.equal(row(r4, 'retExp').status, 'block'); assert.equal(row(r4, 'retExp').value, 7500);
  assert.equal(row(r4, 'ret:mortgage'), undefined);
  assert.deepEqual(row(r4, 'ret:items').rel, problems(a4, DATA, 2026).find(q => q.rule === 'A4').rel);
  assert.equal(row(r4, 'after:50').value, null);
});

test('storyRows: an ended mortgage is a struck row with its fact; a split adds its sum row', () => {
  const ended = { ...S, real: { ...S.real, mortgage: { monthly: 3000, endYear: 2024 } } };
  const m = row(storyRows(ended, DATA, 2026, null), 'mortgage');
  assert.equal(m.status, 'ended'); assert.equal(m.rel.fact, '2024 已还完');
  assert.equal(row(storyRows(ended, DATA, 2026, null), 'after:50'), undefined);
  const split = { ...S, expense: 96000, split: { rent: 5000, food: 2000, other: 1000, before: 72000 }, real: { ...S.real, mortgage: { monthly: 4000, endYear: 2045 } } };
  const rows = storyRows(split, DATA, 2026, null);
  const sp = row(rows, 'split');
  assert.deepEqual([sp.value, sp.parts, sp.before, sp.op, sp.under], [8000, [5000, 2000, 1000], 6000, '=', 'expense']);
  assert.deepEqual(rows.filter(r => r.section === 'now').map(r => r.key), ['have', 'income', 'expense', 'split', 'mortgage', 'save', 'growth']);
});

test('storyRows: an unreachable plan shows its year but no line', () => {
  const p = toParams(S, DATA, 2026); const t = p.life - p.age - 1;
  const rows = storyRows(S, DATA, 2026, { p, t, need: null, unreachable: true });
  assert.equal(row(rows, 'need').value, null); assert.equal(row(rows, 'times').value, null);
  assert.equal(row(rows, 'retExp').ages[0], 30 + t);
});

test('storyRows: no shown value is a negative zero', () => {
  const rows = storyRows({ ...S, income: 179995, real: { mortgage: { monthly: null, endYear: null }, kids: { count: null, age: null, monthly: null } } }, DATA, 2026, null);
  assert.ok(Object.is(row(rows, 'save').value, 0));
});

// ---- Review round 1: the ledger's numbers are the engine's.

test('storyRows: across currencies with drift, the real payment row is the engine\'s spending that year', () => {
  const s = { ...setRetireCountry({ ...S, real: { ...S.real, mortgage: { monthly: 7500, endYear: 2060 } } }, 'US', DATA), view: 'pro', fxDrift: 1 };
  const plan = solved(s); const { p, t } = plan;
  assert.ok(t !== null && 30 + t < 65);
  const retReal = row(storyRows(s, DATA, 2026, plan), 'retReal');
  assert.equal(retReal.value, Math.round(firstDraw(p, t)));
});

test('storyRows: an item that ends before the holiday folds into the first ② row', () => {
  const p = toParams(S, DATA, 2026); const t = 23;
  const plan = { p, t, need: needLine(p)[t] };
  const rows = storyRows(S, DATA, 2026, plan);
  const ret = row(rows, 'retExp');
  assert.deepEqual([ret.ages, ret.value, ret.struck, ret.typed], [[53, null], Math.round(firstDraw(p, t) / 12), ['月供'], 15000]);
  assert.equal(row(rows, 'after:50').folded, true);
  assert.equal(row(storyRows(S, DATA, 2026, solved(S)), 'after:50').folded, undefined);
  assert.equal(row(storyRows({ ...S, view: 'pro' }, DATA, 2026, plan), 'mortgageReal'), undefined);
});

test('storyRows: self-pay shows no amount once the holiday starts at or after the claim age', () => {
  const s = { ...S, pension: 36000, pAge: 63, selfPension: 500, selfMedical: 300 };
  const p = toParams(s, DATA, 2026);
  const at = t => ({ p, t, need: needLine(p)[t] });
  assert.equal(row(storyRows({ ...s, view: 'pro' }, DATA, 2026, at(33)), 'self').value, null);
  assert.equal(row(storyRows(s, DATA, 2026, at(33)), 'self'), undefined);
  assert.equal(row(storyRows(s, DATA, 2026, at(14)), 'self').value, 800);
});

test('setWorkCountry no longer shadows the engine\'s conv', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../site/js/state.js', import.meta.url), 'utf8');
  assert.ok(!/const conv =/.test(src));
});

test('storyRows: the items under spending repeat what was typed, so a stop before them leaves their amounts', () => {
  const kids = { count: 1, age: 5, monthly: 1700 };
  const blank = storyRows({ ...S, income: null, real: { ...S.real, kids } }, DATA, 2026, null);
  assert.deepEqual([row(blank, 'mortgage').value, row(blank, 'kids').value, row(blank, 'save').value], [7500, 1700, null]);
  const a2 = { ...S, expense: 108000, split: { rent: 5000, food: 2000, other: 2000, before: 72000 }, real: { ...S.real, kids } };
  const rows = storyRows(a2, DATA, 2026, null);
  assert.equal(row(rows, 'mortgage').status, 'block'); assert.equal(row(rows, 'kids').value, 1700);
});
