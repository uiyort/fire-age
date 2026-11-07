// Page wiring: reads inputs into state, recomputes, renders.
import DATA from './data-latest.js';
import { DEFAULT_SEED, bwdSolve, dualAges, fiNeed, fiYears, fwdSolve, lifePath, monteCarlo } from './engine.js';
import { drawLives, hardestIndex, heroModel, holidayType, lifeName, lifeNames, lifeRibbon, lifeStory, placeRanking } from './holiday.js';
import { commitField, isProUnlocked, loadState, saveState, safeStorage, setField, unlockPro, setRetireCountry, setWorkCountry, toParams } from './state.js';
import { LIFE_CHOICES, labPlan, rankLevers, impactOf, tryRange } from './levers.js';
import { SCENARIOS, answerValues, baselineOf } from './scenario.js';
import { PARAMS, PARAM_GROUPS } from './params.js';
import { makeGoal, compareVisit, goalApplies, loadGoal, saveGoal, clearGoal } from './goals.js';
import { initAnalytics, track } from './analytics.js';
import { drawChart, drawLivesChart } from './chart.js';
import { toCsv, toJson } from './export.js';
import { renderCard, summaryCardSpec } from './card.js';
import {
  allTypesHtml, cardBody, fasterLead, fifthCompareHtml, fifthSentence, goalFor, goalHtml, headlineText, heatHtml, heroHtml, labChangesHtml, leversHtml, livesHtml, livesSummary, money, pct, pctTableHtml, placesHtml, scenarioHtml, sensitivityHtml, solvesHtml, stickyHtml, storyHtml, wholeMoney, tilesHtml, toDisplay, tryHtml, trySentence, typeHtml, variantsHtml, viewsBannerHtml,
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
let proUnlocked = isProUnlocked(storage);
let S = loadState(DATA, storage);
if (!proUnlocked && S.view === 'pro') S = { ...S, view: 'simple' };
let goal = loadGoal(storage);
let latest = null;
let mcTimer = 0;
let frame = 0;
let lifeSeed = DEFAULT_SEED;
let lifeIndex = 0;
let labValues = {};
const VIEWS_KEY = 'fire-age-views-v1';
let scnIndex = 0;
let scnAnswers = loadAnswers();
const PLAYED_KEY = 'fire-age-played-v1';
const played = new Set(loadPlayed());

function loadAnswers() {
  try {
    const saved = JSON.parse(storage.getItem(VIEWS_KEY));
    return saved && typeof saved === 'object' ? saved : {};
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

function renderPlayed() {
  const done = played.size === PARAMS.length;
  $('lab-progress').textContent = done ? `${played.size}/${PARAMS.length}，全部点亮。这些参数你都亲手试过了。` : `已点亮 ${played.size}/${PARAMS.length} 个参数`;
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
  { legend: '现在', fields: [
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
  return hasCard ? `${wrap}<div class="lcard" id="card-${f.id}" hidden></div>` : wrap;
}

function buildForm(el, prefix, groups) {
  el.innerHTML = groups.map(g => `<fieldset><legend>${g.legend}</legend>${g.fields.map(f => fieldHtml(prefix, f)).join('')}</fieldset>`).join('');
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
  $('to-pro').textContent = proUnlocked ? '专业' : '专业 🔒';
  $('simple-form').hidden = S.view !== 'simple';
  $('pro-form').hidden = S.view !== 'pro';
  $('solve-card').hidden = S.mode !== 'bwd';
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
      <p class="fine">估算值，请按你计划的实际生活改写。</p>${S.notice ? `<p class="notice">${S.notice}</p>` : ''}`;
  }
}

function renderFast() {
  const p = toParams(S, DATA);
  const cur = dispCur(p);
  const t = fwdSolve(p);
  const bwd = bwdSolve(p);
  const dual = dualAges(p);
  const levers = rankLevers(p, DATA, { retC: S.retC });
  const retireT = S.mode === 'bwd' ? bwd.n : t;
  const target = Array.from({ length: p.life - p.age + 1 }, (_, i) => fiNeed(p, i));
  const type = holidayType(p, DATA, { workC: S.workC, retC: S.retC });
  const places = placeRanking(p, DATA, S.retC);
  latest = { ...(latest ?? {}), view: S.view, mode: S.mode, p, t, retireT, years: fiYears(p), dual, bwd, levers, target, type, places, dataVersion: DATA.version, dispCur: cur };

  syncChrome(p);
  syncInputs();
  renderEstimate(p);
  const { say, note } = headlineText({ mode: S.mode, p, t, bwd, dual, dispCur: cur, view: S.view });
  $('headline').innerHTML = `<p class="say">${say}</p><p class="say-note">${note}</p>`;
  $('tiles').innerHTML = tilesHtml({ mode: S.mode, p, t, bwd, mc: latest.mc, dispCur: cur });
  renderHero();
  if (S.mode === 'bwd') $('solves').innerHTML = solvesHtml({ p, bwd, dispCur: cur });
  $('type-now').innerHTML = typeHtml(type);
  document.querySelectorAll('.type-cell').forEach(cell => cell.classList.toggle('mine', cell.dataset.code === type.code));
  $('levers').innerHTML = leversHtml(levers, p, { pro: S.view === 'pro' });
  $('lead-faster').textContent = fasterLead(levers);
  $('places').innerHTML = placesHtml(places, { all: S.view === 'pro' });
  renderGoal(p);
  renderCards(p);
  if (S.view === 'pro') {
    $('variants').innerHTML = variantsHtml({ p, dispCur: cur });
    $('heat-box').innerHTML = heatHtml({ p, dispCur: cur });
    $('sensitivity').innerHTML = sensitivityHtml(p, PARAMS);
  }
  saveState(S, storage);
}

function renderHero() {
  const { mode, p, t, bwd, mc, dispCur: cur } = latest;
  latest.hero = heroModel({ mode, p, t, bwd, success: mc?.success ?? null });
  $('hero').innerHTML = heroHtml(latest.hero, { p, dispCur: cur });
  const success = mc?.success ?? null;
  $('sticky-result').innerHTML = stickyHtml(latest.hero, { p, dispCur: cur, success, pro: S.view === 'pro' });
  const riskLead = S.view === 'pro'
    ? (success === null ? '按计划没有放假年份，不计算成功率。' : `${(mc?.paths ?? 0).toLocaleString('en-US')} 次模拟，成功率 ${pct(success, 0)}。`)
    : (latest.hero.people === null ? '先到得了，再看撑不撑得住。' : `10 个平行的你，约 ${latest.hero.people} 个的钱够花到 ${p.life} 岁。`);
  $('lead-risk').textContent = riskLead;
}

function renderSimulation() {
  const { p, retireT, mode, bwd, dispCur: cur, target } = latest;
  const s0 = mode === 'bwd' ? Math.max(bwd.s0, 0) : null;
  const mc = monteCarlo(p, retireT, s0);
  latest.mc = mc;
  $('tiles').innerHTML = tilesHtml({ mode, p, t: latest.t, bwd, mc, dispCur: cur });
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
      ? `按"所需储蓄"存到 ${p.tAge} 岁，之后每年取出退休支出（扣除养老金）。`
      : `按现在的计划存到 ${p.age + retireT} 岁，之后每年取出退休支出（扣除养老金）。`;
  $('mc-note').textContent = `蒙特卡洛模拟 ${mc.paths.toLocaleString('zh-CN')} 次，随机种子 ${mc.seed}，结果可复现。金额都按今天的购买力计算。`;
  $('pct-table').innerHTML = pctTableHtml({ p, mc, target, dispCur: cur });
  renderLives();
}

const baseline = () => baselineOf(DATA, S.workC);

function labLabels() {
  const fromViews = SCENARIOS.filter(s => scnAnswers[s.id] !== undefined).map(s => paramById[s.param].name);
  const fromSliders = Object.keys(labValues).map(id => paramById[id].name);
  return [...new Set([...fromViews, ...fromSliders])];
}

// The life waiting to be written: the hardest of the four years of luck, walked with the person's own view of the future.
// Working backward, it keeps the holiday age and the saving plan that were asked for.
function fifthLife(p, lives, stories, { mode, retireT, s0 }) {
  const values = { ...answerValues(scnAnswers, baseline()), ...labValues };
  if (!Object.keys(values).length) return null;
  const base = hardestIndex(stories);
  const q = labPlan(p, { values });
  const path = mode === 'bwd' ? lifePath(q, retireT, s0, lives[base].seed) : lifePath(q, fwdSolve(q), null, lives[base].seed);
  return { path, story: lifeStory(path, q), base: stories[base], baseIndex: base, plan: q };
}

// The drawn lives follow the current plan, so changing an input redraws them with the same seeds.
function renderLives() {
  const { p, retireT, mode, bwd, mc, dispCur: cur } = latest;
  const s0 = mode === 'bwd' ? Math.max(bwd.s0, 0) : null;
  const lives = drawLives(p, retireT, s0, lifeSeed);
  const stories = lives.map(life => lifeStory(life, p));
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
  $('life-summary').textContent = livesSummary(stories, mc);
  const story = selectedFifth ? fifth.story : stories[lifeIndex];
  const compare = fifth ? fifthCompareHtml(fifth.base, fifth.story, names[fifth.baseIndex]) : '';
  $('life-story').innerHTML = `${selectedFifth ? compare : ''}${storyHtml(story, { p: selectedFifth ? fifth.plan : p, dispCur: cur })}`;
  $('life-seed').textContent = `随机种子 ${lifeSeed} 到 ${lifeSeed + lives.length - 1}，同样的输入可以复现这几条人生。收益是模型抽样，不是历史重演。`;
  const scale = v => toDisplay(v, p, cur);
  const series = lives.map((life, i) => {
    const kind = selectedFifth ? (i === fifth.baseIndex ? 'compare' : 'other') : (i === lifeIndex ? 'selected' : 'other');
    return { label: names[i], kind, retireT: life.retireT, cells: lifeRibbon(life), values: life.years.map(y => scale(y.assets)) };
  });
  if (selectedFifth) series.push({ label: '等你来写', kind: 'selected', retireT: fifth.path.retireT, cells: lifeRibbon(fifth.path), values: fifth.path.years.map(y => scale(y.assets)) });
  $('lives-chart-legend').innerHTML = [
    '<span><i class="sw r-work"></i>上班</span>',
    '<span><i class="sw r-holiday"></i>放假有钱花</span>',
    '<span><i class="sw r-broke"></i>钱花完</span>',
    '<span><i class="sw r-bad"></i>当年大跌 15% 以上</span>',
    ...(selectedFifth ? [`<span><i class="sw line-compare"></i>原计划：${names[fifth.baseIndex]}</span>`] : []),
    '<span><i class="sw line-other"></i>其他几条</span>',
  ].join('');
  drawLivesChart($('lives-chart'), $('lives-tip'), { age: p.age, lives: series, money: v => money(v, cur) });
  renderScenario();
}

function renderScenario() {
  const fifth = latest.fifth;
  const effect = fifth ? fifthSentence(fifth.base, fifth.story) : '';
  $('scenario').innerHTML = scenarioHtml({ index: scnIndex, answers: scnAnswers, base: baseline(), effect, params: paramById });
  renderViewsBanner();
}

function viewsApplied() {
  const values = answerValues(scnAnswers, baseline());
  return Object.entries(values).every(([id, value]) => S[id] === value);
}

function renderViewsBanner() {
  $('views-banner').innerHTML = viewsBannerHtml(scnAnswers, baseline(), paramById, viewsApplied());
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

const fullCard = (param, p) => cardBody(param, impactOf(p, param.id), tryHtml(param.id, tryRange(p, param.id), labValues[param.id]));

function renderCards(p) {
  for (const param of PARAMS) {
    const inline = $(`card-${param.id}`);
    if (inline && !inline.hidden) inline.innerHTML = fullCard(param, p);
  }
  const box = $('cards');
  if (!box.childElementCount) {
    box.innerHTML = PARAM_GROUPS.map(group => `<h4>${group.name}</h4>${group.ids.map(id => `<details data-id="${id}"><summary>${paramById[id].name}</summary><div class="lcard"></div></details>`).join('')}`).join('');
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

function refresh() {
  hideCard();
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    renderFast();
    clearTimeout(mcTimer);
    mcTimer = setTimeout(renderSimulation, MC_DELAY_MS);
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

function onInput(ev) {
  const el = ev.target;
  if (el.dataset.try) {
    const id = el.dataset.try;
    const p = toParams(S, DATA);
    el.closest('.try').querySelector('output').textContent = trySentence(p, id, Number(el.value), tryRange(p, id));
    markPlayed(id);
    if (LIFE_CHOICES.includes(id)) {
      labValues = { ...labValues, [id]: Number(el.value) };
      hideCard();
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

function hideCard() {
  $('share-panel').hidden = true;
}

function summaryInput() {
  const { mode, p, bwd, type, hero, places, lives, stories, fifth, dispCur: cur } = latest;
  const best = places[0], here = places.find(r => r.current);
  const gain = best.years !== null && here?.years != null ? here.years - best.years : 0;
  const achieved = goal && goalApplies(goal, p) && compareVisit(goal, p, today()).achieved;
  const ribbons = lives.map((life, i) => ({ label: (latest.names ?? lifeNames(stories))[i], cells: lifeRibbon(life).map(c => c.state) }));
  if (fifth) ribbons.push({ label: '等你来写', cells: lifeRibbon(fifth.path).map(c => c.state) });
  return {
    mode, type, hero, ribbons,
    enough: bwd.s0 <= 0,
    monthlyText: wholeMoney(toDisplay(Math.max(bwd.s0, 0) / 12, p, cur), cur),
    place: gain >= 0.05 ? { name: best.name, gain } : null,
    fifth: fifth ? fifthSentence(fifth.base, fifth.story) : null,
    lit: { done: played.size, total: PARAMS.length },
    goal: achieved ? goal.label : null,
  };
}

function showCard(spec) {
  const canvas = document.createElement('canvas');
  renderCard(spec, canvas);
  const png = canvas.toDataURL('image/png');
  $('share-img').src = png;
  $('share-download').href = png;
  $('share-img').alt = [spec.eyebrow, spec.hero, spec.sentence].filter(Boolean).join('，');
  $('share-panel').hidden = false;
  $('share-panel').scrollIntoView({ block: 'nearest' });
}

// A pending simulation would put a stale success rate on the card, so finish it first.
function flushSimulation() {
  clearTimeout(mcTimer);
  cancelAnimationFrame(frame);
  renderFast();
  renderSimulation();
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

// Generating the card is what opens the professional view. Posting it is never asked for or checked.
function openPro() {
  if (!proUnlocked) track('pro_unlock');
  proUnlocked = true;
  unlockPro(storage);
  $('to-pro').textContent = '专业';
  $('pro-enter').hidden = false;
  $('pro-lock-note').hidden = true;
}

function askToUnlock() {
  $('pro-lock-note').textContent = '生成一张放假卡，专业模式就打开了。';
  $('pro-lock-note').hidden = false;
  $('pro-lock-note').scrollIntoView({ block: 'center' });
}

function onClick(ev) {
  if (ev.target.id === 'pro-enter') {
    S = { ...S, view: 'pro' };
    refresh();
    window.scrollTo(0, 0);
    return;
  }
  if (ev.target.id === 'export-csv' || ev.target.id === 'export-json') {
    track('export_data');
    flushSimulation();
    if (ev.target.id === 'export-csv') download('fire-age.csv', 'text/csv;charset=utf-8', toCsv(latest));
    else download('fire-age.json', 'application/json', toJson(latest));
    return;
  }
  if (ev.target.id === 'share-btn') {
    track('card_generate');
    flushSimulation();
    showCard(summaryCardSpec(summaryInput()));
    openPro();
    return;
  }
  if (ev.target.id === 'share-close') {
    hideCard();
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
    if (scnIndex === SCENARIOS.length) track('views_done');
    renderScenario();
    return;
  }
  if (ev.target.id === 'views-apply') {
    for (const [id, value] of Object.entries(answerValues(scnAnswers, baseline()))) S = setField(S, id, String(value), DATA);
    refresh();
    return;
  }
  const scnOption = ev.target.closest('[data-scn]');
  if (scnOption) {
    const scenario = SCENARIOS[scnIndex];
    scnAnswers = { ...scnAnswers, [scenario.id]: Number(scnOption.dataset.scn) };
    saveAnswers();
    markPlayed(scenario.param);
    hideCard();
    renderLives();
    focusFifth();
    return;
  }
  if (ev.target.id === 'life-draw') {
    track('life_draw');
    lifeSeed = lifeSeed === null ? DEFAULT_SEED : Math.floor(Math.random() * 2 ** 31);
    lifeIndex = 0;
    hideCard();
    flushSimulation();
    return;
  }
  const lifeButton = ev.target.closest('[data-life]');
  if (lifeButton) {
    lifeIndex = Number(lifeButton.dataset.life);
    hideCard();
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

function init() {
  buildForm($('simple-form'), 's', SIMPLE_FIELDS);
  buildForm($('pro-form'), 'p', PRO_FIELDS);
  fillCountrySelects();
  $('data-version').textContent = DATA.version;
  const wide = window.matchMedia('(min-width: 900px)');
  if (returning && !wide.matches) $('inputs-box').open = false;
  wide.addEventListener('change', ev => { if (ev.matches) $('inputs-box').open = true; });
  $('type-all').innerHTML = allTypesHtml();
  document.addEventListener('input', onInput);
  document.addEventListener('change', ev => {
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
  for (const form of [$('simple-form'), $('pro-form')]) form.addEventListener('submit', ev => ev.preventDefault());
  const setMode = mode => () => {
    if (S.mode !== mode) track('mode_switch');
    S = { ...S, mode };
    refresh();
  };
  const setView = view => () => {
    if (view === 'pro' && !proUnlocked) {
      askToUnlock();
      return;
    }
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
  renderFast();
  renderSimulation();
  initAnalytics(location.href, DATA.version);
  track('visit');
}

init();

export const currentResult = () => latest;
