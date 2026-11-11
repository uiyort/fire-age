// Fixes from the final review of the second batch.
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { conv, eventDelta } from '../site/js/engine.js';
import { oddsSolve } from '../site/js/odds.js';
import { cardPlace, holidayType, placeRanking, townPlan, withoutItemsGain } from '../site/js/holiday.js';
import { townHtml } from '../site/js/views.js';
import { defaultState, estimateRetireSpend, setField, setReal, setRetireCountry, toParams } from '../site/js/state.js';

const YEAR = 2026;
const withMortgage = (S = defaultState(DATA)) => setReal(setReal(S, 'mortgage', 'monthly', '3000', DATA), 'mortgage', 'endYear', '2040', DATA);
const plan = S => toParams(S, DATA, YEAR);
const ageOf = p => p.age + oddsSolve(p);
const ratio = code => DATA.countries[code].priceLevel.value / DATA.countries.CN.priceLevel.value;
// Yearly retirement spending in the work currency once every item has ended.
const spendAfter = p => conv(p.retExp, p.rCur, p.wCur, p.fx) + eventDelta(p, 60);

test('final review 1: retiring abroad, the mortgage is held at its own value and removed at the same value', () => {
  const p = plan(setRetireCountry(withMortgage(), 'TH', DATA));
  // ¥6,000 a month with ¥3,000 of mortgage: the other ¥3,000 follows Thai prices, the mortgage stays ¥3,000.
  assert.ok(Math.abs(spendAfter(p) - 3000 * 12 * ratio('TH')) < 30, String(spendAfter(p)));
  assert.ok(Math.abs(conv(p.retExp, p.rCur, p.wCur, p.fx) - (3000 * ratio('TH') + 3000) * 12) < 30);
  const bareTH = ageOf(plan(setRetireCountry(defaultState(DATA), 'TH', DATA)));
  const cn = ageOf(plan(defaultState(DATA))), cnMortgage = ageOf(plan(withMortgage()));
  const th = ageOf(p);
  assert.ok(th <= bareTH, `${th} vs ${bareTH}`);
  // The mortgage gains no more abroad than it does at home (it was 8 years before the fix, 44 -> 36).
  assert.ok(bareTH - th <= cn - cnMortgage, `${bareTH - th} vs ${cn - cnMortgage}`);
  assert.ok(th >= 38, String(th));
});

test('final review 1: the overseas ranking holds the items apart and agrees with retiring there', () => {
  const p = plan(withMortgage());
  const rows = placeRanking(p, DATA, 'CN');
  const here = rows.find(r => r.current);
  assert.equal(here.retExp, p.retExp);
  assert.equal(here.age, ageOf(p));
  for (const code of ['TH', 'MY']) {
    const row = rows.find(r => r.code === code);
    assert.equal(row.age, ageOf(plan(setRetireCountry(withMortgage(), code, DATA))), code);
    const expected = (3000 * ratio(code) + 3000) * 12 * p.fx[row.cur] / p.fx.CNY;
    assert.ok(Math.abs(row.retExp - expected) < 1e-6 * expected, code);
  }
});

test('final review 1: at home nothing changes, and the estimate follows the items as they are typed', () => {
  assert.equal(estimateRetireSpend(72000, 'CN', 'CN', DATA, 36000), 72000);
  const home = plan(withMortgage());
  assert.equal(home.retExp, 72000);
  assert.equal(ageOf(home), 43);
  assert.equal(ageOf(plan(defaultState(DATA))), 50);
  // Typing the mortgage after choosing the place, or changing the spending, re-estimates the same way.
  const late = withMortgage(setRetireCountry(defaultState(DATA), 'TH', DATA));
  assert.equal(late.retExp, setRetireCountry(withMortgage(), 'TH', DATA).retExp);
  const more = setField(late, 'expense', '84000', DATA);
  assert.equal(more.retExp, Math.round(estimateRetireSpend(84000, 'CN', 'TH', DATA, 36000)));
  // A typed retirement spend stays as typed.
  const typed = setField(setRetireCountry(defaultState(DATA), 'TH', DATA), 'retExp', '50000', DATA);
  assert.equal(withMortgage(typed).retExp, 50000);
});

