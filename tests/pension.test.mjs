import test from 'node:test';
import assert from 'node:assert/strict';
import { statutoryAge, minContribYears, PAYOUT_MONTHS, payoutMonths, claimAgeWhole, estimatePension, selfPayDefault } from '../site/js/pension.js';

const age = (birthYear, birthMonth, kind) => {
  const r = statutoryAge({ birthYear, birthMonth, kind });
  return r && [r.years, r.months];
};

test('statutoryAge: men', () => {
  assert.deepEqual(age(1964, 12, 'm'), [60, 0]);
  assert.deepEqual(age(1965, 1, 'm'), [60, 1]);
  assert.deepEqual(age(1965, 5, 'm'), [60, 2]);
  assert.deepEqual(age(1976, 8, 'm'), [62, 11]);
  assert.deepEqual(age(1976, 9, 'm'), [63, 0]);
  assert.deepEqual(age(1990, 6, 'm'), [63, 0]);
});

test('statutoryAge: women originally 55', () => {
  assert.deepEqual(age(1970, 1, 'f55'), [55, 1]);
  assert.deepEqual(age(1981, 9, 'f55'), [58, 0]);
});

test('statutoryAge: women originally 50', () => {
  assert.deepEqual(age(1975, 1, 'f50'), [50, 1]);
  assert.deepEqual(age(1975, 3, 'f50'), [50, 2]);
  assert.deepEqual(age(1984, 11, 'f50'), [55, 0]);
});

test('statutoryAge: published table rows and claim year', () => {
  assert.deepEqual(age(1971, 1, 'm'), [61, 7]);
  assert.deepEqual(age(1974, 1, 'm'), [62, 4]);
  assert.equal(statutoryAge({ birthYear: 1990, birthMonth: 6, kind: 'm' }).claimYear, 2053);
  assert.equal(statutoryAge({ birthYear: 1965, birthMonth: 1, kind: 'm' }).claimYear, 2025);
});

test('statutoryAge: incomplete input', () => {
  assert.equal(statutoryAge({ birthYear: 1990, kind: 'm' }), null);
  assert.equal(statutoryAge({ birthYear: 1990, birthMonth: 6 }), null);
  assert.equal(statutoryAge({ birthMonth: 6, kind: 'm' }), null);
});

test('minContribYears', () => {
  assert.equal(minContribYears(2029), 15);
  assert.equal(minContribYears(2030), 15.5);
  assert.equal(minContribYears(2035), 18);
  assert.equal(minContribYears(2039), 20);
  assert.equal(minContribYears(2045), 20);
});

test('payoutMonths', () => {
  for (const [a, m] of [[50, 195], [55, 170], [58, 152], [60, 139], [61, 132], [62, 125], [63, 117], [65, 101]]) {
    assert.equal(payoutMonths(a), m);
  }
  assert.equal(payoutMonths(30), 233);
  assert.equal(payoutMonths(80), 56);
  assert.equal(payoutMonths(63.9), 117);
  assert.equal(Object.keys(PAYOUT_MONTHS).length, 31);
});

test('claimAgeWhole', () => {
  assert.equal(claimAgeWhole({ years: 60, months: 0 }), 60);
  assert.equal(claimAgeWhole({ years: 60, months: 1 }), 61);
  assert.equal(claimAgeWhole({ years: 62, months: 11 }), 63);
});

test('estimatePension', () => {
  const o = { base: 8000, index: 1, years: 30, paidYears: 10, account: 100000, claimAge: 63, claimYear: 2053 };
  const r = estimatePension(o);
  assert.equal(r.basic, 2400);
  assert.ok(Math.abs(r.personal - 2167.52) < 0.01);
  assert.ok(Math.abs(r.monthly - 4567.52) < 0.01);
  assert.equal(r.eligible, true);
  const s = estimatePension({ ...o, years: 12 });
  assert.equal(s.eligible, false);
  assert.equal(s.monthly, 0);
  assert.equal(s.minYears, 20);
});

test('selfPayDefault', () => {
  assert.equal(selfPayDefault(8000), 960);
});
