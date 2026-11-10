import test from 'node:test';
import { oddsSolve, oddsYears } from '../site/js/odds.js';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { fiNeed, fiYears, fwdSolve, lifePath, monteCarlo } from '../site/js/engine.js';
import { defaultState, setField, setRetireCountry, setWorkCountry, toParams } from '../site/js/state.js';
import { rankLevers } from '../site/js/levers.js';
import { AXES, GROUPS, TYPES, drawLives, holidayType, weakness, lifeStory, mondaysIn, placeRanking, workdaysIn } from '../site/js/holiday.js';
import { allTypesHtml, livesSummary, storyHtml, typeHtml, variantsHtml } from '../site/js/views.js';

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
  assert.deepEqual([pack({ retExp: 108000 }).letter, pack({ retExp: 108000 }).value], ['F', '比现在宽裕 1.5 倍']);
  assert.deepEqual([pack({ retExp: 36000 }).letter, pack({ retExp: 36000 }).value], ['T', '只花现在的 50%']);
  assert.equal(pack({ expense: 1000, retExp: 120000 }).value, '比现在宽裕 10 倍以上', 'a tiny spending entry gives no silly ratio');
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
  for (const age of [25, 40, 50, 56]) for (const assets of [0, 3000000, 20000000]) for (const income of [100000, 1000000]) for (const share of [0.3, 0.7]) for (const richer of [0.7, 1.6]) for (const retC of ['CN', 'TH']) {
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
  assert.equal(home.age, p.age + oddsSolve(p));
  const years = rows.filter(r => r.years !== null).map(r => r.years);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
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
  assert.ok(Math.abs(home.years - oddsYears(p)) < 1e-9);
});

test('a return that rounds to zero is not shown with a minus sign', () => {
  const { p } = person();
  const html = storyHtml({ outcome: 'lasted', endAge: 95, endAssets: 1, ruinAge: null, retireAge: 43, retireAssets: 1, retireNeed: 1, worst: null, best: null, firstFive: -0.001 }, { p, dispCur: 'CNY' });
  assert.ok(!html.includes('−0%'), html);
  assert.match(html, /0%/);
});

test('the lives summary quotes the real number of simulated paths', () => {
  const stories = [{ outcome: 'lasted' }, { outcome: 'ruined' }];
  assert.match(livesSummary(stories, { success: 0.5, paths: 500 }), /500 次模拟/);
  assert.doesNotMatch(livesSummary(stories, { success: 0.5, paths: 500 }), /条人生里/);
});

test('the axes use plain words for departure and fare', () => {
  const by = Object.fromEntries(AXES.map(a => [a.key, a]));
  assert.deepEqual(by.when.poles, { E: '早班', L: '正点' });
  assert.deepEqual(by.fare.poles, { S: '现攒', G: '老本' });
  assert.deepEqual(by.where.poles, { H: '在地', A: '远方' });
  assert.deepEqual(by.pack.poles, { T: '轻装', F: '宽裕' });
  for (const a of AXES) assert.ok(!/[A-Z]/.test(a.rule), a.rule);
});

test('type and group blurbs never promise returns', () => {
  for (const x of [...TYPES, ...GROUPS]) for (const w of ['复利', '钱生钱', '替你上班']) assert.ok(!x.blurb.includes(w), x.blurb);
});

test('the result page shows the name and group, not the letter code', () => {
  const type = typeOf(person());
  const html = typeHtml(type);
  assert.ok(!html.includes(type.code));
  assert.ok(!/>[A-Z] [^<]+</.test(html));
  assert.ok(html.includes(type.name + ' · ' + type.group));
});

test('the all-types list shows no code as text', () => {
  const html = allTypesHtml();
  const text = html.replace(/<[^>]*>/g, ' ');
  assert.ok(!/[EL][HA][TF][SG]/.test(text));
  assert.ok(html.includes('data-code="EHTS"'));
});

test('the variants table says how Lean and Fat differ from the English-speaking usage', () => {
  const p = person().p;
  assert.ok(variantsHtml({ p, dispCur: 'CNY' }).includes('英文圈的 Lean / Fat 多按绝对金额分'));
});

const WEAK = {
  waiting: '按现在的节奏还到不了，最要紧的是让每个月能存下钱。',
  thin: '把握还不到八成，最怕放假头几年就撞上大跌。',
  pension: '一半以上的开销指望养老金，最怕领取年龄再推迟，或者待遇不如预期。',
  far: '换了地方生活，最怕汇率和当地物价一起涨，还有签证和医保。',
  rich: '放假后花得比现在多，最怕花销只涨不降。',
  capital: '钱主要靠老本，最怕放假前后遇上大跌。',
  early: '钱主要靠自己现攒，余量薄，最怕放假头五年就撞上大跌。',
  rest: '靠一年一年攒到点，最怕中途收入断档。',
};
const ty = (code, status = 'onway') => ({ code, status: { id: status } });

test('weakness: each of the eight rules fires on its own', () => {
  assert.equal(weakness(ty('EATS', 'waiting'), { success: 0.1, pensionShare: 0.9 }), WEAK.waiting);
  assert.equal(weakness(ty('EATS'), { success: 0.79, pensionShare: 0.9 }), WEAK.thin);
  assert.equal(weakness(ty('EATS'), { success: 0.8, pensionShare: 0.5 }), WEAK.pension);
  assert.equal(weakness(ty('EATS'), { success: null, pensionShare: 0.49 }), WEAK.far);
  assert.equal(weakness(ty('EHFS')), WEAK.rich);
  assert.equal(weakness(ty('LHTG')), WEAK.capital);
  assert.equal(weakness(ty('EHTS')), WEAK.early);
  assert.equal(weakness(ty('LHTS')), WEAK.rest);
});

test('weakness: the order holds when several rules apply', () => {
  assert.equal(weakness(ty('EATS'), { pensionShare: 0.6 }), WEAK.pension, '3 before 4');
  assert.equal(weakness(ty('LAFG')), WEAK.far, '4 before 5 and 6');
  assert.equal(weakness(ty('EHFG')), WEAK.rich, '5 before 6');
  assert.equal(weakness(ty('EHTG')), WEAK.capital, '6 before 7');
  assert.equal(weakness(ty('LHTS', 'waiting'), { success: 0.2 }), WEAK.waiting, '1 before 2');
});

test('weakness: holidayType carries it, from the odds and the pension share that were passed in', () => {
  const { p, workC, retC } = person();
  assert.equal(holidayType(p, DATA, { workC, retC, retireT: 10, success: 0.5 }).weakness, WEAK.thin);
  const reliant = holidayType({ ...p, pension: p.retExp * 0.8 }, DATA, { workC, retC, retireT: 10, success: 0.9 });
  assert.equal(reliant.weakness, WEAK.pension);
  const zero = holidayType({ ...p, retExp: 0, pension: 1000 }, DATA, { workC, retC, retireT: 10, success: 0.9 });
  assert.notEqual(zero.weakness, WEAK.pension, 'no spending means no share');
});

test('all 16 types have a non-empty weakness without a digit, and the page shows it', () => {
  for (const t of TYPES) {
    for (const status of ['onway', 'waiting']) for (const opts of [{}, { success: 0.5 }, { pensionShare: 0.7 }]) {
      const w = weakness({ ...t, status: { id: status } }, opts);
      assert.ok(w.length > 0);
      assert.ok(!/\d/.test(w), w);
      assert.deepEqual(findBannedCopy(w), []);
    }
  }
  const type = typeOf(person());
  assert.ok(type.weakness);
  assert.match(typeHtml(type), new RegExp(`软肋：${type.weakness}`));
});
