// Page wiring: reads inputs into state, recomputes, renders.
import DATA from './data-latest.js';
import { DEFAULT_SEED, bwdSolve, monteCarlo, walkPath } from './engine.js';
import { bwdOdds, decilePaths, dualOdds, extendRow, needLine, oddsRuler, oddsSolve, oddsYears, successAt } from './odds.js';
import { hardestIndex, heroModel, holidayType, oddsText, lifeName, lifeNames, lifeRibbon, lifeStory, placeRanking } from './holiday.js';
import { commitField, defaultState, loadState, missingFields, saveState, safeStorage, setField, setRetireCountry, setWorkCountry, toParams } from './state.js';
import { labPlan, lifeChoices, personalLever, rankLevers, impactOf, smallStep, tryRange } from './levers.js';
import { SCENARIOS, answerValues, baselineOf, cleanAnswers, countBody } from './scenario.js';
import { PARAMS, PARAM_GROUPS } from './params.js';
import { makeGoal, compareVisit, goalApplies, loadGoal, saveGoal, clearGoal } from './goals.js';
import { initAnalytics, track } from './analytics.js';
import { drawChart, drawLivesChart } from './chart.js';
import { toCsv, toJson } from './export.js';
import { assumptionLine, renderCard, summaryCardSpec, typeCardSpec } from './card.js';
import {
  allTypesHtml, cardBody, fasterLead, fifthOddsHtml, placesTitle, fifthBrief, fifthCompareHtml, fifthSentence, goalFor, goalHtml, headlineText, heatHtml, heroHtml, labChangesHtml, leversHtml, livesHtml, livesSummary, money, pct, pctTableHtml, placesHtml, scenarioHtml, sensitivityHtml, solvesHtml, stickyHtml, storyHtml, wholeMoney, tilesHtml, toDisplay, trackStyle, tryHtml, trySentence, tryValueText, typeHtml, variantsHtml, viewsBannerHtml,
} from './views.js';

const $ = id => document.getElementById(id);
const storage = safeStorage();
const paramById = Object.fromEntries(PARAMS.map(c => [c.id, c]));
const today = () => new Date().toISOString().slice(0, 10);
const MC_DELAY_MS = 150;

const returning = (() => {
  try {
    return storage?.getItem('fire-age-v1') != null;
  } catch {
    return false;
  }
})();
const STARTED_KEY = 'fire-age-started-v1';
const started = (() => {
  try {
    return storage?.getItem(STARTED_KEY) === '1';
  } catch {
    return false;
  }
})();
let S = loadState(DATA, storage);
let goal = loadGoal(storage);
let latest = null;
let mcTimer = 0;
let proTimer = 0;
// True from a change of the numbers until the simulation for them has run.
let stale = true;
let frame = 0;
// Which life in each tenth of all lives is told. 0 is the first life of each tenth.
let lifeShift = 0;
let lifeIndex = 0;
let labValues = {};
// Slider values that write the last life. Working backward, the saving plan is fixed, so saving sliders are left out.
const writtenSliders = () => Object.fromEntries(Object.entries(labValues).filter(([id]) => lifeChoices(S.mode).includes(id)));
const VIEWS_KEY = 'fire-age-views-v1';
let scnIndex = 0;
let scnAnswers = loadAnswers();
const CROWD_SENT_KEY = 'fire-age-crowd-sent-v1';
let crowd = { status: 'idle', sent: crowdSent() };

function crowdSent() {
  try {
    return storage.getItem(CROWD_SENT_KEY) === '1';
  } catch {
    return false;
  }
}

// Counts the answers once per browser, only on request, then shows what everyone answered.
let crowdBusy = false;
async function joinCrowd() {
  if (crowdBusy) return;
  crowdBusy = true;
  crowd = { ...crowd, status: 'loading' };
  renderScenario();
  try {
    const body = countBody(scnAnswers);
    if (!crowd.sent && body) {
      const sent = await fetch('/api/views', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!sent.ok) throw new Error(String(sent.status));
      try { storage.setItem(CROWD_SENT_KEY, '1'); } catch { /* counted once per visit at worst */ }
      crowd = { ...crowd, sent: true };
    }
    const got = await fetch('/api/views');
    if (!got.ok) throw new Error(String(got.status));
    const { total, counts } = await got.json();
    crowd = { ...crowd, status: 'shown', total, counts };
  } catch {
    crowd = { ...crowd, status: 'error' };
  }
  crowdBusy = false;
  renderScenario();
}
const PLAYED_KEY = 'fire-age-played-v1';
const played = new Set(loadPlayed());

function loadAnswers() {
  try {
    return cleanAnswers(JSON.parse(storage.getItem(VIEWS_KEY)));
  } catch {
    return {};
  }
}

function saveAnswers() {
  try {
    storage.setItem(VIEWS_KEY, JSON.stringify(scnAnswers));
  } catch {
    // Answers are a convenience; the page works without them.
  }
}

function loadPlayed() {
  try {
    const saved = JSON.parse(storage.getItem(PLAYED_KEY));
    return Array.isArray(saved) ? saved.filter(id => paramById[id]) : [];
  } catch {
    return [];
  }
}

// The simple view lights only what it offers: the questions about the years ahead and the sliders that write the last life.
function litCount() {
  const offered = new Set([...SCENARIOS.map(s => s.param), ...lifeChoices(S.mode)]);
  return { done: [...played].filter(id => offered.has(id)).length, total: offered.size };
}

function renderPlayed() {
  const { done: lit, total } = litCount();
  const done = lit === total;
  $('lab-progress').textContent = done ? `${lit}/${total}，全部点亮。这些参数你都亲手试过了。` : `已点亮 ${lit}/${total} 个参数`;
  for (const details of $('cards').querySelectorAll('details')) details.classList.toggle('played', played.has(details.dataset.id));
}

function markPlayed(id) {
  if (played.has(id)) return;
  played.add(id);
  try {
    storage.setItem(PLAYED_KEY, JSON.stringify([...played]));
  } catch {
    // Progress is a convenience; the lab works without it.
  }
  renderPlayed();
}

