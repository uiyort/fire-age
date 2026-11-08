import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { fiNeed, fiYears, fwdSolve, lifePath, monteCarlo } from '../site/js/engine.js';
import { defaultState, setField, setRetireCountry, setWorkCountry, toParams } from '../site/js/state.js';
import { rankLevers } from '../site/js/levers.js';
import { GROUPS, TYPES, drawLives, holidayType, lifeStory, mondaysIn, placeRanking, workdaysIn } from '../site/js/holiday.js';
import { livesSummary, storyHtml } from '../site/js/views.js';

test('a life that runs dry says fixed spending only when spending was fixed', () => {
  const p = toParams(defaultState(DATA), DATA);
  const s = { outcome: 'ruined', endAge: 95, endAssets: 0, ruinAge: 70, retireAge: 43, retireAssets: 1, retireNeed: 1, worst: null, best: null, firstFive: 0 };
  assert.match(storyHtml(s, { p, dispCur: 'CNY' }), /固定支出/);
  const cut = storyHtml(s, { p: { ...p, flexCut: 30 }, dispCur: 'CNY' });
  assert.ok(!cut.includes('固定支出'));
  assert.match(cut, /少花 30%/);
});
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

const letters = t => t.code.split('');

test('working backward, the type starts the holiday at the age asked for', () => {
  const { p, workC, retC } = person();
  const t = holidayType(p, DATA, { workC, retC, retireT: 50 - p.age });
  const when = t.axes.find(a => a.key === 'when');
  assert.equal(when.value, '50 岁放假');
  assert.equal(when.letter, 'E');
  assert.equal(holidayType(p, DATA, { workC, retC, retireT: 60 - p.age }).axes.find(a => a.key === 'when').letter, 'L');
  assert.equal(t.status.why, `还有 ${50 - p.age} 年到站。`);
});

test('luggage compares the holiday lifestyle with today\'s, at local prices', () => {
  const pack = fields => typeOf(person(fields)).axes.find(a => a.key === 'pack');
  assert.deepEqual([pack({}).letter, pack({}).value], ['T', '和现在差不多']);
  assert.deepEqual([pack({ retExp: 180000 }).letter, pack({ retExp: 180000 }).value], ['F', '比现在宽裕 1.5 倍']);
  assert.deepEqual([pack({ retExp: 60000 }).letter, pack({ retExp: 60000 }).value], ['T', '只花现在的 50%']);
});

test('the code has one letter from each of the four axes', () => {
  const t = typeOf(person());
  assert.match(t.code, /^[EL][HA][TF][SG]$/);
  assert.deepEqual(t.axes.map(a => a.letter), letters(t));
});

test('starting the holiday by 50 is E, later or never is L', () => {
  assert.equal(letters(typeOf(person({ age: 30, assets: 1000000, income: 400000, expense: 100000 })))[0], 'E');
  assert.equal(letters(typeOf(person({ age: 45, assets: 0, income: 150000, expense: 120000, growth: 0 })))[0], 'L');
  assert.equal(letters(typeOf(person({ assets: 0, income: 60000, expense: 60000, growth: 0 })))[0], 'L');
});

test('staying put is H, retiring in another place is A', () => {
  assert.equal(letters(typeOf(person()))[1], 'H');
  assert.equal(letters(typeOf(person({}, { retC: 'TH' })))[1], 'A');
});

test('a holiday no richer than today is T, a richer one is F, adjusted for local prices', () => {
  assert.equal(letters(typeOf(person({ income: 300000, expense: 120000, retExp: 126000 })))[2], 'T');
  assert.equal(letters(typeOf(person({ income: 300000, expense: 120000, retExp: 127000 })))[2], 'F');
  const sameLife = person({ income: 300000, expense: 240000 }, { retC: 'TH' });
  assert.equal(letters(typeOf(sameLife))[2], 'T', 'the same life in a cheap place is still the same luggage');
});

test('capital doing most of the work is G, savings doing it is S', () => {
  assert.equal(letters(typeOf(person({ age: 50, assets: 1300000, income: 200000, expense: 130000, retExp: 130000, growth: 0 })))[3], 'G');
  assert.equal(letters(typeOf(person({ assets: 50000, income: 200000, expense: 150000, retExp: 150000 })))[3], 'S');
  assert.equal(letters(typeOf(person({ assets: 1e9 })))[3], 'G');
  assert.equal(letters(typeOf(person({ assets: 0, income: 60000, expense: 60000, growth: 0 })))[3], 'S');
});

test('there are sixteen types, one for every code, in four groups of four', () => {
  const codes = TYPES.map(t => t.code);
  assert.equal(new Set(codes).size, 16);
  for (const a of 'EL') for (const b of 'HA') for (const c of 'TF') for (const d of 'SG') assert.ok(codes.includes(a + b + c + d), a + b + c + d);
  assert.equal(GROUPS.length, 4);
  for (const g of GROUPS) assert.equal(TYPES.filter(t => t.group === g.name).length, 4, g.name);
  assert.equal(new Set(TYPES.map(t => t.name)).size, 16);
});

test('the group follows from destination and luggage', () => {
  for (const t of TYPES) assert.equal(GROUPS.find(g => g.name === t.group).letters, t.code.slice(1, 3), t.code);
});

test('every type has an image and a blurb, and passes the compliance rules', () => {
  for (const t of TYPES) {
    assert.ok(t.name && t.emoji && t.blurb, t.code);
    assert.deepEqual(findBannedCopy(JSON.stringify(t)), []);
  }
});

test('progress is reported separately from the type', () => {
  assert.equal(typeOf(person({ assets: 1e9 })).status.id, 'reached');
  assert.equal(typeOf(person({ assets: 0, income: 60000, expense: 60000, growth: 0 })).status.id, 'waiting');
  assert.equal(typeOf(person({ age: 40, assets: 2000000, income: 130000, expense: 120000, growth: 0 })).status.id, 'coast');
  assert.equal(typeOf(person({ assets: 50000, income: 200000, expense: 150000 })).status.id, 'onway');
});

test('every one of the 16 types is reachable', () => {
  const seen = new Set();
  for (const age of [25, 40, 50]) for (const assets of [0, 3000000, 20000000]) for (const income of [100000, 1000000]) for (const share of [0.3, 0.7]) for (const richer of [0.7, 1.6]) for (const retC of ['CN', 'TH']) {
    let S = setRetireCountry(defaultState(DATA), retC, DATA);
    for (const [id, value] of Object.entries({ age, assets, income, expense: income * share })) S = setField(S, id, String(value), DATA);
    S = setField(S, 'retExp', String(Math.round(S.retExp * richer)), DATA);
    seen.add(holidayType(toParams(S, DATA), DATA, { workC: 'CN', retC }).code);
  }
  assert.deepEqual([...seen].sort(), TYPES.map(t => t.code).sort());
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
