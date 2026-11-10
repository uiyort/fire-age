// Makes a result feel personal: Mondays left, a four-letter holiday type, the same money elsewhere, one drawn life.
// Pure functions, no DOM. Every label and number comes from the model, with its rule published on the method page.
import { assetsAt, buildParams, coastNeed, conv, fiNeed, lifePath, savingsRate } from './engine.js';
import { needLine, oddsSolve, oddsYears } from './odds.js';

const DAYS_PER_YEAR = 365.25;
const WORKDAYS_PER_YEAR = 250;

export const mondaysIn = years => Math.round(years * DAYS_PER_YEAR / 7);
export const workdaysIn = years => Math.round(years * WORKDAYS_PER_YEAR);

const EARLY_AGE = 50;
// Within 5% of today's lifestyle counts as the same.
const SAME_BAND = 0.05;
const GROW_SHARE = 0.5;

// Four questions about a holiday, each with two answers. One letter from each makes the type.
export const AXES = [
  { key: 'when', name: '启程', poles: { E: '早班', L: '正点' }, rule: '放假年龄在 50 岁前（含 50 岁）是早班，50 岁后或还到不了是正点。' },
  { key: 'where', name: '目的地', poles: { H: '在地', A: '远方' }, rule: '在现在生活的地方放假是在地，换个地方是远方。' },
  { key: 'pack', name: '行李', poles: { T: '轻装', F: '宽裕' }, rule: '放假后的生活和现在比（按两地物价折算）：不比现在宽裕是轻装，比现在宽裕是宽裕。' },
  { key: 'fare', name: '路费', poles: { S: '现攒', G: '老本' }, rule: '放假那天的钱，一半以上来自今天已有的存款（连同它的收益）是老本，否则是现攒。' },
];

export const GROUPS = [
  { name: '归园派', letters: 'HT', blurb: '不走远，也不多花，把日子过回自己手里。' },
  { name: '主场派', letters: 'HF', blurb: '就在熟悉的地方，把假期过得舒舒服服。' },
  { name: '漫游派', letters: 'AT', blurb: '行李不多，地图很大。' },
  { name: '环球派', letters: 'AF', blurb: '走得远，也住得好。' },
];

export const TYPES = [
  ['EHTS', '采菊人', '🌼', '一笔一笔攒出来，早早收工，回家种花。'],
  ['EHTG', '垂钓客', '🎣', '老本够厚，早早收工，坐在河边等鱼咬钩。'],
  ['LHTS', '老园丁', '🌱', '慢慢攒，慢慢种，到点回自己的园子。'],
  ['LHTG', '晒背猫', '🐱', '不着急，等老本慢慢长，够了就躺下。'],
  ['EHFS', '早午餐家', '🍳', '存够了就不赶早高峰，上午十点才开始今天。'],
  ['EHFG', '庄园主', '🏡', '老本打底，早早住进自己的大院子。'],
  ['LHFS', '茶馆东家', '🍵', '攒了一辈子，开张之后天天有人陪喝茶。'],
  ['LHFG', '酒窖主', '🍷', '越陈越香，时间到了，开一瓶最好的。'],
  ['EATS', '背包客', '🎒', '存够路费就出发，趁膝盖还好。'],
  ['EATG', '冲浪客', '🏄', '老本留在岸上，人在浪上漂。'],
  ['LATS', '候鸟', '🐦', '攒够了就飞，哪里暖和住哪里。'],
  ['LATG', '房车客', '🚐', '不赶路，带着老本上路，开到哪算哪。'],
  ['EAFS', '环球旅人', '🧭', '早早存够大钱，世界地图一格一格点亮。'],
  ['EAFG', '帆船船长', '⛵', '带着老本，趁风好早早出海。'],
  ['LAFS', '邮轮常客', '🚢', '辛苦了大半辈子，这次换别人开船。'],
  ['LAFG', '岛主', '🏝️', '攒下的老本送你上岛，剩下的时间归海浪。'],
].map(([code, name, emoji, blurb]) => ({ code, name, emoji, blurb, group: GROUPS.find(g => g.letters === code.slice(1, 3)).name }));

const BY_CODE = Object.fromEntries(TYPES.map(t => [t.code, t]));
const percent = v => `${Math.round(v * 100)}%`;

