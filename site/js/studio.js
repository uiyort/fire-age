// Content studio logic: turns personas into card decks and a data bundle for writing copy. No DOM access.
import { DEFAULT_SEED, conv, monteCarlo, savingsRate } from './engine.js';
import { decilePaths, needLine, oddsRuler, oddsSolve, oddsYears } from './odds.js';
import { heroModel, holidayType, lifeNames, lifeRibbon, lifeStory, mondaysIn, placeRanking } from './holiday.js';
import { assumptionLine, lifeCardSpec, placeCardSpec, summaryCardSpec, toLifeCardInput, typeCardSpec } from './card.js';
import { defaultState, setField, setRetireCountry, setWorkCountry, toParams } from './state.js';
import { personalLever, rankLevers } from './levers.js';
import { money, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const ASK = '评论区晒出你的放假年龄';

export function personaResult(persona, data) {
  let S = setWorkCountry(defaultState(data), persona.workC, data);
  S = setRetireCountry(S, persona.retC, data);
  S = { ...S, dispCur: data.countries[persona.workC].cur };
  for (const id of ['age', 'assets', 'income', 'expense', 'growth', 'retExp', 'pension']) {
    if (persona[id] !== undefined) S = setField(S, id, String(persona[id]), data);
  }
  const p = toParams(S, data);
  const t = oddsSolve(p);
  const mc = monteCarlo(p, t, null);
  const need = needLine(p)[t ?? 0];
  // The life told is the hardest of the ten parallel lives, as on the page.
  const story = lifeStory(decilePaths(p, t, null)[0], p, need);
  const type = holidayType(p, data, { workC: persona.workC, retC: persona.retC });
  return {
    label: persona.label,
    workplace: data.countries[persona.workC].name,
    retirePlace: data.countries[persona.retC].name,
    inputs: { age: p.age, assets: p.assets, income: p.income, expense: p.expense, retExp: p.retExp, pension: p.pension, wCur: p.wCur, rCur: p.rCur, realReturn: p.r },
    retireAge: t === null ? null : p.age + t,
    years: t,
    fractionalYears: oddsYears(p),
    success: mc.success,
    need,
    needText: money(need, p.wCur),
    retExpText: money(p.retExp, p.rCur),
    times: need > 0 ? Math.round(need / conv(p.retExp, p.rCur, p.wCur, p.fx)) : null,
    savingsRate: savingsRate(p),
    type,
    mondays: t === null ? 0 : mondaysIn(t),
    places: placeRanking(p, data, persona.retC),
    life: { seed: DEFAULT_SEED, ...toLifeCardInput(story, { p, dispCur: p.wCur, mc }) },
    levers: rankLevers(p, data, { retC: persona.retC }).map(l => ({ label: l.label, gainYears: l.gainYears, unlocks: l.unlocks, afterYears: l.afterYears })),
    pass: passInput(p, t, mc, type, persona, data),
  };
}

// The same pass card a visitor makes, for a persona. A persona has no lab, so the card shows the fund saved instead.
function passInput(p, t, mc, type, persona, data) {
  const ten = decilePaths(p, t, null);
  const lives = [0, 2, 5, 8].map(k => ten[k]);
  const names = lifeNames(lives.map(life => lifeStory(life, p)));
  return {
    mode: 'fwd', type,
    hero: heroModel({ mode: 'fwd', p, t, bwd: null, success: mc.success, need: needLine(p)[t ?? 0], ruler: oddsRuler(p) }),
    ribbons: lives.map((life, i) => ({ label: names[i], cells: lifeRibbon(life).map(c => c.state) })),
    issued: data.version,
    years: mc.bands?.map(b => b[2]) ?? [],
    lever: personalLever(rankLevers(p, data, { retC: persona.retC, top: 6 }), p, v => money(Math.round(v), p.wCur)),
    odds: t === null ? '' : '八成把握',
    assumptions: assumptionLine({ r: p.r, pension: p.pension }),
    // Studio images are posted by the author: worked examples, never an invitation to search.
    search: false,
    example: true,
  };
}

// Every studio image is a worked example for a made-up person, and says so.
const card = (kind, fields) => ({ kind, size: [1080, 1440], brand: BRAND, searchHint: '', stats: [], lines: [], ...fields, example: true });
const tall = (kind, spec) => card(kind, { ...spec, kind, size: [1080, 1440], searchHint: '' });
const leverGain = l => (l.unlocks ? '能够放假' : `提前 ${l.gainYears.toFixed(1)} 年`);

export function buildDeck(r) {
  const [top, ...rest] = r.levers;
  const leverCard = top
    ? card('lever', { eyebrow: '提前的办法', hero: leverGain(top), sentence: top.label, lines: rest.map(l => `${l.label}：${leverGain(l)}`) })
    : card('lever', { eyebrow: '提前的办法', hero: '已经很稳', sentence: '单改一项，放假年龄也变化不大', lines: ['这时候更该关心的，是资产能不能撑得更久。'] });

  const deck = [
    card('cover', { eyebrow: `算例 · ${r.label}`, hero: '几岁能放假？', sentence: '用公开数据算一算', lines: [`现在 ${r.inputs.age} 岁，储蓄率 ${r.savingsRate === null ? '0%' : pct(Math.max(r.savingsRate, 0), 0)}`] }),
    // The result is the same pass card a visitor makes.
    summaryCardSpec(r.pass),
    tall('type', typeCardSpec(r.type, { search: false })),
    leverCard,
    tall('place', placeCardSpec(r.places)),
    tall('life', lifeCardSpec(r.life)),
    card('learn', {
      eyebrow: '这个数字怎么来的', hero: r.needText, sentence: '放假线（八成把握）',
      lines: [`每年花 ${r.retExpText}，放假线约是年支出的 ${r.times ?? '—'} 倍。`, '按本工具假设模拟 2,000 次，至少 1,600 次的钱够花到 95 岁。', '全部按今天的购买力计算。'],
    }),
    card('ask', { hero: '你呢？', sentence: ASK, lines: ['公式和数据来源全部公开，欢迎来挑错。'] }),
  ];
  return deck.map((c, i) => ({ ...c, page: i + 1, pages: deck.length }));
}

// The pass card's drawing data is noise for writing copy, so the bundle leaves it out.
export function exportBundle(results, dataVersion) {
  return JSON.stringify({ dataVersion, results: results.map(({ pass, ...rest }) => rest) }, null, 2);
}
