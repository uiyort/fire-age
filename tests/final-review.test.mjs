// Fixes from the final review of the second batch.
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { conv, eventDelta } from '../site/js/engine.js';
import { oddsSolve } from '../site/js/odds.js';
import { holidayType, placeRanking, townPlan } from '../site/js/holiday.js';
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
  assert.equal(town.age, townPlan(bare, 2000).age);
  assert.equal(town.age, 39);
  assert.match(townHtml({ name: '大理', monthly: 2000 }, town, p), /没有算这两项/);
  // A spend that holds the items keeps them.
  const enough = townPlan(p, 4000);
  assert.equal(enough.ignored, false);
  assert.ok(enough.age < townPlan(bare, 4000).age);
  assert.ok(!townHtml({ name: '大理', monthly: 4000 }, enough, p).includes('没有算'));
});