// Where this person is on the way there, separate from what kind of holiday it is.
function progress(p, t) {
  if (t === 0) return { id: 'reached', name: '假期中', why: '现有资产已经够覆盖放假所需。' };
  if (t === null) {
    const saving = (savingsRate(p) ?? 0) > 0;
    return { id: 'waiting', name: '待发车', why: saving ? '按现在的节奏，规划期内还到不了放假线。' : '目前存不下钱，第一步是让收入超过支出。' };
  }
  if (p.assets >= coastNeed(p)) return { id: 'coast', name: '滑行中', why: `今天起不再存钱，靠复利到 ${Math.max(p.pAge, p.age)} 岁也能到站。` };
  return { id: 'onway', name: '在路上', why: `还有 ${t} 年到站。` };
}

// Working backward, retireT is the asked-for holiday, and the plan arrives exactly at the money it needs.
function packText(lifestyle) {
  if (!Number.isFinite(lifestyle)) return '现在没有填支出';
  if (Math.abs(lifestyle - 1) <= SAME_BAND) return '和现在差不多';
  if (lifestyle > 10) return '比现在宽裕 10 倍以上';
  return lifestyle > 1 ? `比现在宽裕 ${lifestyle.toFixed(1)} 倍` : `只花现在的 ${percent(lifestyle)}`;
}

// One sentence on what this holiday is most exposed to. The first rule that fits wins; the table is on the method page.
export function weakness(type, { success = null, pensionShare = 0 } = {}) {
  const letters = type.code ?? '';
  if (type.status?.id === 'waiting') return '按现在的节奏还到不了，最要紧的是让每个月能存下钱。';
  if (success !== null && success < 0.8) return '把握还不到八成，最怕放假头几年就撞上大跌。';
  if (pensionShare >= 0.5) return '一半以上的开销指望养老金，最怕领取年龄再推迟，或者待遇不如预期。';
  if (letters[1] === 'A') return '换了地方生活，最怕汇率和当地物价一起涨，还有签证和医保。';
  if (letters[2] === 'F') return '放假后花得比现在多，最怕花销只涨不降。';
  if (letters[3] === 'G') return '钱主要靠老本，最怕放假前后遇上大跌。';
  if (letters[0] === 'E') return '钱主要靠自己现攒，余量薄，最怕放假头五年就撞上大跌。';
  return '靠一年一年攒到点，最怕中途收入断档。';
}

export function holidayType(p, data, { workC, retC, retireT, success = null }) {
  const backward = retireT !== undefined;
  const t = backward ? retireT : oddsSolve(p);
  const age = t === null ? null : p.age + t;
  const priceRatio = data.countries[retC].priceLevel.value / data.countries[workC].priceLevel.value;
  const lifestyle = p.expense > 0 ? conv(p.retExp, p.rCur, p.wCur, p.fx) / priceRatio / p.expense : Infinity;
  const atHoliday = t === null ? 0 : backward ? needLine(p)[t] : assetsAt(p, t);
  const capitalShare = atHoliday > 0 ? Math.min(p.assets * Math.pow(1 + p.r, t) / atHoliday, 1) : 0;

  const picks = {
    when: [age !== null && age <= EARLY_AGE ? 'E' : 'L', age === null ? '还没到' : `${age} 岁放假`],
    where: [workC === retC ? 'H' : 'A', data.countries[retC].name],
    pack: [lifestyle <= 1 + SAME_BAND ? 'T' : 'F', packText(lifestyle)],
    fare: [capitalShare >= GROW_SHARE ? 'G' : 'S', t === null ? '还在攒' : `${percent(capitalShare)} 来自今天已有的存款`],
  };
  const axes = AXES.map(axis => {
    const [letter, value] = picks[axis.key];
    return { key: axis.key, name: axis.name, poles: axis.poles, letter, pole: axis.poles[letter], value };
  });
  const code = axes.map(a => a.letter).join('');
  const type = { ...BY_CODE[code], axes, status: progress(p, t) };
  const pensionShare = p.retExp > 0 ? Math.min(p.pension / p.retExp, 1) : 0;
  return { ...type, weakness: weakness(type, { success, pensionShare }) };
}

// The same plan in every place. Spending keeps its purchasing power; a pension moves at market exchange rates.
export function placeRanking(p, data, retC) {
  const here = data.countries[retC].priceLevel.value;
  const rows = Object.entries(data.countries).map(([code, c]) => {
    const retExp = conv(p.retExp, p.rCur, c.cur, p.fx) * c.priceLevel.value / here;
    const pension = conv(p.pension, p.rCur, c.cur, p.fx);
    const q = buildParams({ ...p, rCur: c.cur, retExp, pension }, p.fx);
    const t = oddsSolve(q);
    return { code, name: c.name, cur: c.cur, retExp, pension, age: t === null ? null : p.age + t, years: oddsYears(q), current: code === retC };
  });
  return rows.sort((a, b) => {
    if (a.years === null || b.years === null) return (a.years === null) - (b.years === null);
    return a.years - b.years || b.current - a.current;
  });
}

