import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { coastNeed, fiNeed, fiYears, fwdSolve, lifePath, monteCarlo } from '../site/js/engine.js';
import { defaultState, setField, setRetireCountry, setWorkCountry, toParams } from '../site/js/state.js';
import { rankLevers } from '../site/js/levers.js';
import { TYPES, drawLives, holidayType, lifeStory, mondaysIn, placeRanking, workdaysIn } from '../site/js/holiday.js';
import { livesSummary, storyHtml } from '../site/js/views.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

function person(fields = {}, { workC = 'CN', retC = 'CN' } = {}) {
  let S = setWorkCountry(defaultState(DATA), workC, DATA);
  S = setRetireCountry(S, retC, DATA);
  for (const [id, value] of Object.entries(fields)) S = setField(S, id, String(value), DATA);
  return { p: toParams(S, DATA), workC, retC };
}
const typeOf = ({ p, workC, retC }) => holidayType(p, DATA, { workC, retC });

test('years become Mondays and workdays', () => {
  assert.equal(mondaysIn(11), 574);
  assert.equal(mondaysIn(0), 0);
  assert.equal(workdaysIn(11), 2750);
});

test('someone who can already stop is on holiday', () => {
  assert.equal(typeOf(person({ assets: 1e9 })).id, 'reached');
});

test('someone with no savings and no end in sight is just starting', () => {
  const t = typeOf(person({ assets: 0, income: 60000, expense: 60000, growth: 0 }));
  assert.equal(t.id, 'seedling');
  assert.match(t.why, /存不下钱/);
});

test('assets that reach the line without further saving are coasting', () => {
  const { p, workC, retC } = person({ age: 40, assets: 2000000, income: 130000, expense: 120000, growth: 0 });
  assert.ok(p.assets >= coastNeed(p));
  assert.ok(fwdSolve(p) > 0);
  assert.equal(holidayType(p, DATA, { workC, retC }).id, 'coast');
});

test('retiring somewhere at most 80% of local prices is the migrant type', () => {
  const t = typeOf(person({ assets: 100000, income: 300000, expense: 120000 }, { workC: 'CN', retC: 'TH' }));
  assert.equal(t.id, 'migrant');
  assert.match(t.why, /物价/);
});

test('a savings rate of at least 50% is the squirrel type', () => {
  const t = typeOf(person({ assets: 100000, income: 300000, expense: 150000 }));
  assert.equal(t.id, 'saver');
  assert.match(t.why, /50%/);
});

test('planned spending at most 70% of today is lean', () => {
  const t = typeOf(person({ assets: 100000, income: 300000, expense: 200000, retExp: 120000 }));
  assert.equal(t.id, 'lean');
});

test('planned spending at least 1.5 times today is the seaview type', () => {
  const t = typeOf(person({ assets: 100000, income: 300000, expense: 200000, retExp: 320000 }));
  assert.equal(t.id, 'fat');
});

test('existing capital doing most of the work is a snowball', () => {
  const t = typeOf(person({ age: 50, assets: 1300000, income: 200000, expense: 130000, retExp: 130000, growth: 0 }));
  assert.equal(t.id, 'snowball');
});

test('everyone else is a steady runner', () => {
  const t = typeOf(person({ assets: 50000, income: 200000, expense: 150000, retExp: 150000 }));
  assert.equal(t.id, 'steady');
});

test('every type names a public rule, and no type copy breaks the compliance rules', () => {
  assert.equal(TYPES.length, 9);
  for (const t of TYPES) {
    assert.ok(t.name && t.en && t.group && t.blurb && t.rule, t.id);
    assert.deepEqual(findBannedCopy(JSON.stringify(t)), []);
  }
});

test('place ranking covers every country, earliest first, and marks the current one', () => {
  const { p, retC } = person({ assets: 100000 });
  const rows = placeRanking(p, DATA, retC);
  assert.equal(rows.length, Object.keys(DATA.countries).length);
  assert.equal(rows.filter(r => r.current).length, 1);
  const home = rows.find(r => r.current);
  assert.equal(home.code, 'CN');
  assert.equal(home.age, p.age + fwdSolve(p));
  const years = rows.filter(r => r.years !== null).map(r => r.years);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
});

test('place ranking agrees with the place lever', () => {
  const { p, retC } = person({ assets: 100000 });
  const lever = rankLevers(p, DATA, { retC, top: 10 }).find(l => l.id === 'place');
  assert.ok(lever, 'China is not the cheapest place, so a place lever exists');
  const best = placeRanking(p, DATA, retC)[0];
  assert.ok(Math.abs(best.years - lever.afterYears) < 1e-9);
});