const SIMPLE_FIELDS = [
  { legend: '现在', note: '示例，改成你的', fields: [
    { id: 'age', label: '年龄', unit: '岁' },
    { id: 'assets', label: '已有存款和投资', unit: 'work', step: 10000 },
    { id: 'income', label: '每月到手收入', unit: 'work', monthly: true, step: 1000 },
    { id: 'expense', label: '每月支出', unit: 'work', monthly: true, step: 500 },
  ] },
  { legend: '在哪里', fields: [
    { id: 'work', label: '现在生活的地方', select: 'work' },
    { id: 'ret', label: '想在哪里退休', select: 'retire' },
  ] },
  { legend: '养老金（可以不填）', fields: [
    { id: 'pension', label: '预计每月养老金', unit: 'retire', monthly: true, step: 500, full: true },
    { id: 'tAge', elementId: 's-tage', label: '想几岁放假', unit: '岁', bwdOnly: true, full: true },
  ] },
];

const PRO_FIELDS = [
  { legend: '地区与币种', fields: [
    { id: 'work', label: '工作/储蓄地', select: 'work' },
    { id: 'ret', label: '退休地', select: 'retire' },
    { id: 'disp', label: '显示币种', select: 'currency', full: true },
  ] },
  { legend: '现在', fields: [
    { id: 'age', label: '年龄', unit: '岁' },
    { id: 'assets', label: '可投资资产', unit: 'work', step: 10000 },
    { id: 'income', label: '税后年收入', unit: 'work', step: 10000 },
    { id: 'expense', label: '当前年支出', unit: 'work', step: 5000 },
    { id: 'growth', label: '收入实际增长', unit: '%', step: 0.5, full: true },
  ] },
  { legend: '退休后', fields: [
    { id: 'retExp', label: '年支出', unit: 'retire', step: 5000 },
    { id: 'life', label: '规划到', unit: '岁' },
    { id: 'pension', label: '养老金/年', unit: 'retire', step: 1000 },
    { id: 'pAge', label: '领取年龄', unit: '岁' },
    { id: 'tAge', label: '目标放假年龄', unit: '岁', bwdOnly: true, full: true },
  ] },
  { legend: '收益假设', fields: [
    { id: 'eq', label: '股票占比', unit: '%', step: 5 },
    { id: 'eqReal', label: '股票实际收益', unit: '%', step: 0.1 },
    { id: 'bondY', label: '10 年国债', unit: '%', step: 0.05 },
    { id: 'infl', label: '长期通胀', unit: '%', step: 0.1 },
    { id: 'drag', label: '税费拖累', unit: '%', step: 0.05 },
    { id: 'fxDrift', label: '退休币升值', unit: '%', step: 0.1 },
    { id: 'swr', label: '安全提取率', unit: '%', step: 0.1 },
  ] },
  { legend: '风险假设', fields: [
    { id: 'sigEq', label: '股票波动率', unit: '小数', step: 0.01 },
    { id: 'sigBd', label: '债券波动率', unit: '小数', step: 0.01 },
    { id: 'rho', label: '股债相关性', unit: '−1 到 1', step: 0.05 },
    { id: 'flexCut', label: '大跌后少花', unit: '%', step: 5 },
  ] },
];

function fieldHtml(prefix, f) {
  const id = f.elementId ?? `${prefix}-${f.id}`;
  const cls = `f${f.full ? ' full' : ''}`;
  const hasCard = prefix === 's' && paramById[f.id];
  const help = hasCard ? `<button type="button" class="help" id="help-${f.id}" aria-expanded="false" aria-controls="card-${f.id}" aria-label="${f.label}是什么">?</button>` : '';
  const unit = f.unit ? `<span class="u" data-unit="${f.unit}">${f.unit}</span>` : '';
  const control = f.select
    ? `<select id="${id}"></select>`
    : `<input type="number" inputmode="decimal" id="${id}" step="${f.step ?? 1}">`;
  const wrap = `<div class="${cls}"${f.bwdOnly ? ' data-bwd-only' : ''}><div class="lab"><label for="${id}">${f.label} ${unit}</label>${help}</div>${control}</div>`;
  const split = id === 's-expense' ? SPLIT_HTML : '';
  return (hasCard ? `${wrap}<div class="lcard" id="card-${f.id}" hidden></div>` : wrap) + split;
}

// Monthly spending is hard to guess as one number, so it can be added up from three parts.
const SPLIT_PARTS = [['rent', '房租或房贷'], ['food', '吃饭'], ['other', '其他']];
const SPLIT_NOTE = '三项加起来，自动填进每月支出。';
const SPLIT_HTML = `<details class="split" id="expense-split"><summary>每月花多少说不准？拆开来加</summary><div class="split-row">${
  SPLIT_PARTS.map(([key, name]) => `<label>${name}<input type="number" inputmode="decimal" id="split-${key}" step="100" min="0"></label>`).join('')
}</div><p class="fine" id="split-note">${SPLIT_NOTE}</p></details>`;

// Typing straight into monthly spending makes the parts stale, so they are cleared rather than left disagreeing.
function clearSplit() {
  const parts = SPLIT_PARTS.map(([key]) => $(`split-${key}`));
  if (parts.every(el => el.value === '')) return;
  parts.forEach(el => { el.value = ''; });
  $('split-note').textContent = SPLIT_NOTE;
}

function buildForm(el, prefix, groups) {
  el.innerHTML = groups.map(g => `<fieldset><legend>${g.legend}${g.note ? ` <span class="legend-note">${g.note}</span>` : ''}</legend>${g.fields.map(f => fieldHtml(prefix, f)).join('')}</fieldset>`).join('');
}

function fillCountrySelects() {
  const options = role => Object.entries(DATA.countries).filter(([, c]) => c.roles.includes(role))
    .map(([k, c]) => `<option value="${k}">${c.name} · ${c.cur}</option>`).join('');
  for (const id of ['s-work', 'p-work']) $(id).innerHTML = options('work');
  for (const id of ['s-ret', 'p-ret']) $(id).innerHTML = options('retire');
  const curs = ['USD', ...Object.keys(DATA.fx)];
  $('p-disp').innerHTML = curs.map(c => `<option value="${c}">${c}</option>`).join('');
}