export const drawLives = (p, retireT, s0, baseSeed, count = 4) =>
  Array.from({ length: count }, (_, i) => lifePath(p, retireT, s0, baseSeed + i));

const moment = (years, i) => ({ age: years[i].age, ret: years[i].ret, before: years[i].assets, after: years[i + 1].assets });

// The moments worth telling from one path. Years after the money ran out have nothing left to gain or lose.
export function lifeStory(path, p, need = null) {
  const { years, retireT, ruinAge } = path;
  const lived = years.map((y, i) => [y, i]).filter(([y]) => y.ret !== null && (ruinAge === null || y.age < ruinAge)).map(([, i]) => i);
  const pickBy = better => (lived.length ? moment(years, lived.reduce((a, b) => (better(years[b].ret, years[a].ret) ? b : a))) : null);
  const retired = retireT === null ? [] : years.slice(retireT, retireT + 5).filter(y => y.ret !== null).map(y => y.ret);
  const firstFive = retired.length ? Math.pow(retired.reduce((acc, r) => acc * (1 + r), 1), 1 / retired.length) - 1 : null;
  // The luck of a life, counted only while the money lasts.
  const kept = years.filter(y => y.ret !== null && (ruinAge === null || y.age < ruinAge));
  const onHoliday = retireT === null ? [] : kept.filter(y => y.t >= retireT).map(y => y.ret);
  // A life that runs dry in its first holiday year falls back to its first holiday years.
  const holidayReturn = onHoliday.length ? Math.pow(onHoliday.reduce((acc, r) => acc * (1 + r), 1), 1 / onHoliday.length) - 1 : retireT === null ? null : firstFive;
  const last = years[years.length - 1];
  return {
    outcome: retireT === null ? 'working' : ruinAge !== null ? 'ruined' : 'lasted',
    endAge: last.age,
    endAssets: last.assets,
    ruinAge,
    retireAge: retireT === null ? null : p.age + retireT,
    retireAssets: retireT === null ? null : years[retireT].assets,
    retireNeed: retireT === null ? null : need ?? fiNeed(p, retireT),
    lowPoint: retireT === null ? null : Math.min(...years.slice(retireT).map(y => y.assets)),
    worst: pickBy((a, b) => a < b),
    best: pickBy((a, b) => a > b),
    firstFive,
    holidayReturn,
    badYears: kept.filter(y => y.ret <= HARD_FALL).length,
  };
}

const HARD_FALL = -0.15;
const NEAR_END_YEARS = 10;
const EARLY_RUIN_YEARS = 15;

// One cell per year of a life: working, on holiday with money, or on holiday with the money gone.
export function lifeRibbon(path) {
  return path.years.filter(y => y.ret !== null).map(y => {
    const state = path.retireT === null || y.t < path.retireT ? 'work' : path.ruinAge !== null && y.age >= path.ruinAge ? 'broke' : 'holiday';
    return { age: y.age, state, bad: y.ret <= HARD_FALL };
  });
}

export function holidayYearsOf(story) {
  if (story.outcome === 'working') return 0;
  return (story.outcome === 'ruined' ? story.ruinAge : story.endAge) - story.retireAge;
}

// A name for what happened, so four lines of numbers read as four different lives.
export function lifeName(story) {
  if (story.outcome === 'working') return '长跑局';
  if (story.outcome === 'ruined') {
    if (story.ruinAge >= story.endAge - NEAR_END_YEARS) return '差一口气';
    return story.ruinAge - story.retireAge <= EARLY_RUIN_YEARS ? '开局暴击' : '中途断粮';
  }
  if (story.retireAssets > 0 && story.lowPoint < story.retireAssets * 0.25) return '虎口脱险';
  if (story.worst && story.best && story.worst.ret <= -0.2 && story.best.ret >= 0.3) return '过山车';
  if (story.endAssets >= story.retireAssets) return '顺风局';
  return story.endAssets >= story.retireAssets * 0.5 ? '平稳局' : '细水长流';
}

