import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, toParams } from '../site/js/state.js';
import { sideSummary, mixShares } from '../site/js/views.js';

const real = (m = {}, k = {}) => ({ mortgage: { monthly: null, endYear: null, ...m }, kids: { count: null, age: null, monthly: null, ...k } });
const summary = (S, row) => sideSummary(row, { S, p: toParams(S, DATA, 2026), rows: storyRows(S, DATA, 2026, null), data: DATA });
const text = html => html.replace(/<[^>]*>/g, '');

test('sidebar: 存下 reads — while a stop sits above it, in both views', () => {
  for (const view of ['simple', 'pro']) {
    const S = { ...defaultState(DATA), view, real: real({ monthly: 8000, endYear: 2045 }) };
    assert.match(text(summary(S, 'now')), /存下? —没有数/);
  }
  const ok = { ...defaultState(DATA) };
  assert.match(text(summary(ok, 'now')), /存下 ¥6,000\/月/);
});

test('sidebar: a negative split part leaves no 存下 and no ≈ 0 for retirement spending', () => {
  const S = { ...defaultState(DATA), split: { rent: -2000, food: 0, other: 0, before: 72000 }, expense: -24000, retExp: 0 };
  assert.match(text(summary(S, 'now')), /存下 —没有数/);
  assert.equal(text(summary(S, 'retire')).includes('0'), false);
  assert.match(text(summary(S, 'retire')), /—没有数/);
});

test('the mix note writes — for a stopped share and U+2212 for a negative one', () => {
  assert.deepEqual(mixShares(60, false), { stock: '60', bond: '40' });
  assert.deepEqual(mixShares(150, true), { stock: '—', bond: '—' });
  assert.deepEqual(mixShares(60, false), { stock: '60', bond: '40' });
});
