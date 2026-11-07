import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { bwdSolve, fiNeed, fwdSolve, lifePath } from '../site/js/engine.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { LIFE_CHOICES, labPlan } from '../site/js/levers.js';
import { fifthCompareHtml, fifthSentence, labChangesHtml, livesHtml, ribbonSvg } from '../site/js/views.js';
import { hardestIndex, heroModel, holidayYearsOf, lifeName, lifeRibbon, lifeStory, peopleOf } from '../site/js/holiday.js';

const person = (fields = {}) => {
  let S = defaultState(DATA);
  for (const [id, value] of Object.entries(fields)) S = setField(S, id, String(value), DATA);
  return toParams(S, DATA);
};

test('the hero splits a life into work and holiday years', () => {
  const p = person();
  const t = fwdSolve(p);
  const h = heroModel({ mode: 'fwd', p, t, bwd: bwdSolve(p), success: 0.7 });
  assert.equal(h.workYears, t);
  assert.equal(h.holidayYears, p.life - p.age - t);
  assert.equal(h.holidayAge, p.age + t);
  assert.equal(h.reachable, true);
  assert.ok(h.mondays > 0);
});

test('the hero shows how far along the holiday money is', () => {
  const p = person({ assets: 500000 });
  const t = fwdSolve(p);
  const h = heroModel({ mode: 'fwd', p, t, bwd: bwdSolve(p), success: 0.7 });
  assert.equal(h.fund.need, fiNeed(p, t));
  assert.ok(Math.abs(h.fund.share - 500000 / fiNeed(p, t)) < 1e-9);
});

test('the hero caps the money bar when the money is already there', () => {
  const p = person({ assets: 1e9 });
  const h = heroModel({ mode: 'fwd', p, t: 0, bwd: bwdSolve(p), success: 1 });
  assert.equal(h.fund.share, 1);
  assert.equal(h.workYears, 0);
});

test('the hero never invents an age for someone who cannot reach it', () => {
  const p = person({ assets: 0, income: 60000, expense: 60000, growth: 0 });
  const h = heroModel({ mode: 'fwd', p, t: null, bwd: bwdSolve(p), success: null });
  assert.equal(h.reachable, false);
  assert.equal(h.holidayAge, null);
  assert.equal(h.holidayYears, 0);
  assert.equal(h.people, null);
  assert.equal(h.mondays, 0);
});

test('the backward hero uses the target age', () => {
  const p = person({ tAge: 50 });
  const h = heroModel({ mode: 'bwd', p, t: fwdSolve(p), bwd: bwdSolve(p), success: 0.8 });
  assert.equal(h.holidayAge, 50);
  assert.equal(h.workYears, 20);
  assert.equal(h.fund.need, bwdSolve(p).need);
});

test('parallel people round a chance without implying certainty or doom', () => {
  assert.equal(peopleOf(0.7), 7);
  assert.equal(peopleOf(0.65), 7);
  assert.equal(peopleOf(0.645), 7, 'matches the 65% shown beside it');
  assert.equal(peopleOf(0.99), 9, 'ten of ten is only for a certain result');
  assert.equal(peopleOf(1), 10);
  assert.equal(peopleOf(0.01), 1, 'zero of ten is only for an impossible result');
  assert.equal(peopleOf(0), 0);
  assert.equal(peopleOf(null), null);
});

const path = (retireT, ruinAge, rets) => ({
  seed: 1, retireT, ruinAge,
  years: [...rets.map((ret, t) => ({ t, age: 30 + t, assets: 100, ret })), { t: rets.length, age: 30 + rets.length, assets: 100, ret: null }],
});

test('a ribbon marks each year as work, holiday or out of money', () => {
  const cells = lifeRibbon(path(2, 34, [0, 0, 0, 0, 0, 0]));
  assert.deepEqual(cells.map(c => c.state), ['work', 'work', 'holiday', 'holiday', 'broke', 'broke']);
});

test('a ribbon with no holiday is all work', () => {
  assert.deepEqual(lifeRibbon(path(null, null, [0, 0])).map(c => c.state), ['work', 'work']);
});

test('a ribbon flags years that fell hard', () => {
  assert.deepEqual(lifeRibbon(path(0, null, [-0.2, -0.14, 0.3])).map(c => c.bad), [true, false, false]);
});