const dispCur = p => (S.view === 'simple' ? p.wCur : S.dispCur);

// Writes state into inputs, skipping whatever the person is typing in right now.
function syncInputs() {
  const set = (id, value) => {
    const el = $(id);
    if (!el || el === document.activeElement) return;
    el.value = value === null || value === undefined ? '' : value;
  };
  for (const g of SIMPLE_FIELDS) for (const f of g.fields) {
    if (f.select) continue;
    const v = S[f.id];
    set(f.elementId ?? `s-${f.id}`, v === null ? '' : f.monthly ? Math.round(v / 12) : v);
  }
  for (const g of PRO_FIELDS) for (const f of g.fields) {
    if (!f.select) set(`p-${f.id}`, S[f.id]);
  }
  set('s-work', S.workC); set('p-work', S.workC);
  set('s-ret', S.retC); set('p-ret', S.retC);
  set('p-disp', S.dispCur);
  if ($('s-retexp')) set('s-retexp', S.retExp === null ? '' : Math.round(S.retExp / 12));
  $('p-swr').disabled = S.autoSwr;
}

function syncChrome(p) {
  document.querySelectorAll('[data-unit="work"]').forEach(e => { e.textContent = p.wCur; });
  document.querySelectorAll('[data-unit="retire"]').forEach(e => { e.textContent = p.rCur; });
  document.querySelectorAll('[data-bwd-only]').forEach(e => { e.hidden = S.mode !== 'bwd'; });
  document.querySelectorAll('.pro-only').forEach(e => { e.hidden = S.view !== 'pro'; });
  document.querySelectorAll('.simple-only').forEach(e => { e.hidden = S.view !== 'simple'; });
  $('simple-form').hidden = S.view !== 'simple';
  $('pro-form').hidden = S.view !== 'pro';
  $('solve-card').hidden = S.mode !== 'bwd';
  // The note names the other view, so it stays in place when the view changes.
  $('mode-note').textContent = S.view === 'simple' ? '专业版：改收益、通胀等全部假设' : '简单版：只填几个数';
  // The "example" label holds only while the numbers are still the examples.
  const start = defaultState(DATA);
  const example = ['age', 'assets', 'income', 'expense'].every(k => S[k] === start[k]);
  document.querySelectorAll('.legend-note').forEach(e => { e.hidden = !example; });
  for (const [id, on] of [['to-fwd', S.mode === 'fwd'], ['to-bwd', S.mode === 'bwd'], ['to-simple', S.view === 'simple'], ['to-pro', S.view === 'pro']]) {
    $(id).setAttribute('aria-pressed', String(on));
  }
}

function renderEstimate(p) {
  if (S.view !== 'simple') {
    $('estimate').innerHTML = `<div class="derived">
      <div><span>组合实际年化收益</span><b>${pct(p.r, 2)}</b></div>
      <div><span>组合年化波动</span><b>${pct(p.sigma, 1)}</b></div>
      <div><span>债券实际收益</span><b>${pct(p.bondReal, 2)}</b></div>
    </div><label class="chk"><input type="checkbox" id="p-autoswr"${S.autoSwr ? ' checked' : ''}> 提取率按退休年限自动调整</label>${S.notice ? `<p class="notice">${S.notice}</p>` : ''}`;
    return;
  }
  const typing = document.activeElement?.id === 's-retexp';
  if (!typing) {
    $('estimate').innerHTML = `<div class="f"><div class="lab"><label for="s-retexp">退休后每月想花 <span class="u">${p.rCur}</span></label></div>
      <input type="number" inputmode="decimal" id="s-retexp" step="500" value="${S.retExp === null ? '' : Math.round(S.retExp / 12)}"></div>
      <p class="fine">估算值，请按你计划的实际生活改写。</p>
      <p class="fine mix-note">组合按股票 ${p.eq}% / 债券 ${100 - p.eq}% 估算（常见的基准组合，不是建议），扣掉通胀后约 ${pct(p.r, 1)}/年。<a href="sources.html">数据来源</a>，专业模式可以改。</p>${S.notice ? `<p class="notice">${S.notice}</p>` : ''}`;
  }
}

function renderFast() {
  const p = toParams(S, DATA);
  const cur = dispCur(p);
  const t = oddsSolve(p);
  const bwd = bwdSolve(p);
  const odds = S.mode === 'bwd' ? bwdOdds(p) : null;
  const dual = dualOdds(p);
  const levers = rankLevers(p, DATA, { retC: S.retC });
  const small = smallStep(p);
  const retireT = S.mode === 'bwd' ? bwd.n : t;
  // Working backward, every life walks the plan as it is: the saving that gives 8 in 10 is told, not assumed.
  const s0 = null;
  const target = needLine(p);
  const type = holidayType(p, DATA, { workC: S.workC, retC: S.retC, ...(S.mode === 'bwd' ? { retireT: bwd.n } : {}) });
  // The odds of the plan as it is, right away: the full simulation for the chart follows a moment later.
  const success = retireT === null ? null : successAt(p, retireT, s0);
  latest = { ...(latest ?? {}), view: S.view, mode: S.mode, p, t, retireT, s0, years: oddsYears(p), dual, bwd, odds, levers, small, target, type, success, ruler: S.mode === 'bwd' ? null : oddsRuler(p), dataVersion: DATA.version, dispCur: cur };

  syncChrome(p);
  syncInputs();
  renderEstimate(p);
  const eightAge = t === null ? null : p.age + t;
  const { say, note } = headlineText({ mode: S.mode, p, t, odds, eightAge, dual, dispCur: cur, view: S.view });
  $('headline').innerHTML = `<p class="say">${say}</p><p class="say-note">${note}</p>`;
  $('tiles').innerHTML = tilesHtml({ mode: S.mode, p, t, bwd, mc: latest.mc, dispCur: cur, target });
  renderHero();
  if (S.mode === 'bwd') $('solves').innerHTML = solvesHtml({ p, bwd, odds, dispCur: cur });
  $('type-now').innerHTML = typeHtml(type);
  document.querySelectorAll('.type-cell').forEach(cell => cell.classList.toggle('mine', cell.dataset.code === type.code));
  $('levers').innerHTML = leversHtml(levers, p, { pro: S.view === 'pro', small, dispCur: cur });
  $('lead-faster').textContent = fasterLead(levers);
  renderGoal(p);
  saveState(S, storage);
}

