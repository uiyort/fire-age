// Content studio logic: turns personas into card decks and a data bundle for writing copy. No DOM access.
import { DEFAULT_SEED, fiNeed, fwdSolve, fiYears, lifePath, monteCarlo, savingsRate, swrFor } from './engine.js';
import { holidayType, lifeStory, mondaysIn, placeRanking } from './holiday.js';
import { lifeCardSpec, placeCardSpec, toLifeCardInput } from './card.js';
import { defaultState, setField, setRetireCountry, setWorkCountry, toParams } from './state.js';
import { rankLevers } from './levers.js';
import { money, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const ASK = '评论区晒出你的放假年龄';

export function personaResult(persona, data) {
  let S = setWorkCountry(defaultState(data), persona.workC, data);
  S = setRetireCountry(S, persona.retC, data);
  S = { ...S, dispCur: data.countries[persona.workC].cur };
  for (const id of ['age', 'assets', 'income', 'expense', 'growth', 'retExp', 'pension']) {
    if (persona[id] !== undefined) S = setField(S, id, String(persona[id]), data);
  }
  const p = toParams(S, data);
  const t = fwdSolve(p);
  const mc = monteCarlo(p, t, null);
  const need = fiNeed(p, t ?? 0);
  const story = lifeStory(lifePath(p, t, null, DEFAULT_SEED), p);
  return {
    label: persona.label,
    workplace: data.countries[persona.workC].name,
    retirePlace: data.countries[persona.retC].name,
    inputs: { age: p.age, assets: p.assets, income: p.income, expense: p.expense, retExp: p.retExp, pension: p.pension, wCur: p.wCur, rCur: p.rCur, realReturn: p.r },
    retireAge: t === null ? null : p.age + t,
    years: t,
    fractionalYears: fiYears(p),
    success: mc.success,
    need,
    needText: money(need, p.wCur),
    retExpText: money(p.retExp, p.rCur),
    withdrawalRate: swrFor(p, p.life - p.age - (t ?? 0)),
    savingsRate: savingsRate(p),
    type: holidayType(p, data, { workC: persona.workC, retC: persona.retC }),
    mondays: t === null ? 0 : mondaysIn(t),
    places: placeRanking(p, data, persona.retC),
    life: { seed: DEFAULT_SEED, ...toLifeCardInput(story, { p, dispCur: p.wCur, mc }) },
    levers: rankLevers(p, data, { retC: persona.retC }).map(l => ({ label: l.label, gainYears: l.gainYears, unlocks: l.unlocks, afterYears: l.afterYears })),
  };
}

const card = (kind, fields) => ({ kind, size: [1080, 1440], brand: BRAND, searchHint: SEARCH_HINT, stats: [], lines: [], ...fields });
const tall = (kind, spec) => card(kind, { ...spec, kind, size: [1080, 1440] });
const leverGain = l => (l.unlocks ? '能够放假' : `提前 ${l.gainYears.toFixed(1)} 年`);

export function buildDeck(r) {
  const reachable = r.retireAge !== null;
  const stats = [{ label: '放假所需资产', value: r.needText }];
  if (reachable) stats.unshift({ label: '计划成功率', value: pct(r.success, 0) });

  const [top, ...rest] = r.levers;
  const leverCard = top
    ? card('lever', { eyebrow: '最大杠杆', hero: leverGain(top), sentence: top.label, lines: rest.map(l => `${l.label}：${leverGain(l)}`) })
    : card('lever', { eyebrow: '最大杠杆', hero: '已经很稳', sentence: '单改一项，放假年龄也变化不大', lines: ['这时候更该关心的，是资产能不能撑得更久。'] });

  return [
    card('cover', { eyebrow: r.label, hero: '几岁能放假？', sentence: '用公开数据算一算', lines: [`现在 ${r.inputs.age} 岁，储蓄率 ${r.savingsRate === null ? '0%' : pct(Math.max(r.savingsRate, 0), 0)}`] }),
    reachable
      ? card('result', { eyebrow: r.label, hero: `${r.retireAge} 岁`, sentence: r.years === 0 ? '从今天起，余生皆假期' : `从 ${r.retireAge} 岁起，余生皆假期`, stats })
      : card('result', { eyebrow: r.label, hero: '还在路上', sentence: '还没到放假那天，用杠杆一步步提前', stats }),
    card('type', { eyebrow: `${r.label}的放假类型`, hero: r.type.name, sentence: r.type.why, lines: [r.type.blurb, `判定规则：${r.type.rule}`] }),
    leverCard,
    tall('place', placeCardSpec(r.places)),
    tall('life', lifeCardSpec(r.life)),
    card('learn', {
      eyebrow: '这个数字怎么来的', hero: r.needText, sentence: '放假所需资产',
      lines: [`每年花 ${r.retExpText}，按 ${pct(r.withdrawalRate, 1)} 的提取率估算。`, '放假越早，要撑的年数越长，提取率就要越低。', '全部按今天的购买力计算。'],
    }),
    card('ask', { hero: '你呢？', sentence: ASK, lines: ['公式和数据来源全部公开，欢迎来挑错。'] }),
  ];
}

export function exportBundle(results, dataVersion) {
  return JSON.stringify({ dataVersion, results }, null, 2);
}