const story = over => ({ outcome: 'lasted', endAge: 95, endAssets: 70, ruinAge: null, retireAge: 43, retireAssets: 100, lowPoint: 80, worst: { ret: -0.1 }, best: { ret: 0.1 }, ...over });

test('each life gets a name from what happened in it', () => {
  assert.equal(lifeName(story({ outcome: 'working', retireAge: null })), '长跑局');
  assert.equal(lifeName(story({ outcome: 'ruined', ruinAge: 90 })), '差一口气');
  assert.equal(lifeName(story({ outcome: 'ruined', ruinAge: 50 })), '开局暴击');
  assert.equal(lifeName(story({ outcome: 'ruined', ruinAge: 70 })), '中途断粮');
  assert.equal(lifeName(story({ lowPoint: 10 })), '虎口脱险');
  assert.equal(lifeName(story({ endAssets: 300 })), '顺风局');
  assert.equal(lifeName(story({ worst: { ret: -0.25 }, best: { ret: 0.35 } })), '过山车');
  assert.equal(lifeName(story({ endAssets: 110 })), '顺风局');
  assert.equal(lifeName(story({ endAssets: 30 })), '细水长流');
  assert.equal(lifeName(story()), '平稳局');
});

test('holiday years count only years with money', () => {
  assert.equal(holidayYearsOf(story()), 52);
  assert.equal(holidayYearsOf(story({ outcome: 'ruined', ruinAge: 71 })), 28);
  assert.equal(holidayYearsOf(story({ outcome: 'working', retireAge: null })), 0);
});

test('the hardest life is the earliest to run out, then the poorest', () => {
  assert.equal(hardestIndex([story({ outcome: 'ruined', ruinAge: 80 }), story({ outcome: 'ruined', ruinAge: 60 }), story()]), 1);
  assert.equal(hardestIndex([story({ endAssets: 500 }), story({ endAssets: 90 }), story({ endAssets: 200 })]), 1);
});

test('a story reports the lowest point of the holiday', () => {
  const p = person();
  const t = fwdSolve(p);
  const life = lifePath(p, t, null, 5);
  const s = lifeStory(life, p);
  const holiday = life.years.slice(t).map(y => y.assets);
  assert.equal(s.lowPoint, Math.min(...holiday));
});

test('a story sums up the luck of a holiday: its yearly return and its hard falls', () => {
  const s = lifeStory(path(1, null, [-0.2, 0.1, -0.2, 0.21]), person());
  assert.ok(Math.abs(s.holidayReturn - (Math.cbrt(1.1 * 0.8 * 1.21) - 1)) < 1e-12);
  assert.equal(s.badYears, 2);
});

test('years after the money runs out are not part of the holiday luck', () => {
  const s = lifeStory(path(0, 32, [0.1, -0.3, -0.5, -0.5]), person());
  assert.ok(Math.abs(s.holidayReturn - (Math.sqrt(1.1 * 0.7) - 1)) < 1e-12);
  assert.equal(s.badYears, 1);
});

test('a life that never takes the holiday has no holiday return', () => {
  assert.equal(lifeStory(path(null, null, [0.1, -0.2]), person()).holidayReturn, null);
});

test('each life row shows what set its years apart', () => {
  const p = person();
  const t = fwdSolve(p);
  const lives = [5, 6].map(seed => lifePath(p, t, null, seed));
  const html = livesHtml(lives, lives.map(l => lifeStory(l, p)), 0, { p, dispCur: p.wCur });
  assert.equal((html.match(/放假头 5 年/g) ?? []).length, 2);
  assert.equal((html.match(/整个假期/g) ?? []).length, 2);
  assert.equal((html.match(/大跌 \d+ 次/g) ?? []).length, 2);
  assert.ok(!html.includes('最惨一年'));
});

test('a return that rounds to zero is not painted as a loss', () => {
  const p = person();
  const t = fwdSolve(p);
  const life = lifePath(p, t, null, 5);
  const s = { ...lifeStory(life, p), firstFive: -0.004, holidayReturn: -0.03 };
  const html = livesHtml([life], [s], 0, { p, dispCur: p.wCur });
  assert.match(html, /<b class="">0%\/年<\/b>/);
  assert.match(html, /<b class="bad">−3%\/年<\/b>/);
});

test('what wrote the last life is listed, with no clear-all button', () => {
  const html = labChangesHtml(['股票实际收益']);
  assert.match(html, /股票实际收益/);
  assert.ok(!html.includes('<button'));
});