// The parts that solve the plan many times over: other places, the lab cards and the professional tables.
// Every solve runs 2,000 lives, so they wait until typing pauses, with the full simulation.
function slowParts() {
  const { p, dispCur: cur } = latest;
  const pro = S.view === 'pro';
  return [
    () => {
      latest.places = placeRanking(p, DATA, S.retC);
      $('places').innerHTML = placesHtml(latest.places, { all: pro, home: S.workC });
      $('places-title').textContent = placesTitle(latest.places);
    },
    () => renderCards(p),
    ...(pro ? [
      () => { $('variants').innerHTML = variantsHtml({ p, dispCur: cur }); },
      () => { $('heat-box').innerHTML = heatHtml({ p, dispCur: cur }); },
      () => { $('sensitivity').innerHTML = sensitivityHtml(p, PARAMS); },
    ] : []),
  ];
}

function renderHero() {
  const { mode, p, t, bwd, retireT, target, ruler, dispCur: cur } = latest;
  const success = latest.success;
  latest.hero = heroModel({ mode, p, t, bwd, success, need: target[retireT ?? 0], ruler: mode === 'bwd' ? null : ruler });
  $('hero').innerHTML = heroHtml(latest.hero, { p, dispCur: cur });
  $('sticky-result').innerHTML = stickyHtml(latest.hero, { p, dispCur: cur, success, pro: S.view === 'pro' });
  const riskLead = S.view === 'pro'
    ? (success === null ? '按计划没有放假年份，不计算成功率。' : `2,000 次模拟，成功率 ${pct(success, 0)}，按本工具假设。`)
    : (latest.hero.people === null ? '先到得了，再看撑不撑得住。' : `10 个平行的你，${latest.hero.people} 个的钱够花到 ${p.life} 岁。`);
  $('lead-risk').textContent = riskLead;
}

// After typing pauses, the simulation and the slow parts run one task at a time, so the page keeps answering
// input between them; a new change cancels the rest. A flush runs every part at once.
function renderSimulation({ chunked = false } = {}) {
  clearTimeout(proTimer);
  const parts = [renderSimulationCore, renderLives, ...slowParts()];
  if (!chunked) {
    parts.forEach(part => part());
    stale = false;
    return;
  }
  // Results count as current only once the last part has run, so a flush in between finishes the job.
  const next = () => {
    const part = parts.shift();
    if (!part) {
      stale = false;
      return;
    }
    part();
    proTimer = setTimeout(next, 0);
  };
  next();
}

function renderSimulationCore() {
  const { p, retireT, mode, bwd, s0, dispCur: cur, target } = latest;
  const mc = monteCarlo(p, retireT, s0);
  latest.mc = mc;
  $('tiles').innerHTML = tilesHtml({ mode, p, t: latest.t, bwd, mc, dispCur: cur, target });
  renderHero();
  const scale = v => toDisplay(v, p, cur);
  drawChart($('chart'), $('tip'), {
    age: p.age,
    bands: mc.bands.map(b => b.map(scale)),
    target: target.map(scale),
    retireT,
    year0: new Date().getFullYear(),
    money: v => money(v, cur),
  });
  $('chart-sub').textContent = retireT === null
    ? '按现在的计划继续积累，规划期内还不放假。'
    : mode === 'bwd'
      ? `按现在的计划存到 ${p.tAge} 岁，之后每年取出退休支出（扣除养老金）。`
      : `按现在的计划存到 ${p.age + retireT} 岁，之后每年取出退休支出（扣除养老金）。`;
  $('mc-note').textContent = `蒙特卡洛模拟 ${mc.paths.toLocaleString('zh-CN')} 次，随机种子 ${mc.seed}，结果可复现。金额都按今天的购买力计算。`;
  $('pct-table').innerHTML = pctTableHtml({ p, mc, target, dispCur: cur });
}

const baseline = () => baselineOf(DATA, S.workC);

function labLabels() {
  const fromViews = SCENARIOS.filter(s => scnAnswers[s.id] !== undefined).map(s => paramById[s.param].name);
  const fromSliders = Object.keys(writtenSliders()).map(id => paramById[id].name);
  return [...new Set([...fromViews, ...fromSliders])];
}

// The life waiting to be written: the hardest of the four years of luck, walked with the person's own view of the future.
// Working backward, it keeps the holiday age and the saving plan that were asked for.
function fifthLife(p, lives, stories, { mode, retireT, s0 }) {
  const values = { ...answerValues(scnAnswers, baseline()), ...writtenSliders() };
  if (!Object.keys(values).length) return null;
  const base = hardestIndex(stories);
  const q = labPlan(p, { values, minLife: mode === 'bwd' ? p.age + retireT + 1 : 0 });
  const z = extendRow(lives[base].z, q.life - q.age, lives[base].index);
  const qT = mode === 'bwd' ? retireT : oddsSolve(q);
  const path = walkPath(q, qT, s0, z);
  const qSuccess = qT === null ? null : successAt(q, qT, s0);
  return { path, story: lifeStory(path, q, qT === null ? null : needLine(q)[qT]), base: stories[base], baseIndex: base, plan: q, success: qSuccess, worstYear: worstYear(q) };
}

// The worst single year among all simulated lives' first holiday decade is too much to explain;
// the price of a mix is told as the 5% worst year a portfolio like it has, from its volatility.
function worstYear(q) {
  return Math.exp(Math.log(1 + q.r) - 1.645 * q.sigma) - 1;
}

