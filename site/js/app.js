// Page wiring: reads inputs into state, recomputes, renders.
import DATA from './data-latest.js';
import { DEFAULT_SEED, bwdSolve, dualAges, fiNeed, fiYears, fwdSolve, monteCarlo } from './engine.js';
import { TYPES, drawLives, holidayType, lifeStory, placeRanking } from './holiday.js';
import { commitField, loadState, saveState, safeStorage, setField, setRetireCountry, setWorkCountry, toParams } from './state.js';
import { rankLevers, impactOf } from './levers.js';
import { PARAMS } from './params.js';
import { makeGoal, compareVisit, goalApplies, loadGoal, saveGoal, clearGoal } from './goals.js';
import { initAnalytics, track } from './analytics.js';
import { drawChart } from './chart.js';
import { toCsv, toJson } from './export.js';
import { copyText, goalCardSpec, lifeCardSpec, placeCardSpec, renderCard, resultCardSpec, toCardInput, toLifeCardInput } from './card.js';
import {
  allTypesHtml, cardBody, goalFor, goalHtml, headlineText, heatHtml, leversHtml, livesHtml, livesSummary, money, pct, pctTableHtml, placesHtml, solvesHtml, storyHtml, tilesHtml, toDisplay, typeHtml, variantsHtml,
} from './views.js';

const $ = id => document.getElementById(id);
const storage = safeStorage();
const paramById = Object.fromEntries(PARAMS.map(c => [c.id, c]));
const today = () => new Date().toISOString().slice(0, 10);
const MC_DELAY_MS = 150;

let S = loadState(DATA, storage);
let goal = loadGoal(storage);
let latest = null;
let mcTimer = 0;
let frame = 0;
let lastCardView = null;
let lifeSeed = null;
let lifeIndex = 0;

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
    { id: 'rho', label: '股债相关性', unit: '−1 到 1', step: 0.05, full: true },
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
  const { say, note } = headlineText({ mode: S.mode, p, t, bwd, dual, dispCur: cur });
  $('headline').innerHTML = `<p class="say">${say}</p><p class="say-note">${note}</p>`;
  $('tiles').innerHTML = tilesHtml({ mode: S.mode, p, t, bwd, mc: latest.mc, dispCur: cur });
  if (S.mode === 'bwd') $('solves').innerHTML = solvesHtml({ p, bwd, dispCur: cur });
  $('type-now').innerHTML = typeHtml(type, levers[0]);
  $('levers').innerHTML = leversHtml(levers, p);
  $('places').innerHTML = placesHtml(places);
  renderGoal(p);
  renderCards(p);
  if (S.view === 'pro') {
    $('variants').innerHTML = variantsHtml({ p, dispCur: cur });
    $('heat-box').innerHTML = heatHtml({ p, dispCur: cur });
  }
  saveState(S, storage);
}

function renderSimulation() {
  const { p, retireT, mode, bwd, dispCur: cur, target } = latest;
  const s0 = mode === 'bwd' ? Math.max(bwd.s0, 0) : null;
  const mc = monteCarlo(p, retireT, s0);
  latest.mc = mc;
  $('tiles').innerHTML = tilesHtml({ mode, p, t: latest.t, bwd, mc, dispCur: cur });
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

// The drawn lives follow the current plan, so changing an input redraws them with the same seeds.
function renderLives() {
  if (lifeSeed === null) return;
  const { p, retireT, mode, bwd, mc, dispCur: cur } = latest;
  const s0 = mode === 'bwd' ? Math.max(bwd.s0, 0) : null;
  const lives = drawLives(p, retireT, s0, lifeSeed);
  const stories = lives.map(life => lifeStory(life, p));
  latest.lifeStory = stories[lifeIndex];
  $('lives').innerHTML = livesHtml(lives, stories, lifeIndex, { p, dispCur: cur });
  $('life-summary').textContent = livesSummary(stories, mc);
  $('life-story').innerHTML = storyHtml(stories[lifeIndex], { p, dispCur: cur });
  $('life-seed').textContent = `随机种子 ${lifeSeed} 到 ${lifeSeed + lives.length - 1}，同样的输入可以复现这几条人生。收益是模型抽样，不是历史重演。`;
  $('life-draw').textContent = '再抽一次';
  $('life-card').hidden = false;
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
  box.innerHTML = goalHtml(goal, compareVisit(goal, p, today()));
}

function renderCards(p) {
  for (const param of PARAMS) {
    const inline = $(`card-${param.id}`);
    if (inline && !inline.hidden) inline.innerHTML = cardBody(param, impactOf(p, param.id));
  }
  const box = $('cards');
  if (!box.childElementCount) {
    box.innerHTML = PARAMS.map(param => `<details data-id="${param.id}"><summary>${param.name}</summary><div class="lcard"></div></details>`).join('');
  }
  // Update in place so an open card stays open, keeps focus, and is not counted again.
  for (const details of box.children) {
    const param = paramById[details.dataset.id];
    details.querySelector('.lcard').innerHTML = cardBody(param, impactOf(p, param.id));
    if (S.view === 'pro' && S.view !== lastCardView) details.open = true;
    if (S.view === 'simple' && S.view !== lastCardView && lastCardView !== null) details.open = false;
  }
  lastCardView = S.view;
}

let calcCounted = false;
function countCalculation() {
  if (calcCounted) return;
  calcCounted = true;
  track('calc_done');
}

function refresh() {
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

function onSelect(ev) {
  const { id, value } = ev.target;
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

function showCard(spec) {
  const canvas = document.createElement('canvas');
  renderCard(spec, canvas);
  const png = canvas.toDataURL('image/png');
  $('share-img').src = png;
  $('share-download').href = png;
  $('share-comment').textContent = spec.comment;
  $('share-copy-status').textContent = '';
  $('share-panel').hidden = false;
  $('share-panel').scrollIntoView({ block: 'center' });
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

function onClick(ev) {
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
    showCard(resultCardSpec(toCardInput(latest)));
    return;
  }
  if (ev.target.id === 'place-card') {
    track('card_generate');
    showCard(placeCardSpec(latest.places));
    return;
  }
  if (ev.target.id === 'life-draw') {
    track('life_draw');
    lifeSeed = lifeSeed === null ? DEFAULT_SEED : Math.floor(Math.random() * 2 ** 31);
    lifeIndex = 0;
    flushSimulation();
    return;
  }
  if (ev.target.id === 'life-card') {
    track('card_generate');
    flushSimulation();
    showCard(lifeCardSpec(toLifeCardInput(latest.lifeStory, latest)));
    return;
  }
  const lifeButton = ev.target.closest('[data-life]');
  if (lifeButton) {
    lifeIndex = Number(lifeButton.dataset.life);
    renderLives();
    return;
  }
  if (ev.target.id === 'goal-card') {
    track('card_generate');
    showCard(goalCardSpec(goal, compareVisit(goal, toParams(S, DATA), today())));
    return;
  }
  if (ev.target.id === 'share-copy') {
    track('copy_text');
    copyText($('share-comment').textContent, $('share-comment')).then(result => {
      $('share-copy-status').textContent = result === 'copied' ? '已复制' : '请长按选中文字复制';
    });
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
      card.innerHTML = cardBody(paramById[id], impactOf(toParams(S, DATA), id));
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
  $('type-all').innerHTML = allTypesHtml(TYPES);
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