// Other true names for a life, tried in order when its first name is already taken in the same draw.
function otherNames(s) {
  if (s.outcome === 'working') return ['还在攒'];
  const start = s.firstFive ?? 0, bad = s.badYears ?? 0;
  if (s.outcome === 'ruined') {
    return [[start >= 0.04, '后劲不足'], [start < 0, '起步就难'], [bad >= 3, '风浪不断'], [true, '入不敷出']].filter(([ok]) => ok).map(([, name]) => name);
  }
  const ratio = s.retireAssets > 0 ? s.endAssets / s.retireAssets : 1;
  return [
    [bad >= 3, '风浪不断'], [start < 0, '先苦后甜'], [start >= 0.06 && ratio >= 1, '一路高歌'],
    [s.retireAssets > 0 && s.lowPoint < s.retireAssets * 0.25, '虎口脱险'],
    [s.worst && s.best && s.worst.ret <= -0.2 && s.best.ret >= 0.3, '过山车'],
    [ratio >= 1, '顺风局'], [ratio >= 0.5, '平稳局'], [ratio < 0.5, '细水长流'],
  ].filter(([ok]) => ok).map(([, name]) => name);
}

const ORDINALS = ['二', '三', '四', '五', '六'];

// Names for lives drawn together: each stays true to its own life, and no two are the same.
export function lifeNames(stories) {
  const taken = [];
  for (const s of stories) {
    const first = lifeName(s);
    const free = [first, ...otherNames(s)].find(name => !taken.includes(name));
    if (free) { taken.push(free); continue; }
    const k = taken.filter(name => name === first || name.startsWith(`${first}·`)).length;
    taken.push(`${first}·${ORDINALS[k - 1] ?? k + 1}`);
  }
  return taken;
}

// The life that went worst: the earliest to run out, otherwise the one with least left.
export function hardestIndex(stories) {
  const rank = s => (s.outcome === 'ruined' ? s.ruinAge - 1e6 : s.endAssets);
  return stories.reduce((worst, s, i) => (rank(s) < rank(stories[worst]) ? i : worst), 0);
}

// Rounded down, so the odds are never said to be better than they are: 79.9% is 7 in 10, and under 10% is none of 10.
export function peopleOf(success) {
  if (success === null || success === undefined) return null;
  return Math.min(Math.max(Math.floor(success * 10 + 1e-9), 0), 10);
}

// The odds in words for the simple view. Under one in ten is said as such, never as zero.
export function oddsText(success) {
  const n = peopleOf(success);
  if (n === null) return '';
  return n === 0 ? '不到 1 成把握' : `${n} 成把握`;
}

// The odds band a sentence speaks for, judged on the success rate itself, not on the rounded figure.
export const oddsBand = success => (success === null || success === undefined ? null : success >= 0.8 ? 'sure' : success >= 0.5 ? 'hedge' : 'thin');

// The conclusion as shapes: how a life splits between work and holiday, how far along the money is,
// and how many months of holiday are already saved.
export function heroModel({ mode, p, t, bwd, success, need = null, ruler = null }) {
  const total = p.life - p.age;
  const backward = mode === 'bwd';
  const workYears = backward ? bwd.n : t;
  const reachable = workYears !== null;
  const line = need ?? fiNeed(p, workYears ?? 0);
  const yearSpend = conv(p.retExp, p.rCur, p.wCur, p.fx);
  const monthSpend = yearSpend / 12;
  const months = monthSpend > 0 ? Math.floor(p.assets / monthSpend + 1e-9) : null;
  // The next whole year of holiday: a first full year, then each year after.
  const nextMonths = months === null ? null : months < 12 ? 12 : (Math.floor(months / 12) + 1) * 12;
  return {
    reachable,
    startAge: p.age,
    endAge: p.life,
    holidayAge: reachable ? p.age + workYears : null,
    workYears: reachable ? workYears : total,
    holidayYears: reachable ? total - workYears : 0,
    mondays: reachable ? mondaysIn(workYears) : 0,
    success: reachable ? success : null,
    people: reachable ? peopleOf(success) : null,
    // Forward, the age is the 8-in-10 age by definition; working backward, the odds are those of the plan as it is.
    label: !reachable ? '' : backward ? oddsText(success) : '八成把握',
    fund: { have: p.assets, need: line, share: line > 0 ? Math.min(p.assets / line, 1) : 1 },
    times: yearSpend > 0 && reachable ? Math.round(line / yearSpend) : null,
    months,
    // Savings that alone cover every month to the end of the plan, before any return: the count stops meaning anything.
    covered: months !== null && months >= total * 12,
    // Someone who can stop today has no next step to save for.
    next: months === null || (reachable && workYears === 0) || months >= total * 12 || nextMonths * monthSpend <= p.assets ? null : { months: nextMonths, gap: nextMonths * monthSpend - p.assets },
    ruler,
  };
}