// Four of the ten parallel lives are told: the hardest, a hard one, the middle one and an easy one.
const TOLD = [0, 2, 5, 8];

// The drawn lives follow the current plan, so changing an input redraws them with the same seeds.
function renderLives() {
  const { p, retireT, mode, s0, mc, target, dispCur: cur } = latest;
  const ten = decilePaths(p, retireT, s0, lifeShift);
  const lives = TOLD.map(k => ten[k]);
  const stories = lives.map(life => lifeStory(life, p, retireT === null ? null : target[retireT]));
  const fifth = fifthLife(p, lives, stories, { mode, retireT, s0 });
  const names = lifeNames(stories);
  const hardest = hardestIndex(stories);
  if (!fifth && lifeIndex === lives.length) lifeIndex = 0;
  latest.lives = lives;
  latest.stories = stories;
  latest.fifth = fifth;
  latest.names = names;
  const selectedFifth = fifth && lifeIndex === lives.length;
  $('lives').innerHTML = livesHtml(lives, stories, lifeIndex, { p, dispCur: cur, fifth, names, hardest });
  $('life-changes').innerHTML = labChangesHtml(labLabels());
  $('life-summary').textContent = livesSummary(stories, mc, p.life);
  const story = selectedFifth ? fifth.story : stories[lifeIndex];
  const compare = fifth ? fifthCompareHtml(fifth.base, fifth.story, names[fifth.baseIndex], latestMoney())
    + fifthOddsHtml({ mode, age: fifth.path.retireT === null ? null : fifth.plan.age + fifth.path.retireT, success: fifth.success, worstYear: fifth.worstYear, baseAge: retireT === null ? null : p.age + retireT, baseSuccess: latest.success }) : '';
  $('life-story').innerHTML = `${selectedFifth ? compare : ''}${storyHtml(story, { p: selectedFifth ? fifth.plan : p, dispCur: cur })}`;
  $('life-seed').textContent = `2,000 次模拟按结果从难到顺排好，分成十份，从第 1、3、6、9 份里各取一条（第 ${lives.map(l => l.index + 1).join('、')} 次模拟，随机种子 ${DEFAULT_SEED}）。同样的输入可以复现。收益是模型抽样，不是历史重演。`;
  const scale = v => toDisplay(v, p, cur);
  // Only the chosen life is drawn, with the life it rewrites when the written life is chosen. Grey lines for the
  // other lives read as a fan of outcomes, which the simple view does not explain.
  const series = lives.map((life, i) => {
    const kind = selectedFifth ? (i === fifth.baseIndex ? 'compare' : 'other') : (i === lifeIndex ? 'selected' : 'other');
    return { label: names[i], kind, retireT: life.retireT, cells: lifeRibbon(life), values: life.years.map(y => scale(y.assets)) };
  }).filter(life => life.kind !== 'other');
  if (selectedFifth) series.push({ label: '等你来写', kind: 'selected', retireT: fifth.path.retireT, cells: lifeRibbon(fifth.path), values: fifth.path.years.map(y => scale(y.assets)) });
  $('lives-chart-legend').innerHTML = [
    '<span><i class="sw r-work"></i>上班</span>',
    '<span><i class="sw r-holiday"></i>放假有钱花</span>',
    '<span><i class="sw r-broke"></i>钱花完</span>',
    '<span><i class="sw r-bad"></i>当年大跌 15% 以上</span>',
    ...(selectedFifth ? [`<span><i class="sw line-compare"></i>原计划：${names[fifth.baseIndex]}</span>`] : []),
  ].join('');
  drawLivesChart($('lives-chart'), $('lives-tip'), { age: p.age, lives: series, money: v => money(v, cur) });
  renderScenario();
}

// Amounts in the display currency, for sentences about the written life.
const latestMoney = () => v => money(toDisplay(v, latest.p, latest.dispCur), latest.dispCur);

function renderScenario() {
  const fifth = latest.fifth;
  const effect = fifth ? fifthSentence(fifth.base, fifth.story, latestMoney()) : '';
  $('scenario').innerHTML = scenarioHtml({ index: scnIndex, answers: scnAnswers, base: baseline(), effect, params: paramById, crowd });
  renderViewsBanner();
}

// Everything the simple view collected, as plan values.
const collected = () => ({ ...answerValues(scnAnswers, baseline()), ...writtenSliders() });

function viewsApplied() {
  return Object.entries(collected()).every(([id, value]) => S[id] === value);
}

function renderViewsBanner() {
  const p = toParams(S, DATA);
  const sliders = Object.entries(writtenSliders()).map(([id, value]) => ({ id, name: paramById[id].name, text: tryValueText(value, tryRange(p, id).unit, p) }));
  $('views-banner').innerHTML = viewsBannerHtml(scnAnswers, baseline(), paramById, viewsApplied(), sliders);
}

function renderGoal(p) {
  const box = $('goal');
  if (goal && !goalApplies(goal, p)) {
    goal = null;
    clearGoal(storage);
  }
  if (!goal || !storage) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('goal-body').innerHTML = goalHtml(goal, compareVisit(goal, p, today()));
}

const fullCard = (param, p) => cardBody(param, impactOf(p, param.id), tryHtml(param.id, tryRange(p, param.id), labValues[param.id], { mode: S.mode, p }));

function renderCards(p) {
  for (const param of PARAMS) {
    const inline = $(`card-${param.id}`);
    if (inline && !inline.hidden) inline.innerHTML = fullCard(param, p);
  }
  // The simple list keeps only what writes the last life; every parameter stays in the professional view.
  const box = $('cards');
  if (box.dataset.mode !== S.mode) {
    const offered = lifeChoices(S.mode);
    box.innerHTML = PARAM_GROUPS.map(group => ({ ...group, ids: group.ids.filter(id => offered.includes(id)) })).filter(group => group.ids.length)
      .map(group => `<h4>${group.name}</h4>${group.ids.map(id => `<details data-id="${id}"><summary>${paramById[id].name}</summary><div class="lcard"></div></details>`).join('')}`).join('');
    box.dataset.mode = S.mode;
    renderPlayed();
  }
  // Update in place so an open card stays open, keeps focus, and is not counted again.
  for (const details of box.querySelectorAll('details')) {
    const param = paramById[details.dataset.id];
    details.querySelector('.lcard').innerHTML = fullCard(param, p);
  }
}