test('final review 1: the type still reads the same lifestyle abroad with a mortgage', () => {
  const S = setRetireCountry(withMortgage(), 'TH', DATA);
  const type = holidayType(plan(S), DATA, { workC: 'CN', retC: 'TH' });
  assert.equal(type.axes.find(a => a.key === 'pack').letter, 'T');
});

test('final review 1: a town spend below the items leaves the items out of that line and says so', () => {
  const p = plan(withMortgage());
  const bare = plan(defaultState(DATA));
  const town = townPlan(p, 2000);
  assert.equal(town.ignored, true);
  assert.deepEqual(town, { age: null, years: null, gain: null, ignored: true });
  assert.equal(townHtml({ name: '大理', monthly: 2000 }, town, p), '<p class="town-line">在大理每月花 ¥2,000：比月供和孩子的花销还少。把月供和孩子算进这里的花销，再看几岁能放假。</p>');
  assert.ok(!townHtml({ name: '大理', monthly: 2000 }, town, p).includes('这一行没有算'));
  // The card never names such a town: it falls back to the best overseas place, or none.
  assert.equal(cardPlace([{ name: 'X', years: 10, current: true }], { name: '大理' }, town), null);
  assert.deepEqual(cardPlace([{ name: '泰国', years: 5 }, { name: '中国', years: 10, current: true }], { name: '大理' }, town), { name: '泰国', gain: 5 });
  // A spend that holds the items keeps them.
  const enough = townPlan(p, 4000);
  assert.equal(enough.ignored, false);
  assert.ok(enough.age < townPlan(bare, 4000).age);
  assert.ok(!townHtml({ name: '大理', monthly: 4000 }, enough, p).includes('没有算'));
});

// ---- 9: a cut after a bad year cuts only the living spending ----
import { buildParams, planFlows } from '../site/js/engine.js';
import { needLine, successAt } from '../site/js/odds.js';
const FX = { USD: 1, CNY: 6.6688, MYR: 4.08 };
const mortgage = { id: 'mortgage', amount: 30000, endAge: 45, nominal: true };
const kids = { id: 'kids', amount: 20000, endAge: 55, nominal: false };
const cutPlan = (o = {}) => buildParams({
  age: 30, life: 95, assets: 500000, income: 300000, expense: 120000, growth: 2,
  retExp: 120000, pension: 36000, pAge: 63, tAge: 45, eq: 60, eqReal: 5, bondY: 1.65,
  infl: 1.5, drag: 0.2, fxDrift: 0, swr: 3.9, autoSwr: true, sigEq: 0.17, sigBd: 0.06,
  rho: 0.2, wCur: 'CNY', rCur: 'CNY', flexCut: 20, selfPay: 30000, events: [mortgage, kids], ...o }, FX);

test('final review 9: the bad-year cut leaves self-pay and the mortgage payment whole', () => {
  const p = cutPlan();
  const { full, after } = planFlows(p, 0, null);
  const paid = t => 30000 * Math.pow(1.015, -t);
  // Age 35: mortgage and children running, self-pay before the pension.
  assert.ok(Math.abs(after[5] - ((120000 - 30000) * 0.8 + paid(5) + 30000)) < 1e-6, String(after[5]));
  assert.ok(Math.abs(full[5] - (120000 - 30000 + paid(5) + 30000)) < 1e-6);
  // Age 60: both ended, still self-paying.
  assert.ok(Math.abs(after[30] - ((120000 - 30000 - 20000) * 0.8 + 30000)) < 1e-6, String(after[30]));
  // Age 70: the pension has started, no self-pay.
  assert.ok(Math.abs(after[40] - ((120000 - 50000) * 0.8 - 36000)) < 1e-6, String(after[40]));
  // With no cut nothing changes.
  const flat = planFlows(cutPlan({ flexCut: 0 }), 0, null);
  for (const t of [5, 30, 40]) assert.equal(flat.after[t], flat.full[t]);
});

