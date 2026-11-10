import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, toParams, setField } from '../site/js/state.js';
import { makeGoal, compareVisit, loadGoal, saveGoal } from '../site/js/goals.js';

test('a met goal is achieved and reports years gained', () => {
  const before = toParams(defaultState(DATA), DATA);
  const goal = makeGoal('saveRate', 0.55, before, '2026-11-07');
  const after = toParams(setField(defaultState(DATA), 'expense', '60000', DATA), DATA);
  const out = compareVisit(goal, after, '2026-12-07');
  assert.equal(out.achieved, true);
  assert.ok(out.yearsDelta > 0);
});

test('an unmet goal is not achieved', () => {
  const p = toParams(defaultState(DATA), DATA);
  assert.equal(compareVisit(makeGoal('saveRate', 0.9, p, '2026-11-07'), p, '2026-11-08').achieved, false);
});

test('lower-is-better goals are met from below', () => {
  const p = toParams(defaultState(DATA), DATA);
  assert.equal(compareVisit(makeGoal('expense', 130000, p, '2026-11-07'), p, '2026-11-08').achieved, true);
  assert.equal(compareVisit(makeGoal('drag', 0.1, p, '2026-11-07'), p, '2026-11-08').achieved, false);
});

test('goals carry a readable label', () => {
  const p = toParams(defaultState(DATA), DATA);
  assert.equal(makeGoal('saveRate', 0.65, p, '2026-11-07').label, '储蓄率到 65%');
});

test('years gained is null when either side never reaches the goal', () => {
  const stuck = toParams(setField(setField(defaultState(DATA), 'assets', '0', DATA), 'income', '0', DATA), DATA);
  const p = toParams(defaultState(DATA), DATA);
  assert.equal(compareVisit(makeGoal('saveRate', 0.1, stuck, '2026-11-07'), p, '2026-11-08').yearsDelta, null);
});

test('a broken goal store reads as no goal', () => {
  assert.equal(loadGoal({ getItem() { throw new Error('denied'); } }), null);
  assert.equal(loadGoal(null), null);
  assert.equal(loadGoal({ getItem: () => '{broken' }), null);
  assert.doesNotThrow(() => saveGoal({ paramId: 'saveRate' }, { setItem() { throw new Error('denied'); } }));
});

test('a saved goal round-trips', () => {
  let saved = null;
  const store = { getItem: () => saved, setItem: (_, v) => { saved = v; } };
  const p = toParams(defaultState(DATA), DATA);
  saveGoal(makeGoal('saveRate', 0.7, p, '2026-11-07'), store);
  assert.equal(loadGoal(store).target, 0.7);
});

test('a goal saved before the age was counted by the odds is dropped, so its years are never compared the wrong way', () => {
  const box = new Map();
  const storage = { getItem: k => box.get(k) ?? null, setItem: (k, v) => box.set(k, v), removeItem: k => box.delete(k) };
  box.set('fire-age-goal-v1', JSON.stringify({ paramId: 'saveRate', target: 0.6, label: 'x', years: 11.2, createdAt: '2026-10-01', cur: 'CNY' }));
  assert.equal(loadGoal(storage), null);
  const p = toParams(defaultState(DATA), DATA);
  saveGoal(makeGoal('saveRate', 0.55, p, '2026-11-09'), storage);
  assert.equal(loadGoal(storage).odds, 0.8);
});