let calcCounted = false;
function countCalculation() {
  if (calcCounted) return;
  calcCounted = true;
  track('calc_done');
}

// The blank numbers the result rests on, with their input and their name in the view on screen.
function blankFields() {
  const simple = S.view === 'simple';
  const fields = (simple ? SIMPLE_FIELDS : PRO_FIELDS).flatMap(g => g.fields);
  return missingFields(S).map(id => {
    if (simple && id === 'retExp') return { id, el: $('s-retexp'), label: '退休后每月想花' };
    const f = fields.find(x => x.id === id);
    return { id, el: $(f.elementId ?? `${simple ? 's' : 'p'}-${id}`), label: f.label };
  });
}

// Marks the blanks and says what is missing. A field just cleared to type a new number is marked only once the
// person leaves it; one already marked stays marked until it is filled in.
function showBlanks(blanks, { all = false } = {}) {
  const blankEls = blanks.map(b => b.el);
  document.querySelectorAll('[aria-invalid="true"]').forEach(el => {
    if (blankEls.includes(el)) return;
    el.removeAttribute('aria-invalid');
    el.closest('.f')?.classList.remove('missing');
  });
  for (const b of blanks) {
    if (!b.el || (!all && b.el === document.activeElement)) continue;
    b.el.setAttribute('aria-invalid', 'true');
    b.el.closest('.f')?.classList.add('missing');
  }
  document.body.classList.toggle('inputs-missing', blanks.length > 0);
  $('missing-note').hidden = !blanks.length;
  $('missing-note').textContent = blanks.length ? `请填写${blanks.map(b => b.label).join('、')}，填好后结果再更新。` : '';
}

// Before anything goes on from the numbers: stops at the first blank, opens the numbers and puts the cursor there.
function stopAtBlank() {
  const blanks = blankFields();
  if (!blanks.length) return false;
  $('inputs-box').open = true;
  showBlanks(blanks, { all: true });
  blanks[0].el?.focus();
  blanks[0].el?.scrollIntoView({ block: 'center' });
  return true;
}

function refresh() {
  // Saved at once, so a reload straight after typing keeps what was typed.
  saveState(S, storage);
  // A blank would count as zero or as an old value, so the last result stays, dimmed, until it is filled in.
  if (missingFields(S).length) {
    cancelAnimationFrame(frame);
    clearTimeout(mcTimer);
    clearTimeout(proTimer);
    syncChrome(toParams(S, DATA));
    showBlanks(blankFields());
    return;
  }
  showBlanks([]);
  stale = true;
  updateCard();
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    renderFast();
    clearTimeout(mcTimer);
    clearTimeout(proTimer);
    mcTimer = setTimeout(() => renderSimulation({ chunked: true }), MC_DELAY_MS);
  });
}

function fieldFromElement(id) {
  for (const prefix of ['s', 'p']) {
    const groups = prefix === 's' ? SIMPLE_FIELDS : PRO_FIELDS;
    for (const g of groups) for (const f of g.fields) {
      if ((f.elementId ?? `${prefix}-${f.id}`) === id) return f;
    }
  }
  return null;
}

let splitting = false;
const sumText = sum => {
  const cur = toParams(S, DATA).wCur;
  return cur === 'CNY' ? `¥${wholeMoney(sum, cur)}` : wholeMoney(sum, cur);
};
function onInput(ev) {
  const el = ev.target;
  if (el.closest?.('#expense-split')) {
    const parts = SPLIT_PARTS.map(([key]) => $(`split-${key}`).value);
    if (parts.every(v => v === '')) return;
    const expense = $('s-expense');
    const sum = parts.reduce((total, v) => total + (Number(v) || 0), 0);
    expense.value = String(sum);
    $('split-note').innerHTML = `合计 <span class="split-sum">${sumText(sum)}</span>，已填进每月支出。`;
    splitting = true;
    try { expense.dispatchEvent(new Event('input', { bubbles: true })); } finally { splitting = false; }
    return;
  }
  if (el.id === 's-expense' && !splitting) clearSplit();
  if (el.dataset.try) {
    const id = el.dataset.try;
    const p = toParams(S, DATA);
    const range = tryRange(p, id);
    el.closest('.try').querySelector('output').textContent = trySentence(p, id, Number(el.value), range);
    const track = el.closest('.try-track');
    track?.setAttribute('style', trackStyle(range, el.value));
    track?.classList.toggle('moved', Number(el.value) !== Number(range.value));
    markPlayed(id);
    if (lifeChoices(S.mode).includes(id)) {
      labValues = { ...labValues, [id]: Number(el.value) };
      updateCard();
      renderLives();
      focusFifth();
    }
    return;
  }
  labValues = {};
  if (el.id === 's-retexp') {
    S = setField(S, 'retExp', el.value === '' ? '' : Number(el.value) * 12, DATA, { commit: false });
    countCalculation();
    refresh();
    return;
  }
  if (el.id === 'p-autoswr') {
    S = { ...S, autoSwr: el.checked };
    refresh();
    return;
  }
  if (el.tagName === 'SELECT') return;
  const f = fieldFromElement(el.id);
  if (!f) return;
  const value = f.monthly && el.value !== '' ? Number(el.value) * 12 : el.value;
  S = setField(S, f.id, value, DATA, { commit: false });
  countCalculation();
  refresh();
}

// The first change opens the fifth life, so the person sees what they wrote.
function focusFifth() {
  if (latest.fifth && lifeIndex !== latest.lives.length) {
    lifeIndex = latest.lives.length;
    renderLives();
  }
}

