// Makes a result feel personal: Mondays left, a holiday type, the same money elsewhere, one drawn life.
// Pure functions, no DOM. Every label and number comes from the model, with its rule published on the method page.
import { assetsAt, buildParams, coastNeed, conv, fiNeed, fiYears, fwdSolve, lifePath, savingsRate } from './engine.js';

const DAYS_PER_YEAR = 365.25;
const WORKDAYS_PER_YEAR = 250;

export const mondaysIn = years => Math.round(years * DAYS_PER_YEAR / 7);
export const workdaysIn = years => Math.round(years * WORKDAYS_PER_YEAR);

const MIGRANT_PRICE_RATIO = 0.8;
const SAVER_RATE = 0.5;
const LEAN_RATIO = 0.7;
const FAT_RATIO = 1.5;
const SNOWBALL_SHARE = 0.5;

export const TYPES = [
  { id: 'reached', name: '假期中', en: 'FIRE reached', group: '已上岸', blurb: '钱已经够了，接下来的问题是怎么过。', rule: '现有资产已经达到放假线。' },
  { id: 'coast', name: '滑行型', en: 'Coast FIRE', group: '已上岸', blurb: '就算今天起不再存钱，复利也会把你送到终点。', rule: '不再储蓄，现有资产靠复利也能在领养老金时达到放假线。' },
  { id: 'saver', name: '松鼠型', en: 'High saver', group: '积累派', blurb: '靠高储蓄率把放假往前推，这是最可控的一条路。', rule: '储蓄率达到 50%。' },
  { id: 'snowball', name: '雪球型', en: 'Compounder', group: '积累派', blurb: '本金已经在替你干活，时间是你最大的帮手。', rule: '放假时一半以上的资产来自现有本金的复利。' },
  { id: 'migrant', name: '候鸟型', en: 'Geo-arbitrage', group: '设计派', blurb: '在贵的地方赚钱，去便宜的地方放假。', rule: '退休地物价不超过现居地的 80%。' },
  { id: 'lean', name: '极简型', en: 'Lean FIRE', group: '设计派', blurb: '想要的不多，所以能早点走。', rule: '按物价折算后，退休支出不超过现在的 70%。' },
  { id: 'fat', name: '海景型', en: 'Fat FIRE', group: '设计派', blurb: '放假也要过得宽裕，所以多攒几年。', rule: '按物价折算后，退休支出达到现在的 1.5 倍。' },
  { id: 'steady', name: '长跑型', en: 'Steady runner', group: '路上派', blurb: '按部就班地走，节奏稳定就能到。', rule: '能到达放假线，且不属于以上任何一种。' },
  { id: 'seedling', name: '破土型', en: 'Just starting', group: '路上派', blurb: '终点还没出现，但每一步都在把它拉近。', rule: '按现在的节奏，规划期内还到不了放假线。' },
];
const BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));
const percent = v => `${Math.round(v * 100)}%`;

// The first matching rule wins, in the order written here, so the result is deterministic and checkable.
export function holidayType(p, data, { workC, retC }) {
  const pick = (id, why) => ({ ...BY_ID[id], why });
  const t = fwdSolve(p);
  const rate = savingsRate(p);
  if (t === 0) return pick('reached', '现有资产已经够覆盖放假所需。');
  if (t === null) return pick('seedling', rate !== null && rate > 0 ? '按现在的节奏，规划期内还到不了放假线。' : '目前存不下钱，第一步是让收入超过支出。');
  if (p.assets >= coastNeed(p)) return pick('coast', `今天起不再存钱，靠复利到 ${Math.max(p.pAge, p.age)} 岁也能达标。`);

  const priceRatio = data.countries[retC].priceLevel.value / data.countries[workC].priceLevel.value;
  if (workC !== retC && priceRatio <= MIGRANT_PRICE_RATIO) return pick('migrant', `退休地物价约为现居地的 ${percent(priceRatio)}。`);
  if (rate !== null && rate >= SAVER_RATE) return pick('saver', `储蓄率 ${percent(rate)}，达到 50% 门槛。`);

  if (p.expense > 0) {
    const spendRatio = conv(p.retExp, p.rCur, p.wCur, p.fx) / priceRatio / p.expense;
    if (spendRatio <= LEAN_RATIO) return pick('lean', `退休支出约为现在的 ${percent(spendRatio)}。`);
    if (spendRatio >= FAT_RATIO) return pick('fat', `退休支出约为现在的 ${percent(spendRatio)}。`);
  }
  const atHoliday = assetsAt(p, t);
  const share = atHoliday > 0 ? p.assets * Math.pow(1 + p.r, t) / atHoliday : 0;
  if (share >= SNOWBALL_SHARE) return pick('snowball', `放假时约 ${percent(Math.min(share, 1))} 的资产来自现有本金的复利。`);
  return pick('steady', rate !== null && rate > 0 ? `储蓄率 ${percent(rate)}，按部就班走向放假线。` : '按部就班走向放假线。');
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