test('the rewritten plan applies values, leaving the real plan alone', () => {
  const p = person();
  const before = { ...p };
  const q = labPlan(p, { values: { income: p.income * 1.1, retExp: 90000 } });
  assert.ok(Math.abs(q.income - p.income * 1.1) < 1e-6);
  assert.equal(q.retExp, 90000);
  assert.deepEqual(p, before);
  assert.ok(fwdSolve(q) < fwdSolve(p));
});

test('a withdrawal rate written into the plan takes effect with automatic rates on', () => {
  const p = person();
  assert.ok(fwdSolve(labPlan(p, { values: { swr: 6 } })) < fwdSolve(p));
});

test('only decisions can be written in by slider', () => {
  for (const id of ['income', 'expense', 'retExp', 'pension', 'pAge', 'life']) assert.ok(LIFE_CHOICES.includes(id), id);
  for (const id of ['age', 'assets', 'sigEq', 'sigBd', 'rho', 'fxDrift']) assert.ok(!LIFE_CHOICES.includes(id), id);
});

test('the fifth life walks the same years as the life it rewrites', () => {
  const p = person();
  const q = labPlan(p, { values: { income: p.income * 1.1 } });
  const original = lifePath(p, fwdSolve(p), null, 42), rewritten = lifePath(q, fwdSolve(q), null, 42);
  assert.equal(original.years[0].ret, rewritten.years[0].ret);
  assert.equal(original.years[10].ret, rewritten.years[10].ret);
});

test('the fifth life sentence counts the holiday that has money, not the years after it runs dry', () => {
  const base = story({ outcome: 'ruined', ruinAge: 71 });
  assert.equal(fifthSentence(base, story({ outcome: 'ruined', ruinAge: 71, retireAge: 41 })), '同样的年景，有钱花的假期从 28 年变成 30 年：早 2 年放假，71 岁花完');
  assert.equal(fifthSentence(base, story({ outcome: 'lasted', retireAge: 41 })), '同样的年景，有钱花的假期从 28 年变成 54 年：早 2 年放假，钱撑到 95 岁');
  assert.equal(fifthSentence(base, story({ outcome: 'lasted', retireAge: 45 })), '同样的年景，有钱花的假期从 28 年变成 50 年：晚 2 年放假，钱撑到 95 岁');
  assert.equal(fifthSentence(base, story({ outcome: 'lasted' })), '同样的年景，有钱花的假期从 28 年变成 52 年：钱撑到 95 岁');
  assert.equal(fifthSentence(base, base), '同样的年景，结局没有变，换个选择再试试');
});

test('an earlier holiday that runs dry just as early is not sold as a gain', () => {
  const s = fifthSentence(story({ outcome: 'ruined', retireAge: 49, ruinAge: 88 }), story({ outcome: 'ruined', retireAge: 46, ruinAge: 85 }));
  assert.equal(s, '同样的年景，有钱花的假期还是 39 年：早 3 年放假，85 岁花完');
  assert.ok(!/变成 \d+ 岁花完/.test(s));
});

test('the fifth life sentence copes with a life that never takes the holiday', () => {
  assert.equal(fifthSentence(story({ outcome: 'working', retireAge: null }), story({ outcome: 'lasted' })), '同样的年景，原来放不了假，现在 43 岁放假，钱撑到 95 岁');
  assert.equal(fifthSentence(story({ outcome: 'lasted' }), story({ outcome: 'working', retireAge: null })), '同样的年景，到 95 岁也放不了假');
});

test('ribbons share one age scale even when a plan runs longer', () => {
  const short = path(2, null, [0, 0, 0, 0]);
  const svg = ribbonSvg(short, 6);
  assert.match(svg, /viewBox="0 0 60 20"/);
  assert.equal((svg.match(/r-(work|holiday|broke)/g) ?? []).length, 4);
});