function onSelect(ev) {
  const { id, value } = ev.target;
  labValues = {};
  countCalculation();
  if (id === 's-work' || id === 'p-work') {
    const wasWorkCur = S.dispCur === DATA.countries[S.workC].cur;
    S = setWorkCountry(S, value, DATA);
    if (wasWorkCur) S = { ...S, dispCur: DATA.countries[S.workC].cur };
    refresh();
  } else if (id === 's-ret' || id === 'p-ret') {
    S = setRetireCountry(S, value, DATA);
    refresh();
  } else if (id === 'p-disp') {
    S = { ...S, dispCur: value };
    refresh();
  }
}

// Once made, the card stays open and is redrawn shortly after the numbers change.
let cardTimer;
let cardPng = '';
let cardCanvas = null;
function updateCard() {
  if ($('share-panel').hidden) return;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => {
    if (flushSimulation()) showCard(cardSpec(), { scroll: false });
  }, 400);
}

// Phones hand the picture to the system sheet, which can save it to the photos. WeChat's browser cannot, so it
// points at the long press. Computers download the file.
async function saveCard() {
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (/MicroMessenger/i.test(navigator.userAgent)) {
    const hint = $('share-hint');
    hint.textContent = '微信里请长按上面的图片，选择保存。';
    hint.classList.add('emph');
    $('share-img').scrollIntoView({ block: 'center' });
    return;
  }
  if (touch) {
    try {
      // The page may not fetch data: URLs (connect-src 'self'), so the picture comes straight from the canvas.
      const blob = await new Promise(resolve => cardCanvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'fire-age.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  const link = document.createElement('a');
  link.href = cardPng;
  link.download = 'fire-age.png';
  document.body.append(link);
  link.click();
  link.remove();
}

function summaryInput() {
  const { mode, p, bwd, type, hero, places, lives, stories, fifth, dispCur: cur } = latest;
  const best = places[0], here = places.find(r => r.current);
  const gain = best.years !== null && here?.years != null ? here.years - best.years : 0;
  const achieved = goal && goalApplies(goal, p) && compareVisit(goal, p, today()).achieved;
  const ribbons = lives.map((life, i) => ({ label: (latest.names ?? lifeNames(stories))[i], base: fifth?.baseIndex === i, cells: lifeRibbon(life).map(c => c.state) }));
  if (fifth) ribbons.push({ label: '改签后', fifth: true, cells: lifeRibbon(fifth.path).map(c => c.state) });
  return {
    mode, type, hero, ribbons,
    issued: latest.dataVersion,
    years: latest.mc?.bands?.map(b => b[2]) ?? [],
    enough: latest.odds?.enough ?? bwd.s0 <= 0,
    monthlyText: wholeMoney(toDisplay((latest.odds?.s0 ?? Math.max(bwd.s0, 0)) / 12, p, cur), cur),
    place: gain >= 0.05 ? { name: best.name, gain } : null,
    fifth: fifth && fifthBrief(fifth.base, fifth.story, latestMoney()) ? { ...fifthBrief(fifth.base, fifth.story, latestMoney()), baseName: (latest.names ?? lifeNames(stories))[fifth.baseIndex] } : null,
    // A spending goal is an amount, so a card without money says it was met without the number.
    goal: achieved ? { label: goal.label, plain: goal.paramId === 'expense' ? '年支出降到了目标' : goal.label } : null,
    lever: personalLever(rankLevers(p, DATA, { retC: S.retC, top: 6 }), p, v => money(Math.round(toDisplay(v, p, cur)), cur)),
    // Forward, the age is the 8-in-10 age; working backward, the card says the odds of the plan as it is.
    odds: !hero.reachable ? '' : mode === 'bwd' ? oddsText(hero.success) : '八成把握',
    assumptions: assumptionLine({ r: p.r, pension: p.pension }),
    privacy: { money: $('card-money').checked, now: $('card-now').checked },
  };
}

// The card the person asked for: the full pass, or the type alone with no number on it.
function cardSpec() {
  const kind = document.querySelector('input[name="card-kind"]:checked')?.value ?? 'pass';
  return kind === 'type' ? typeCardSpec(latest.type) : summaryCardSpec(summaryInput());
}

function showCard(spec, { scroll = true } = {}) {
  const canvas = document.createElement('canvas');
  renderCard(spec, canvas);
  cardCanvas = canvas;
  cardPng = canvas.toDataURL('image/png');
  $('share-img').src = cardPng;
  $('share-img').alt = [spec.eyebrow, spec.hero, spec.odds, spec.sentence].filter(Boolean).join('，');
  // What the card says, readable by tests and by assistive tools; it holds nothing the image does not show.
  $('share-img').dataset.card = JSON.stringify({ kind: spec.kind, now: spec.now ?? '', fund: spec.fund ?? null, note: spec.note?.main ?? '', route: spec.ticket?.route ?? '', search: spec.searchHint ?? '' });
  $('share-panel').hidden = false;
  if (scroll) $('share-panel').scrollIntoView({ block: 'nearest' });
}

// A pending simulation would put a stale success rate on the card, so finish it first. With a number left blank
// nothing is recounted: the last result stays, dimmed, and false says so. Results already up to date are reused.
function flushSimulation() {
  if (missingFields(S).length) return false;
  if (!stale) return true;
  clearTimeout(mcTimer);
  clearTimeout(proTimer);
  cancelAnimationFrame(frame);
  renderFast();
  renderSimulation();
  return true;
}

function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function onClick(ev) {
  if (ev.target.id === 'export-csv' || ev.target.id === 'export-json') {
    if (stopAtBlank()) return;
    track('export_data');
    flushSimulation();
    if (ev.target.id === 'export-csv') download('fire-age.csv', 'text/csv;charset=utf-8', toCsv(latest));
    else download('fire-age.json', 'application/json', toJson(latest));
    return;
  }
  if (ev.target.id === 'share-btn') {
    if (stopAtBlank()) return;
    $('share-btn').closest('.goal-row').hidden = true;
    $('share-title').textContent = '你的放假卡';
    track('card_generate');
    flushSimulation();
    showCard(cardSpec());
    return;
  }
  if (ev.target.id === 'share-save') {
    saveCard();
    return;
  }
  if (ev.target.id === 'start-calc') {
    if (stopAtBlank()) return;
    endIntro();
    try { storage.setItem(STARTED_KEY, '1'); } catch { /* the start screen shows again next time at worst */ }
    $('inputs-box').open = false;
    refresh();
    requestAnimationFrame(() => $('headline').scrollIntoView({ block: 'start' }));
    return;
  }
  if (ev.target.id === 'crowd-join') {
    joinCrowd();
    return;
  }
  const scnGoto = ev.target.closest('[data-scn-goto]');
  if (scnGoto) {
    scnIndex = Number(scnGoto.dataset.scnGoto);
    renderScenario();
    return;
  }
  if (ev.target.id === 'scn-next') {
    scnIndex += 1;
    if (scnIndex === SCENARIOS.length) {
      if (!crowd.sent) track('views_done');
      joinCrowd();
      return;
    }
    renderScenario();
    return;
  }
  if (ev.target.id === 'views-apply') {
    for (const [id, value] of Object.entries(collected())) S = setField(S, id, String(value), DATA);
    if (writtenSliders().swr !== undefined) S = { ...S, autoSwr: false };
    refresh();
    return;
  }
  const scnOption = ev.target.closest('[data-scn]');
  if (scnOption) {
    const scenario = SCENARIOS[scnIndex];
    scnAnswers = { ...scnAnswers, [scenario.id]: Number(scnOption.dataset.scn) };
    saveAnswers();
    markPlayed(scenario.param);
    updateCard();
    renderLives();
    focusFifth();
    return;
  }
  if (ev.target.id === 'life-draw') {
    if (stopAtBlank()) return;
    track('life_draw');
    lifeShift = 1 + Math.floor(Math.random() * 199);
    lifeIndex = 0;
    flushSimulation();
    renderLives();
    updateCard();
    return;
  }
  const lifeButton = ev.target.closest('[data-life]');
  if (lifeButton) {
    lifeIndex = Number(lifeButton.dataset.life);
    updateCard();
    renderLives();
    return;
  }
  const help = ev.target.closest('.help');
  if (help) {
    const id = help.id.replace('help-', '');
    const card = $(`card-${id}`);
    card.hidden = !card.hidden;
    help.setAttribute('aria-expanded', String(!card.hidden));
    if (!card.hidden) {
      track('card_open');
      card.innerHTML = fullCard(paramById[id], toParams(S, DATA));
    }
    return;
  }
  const leverGoal = ev.target.closest('[data-goal]');
  if (leverGoal) {
    const p = toParams(S, DATA);
    const [paramId, target] = goalFor(leverGoal.dataset.goal, p);
    goal = makeGoal(paramId, target, p, today());
    saveGoal(goal, storage);
    renderGoal(p);
    return;
  }
  if (ev.target.id === 'goal-clear') {
    goal = null;
    clearGoal(storage);
    renderGoal(toParams(S, DATA));
  }
}

function startIntro() {
  document.body.classList.add('intro');
  $('start-intro').hidden = false;
  $('start-calc').hidden = false;
}

function endIntro() {
  document.body.classList.remove('intro');
  $('start-intro').hidden = true;
  $('start-calc').hidden = true;
}

function init() {
  buildForm($('simple-form'), 's', SIMPLE_FIELDS);
  buildForm($('pro-form'), 'p', PRO_FIELDS);
  fillCountrySelects();
  $('data-version').textContent = DATA.version;
  const wide = window.matchMedia('(min-width: 900px)');
  if (returning && !wide.matches) $('inputs-box').open = false;
  // A first visit on a phone starts with the numbers; a computer shows them beside the result.
  if (!started && !returning && !wide.matches) startIntro();
  wide.addEventListener('change', ev => {
    if (!ev.matches) return;
    $('inputs-box').open = true;
    endIntro();
  });
  $('type-all').innerHTML = allTypesHtml();
  document.addEventListener('input', onInput);
  document.addEventListener('change', ev => {
    if (ev.target.closest?.('#share-options')) {
      if (!$('share-panel').hidden && flushSimulation()) showCard(cardSpec(), { scroll: false });
      return;
    }
    if (ev.target.tagName === 'SELECT') {
      onSelect(ev);
      return;
    }
    // A field leaving focus is finished, so its value can now be the fallback for a later blank.
    const f = ev.target.id === 's-retexp' ? { id: 'retExp' } : fieldFromElement(ev.target.id);
    if (f) {
      S = commitField(S, f.id);
      saveState(S, storage);
    }
  });
  document.addEventListener('click', onClick);
  // A folded chart has no width to draw in, so the lives are drawn again when their section opens.
  $('lives-fold').addEventListener('toggle', () => { if ($('lives-fold').open && latest) renderLives(); });
  for (const form of [$('simple-form'), $('pro-form')]) form.addEventListener('submit', ev => ev.preventDefault());
  const setMode = mode => () => {
    if (S.mode !== mode) track('mode_switch');
    S = { ...S, mode };
    refresh();
  };
  const setView = view => () => {
    if (S.view !== view) track('mode_switch');
    S = { ...S, view };
    refresh();
  };
  $('cards').addEventListener('toggle', ev => {
    if (ev.target.open && S.view === 'simple') track('card_open');
  }, true);
  $('to-fwd').addEventListener('click', setMode('fwd'));
  $('to-bwd').addEventListener('click', setMode('bwd'));
  $('to-simple').addEventListener('click', setView('simple'));
  $('to-pro').addEventListener('click', setView('pro'));
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (latest?.mc) renderSimulation(); }, 120);
  });
  // Leaving a blank field marks it.
  document.addEventListener('focusout', () => {
    if (missingFields(S).length) requestAnimationFrame(() => showBlanks(blankFields()));
  });
  renderFast();
  renderSimulation();
  // A blank saved from last time: the result shows, dimmed, with the blank pointed out.
  showBlanks(blankFields());
  initAnalytics(location.href, DATA.version);
  track('visit');
}

init();

export const currentResult = () => latest;