test('final review 9: starting with exactly the holiday line still gives 8 in 10 with a cut, a mortgage and self-pay', () => {
  const plans = [
    cutPlan(),
    cutPlan({ rCur: 'MYR', retExp: 60000, pension: 15000, fxDrift: 2 }),
    cutPlan({ events: [] }),
    cutPlan({ events: [], rCur: 'MYR', retExp: 60000, pension: 15000, fxDrift: -2 }),
  ];
  for (const p of plans) {
    const line = needLine(p);
    for (const T of [5, 15, 25]) {
      const s = successAt(p, T, null, { startAt: T, startAssets: line[T] });
      assert.ok(Math.abs(s - 0.8) < 1e-9, `${p.rCur} events ${p.events.length} T=${T}: ${s}`);
    }
  }
});

// ---- 4 to 8: small fixes ----
import { cleanPen, loadState, setTown } from '../site/js/state.js';
import { estimateFromForm } from '../site/js/pension.js';
import { pensionEstimateHtml } from '../site/js/views.js';

test('final review 4: a town name of spaces is empty, and a name is trimmed', () => {
  assert.equal(setTown(defaultState(DATA), { name: '   ' }).town.name, '');
  assert.equal(setTown(defaultState(DATA), { name: '  大理 ' }).town.name, '大理');
});

test('final review 5: a birth month with one digit is read as two', () => {
  assert.equal(cleanPen({ birth: '1996-6' }).birth, '1996-06');
  assert.equal(cleanPen({ birth: '1996-06' }).birth, '1996-06');
  assert.equal(cleanPen({ birth: '1996-11' }).birth, '1996-11');
  for (const bad of ['1996-0', '1996-13', '1996-006', '96-6', 'abc']) assert.equal(cleanPen({ birth: bad }).birth, '', bad);
});

test('final review 6: someone past the claim year is not shown fewer years than they paid', () => {
  const pen = { ...cleanPen({ birth: '1960-01', kind: 'm', base: 8000, paidYears: 30 }) };
  const r = estimateFromForm(pen, 2026);
  assert.equal(r.defaultYears, 30);
  const young = estimateFromForm(cleanPen({ birth: '1996-06', kind: 'm', base: 8000, paidYears: 5 }), 2026);
  assert.equal(young.defaultYears, 5 + young.st.claimYear - 2026);
});

test('final review 7: a saved self-pay that is not a number counts as 0', () => {
  const S = { ...defaultState(DATA), pension: 36000, selfPension: 'abc', selfMedical: 'x' };
  const p = toParams(S, DATA, YEAR);
  assert.equal(p.selfPay, 0);
  const store = { getItem: () => JSON.stringify({ ...defaultState(DATA), pension: 36000, selfPension: 'abc', selfMedical: 300 }) };
  const q = toParams(loadState(DATA, store), DATA, YEAR);
  assert.ok(Number.isFinite(q.selfPay), String(q.selfPay));
  assert.equal(q.selfPay, 300 * 12);
});

test('final review 8: below the minimum years, the page says the pension above is still the earlier one', () => {
  const r = estimateFromForm(cleanPen({ birth: '1996-06', kind: 'm', base: 8000, paidYears: 1, years: 5 }), 2026);
  assert.equal(r.est.eligible, false);
  const plain = pensionEstimateHtml(r);
  assert.match(plain, /这里按 0 算/);
  const held = pensionEstimateHtml(r, { held: true });
  assert.match(held, /累计缴费不满 \d+ 年，不能按月领取。上面的养老金还是之前填的，要按 0 算请清空它。/);
  assert.ok(!held.includes('这里按 0 算'));
});

test('without-items gain: years the holiday comes earlier with the items than without', () => {
  const p = plan(withMortgage());
  const g = withoutItemsGain(p);
  assert.ok(Number.isInteger(g.years) && g.years >= 0, JSON.stringify(g));
  assert.equal(withoutItemsGain(plan(defaultState(DATA))), null);
  assert.equal(withoutItemsGain({ ...p, savings: 0, income: 1 }), null);
});