test('unlocking the professional view persists, and blocked storage does not break it', async () => {
  const { isProUnlocked, unlockPro } = await import('../site/js/state.js');
  const box = new Map();
  const storage = { getItem: k => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  assert.equal(isProUnlocked(storage), false);
  unlockPro(storage);
  assert.equal(isProUnlocked(storage), true);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(isProUnlocked(blocked), false);
  assert.doesNotThrow(() => unlockPro(blocked));
  assert.equal(isProUnlocked(null), false);
});

test('the professional headline states the result without the slogan', async () => {
  const { headlineText } = await import('../site/js/views.js');
  const { dualAges } = await import('../site/js/engine.js');
  const p = person();
  const base = { mode: 'fwd', p, bwd: bwdSolve(p), dual: dualAges(p), dispCur: 'CNY', view: 'pro' };
  const t = fwdSolve(p);
  assert.match(headlineText({ ...base, t }).say, new RegExp(`财务独立年龄 ${p.age + t} 岁`));
  assert.ok(!headlineText({ ...base, t }).say.includes('余生'));
  assert.match(headlineText({ ...base, t: 0 }).say, /已达到财务独立/);
  assert.match(headlineText({ ...base, t: null }).say, /规划期内未达到/);
  assert.match(headlineText({ ...base, mode: 'bwd', t }).say, new RegExp(`目标 ${p.tAge} 岁`));
});

test('the sensitivity table has one row per parameter and honest empty cells', async () => {
  const { sensitivityHtml } = await import('../site/js/views.js');
  const { PARAMS } = await import('../site/js/params.js');
  const html = sensitivityHtml(person(), PARAMS);
  assert.equal((html.match(/<tr>/g) ?? []).length, PARAMS.length + 1);
  assert.ok(!/NaN|undefined|null/.test(html));
  assert.match(html, /年/);
});

test('the sticky summary suits each view and each outcome', async () => {
  const { stickyHtml } = await import('../site/js/views.js');
  const p = person();
  const t = fwdSolve(p);
  const hero = heroModel({ mode: 'fwd', p, t, bwd: bwdSolve(p), success: 0.7 });
  const simple = stickyHtml(hero, { p, dispCur: 'CNY', success: 0.7, pro: false });
  assert.match(simple, new RegExp(`${p.age + t} 岁放假`));
  assert.match(simple, /7\/10/);
  const pro = stickyHtml(hero, { p, dispCur: 'CNY', success: 0.7, pro: true });
  assert.match(pro, /成功率 70%/);
  const none = heroModel({ mode: 'fwd', p, t: null, bwd: bwdSolve(p), success: null });
  assert.ok(!/null|NaN|undefined/.test(stickyHtml(none, { p, dispCur: 'CNY', success: null, pro: false })));
  assert.ok(!/null|NaN|undefined/.test(stickyHtml(none, { p, dispCur: 'CNY', success: null, pro: true })));
});

test('the place list folds all but the top five, keeping the current place in view', async () => {
  const { placesHtml } = await import('../site/js/views.js');
  const rows = Array.from({ length: 11 }, (_, i) => ({ code: String(i), name: 'x' + i, cur: 'CNY', retExp: 1, age: 40 + i, years: 10 + i, current: i === 9 }));
  const html = placesHtml(rows);
  const open = html.slice(0, html.indexOf('<details'));
  assert.equal((open.match(/class="place( current)?"/g) ?? []).length, 6, 'top five plus the current place');
  assert.match(open, /x9/);
  assert.ok(!placesHtml(rows, { all: true }).includes('<details'));
});

test('the sensitivity table never claims age has no effect, and keeps the stock share risk note', async () => {
  const { sensitivityHtml } = await import('../site/js/views.js');
  const { PARAMS } = await import('../site/js/params.js');
  const row = id => sensitivityHtml(person(), PARAMS.filter(c => c.id === id));
  assert.ok(!row('age').includes('不影响放假年龄'));
  assert.match(row('sigEq'), /成功率/);
  assert.match(row('eq'), /波动/);
});

test('a written life that runs dry sooner says so plainly', () => {
  const base = story({ outcome: 'ruined', ruinAge: 71 });
  assert.equal(fifthSentence(base, story({ outcome: 'ruined', ruinAge: 68 })), '同样的年景，有钱花的假期从 28 年变成 25 年：68 岁花完');
});

test('the written life is compared against the dashed life it rewrites', () => {
  const html = fifthCompareHtml(story({ outcome: 'ruined', ruinAge: 71 }), story({ outcome: 'lasted' }));
  assert.match(html, /虚线/);
  assert.ok(html.includes(lifeName(story({ outcome: 'ruined', ruinAge: 71 }))));
  assert.ok(html.includes('有钱花的假期从 28 年变成 52 年'));
});
