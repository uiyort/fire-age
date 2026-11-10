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

test('statutoryAge: edge months and bad input', () => {
  assert.equal(statutoryAge({ birthYear: 1976, birthMonth: 11, kind: 'm' }).claimYear, 2039);
  assert.equal(statutoryAge({ birthYear: 1990, birthMonth: 13, kind: 'm' }), null);
  assert.equal(statutoryAge({ birthYear: 1990, birthMonth: 0, kind: 'm' }), null);
});

test('payoutMonths returns null unless the age is a finite number', () => {
  assert.equal(payoutMonths(null), null);
  assert.equal(payoutMonths(undefined), null);
  assert.equal(payoutMonths(NaN), null);
  assert.equal(payoutMonths(Infinity), null);
  assert.equal(payoutMonths(63), 117);
});

test('estimatePension: missing or non-finite inputs give a zero estimate, never NaN', () => {
  const ok = { base: 8000, index: 1, years: 30, paidYears: 10, account: 100000, claimAge: 63, claimYear: 2053 };
  for (const key of ['base', 'index', 'years', 'claimAge', 'claimYear']) {
    for (const bad of [undefined, null, NaN, Infinity]) {
      const r = estimatePension({ ...ok, [key]: bad });
      assert.equal(r.eligible, false, `${key}=${bad}`);
      assert.equal(r.monthly, 0);
      assert.equal(r.basic, 0);
      assert.equal(r.personal, 0);
      assert.ok(r.minYears === null || Number.isFinite(r.minYears));
    }
  }
  assert.equal(estimatePension({ ...ok, claimYear: null }).minYears, null);
  assert.equal(estimatePension({ ...ok, base: null }).minYears, 20);
});

test('estimatePension: a missing paidYears or account counts as 0, negative years clamp to 0', () => {
  const ok = { base: 8000, index: 1, years: 30, claimAge: 63, claimYear: 2053 };
  const r = estimatePension({ ...ok, paidYears: undefined, account: undefined });
  assert.ok(Number.isFinite(r.personal) && r.personal > 0);
  assert.equal(r.personal, estimatePension({ ...ok, paidYears: 0, account: 0 }).personal);
  const neg = estimatePension({ ...ok, years: -5, paidYears: 0, account: 0 });
  assert.equal(neg.eligible, false);
  assert.equal(neg.basic, 0);
  assert.equal(neg.monthly, 0);
});

test('estimateFromForm: waits for a birth month and a base, and defaults the years', async () => {
  const { estimateFromForm } = await import('../site/js/pension.js');
  assert.equal(estimateFromForm({ birth: '', base: 8000, kind: 'm' }, 2026), null);
  assert.equal(estimateFromForm({ birth: '1996-06', base: null, kind: 'm' }, 2026), null);
  assert.equal(estimateFromForm({ birth: '1996-13', base: 8000, kind: 'm' }, 2026), null);
  const r = estimateFromForm({ birth: '1996-06', kind: 'm', paidYears: 8, years: null, account: 60000, base: 8000, index: 1 }, 2026);
  assert.equal(r.st.years, 63);
  assert.equal(r.claimAge, 63);
  assert.equal(r.defaultYears, 41);
  assert.equal(r.est.eligible, true);
  assert.equal(Math.round(r.est.basic), 3280);
  assert.equal(r.selfPay, 960);
  assert.equal(estimateFromForm({ birth: '1996-06', kind: 'm', paidYears: 8, years: 10, base: 8000, index: 1 }, 2026).est.eligible, false);
});
