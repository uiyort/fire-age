// Makes a result feel personal: Mondays left, a four-letter holiday type, the same money elsewhere, one drawn life.
// Pure functions, no DOM. Every label and number comes from the model, with its rule published on the method page.
import { assetsAt, buildParams, coastNeed, conv, fiNeed, fiYears, fwdSolve, lifePath, savingsRate } from './engine.js';

const DAYS_PER_YEAR = 365.25;
const WORKDAYS_PER_YEAR = 250;

export const mondaysIn = years => Math.round(years * DAYS_PER_YEAR / 7);
export const workdaysIn = years => Math.round(years * WORKDAYS_PER_YEAR);

const EARLY_AGE = 50;
const LIGHT_SHARE = 0.6;
const GROW_SHARE = 0.5;

// Four questions about a holiday, each with two answers. One letter from each makes the type.
export const AXES = [
  { key: 'when', name: '启程', poles: { E: '早', L: '晚' }, rule: '放假年龄在 50 岁及以前是 E，之后或还到不了是 L。' },
  { key: 'where', name: '目的地', poles: { H: '在地', A: '远方' }, rule: '在现在生活的地方放假是 H，换个地方是 A。' },
  { key: 'pack', name: '行李', poles: { T: '轻装', F: '宽裕' }, rule: '放假后的开销（按当地物价折算）不超过现在收入的 60% 是 T，超过是 F。' },
  { key: 'fare', name: '路费', poles: { S: '靠存', G: '靠滚' }, rule: '放假时一半以上的资产来自现有本金的复利是 G，否则是 S。' },
];

export const GROUPS = [
  { name: '归园派', letters: 'HT', blurb: '不走远，也不多花，把日子过回自己手里。' },
  { name: '主场派', letters: 'HF', blurb: '就在熟悉的地方，把假期过得舒舒服服。' },
  { name: '漫游派', letters: 'AT', blurb: '行李不多，地图很大。' },
  { name: '环球派', letters: 'AF', blurb: '走得远，也住得好。' },
];

export const TYPES = [
  ['EHTS', '采菊人', '🌼', '一笔一笔攒出来，早早收工，回家种花。'],
  ['EHTG', '垂钓客', '🎣', '本金替你上班，你坐在河边等鱼咬钩。'],
  ['LHTS', '老园丁', '🌱', '慢慢攒，慢慢种，到点回自己的园子。'],
  ['LHTG', '晒背猫', '🐱', '不着急，让复利多晒一会儿，够了就躺下。'],
  ['EHFS', '早午餐家', '🍳', '存够了就不赶早高峰，上午十点才开始今天。'],
  ['EHFG', '庄园主', '🏡', '钱生钱的速度够快，早早住进自己的大院子。'],
  ['LHFS', '茶馆东家', '🍵', '攒了一辈子，开张之后天天有人陪喝茶。'],
  ['LHFG', '酒窖主', '🍷', '越陈越香，时间到了，开一瓶最好的。'],
  ['EATS', '背包客', '🎒', '存够路费就出发，趁膝盖还好。'],
  ['EATG', '冲浪客', '🏄', '本金在岸上滚，人在浪上漂。'],
  ['LATS', '候鸟', '🐦', '攒够了就飞，哪里暖和住哪里。'],
  ['LATG', '房车客', '🚐', '不赶路，让复利当油钱，开到哪算哪。'],
  ['EAFS', '环球旅人', '🧭', '早早存够大钱，世界地图一格一格点亮。'],
  ['EAFG', '帆船船长', '⛵', '资产顺风，人也顺风，早早出海。'],
  ['LAFS', '邮轮常客', '🚢', '辛苦了大半辈子，这次换别人开船。'],
  ['LAFG', '岛主', '🏝️', '复利送你上岛，剩下的时间归海浪。'],
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

export function holidayType(p, data, { workC, retC }) {
  const t = fwdSolve(p);
  const age = t === null ? null : p.age + t;
  const priceRatio = data.countries[retC].priceLevel.value / data.countries[workC].priceLevel.value;
  const spendShare = p.income > 0 ? conv(p.retExp, p.rCur, p.wCur, p.fx) / priceRatio / p.income : Infinity;
  const atHoliday = t === null ? 0 : assetsAt(p, t);
  const capitalShare = atHoliday > 0 ? Math.min(p.assets * Math.pow(1 + p.r, t) / atHoliday, 1) : 0;

  const picks = {
    when: [age !== null && age <= EARLY_AGE ? 'E' : 'L', age === null ? '还没到' : `${age} 岁放假`],
    where: [workC === retC ? 'H' : 'A', data.countries[retC].name],
    pack: [spendShare <= LIGHT_SHARE ? 'T' : 'F', Number.isFinite(spendShare) ? `开销占收入 ${percent(spendShare)}` : '目前没有收入'],
    fare: [capitalShare >= GROW_SHARE ? 'G' : 'S', t === null ? '还在攒' : `本金复利占 ${percent(capitalShare)}`],
  };
  const axes = AXES.map(axis => {
    const [letter, value] = picks[axis.key];
    return { key: axis.key, name: axis.name, poles: axis.poles, letter, pole: axis.poles[letter], value };
  });
  const code = axes.map(a => a.letter).join('');
  return { ...BY_CODE[code], axes, status: progress(p, t) };
}

// The same plan in every place. Spending keeps its purchasing power; a pension moves at market exchange rates.
export function placeRanking(p, data, retC) {
  const here = data.countries[retC].priceLevel.value;
  const rows = Object.entries(data.countries).map(([code, c]) => {
    const retExp = conv(p.retExp, p.rCur, c.cur, p.fx) * c.priceLevel.value / here;
    const pension = conv(p.pension, p.rCur, c.cur, p.fx);
    const q = buildParams({ ...p, rCur: c.cur, retExp, pension }, p.fx);
    const t = fwdSolve(q);
    return { code, name: c.name, cur: c.cur, retExp, pension, age: t === null ? null : p.age + t, years: fiYears(q), current: code === retC };
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
export function lifeStory(path, p) {
  const { years, retireT, ruinAge } = path;
  const lived = years.map((y, i) => [y, i]).filter(([y]) => y.ret !== null && (ruinAge === null || y.age < ruinAge)).map(([, i]) => i);
  const pickBy = better => (lived.length ? moment(years, lived.reduce((a, b) => (better(years[b].ret, years[a].ret) ? b : a))) : null);
  const retired = retireT === null ? [] : years.slice(retireT, retireT + 5).filter(y => y.ret !== null).map(y => y.ret);
  const firstFive = retired.length ? Math.pow(retired.reduce((acc, r) => acc * (1 + r), 1), 1 / retired.length) - 1 : null;
  const last = years[years.length - 1];
  return {
    outcome: retireT === null ? 'working' : ruinAge !== null ? 'ruined' : 'lasted',
    endAge: last.age,
    endAssets: last.assets,
    ruinAge,
    retireAge: retireT === null ? null : p.age + retireT,
    retireAssets: retireT === null ? null : years[retireT].assets,
    retireNeed: retireT === null ? null : fiNeed(p, retireT),
    worst: pickBy((a, b) => a < b),
    best: pickBy((a, b) => a > b),
    firstFive,
  };
}