test('place ranking keeps purchasing power for spending but converts a pension at market rates', () => {
  const { p, retC } = person({ retExp: 120000, pension: 24000 });
  const th = placeRanking(p, DATA, retC).find(r => r.code === 'TH');
  const fx = p.fx.THB / p.fx.CNY;
  const prices = DATA.countries.TH.priceLevel.value / DATA.countries.CN.priceLevel.value;
  assert.ok(Math.abs(th.retExp - 120000 * fx * prices) < 1e-6);
  assert.ok(Math.abs(th.pension - 24000 * fx) < 1e-6);
});

test('places that can never be reached sort last, with no fake age', () => {
  const { p, retC } = person({ age: 60, assets: 0, income: 100000, expense: 100000, retExp: 500000, growth: 0 });
  const rows = placeRanking(p, DATA, retC);
  const last = rows[rows.length - 1];
  assert.equal(last.years, null);
  assert.equal(last.age, null);
});

test('a drawn life is the same path the simulation walks for that seed', () => {
  const { p } = person();
  const t = fwdSolve(p);
  const seed = 12345;
  const path = lifePath(p, t, null, seed);
  const mc = monteCarlo(p, t, null, { paths: 1, seed });
  path.years.forEach((y, i) => assert.ok(Math.abs(y.assets - mc.bands[i][2]) < 1e-6, `year ${i}`));
  assert.equal(path.ruinAge === null, mc.success === 1);
});

test('the same seed draws the same life, a different seed a different one', () => {
  const { p } = person();
  const t = fwdSolve(p);
  assert.deepEqual(lifePath(p, t, null, 7), lifePath(p, t, null, 7));
  assert.notDeepEqual(lifePath(p, t, null, 7).years, lifePath(p, t, null, 8).years);
});

test('drawn lives share a plan and use consecutive seeds', () => {
  const { p } = person();
  const lives = drawLives(p, fwdSolve(p), null, 100);
  assert.deepEqual(lives.map(l => l.seed), [100, 101, 102, 103]);
});

test('a life that runs out says when, and stops looking for bad years afterwards', () => {
  const { p } = person({ assets: 100000 });
  const t = fwdSolve(p);
  let ruined = null;
  for (let seed = 1; seed < 3000 && !ruined; seed++) {
    const path = lifePath({ ...p, sigma: 0.3 }, t, null, seed);
    if (path.ruinAge !== null) ruined = path;
  }
  assert.ok(ruined, 'a volatile portfolio runs out on some seed');
  const s = lifeStory(ruined, p);
  assert.equal(s.outcome, 'ruined');
  assert.equal(s.ruinAge, ruined.ruinAge);
  assert.ok(s.worst.age < s.ruinAge);
  assert.ok(s.best.age < s.ruinAge);
});

test('a life that lasts reports what is left, the worst year and the first five years of holiday', () => {
  const { p } = person();
  const t = fwdSolve(p);
  const path = lifePath({ ...p, sigma: 0.01 }, t, null, 1);
  const s = lifeStory(path, p);
  assert.equal(s.outcome, 'lasted');
  assert.equal(s.endAge, p.life);
  assert.equal(s.retireAge, p.age + t);
  assert.equal(s.retireNeed, fiNeed(p, t));
  assert.ok(s.worst.ret <= s.best.ret);
  assert.ok(Number.isFinite(s.firstFive));
});

test('a life with no holiday in it still tells a complete story', () => {
  const { p } = person({ assets: 0, income: 60000, expense: 60000, growth: 0 });
  const s = lifeStory(lifePath(p, null, null, 1), p);
  assert.equal(s.outcome, 'working');
  assert.equal(s.retireAge, null);
  assert.equal(s.firstFive, null);
});

test('a holiday that starts today has no years to rank before it, yet tells its story', () => {
  const { p } = person({ assets: 1e9 });
  const s = lifeStory(lifePath(p, 0, null, 1), p);
  assert.equal(s.retireAge, p.age);
  assert.ok(s.worst);
});

test('fractional years stay consistent with the ranking', () => {
  const { p, retC } = person();
  const home = placeRanking(p, DATA, retC).find(r => r.current);
  assert.ok(Math.abs(home.years - fiYears(p)) < 1e-9);
});

test('a return that rounds to zero is not shown with a minus sign', () => {
  const { p } = person();
  const html = storyHtml({ outcome: 'lasted', endAge: 95, endAssets: 1, ruinAge: null, retireAge: 43, retireAssets: 1, retireNeed: 1, worst: null, best: null, firstFive: -0.001 }, { p, dispCur: 'CNY' });
  assert.ok(!html.includes('−0%'), html);
  assert.match(html, /0%/);
});

test('the lives summary quotes the real number of simulated paths', () => {
  const stories = [{ outcome: 'lasted' }, { outcome: 'ruined' }];
  assert.match(livesSummary(stories, { success: 0.5, paths: 500 }), /500 条/);
});
