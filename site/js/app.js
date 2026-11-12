// Page wiring: reads inputs into state, recomputes, renders.
import DATA from './data-latest.js';
import { DEFAULT_PATHS, DEFAULT_SEED, bwdSolve, monteCarlo, walkPath } from './engine.js';
import { bwdOdds, decilePaths, dualOdds, extendRow, needLine, oddsAround, oddsRuler, oddsSolve, oddsYears, successAt } from './odds.js';
import { hardestIndex, heroModel, holidayType, oddsText, lifeName, lifeNames, lifeRibbon, lifeStory, placeRanking, townPlan, cardPlace, withoutItemsGain } from './holiday.js';
import { FIELD_LABEL, FIELD_ORDER, LIMITS, applyPensionEstimate, cleanReal, cleanSplit, commitField, defaultState, groupStates, loadState, problems, resetRetExp, saveState, safeStorage, setField, setPen, setReal, setRetireCountry, setSplit, setTown, setWorkCountry, splitOn, storyRows, toParams, unsplit } from './state.js';
import { estimateFromForm } from './pension.js';
import { labPlan, lifeChoices, personalLever, rankLevers, impactOf, smallStep, tryRange } from './levers.js';
import { SCENARIOS, answerValues, baselineOf, cleanAnswers, countBody } from './scenario.js';
import { PARAMS, PARAM_GROUPS } from './params.js';
import { makeGoal, compareVisit, goalApplies, loadGoal, saveGoal, clearGoal } from './goals.js';
import { initAnalytics, track } from './analytics.js';
import { drawChart, drawLivesChart } from './chart.js';
import { toCsv, toJson } from './export.js';
import { assumptionLine, renderCard, summaryCardSpec, typeCardSpec } from './card.js';
import {
  allTypesHtml, cardBody, chipText, fasterLead, fifthOddsHtml, placesTitle, fifthBrief, fifthCompareHtml, fifthSentence, goalFor, goalHtml, headlineText, heatHtml, heldHeadHtml, heldHeroHtml, heroHtml, labChangesHtml, ledgerHtml, leversHtml, proLedgerRowHtml, proLinesHtml, lifeGainText, lifeTagText, fieldLineHtml, fieldLinesHtml, fixesHtml, groupStatusHtml, pensionEstimateHtml, livesHtml, livesSummary, money, pct, pctTableHtml, placesHtml, scenarioHtml, sensitivityHtml, solvesHtml, stickyHtml, storyHtml, wholeMoney, tilesHtml, toDisplay, townHtml, trackStyle, tryHtml, trySentence, tryValueText, typeHtml, variantsHtml, viewsBannerHtml,
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
// The ledger behind the fund line: closed until the person opens it, then drawn with every refresh.
let ledgerOpen = false;
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
  { legend: '现在', grp: 'now', fields: [
    { id: 'age', label: '年龄', unit: '岁' },
    { id: 'assets', label: '已有存款和投资', unit: 'work', step: 10000 },
    { id: 'income', label: '每月到手收入', unit: 'work', monthly: true, step: 1000 },
    { id: 'expense', label: '每月支出', unit: 'work', monthly: true, step: 500 },
  ] },
  { legend: '在哪里', grp: 'where', fields: [
    { id: 'work', label: '现在生活的地方', select: 'work' },
    { id: 'ret', label: '想在哪里退休', select: 'retire' },
  ] },
  { legend: '养老金', grp: 'pension', fields: [
    { id: 'pension', label: '预计每月养老金', unit: 'retire', monthly: true, step: 500, full: true },
    { id: 'selfPension', label: '放假后每月自缴养老保险', unit: 'work', step: 100, min: 0, full: true, cnPension: true },
    { id: 'selfMedical', label: '放假后每月自缴医保', unit: 'work', step: 100, min: 0, full: true, cnPension: true, note: '各地不同，缴满当地规定的年限后可以停，这里一直算到领取养老金那年。' },
    { id: 'tAge', elementId: 's-tage', label: '想几岁放假', unit: '岁', bwdOnly: true, full: true },
  ] },
];

const PRO_FIELDS = [
  { legend: '地区与币种', grp: 'region', fields: [
    { id: 'work', label: '工作/储蓄地', select: 'work' },
    { id: 'ret', label: '退休地', select: 'retire' },
    { id: 'disp', label: '显示币种', select: 'currency', full: true },
  ] },
  { legend: '现在', grp: 'now', fields: [
    { id: 'age', label: '年龄', unit: '岁' },
    { id: 'assets', label: '可投资资产', unit: 'work', step: 10000 },
    { id: 'income', label: '税后年收入', unit: 'work', step: 10000 },
    { id: 'expense', label: '当前年支出', unit: 'work', step: 5000 },
    { id: 'growth', label: '收入实际增长', unit: '%', step: 0.5, full: true, tool: true },
  ] },
  { legend: '退休后', grp: 'retire', fields: [
    { id: 'retExp', label: '年支出', unit: 'retire', step: 5000 },
    { id: 'life', label: '规划到', unit: '岁' },
    { id: 'pension', label: '养老金/年', unit: 'retire', step: 1000 },
    { id: 'pAge', label: '领取年龄', unit: '岁' },
    { id: 'selfPension', label: '放假后每月自缴养老保险', unit: 'work', step: 100, min: 0, full: true, cnPension: true },
    { id: 'selfMedical', label: '放假后每月自缴医保', unit: 'work', step: 100, min: 0, full: true, cnPension: true, note: '各地不同，缴满当地规定的年限后可以停，这里一直算到领取养老金那年。' },
    { id: 'tAge', label: '目标放假年龄', unit: '岁', bwdOnly: true, full: true },
  ] },
  { legend: '收益假设', grp: 'returns', fields: [
    { id: 'eq', label: '股票占比', unit: '%', step: 5 },
    { id: 'eqReal', label: '股票实际收益', unit: '%', step: 0.1 },
    { id: 'bondY', label: '10 年国债', unit: '%', step: 0.05 },
    { id: 'infl', label: '长期通胀', unit: '%', step: 0.1 },
    { id: 'drag', label: '税费拖累', unit: '%', step: 0.05 },
    { id: 'fxDrift', label: '退休币升值', unit: '%', step: 0.1 },
    { id: 'swr', label: '安全提取率', unit: '%', step: 0.1 },
  ] },
  { legend: '风险假设', grp: 'risk', fields: [
    { id: 'sigEq', label: '股票波动率', unit: '小数', step: 0.01 },
    { id: 'sigBd', label: '债券波动率', unit: '小数', step: 0.01 },
    { id: 'rho', label: '股债相关性', unit: '−1 到 1', step: 0.05 },
    { id: 'flexCut', label: '一年跌 ≥ 15% 后少花', unit: '%', step: 5 },
  ] },
  // Read only: the target, the runs and the seed the tool sets.
  { legend: '模拟', grp: 'sim', fields: [], html: `<p class="sim-line">八成 · ${DEFAULT_PATHS.toLocaleString('en-US')} 次 · 种子 ${DEFAULT_SEED} <span class="tool">本工具设定</span></p>` },
];

// An empty money field reads as 0 to the eye; the result still waits for it to be filled in.
const MONEY_UNITS = ['work', 'retire'];
// Retirement spending: the estimate's ≈, and the way back to it once typed by hand (shown by syncEstimateMark).
const EST_PRE = '<span class="f-pre est" aria-label="估算" hidden>≈</span>';
const EST_BACK = `<button type="button" class="link est-back" data-fix='{"reset":"retExp"}' hidden>改回估算</button>`;
function fieldHtml(prefix, f) {
  const id = f.elementId ?? `${prefix}-${f.id}`;
  const cls = `f${f.full ? ' full' : ''}`;
  const hasCard = prefix === 's' && paramById[f.id];
  const help = hasCard ? `<button type="button" class="help" id="help-${f.id}" aria-expanded="false" aria-controls="card-${f.id}" aria-label="${f.label}是什么">?</button>` : '';
  const unit = f.unit ? `<span class="u" data-unit="${f.unit}">${f.unit}</span>` : '';
  const control = f.select
    ? `<select id="${id}"></select>`
    : `<input type="number" inputmode="decimal" id="${id}" step="${f.step ?? 1}"${f.min === undefined ? '' : ` min="${f.min}"`}${MONEY_UNITS.includes(f.unit) ? ' placeholder="0"' : ''}>`;
  const flags = `${f.bwdOnly ? ' data-bwd-only' : ''}${f.cnPension ? ' data-cn-pension' : ''}`;
  const note = f.note ? `<p class="fine">${f.note}</p>` : '';
  // Spending can be a locked sum, drawn with = inside the box, in front of the number and not part of it; retirement
  // spending not typed by hand is the page's estimate, drawn with a blue ≈ the same way.
  const box = f.id === 'expense' ? `<span class="f-box"><span class="f-pre" aria-hidden="true" hidden>=</span>${control}</span>`
    : f.id === 'retExp' ? `<span class="f-box">${EST_PRE}${control}</span>` : control;
  const back = f.id === 'retExp' ? EST_BACK : '';
  // A value the tool sets by default says so by its label (the income growth, spec §8.3).
  const tool = f.tool ? ' <span class="tool">本工具设定</span>' : '';
  const wrap = `<div class="${cls}"${flags}><div class="lab"><label for="${id}">${f.label} ${unit}</label>${tool}${back}${help}</div>${box}${note}</div>`;
  const extra = f.id === 'expense' ? splitHtml(prefix) : f.id === 'pension' ? penFoldHtml(prefix) : '';
  return (hasCard ? `${wrap}<div class="lcard" id="card-${f.id}" hidden></div>` : wrap) + extra;
}

// The pension estimate: a fold under the pension field, only for people who work in mainland China.
const PEN_INPUTS = [
  ['birth', 'birth', '出生年月', '<input type="month" id="pen-@-birth" placeholder="1996-06">'],
  ['kind', 'kind', '类别', '<select id="pen-@-kind"><option value="m">男（原 60 岁退休）</option><option value="f55">女（原 55 岁退休）</option><option value="f50">女（原 50 岁退休）</option></select>'],
  ['paidYears', 'paid', '已缴几年', '<input type="number" inputmode="decimal" id="pen-@-paid" step="1" min="0">'],
  ['years', 'years', '到领取时累计缴费几年', '<input type="number" inputmode="decimal" id="pen-@-years" step="1" min="0">'],
  ['account', 'account', '个人账户余额（元）', '<input type="number" inputmode="decimal" id="pen-@-account" step="1000" min="0">'],
  ['base', 'base', '当地养老金计发基数（元/月）', '<input type="number" inputmode="decimal" id="pen-@-base" step="100" min="0">'],
  ['index', 'index', '平均缴费指数（0.6 到 3）', '<input type="number" inputmode="decimal" id="pen-@-index" step="0.1" min="0.6" max="3">'],
];
function penFoldHtml(prefix) {
  const grid = PEN_INPUTS.map(([, , name, input]) => `<label>${name}${input.replace('@', prefix)}</label>`).join('');
  return `<details class="split pen" id="pen-fold-${prefix}" data-cn-only><summary>不知道？估一下</summary><div class="pen-grid">${grid}</div>
    <p class="fine">计发基数在当地人社局网站，或 12333、国家社会保险公共服务平台查“养老金计发基数”。</p>
    <div class="pen-result" id="pen-result-${prefix}"></div></details>${prefix === 's' ? '<p class="fine" id="pen-age-s" hidden></p>' : ''}`;
}

const penEstimate = () => estimateFromForm(S.pen, new Date().getFullYear());
// B15, once shown (not while the years are being typed).
const penProblem = () => (localShown.has('pen.years') ? problems(S, DATA).find(q => q.rule === 'B15') ?? null : null);

// Writes the estimate fields from state, then the result under each form; the person's own typing is left alone.
function renderPen() {
  const est = penEstimate();
  for (const prefix of ['s', 'p']) {
    for (const [key, short] of PEN_INPUTS) {
      const el = $(`pen-${prefix}-${short}`);
      if (!el || el === document.activeElement) continue;
      el.value = S.pen[key] ?? '';
    }
    const years = $(`pen-${prefix}-years`);
    if (years) years.placeholder = est ? `默认 ${est.defaultYears}` : '';
    const out = $(`pen-result-${prefix}`);
    if (!out) continue;
    const used = Boolean(est) && est.est.eligible && (() => {
      const q = applyPensionEstimate(S, { monthly: est.est.monthly, claimAge: est.claimAge, selfPay: est.selfPay }, DATA);
      return q.pension === S.pension && q.pAge === S.pAge;
    })();
    const problem = prefix === (S.view === 'pro' ? 'p' : 's') ? penProblem() : null;
    out.innerHTML = pensionEstimateHtml(est, { used, held: S.pension > 0, problem });
    // The years field points at the line that says why.
    if (years && problem && est) {
      years.setAttribute('aria-describedby', 'rel-pen.years');
      years.dataset.described = '';
    }
  }
  const age = $('pen-age-s');
  if (age) {
    age.hidden = !(S.pension > 0);
    age.textContent = `领取年龄 ${S.pAge ?? S.lastValid.pAge} 岁，专业版里可以改。`;
  }
}

// Monthly spending is hard to guess as one number, so it can be added up from three monthly parts, in both views;
// the two views share one stored split (S.split). Once a part is used, spending is their sum and locked.
const SPLIT_PARTS = [['rent', '房租和房贷'], ['food', '吃饭'], ['other', '其他']];
function splitHtml(prefix) {
  const simple = prefix === 's';
  // The professional total is yearly, so its parts say they are monthly.
  const unit = simple ? '' : ' <span class="u">/月</span>';
  const parts = SPLIT_PARTS.map(([key, name]) => `<label><span>${name}${unit}</span><input type="number" inputmode="decimal" id="${simple ? '' : 'p-'}split-${key}" step="100" min="0" placeholder="0"></label>`).join('');
  return `<details class="split" id="${simple ? '' : 'p-'}expense-split"><summary>每月花多少说不准？拆开来加</summary><div class="split-row">${parts}</div></details>`;
}

// The split as stored, written into both views: the parts (except the one being typed in) and the locked total; its
// line is drawn with the lines under spending.
function syncSplit() {
  const sp = cleanSplit(S.split);
  const on = splitOn(S);
  for (const view of ['simple', 'pro']) {
    const simple = view === 'simple';
    for (const [key] of SPLIT_PARTS) {
      const el = fieldEl(`split.${key}`, view);
      if (el !== document.activeElement) el.value = sp[key] ?? '';
    }
    const total = fieldEl('expense', view);
    if (total !== document.activeElement) total.value = S.expense === null ? '' : simple ? Math.round(S.expense / 12) : S.expense;
    total.readOnly = on;
    // Out of the Tab order while locked, so Shift+Tab from the first part goes on to the fields before it.
    if (on) total.tabIndex = -1;
    else total.removeAttribute('tabindex');
    total.classList.toggle('locked', on);
    total.previousElementSibling.hidden = !on;
    if (on) {
      total.setAttribute('aria-readonly', 'true');
      total.setAttribute('aria-label', simple ? '每月支出，三项合计' : '当前年支出，三项合计');
      $(simple ? 'expense-split' : 'p-expense-split').open = true;
    } else {
      total.removeAttribute('aria-readonly');
      total.removeAttribute('aria-label');
    }
  }
  renderLines();
}

function buildForm(el, prefix, groups) {
  el.innerHTML = groups.map(g => `<fieldset><legend>${g.legend}<span class="grp-status" data-grp="${g.grp}"></span></legend>${g.fields.map(f => fieldHtml(prefix, f)).join('')}${g.html ?? ''}</fieldset>`).join('');
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
  for (const [id, v] of [['town-name', S.town.name], ['town-monthly', S.town.monthly ?? '']]) {
    const el = $(id);
    if (el && el !== document.activeElement) el.value = v;
  }
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
  syncSplit();
}

// The lines under spending and the fold sit under the spending field of the form on screen. Each is one node, moved
// only when the view changes, so its inputs keep their values and typing keeps its focus.
const linesExp = $('lines-expense');
const linesRet = $('lines-retexp');
function placeFold() {
  const fold = $('life-fold');
  const anchor = $(S.view === 'simple' ? 'expense-split' : 'p-expense-split');
  if (linesExp.previousElementSibling !== anchor) anchor.after(linesExp);
  if (fold.previousElementSibling !== linesExp) linesExp.after(fold);
}
// The lines under retirement spending follow its field, which the simple view draws inside the estimate box.
function placeRetLines() {
  const box = fieldEl('retExp')?.closest('.f');
  if (box && box.nextElementSibling !== linesRet) box.after(linesRet);
}

// The tag sits under the big age in the simple view and under the headline in the professional one. The hero is
// redrawn whole, which drops the tag, so it is put back after every redraw.
const lifeTag = $('life-tag');
function placeTag() {
  const big = S.view === 'simple' ? $('hero').querySelector('.hero-big') : null;
  if (big) big.after(lifeTag);
  else if (S.view === 'simple') $('hero').prepend(lifeTag);
  else $('headline').after(lifeTag);
}

function syncChrome(p) {
  placeFold();
  // The ledger opens under its closed line: the fund line in the simple view's hero, the line under the tiles in the
  // professional view. One node, moved only when the view changes.
  const ledgerAt = $(S.view === 'pro' ? 'ledger-row' : 'hero');
  if (ledgerAt.nextElementSibling !== $('ledger')) ledgerAt.after($('ledger'));
  document.querySelectorAll('[data-unit="work"]').forEach(e => { e.textContent = p.wCur; });
  document.querySelectorAll('[data-unit="retire"]').forEach(e => { e.textContent = p.rCur; });
  // The town box reads its spend in the retirement currency; abroad, the towns are not 国内.
  $('town-title').textContent = S.retC === 'CN' ? '国内换个城市，或者回老家' : '换个城市，或者回老家';
  document.querySelectorAll('[data-bwd-only]').forEach(e => { e.hidden = S.mode !== 'bwd'; });
  document.querySelectorAll('[data-cn-only]').forEach(e => { e.hidden = S.workC !== 'CN'; });
  document.querySelectorAll('[data-cn-pension]').forEach(e => { e.hidden = !(S.workC === 'CN' && S.pension > 0); });
  document.querySelectorAll('.pro-only').forEach(e => { e.hidden = S.view !== 'pro'; });
  document.querySelectorAll('.simple-only').forEach(e => { e.hidden = S.view !== 'simple'; });
  $('simple-form').hidden = S.view !== 'simple';
  $('pro-form').hidden = S.view !== 'pro';
  $('solve-card').hidden = S.mode !== 'bwd';
  // The note names the other view, so it stays in place when the view changes.
  $('mode-note').textContent = S.view === 'simple' ? '专业版：改收益、通胀等全部假设' : '简单版：只填几个数';
  for (const [id, on] of [['to-fwd', S.mode === 'fwd'], ['to-bwd', S.mode === 'bwd'], ['to-simple', S.view === 'simple'], ['to-pro', S.view === 'pro']]) {
    $(id).setAttribute('aria-pressed', String(on));
  }
}

// The estimate box is redrawn only when its text changes, so a redraw never swaps the field under the pointer.
let estimateNow = '';
const setEstimate = html => {
  if (html === estimateNow) return;
  estimateNow = html;
  $('estimate').innerHTML = html;
};
function renderEstimate(p) {
  if (S.view !== 'simple') {
    setEstimate(`<div class="derived">
      <div><span>组合实际年化收益</span><b>${pct(p.r, 2)}</b></div>
      <div><span>组合年化波动</span><b>${pct(p.sigma, 1)}</b></div>
      <div><span>债券实际收益</span><b>${pct(p.bondReal, 2)}</b></div>
    </div><label class="chk"><input type="checkbox" id="p-autoswr"${S.autoSwr ? ' checked' : ''}> 提取率按退休年限自动调整</label>${S.notice ? `<p class="notice">${S.notice}</p>` : ''}`);
    placeRetLines();
    renderLines();
    syncGroups();
    return;
  }
  const typing = document.activeElement?.id === 's-retexp';
  if (!typing) {
    setEstimate(`<h3 class="grp-legend"><label for="s-retexp">退休后每月想花</label><span class="grp-status" data-grp="retire"></span></h3>
      <div class="f"><div class="lab"><span class="u">${p.rCur}</span>${EST_BACK}</div>
      <span class="f-box">${EST_PRE}<input type="number" inputmode="decimal" id="s-retexp" step="500" placeholder="0" value="${S.retExp === null ? '' : Math.round(S.retExp / 12)}"></span></div>
      <p class="fine mix-note">组合按股票 ${p.eq}% / 债券 ${100 - p.eq}% 估算（常见的基准组合，不是建议），扣掉通胀后约 ${pct(p.r, 1)}/年。<a href="sources.html">数据来源</a>，专业模式可以改。</p>${S.notice ? `<p class="notice">${S.notice}</p>` : ''}`);
  }
  placeRetLines();
  renderLines();
  syncGroups();
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
  // The odds of the plan as it is, right away: the full simulation for the chart follows a moment later.
  const success = retireT === null ? null : successAt(p, retireT, s0);
  const type = holidayType(p, DATA, { workC: S.workC, retC: S.retC, success, ...(S.mode === 'bwd' ? { retireT: bwd.n } : {}) });
  latest = { ...(latest ?? {}), view: S.view, mode: S.mode, p, t, retireT, s0, years: oddsYears(p), dual, bwd, odds, levers, small, target, type, success, ruler: S.mode === 'bwd' ? null : oddsRuler(p), dataVersion: DATA.version, dispCur: cur };

  syncChrome(p);
  syncInputs();
  renderPen();
  renderLife();
  renderEstimate(p);
  const eightAge = t === null ? null : p.age + t;
  const { say, note } = headlineText({ mode: S.mode, p, t, odds, eightAge, dual, dispCur: cur, view: S.view });
  $('headline').hidden = false;
  $('headline').innerHTML = `<p class="say">${say}</p><p class="say-note">${note}</p>`;
  $('tiles').innerHTML = tilesHtml({ mode: S.mode, p, t, bwd, mc: latest.mc, dispCur: cur, target });
  renderHero();
  if (S.mode === 'bwd') $('solves').innerHTML = solvesHtml({ p, bwd, odds, dispCur: cur });
  // The type is told for the plan as it is; spending that ends can move both the age and the type.
  $('type-now').innerHTML = typeHtml(type) + (p.events.length ? '<p class="fine">算上到期支出，放假可能更早，类型也可能跟着变。</p>' : '');
  document.querySelectorAll('.type-cell').forEach(cell => cell.classList.toggle('mine', cell.dataset.code === type.code));
  const reached = S.mode === 'fwd' && t === 0;
  $('levers').innerHTML = leversHtml(levers, p, { pro: S.view === 'pro', small, dispCur: cur, reached });
  $('lead-faster').textContent = fasterLead(levers, { reached });
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
    () => renderTown(),
    () => renderCards(p),
    ...(pro ? [
      () => { $('variants').innerHTML = variantsHtml({ p, dispCur: cur }); },
      () => { $('heat-box').innerHTML = heatHtml({ p, dispCur: cur }); },
      () => { $('sensitivity').innerHTML = sensitivityHtml(p, PARAMS); },
    ] : []),
  ];
}

const LIFE_INPUTS = [
  ['life-mortgage', 'mortgage', 'monthly'], ['life-mortgage-end', 'mortgage', 'endYear'],
  ['life-kids', 'kids', 'count'], ['life-kid-age', 'kids', 'age'], ['life-kid-monthly', 'kids', 'monthly'],
];
// The fold's inputs, typing left alone.
function syncLifeInputs() {
  for (const [id, part, field] of LIFE_INPUTS) {
    const el = $(id);
    if (el && el !== document.activeElement) el.value = S.real[part][field] ?? '';
  }
}
// The fold's inputs and the tag under the big age (the counted items, hidden while the result is stopped).
// solve: false while the result is stopped, when nothing is worked out from the numbers.
function renderLife(p = latest.p, { solve = true } = {}) {
  syncLifeInputs();
  const year = new Date().getFullYear();
  $('life-mortgage-end').min = String(year - LIMITS.endYearBack);
  $('life-mortgage-end').max = String(year + LIMITS.endYearAhead);
  const tag = lifeTagText(storyRows(S, DATA, year, null));
  lifeTag.hidden = !tag;
  lifeTag.textContent = tag;
  // One more solve, without the items, for the comparison inside the fold.
  const gain = solve && tag ? lifeGainText(withoutItemsGain(p)) : '';
  $('life-gain').hidden = !gain;
  $('life-gain').textContent = gain;
}

function renderTown() {
  const { p } = latest;
  const plan = townPlan(p, S.town.monthly);
  latest.town = plan;
  $('town-result').innerHTML = townHtml(S.town, plan, p);
}

function renderHero() {
  const { mode, p, t, bwd, retireT, target, ruler, dispCur: cur } = latest;
  const success = latest.success;
  latest.hero = heroModel({ mode, p, t, bwd, success, need: target[retireT ?? 0], ruler: mode === 'bwd' ? null : ruler });
  $('hero').innerHTML = heroHtml(latest.hero, { p, dispCur: cur, open: ledgerOpen });
  // The professional view's fund line: the ledger closed, in the work currency like the ledger's own ⇒ row.
  $('ledger-row').innerHTML = proLedgerRowHtml({ need: retireT === null ? null : target[retireT], success, cur: p.wCur, open: ledgerOpen });
  renderLedger();
  placeTag();
  stickyNow = '';
  $('sticky-result').innerHTML = stickyHtml(latest.hero, { p, dispCur: cur, success, pro: S.view === 'pro' });
  const riskLead = S.view === 'pro'
    ? (success === null ? '按计划没有放假年份，不计算成功率。' : `2,000 次模拟，成功率 ${pct(success, 0)}，按本工具假设。`)
    : (latest.hero.people === null ? '先到得了，再看撑不撑得住。' : `10 个平行的你，${latest.hero.people} 个的钱够花到 ${p.life} 岁。`);
  $('lead-risk').textContent = riskLead;
}

// The ledger, while open, from the numbers as they are: held, the rows stop at the first stop and nothing is worked
// out; otherwise from the solved plan (the year chosen, working backward; the last year, out of reach).
function ledgerNow() {
  const year = new Date().getFullYear();
  const view = S.view === 'pro' ? 'pro' : 'simple';
  if (isHeld()) {
    const { wCur, rCur } = toParams(S, DATA);
    // Only the stops marked on the page; one still being typed waits there too (the field is not red yet).
    return ledgerHtml({ rows: storyRows(S, DATA, year, null), list: stopsNow().filter(q => shown.has(q.id)), odds: [], plan: null, state: 'held', view, mode: S.mode, p: null, dispCur: wCur, rCur });
  }
  const { p, t, bwd, target, odds, mc, mcFor, mode, dispCur: cur } = latest;
  const unreachable = mode !== 'bwd' && t === null;
  const T = mode === 'bwd' ? bwd.n : unreachable ? p.life - p.age - 1 : t;
  const plan = unreachable ? { p, t: T, need: null, unreachable: true } : { p, t: T, need: target[T] };
  const state = unreachable ? 'unreachable' : mode !== 'bwd' && T === 0 ? 'now' : 'ok';
  // The flags the professional ledger draws (B13 on the r row), from the page's own list. The median waits for the
  // simulation of these numbers; one from numbers before is never shown.
  const list = view === 'pro' ? problems(S, DATA, year).filter(q => q.kind === 'flag') : [];
  return ledgerHtml({ rows: storyRows(S, DATA, year, plan), list, odds: oddsAround(p, T), plan, state, view, mode, p, dispCur: cur, mc: mc && mcFor === p ? mc : null, bwdOdds: odds });
}
function renderLedger() {
  document.querySelectorAll('.ledger-toggle').forEach(button => {
    button.setAttribute('aria-expanded', String(ledgerOpen));
    button.lastElementChild.textContent = ledgerOpen ? '▾' : '▸';
  });
  const html = ledgerOpen && (latest || isHeld()) ? ledgerNow() : '';
  $('ledger').innerHTML = html;
  $('ledger').hidden = !html;
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
  latest.mcFor = p;
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
  const empty = stories.every(s => s.outcome === 'working' && !(s.endAssets > 0));
  $('life-section').classList.toggle('empty-lives', empty);
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
  const sliders = Object.entries(writtenSliders()).map(([id, value]) => ({ id, name: paramById[id].name, text: tryValueText(value, tryRange(p, id).unit, p, id) }));
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

// While a blank or a block stops the result, a card leaves out its impact and its slider: both are worked out from
// the numbers, which must not reach the model.
const fullCard = (param, p) => (isHeld() || stopsNow().length
  ? cardBody(param, null)
  : cardBody(param, impactOf(p, param.id), tryHtml(param.id, tryRange(p, param.id), labValues[param.id], { mode: S.mode, p })));
// Redraws the help cards open in the form, when the result stops or starts again.
function renderOpenCards(p) {
  for (const param of PARAMS) {
    const inline = $(`card-${param.id}`);
    if (inline && !inline.hidden) inline.innerHTML = fullCard(param, p);
  }
}

function renderCards(p) {
  renderOpenCards(p);
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

// ---- A stopped result. problems() judges every rule; the page only marks the fields it names and holds the result.

// The input of a field key in a view. A key with no input in that view (a professional-only field in the simple view,
// or a split part in the professional view before it has one) gives null.
const LIFE_ID = Object.fromEntries(LIFE_INPUTS.map(([id, part, field]) => [`${part}.${field}`, id]));
function fieldId(key, view) {
  const simple = view !== 'pro';
  if (key in LIFE_ID) return LIFE_ID[key];
  if (key === 'town.monthly') return 'town-monthly';
  if (key === 'pen.years') return `pen-${simple ? 's' : 'p'}-years`;
  if (key.startsWith('split.')) return `${simple ? '' : 'p-'}split-${key.slice(6)}`;
  if (simple && key === 'retExp') return 's-retexp';
  if (simple && key === 'tAge') return 's-tage';
  return `${simple ? 's' : 'p'}-${key}`;
}
function fieldEl(key, view = S.view) {
  return $(fieldId(key, view));
}
const FIELD_KEYS = [...new Set([...FIELD_ORDER.simple, ...FIELD_ORDER.pro])];
// The field key of an input, or null for anything that no rule reads.
function fieldKeyOf(el) {
  if (!el?.id) return null;
  return FIELD_KEYS.find(key => fieldId(key, 'simple') === el.id || fieldId(key, 'pro') === el.id) ?? null;
}

// The field the person committed last, which takes the solid frame where a relation has two sides.
let lastField = null;
// The ids of the stops now marked on the page.
let shown = new Set();
const isStop = q => q.kind === 'blank' || q.kind === 'block';
const stopsNow = () => problems(S, DATA, new Date().getFullYear(), { last: lastField }).filter(isStop);
const isHeld = () => document.body.classList.contains('result-held');

// The fields a stop rests on. The mortgage's cells count as one, as do the children's and the split's parts: typing
// the end year, which brings the mortgage in, is still typing the mortgage.
const groupKeys = key => {
  const head = key.split('.')[0];
  return ['mortgage', 'kids', 'split'].includes(head) ? FIELD_KEYS.filter(k => k.startsWith(`${head}.`)) : [key];
};
const restsOn = (q, key) => [q.field, ...q.more, ...q.compare].flatMap(groupKeys).includes(key);

// Solid frame on the field to fix (and on the other blank cells of its group), dashed frame on the fields it is
// compared with. Marks of stops no longer listed go.
function markProblems(list) {
  const view = S.view === 'pro' ? 'pro' : 'simple';
  const wrap = el => el.closest('.f') ?? el.closest('label') ?? el;
  document.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
  document.querySelectorAll('[data-cmp]').forEach(el => { el.removeAttribute('aria-description'); el.removeAttribute('data-cmp'); });
  document.querySelectorAll('.f.bad, label.bad, .f.cmp, label.cmp').forEach(el => el.classList.remove('bad', 'cmp'));
  const solid = new Set();
  for (const q of list) {
    for (const key of [q.field, ...q.more]) {
      const el = fieldEl(key);
      if (!el) continue;
      solid.add(el);
      el.setAttribute('aria-invalid', 'true');
      wrap(el).classList.add('bad');
    }
  }
  for (const q of list) {
    for (const key of q.compare) {
      const el = fieldEl(key);
      if (!el || solid.has(el)) continue;
      el.dataset.cmp = '';
      el.setAttribute('aria-description', `和${FIELD_LABEL[view][q.field]}比较`);
      wrap(el).classList.add('cmp');
    }
  }
  markedNow = list;
  renderLines();
  syncGroups();
}

// The state at the right of each group header of the view on screen: ✕ N counts the stops marked now (never one still
// being typed), the rest reads the numbers. Redrawn only when it changes, so a button under the pointer stays.
function syncGroups() {
  const states = groupStates(S, markedNow, DATA);
  for (const el of document.querySelectorAll('.grp-status')) {
    if ($('pro-form').contains(el) !== (S.view === 'pro')) continue;
    const html = groupStatusHtml(states[el.dataset.grp], { version: DATA.version });
    if (el.innerHTML !== html) el.innerHTML = html;
  }
}

// 我的数字: the numbers opened, at the first group with a ✕ shown, else at the top of the form.
function goToNumbers() {
  $('inputs-box').open = true;
  const x = document.querySelector(S.view === 'pro' ? '#pro-form .grp-x' : '#simple-form .grp-x, #estimate .grp-x');
  const head = x?.closest('fieldset, .grp-legend') ?? $(S.view === 'pro' ? 'pro-form' : 'simple-form');
  head.scrollIntoView({ block: 'start' });
}

// ---- The lines under the fields and the exit buttons. A stop is drawn red only once it is marked; a stop that waits
// while its field is typed in draws its items plainly. A local stop (A9, B15) frames its field once the field is left.

// The stops marked now; the local stops shown now (by field key).
let markedNow = [];
const localShown = new Set();
const wrapOf = el => el.closest('.f') ?? el.closest('label') ?? el;
// A line goes right after its field's box, or after the lines that already follow it (retirement spending).
const anchorOf = el => (wrapOf(el).nextElementSibling === linesRet ? linesRet : wrapOf(el));
const drawn = new Map();
const boxField = new WeakMap();
const setHtml = (el, html) => {
  if (drawn.get(el) === html && el.isConnected) return;
  drawn.set(el, html);
  el.innerHTML = html;
};
// ≈ inside the retirement spending box while it is the estimate; 改回估算 by its label once typed.
function syncEstimateMark() {
  const typed = Boolean(S.touched?.retExp);
  for (const view of ['simple', 'pro']) {
    const el = fieldEl('retExp', view);
    if (!el) continue;
    el.previousElementSibling.hidden = typed;
    el.classList.toggle('has-pre', !typed);
    el.closest('.f').querySelector('.est-back').hidden = !typed;
  }
}
function renderLines() {
  const view = S.view === 'pro' ? 'pro' : 'simple';
  const year = new Date().getFullYear();
  const all = problems(S, DATA, year, { last: lastField });
  const marked = new Set(markedNow.map(q => q.id));
  // Local stops: shown once their field is left, gone as soon as they no longer hold.
  for (const key of [...localShown]) if (!all.some(q => q.kind === 'local' && q.field === key)) localShown.delete(key);
  for (const q of all) if (q.kind === 'local' && fieldEl(q.field) !== document.activeElement) localShown.add(q.field);
  const list = all.filter(q => (isStop(q) ? marked.has(q.id) : q.kind !== 'local' || localShown.has(q.field)));
  const sp = cleanSplit(S.split);
  // The split line takes the stored yearly total from before the split.
  const rows = storyRows(S, DATA, year, null).map(r => (r.key === 'split' ? { ...r, before: sp.before } : r));
  const wCur = DATA.countries[S.workC].cur, rCur = DATA.countries[S.retC].cur;
  // The professional view's own lines: the rate, the nominal mortgage, the estimate across countries, the pension cap
  // and the orange flags (B11, B12), each under its field.
  const own = view === 'pro' ? proLinesHtml({ S, p: toParams(S, DATA, year), data: DATA, list, rows }) : {};
  const lines = at => fieldLinesHtml({ rows, list, at, view, wCur, rCur, note: own[at] ?? '' });
  // Exits of the relations drawn in the lines block, whose solid field is the block's own field, end the block.
  const ownFixes = key => {
    const html = list.filter(q => isStop(q) && q.rel?.sub && q.field === key).map(q => fixesHtml(q.fixes)).join('');
    return html ? `<div class="fixes">${html}</div>` : '';
  };
  // A rent or mortgage in the parts may end one day, so the simple view points at the fold for the end year, after the
  // lines; once a mortgage is filled the box below already says it.
  const lifeLink = view === 'simple' && sp.rent > 0 && !(cleanReal(S.real).mortgage.monthly > 0)
    ? '<button type="button" class="split-life" id="split-life">房贷会还完？填上还到哪年 ›</button>' : '';
  setHtml(linesExp, lines('expense') + ownFixes('expense') + lifeLink);
  setHtml(linesRet, lines('retExp') + ownFixes('retExp'));
  // Everything else goes right after its solid field: a range rule's line and its exits, or the exits alone.
  const after = new Map();
  for (const q of list) {
    if (q.rule === 'B15' || (isStop(q) && q.rel?.sub && (q.field === 'expense' || q.field === 'retExp'))) continue;
    const range = isStop(q) && q.rel && !q.rel.sub;
    const fixes = isStop(q) || q.kind === 'local' ? fixesHtml(q.fixes) : '';
    if (!range && !fixes) continue;
    const el = fieldEl(q.field);
    if (!el) continue;
    const html = (range ? fieldLineHtml(q) : '') + (fixes ? `<div class="fixes">${fixes}</div>` : '');
    after.set(el, (after.get(el) ?? '') + html);
  }
  const addAfter = (el, html) => { if (el && html) after.set(el, (after.get(el) ?? '') + html); };
  if (view === 'pro') {
    addAfter($('p-disp'), own.region && own.region.replace('</p>', ` <span class="grp-data">${DATA.version} 数据</span></p>`));
    addAfter(fieldEl('pension'), own.pension);
    for (const key of Object.keys(LIMITS.common)) addAfter(fieldEl(key), own[key]);
  }
  // Orange frames: a changed assumption outside the common range (B11), a pension above the year's spending (B12).
  document.querySelectorAll('.f.warn').forEach(el => el.classList.remove('warn'));
  for (const q of list) {
    const el = view === 'pro' && (q.rule === 'B11' || q.rule === 'B12') ? fieldEl(q.field) : null;
    if (el) wrapOf(el).classList.add('warn');
  }
  // A box already in place with the same content stays, so a redraw never swaps a button under the pointer.
  for (const box of document.querySelectorAll('.field-after')) {
    const field = boxField.get(box);
    if (field && after.get(field) === drawn.get(box) && box.previousElementSibling === anchorOf(field)) after.delete(field);
    else box.remove();
  }
  for (const [el, html] of after) {
    const box = document.createElement('div');
    box.className = 'field-after';
    box.innerHTML = html;
    drawn.set(box, html);
    boxField.set(box, el);
    anchorOf(el).after(box);
  }
  // The solid field points at the line that says why.
  document.querySelectorAll('[data-described]').forEach(el => { el.removeAttribute('aria-describedby'); el.removeAttribute('data-described'); });
  for (const q of list) {
    if (!(isStop(q) || q.rule === 'B15') || !q.rel || !document.getElementById(`rel-${q.field}`)) continue;
    const el = fieldEl(q.field);
    if (!el) continue;
    el.setAttribute('aria-describedby', `rel-${q.field}`);
    el.dataset.described = '';
  }
  // The local frames.
  for (const key of localShown) {
    const el = fieldEl(key);
    if (!el) continue;
    el.setAttribute('aria-invalid', 'true');
    wrapOf(el).classList.add('bad');
  }
  for (const key of ['town.monthly', 'pen.years']) {
    const el = fieldEl(key);
    if (!el || localShown.has(key) || markedNow.some(q => q.field === key)) continue;
    el.removeAttribute('aria-invalid');
    wrapOf(el).classList.remove('bad');
  }
  syncEstimateMark();
}

// An exit button: the value it names goes into its field (which keeps the cursor), or the cursor goes to the field.
function applyFix(fix) {
  labValues = {};
  countCalculation();
  if (fix.focus) {
    refresh({ commit: true });
    goToField(fix.focus);
    return;
  }
  let key = null;
  if (fix.set) {
    for (const [k, v] of Object.entries(fix.set)) {
      const [head, tail] = k.split('.');
      if (head === 'split') S = setSplit(S, tail, String(v), DATA);
      else if (head === 'mortgage' || head === 'kids') S = setReal(S, head, tail, String(v), DATA);
      else if (head === 'pen') S = setPen(S, { [tail]: v });
      else S = setField(S, k, String(v), DATA);
      key ??= k;
    }
  } else if (fix.clear) {
    const fields = Object.keys(S.real[fix.clear]);
    for (const field of fields) S = setReal(S, fix.clear, field, '', DATA);
    key = `${fix.clear}.${fields[0]}`;
  } else if (fix.reset === 'retExp') {
    S = resetRetExp(S, DATA);
    key = 'retExp';
  } else if (fix.unsplit) {
    S = unsplit(S, DATA);
    key = 'expense';
  }
  if (key === null) return;
  lastField = key;
  // The new value is written before the field takes the cursor: a focused field is never written over.
  syncInputs();
  syncLifeInputs();
  refresh({ commit: true });
  renderPen();
  fieldEl(key)?.focus();
}

// The stopped result: — 岁放假, the chip naming stops, frames for marks (the stops shown, by default all of them).
// Nothing is worked out from the numbers. The form is drawn once per set of numbers, so a second call for the same numbers (a change, then a
// focusout) never swaps an element under the pointer.
let heldState = null;
let stickyNow = '';
function holdResult(stops, marks = stops) {
  cancelAnimationFrame(frame);
  clearTimeout(mcTimer);
  clearTimeout(proTimer);
  stale = true;
  const numbers = JSON.stringify({ ...S, lastValid: null });
  if (heldState !== numbers || !isHeld()) {
    heldState = numbers;
    const p = toParams(S, DATA);
    syncChrome(p);
    syncInputs();
    renderPen();
    renderLife(p, { solve: false });
    renderEstimate(p);
    document.body.classList.add('result-held');
    // Hidden while stopped; emptied too, so no age from the numbers before is left in the page.
    $('type-now').innerHTML = '';
    $('tiles').innerHTML = '';
    $('hero').innerHTML = heldHeroHtml(ledgerOpen);
    $('ledger-row').innerHTML = proLedgerRowHtml({ held: true, open: ledgerOpen });
    placeTag();
    const head = heldHeadHtml(S.view);
    $('headline').innerHTML = head;
    $('headline').hidden = !head;
    renderOpenCards(p);
  }
  const sticky = stickyHtml(null, { pro: S.view === 'pro', chip: chipText(stops) });
  if (sticky !== stickyNow) {
    stickyNow = sticky;
    $('sticky-result').innerHTML = sticky;
  }
  markProblems(marks);
  renderLedger();
}

// Puts the cursor in a field: the professional view first if only it has the field, then the numbers opened, every
// fold around the field opened, the field in the middle of the screen.
function goToField(key) {
  if (S.view === 'simple' && !fieldEl(key, 'simple') && fieldEl(key, 'pro')) {
    S = { ...S, view: 'pro' };
    refresh({ commit: true });
    syncChrome(toParams(S, DATA));
  }
  const el = fieldEl(key);
  if (!el) return;
  $('inputs-box').open = true;
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
  el.scrollIntoView({ block: 'center' });
  el.focus();
}

// Before anything goes on from the result: with a blank or a block, every stop is marked, the result holds and the
// cursor goes to the first blank, else the first block. False when there is none.
function stopAtProblem() {
  const stops = stopsNow();
  if (!stops.length) return false;
  refresh({ commit: true });
  goToField((stops.find(q => q.kind === 'blank') ?? stops[0]).field);
  return true;
}

// A field was left: its rules are judged now, or, while a press is still down, right after it ends.
let pressing = false;
let judgeAfterPress = false;
function judgeLeft() {
  judgeAfterPress = pressing;
  if (pressing) return;
  refresh({ commit: true });
  renderPen();
}

// commit: the person left a field, pressed a button or jumped. Until then a new stop that rests only on the field
// being typed in waits, and the result stays as it was, not recomputed.
function refresh({ commit = false } = {}) {
  // Saved at once, so a reload straight after typing keeps what was typed.
  saveState(S, storage);
  const stops = stopsNow();
  const typing = commit ? null : fieldKeyOf(document.activeElement);
  const held = typing === null ? [] : stops.filter(q => !shown.has(q.id) && restsOn(q, typing));
  const live = stops.filter(q => !held.includes(q));
  if (live.length) {
    shown = new Set(live.map(q => q.id));
    holdResult(live);
    return;
  }
  if (held.length) {
    // Nothing is recomputed with the half-typed number; a mark whose stop was fixed goes at once.
    cancelAnimationFrame(frame);
    clearTimeout(mcTimer);
    clearTimeout(proTimer);
    stale = true;
    // Already stopped, the chip names what is wrong now, never a stop just fixed; only the shown stops keep marks.
    shown = new Set([...shown].filter(id => stops.some(q => q.id === id)));
    const still = stops.filter(q => shown.has(q.id));
    if (isHeld()) holdResult([...still, ...held], still);
    else markProblems([]);
    return;
  }
  shown.clear();
  markProblems([]);
  stale = true;
  updateCard();
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    heldState = null;
    document.body.classList.remove('result-held');
    renderFast();
    renderOpenCards(latest.p);
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

function onInput(ev) {
  const el = ev.target;
  if (el.closest?.('.pen')) {
    const short = /^pen-[sp]-(\w+)$/.exec(el.id)?.[1];
    const key = PEN_INPUTS.find(row => row[1] === short)?.[0];
    if (!key) return;
    S = setPen(S, { [key]: el.value });
    saveState(S, storage);
    renderLines();
    renderPen();
    return;
  }
  if (el.closest?.('#life-fold')) {
    const row = LIFE_INPUTS.find(r => r[0] === el.id);
    if (!row) return;
    labValues = {};
    S = setReal(S, row[1], row[2], el.value, DATA);
    saveState(S, storage);
    refresh();
    return;
  }
  const part = /^(?:p-)?split-(rent|food|other)$/.exec(el.id)?.[1];
  if (part) {
    labValues = {};
    S = setSplit(S, part, el.value, DATA);
    countCalculation();
    // The total and its line follow every keystroke, also while a stop on the parts waits for the field to be left.
    syncSplit();
    refresh();
    return;
  }
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
      // While the result is stopped there are no lives to write into; the value waits for the next result.
      if (isHeld()) return;
      updateCard();
      renderLives();
      focusFifth();
    }
    return;
  }
  if (el.id === 'town-name' || el.id === 'town-monthly') {
    S = setTown(S, el.id === 'town-name' ? { name: el.value } : { monthly: el.value });
    saveState(S, storage);
    renderLines();
    if (latest?.p && !isHeld()) renderTown();
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
  const achieved = goal && goalApplies(goal, p) && compareVisit(goal, p, today()).achieved;
  const ribbons = lives.map((life, i) => ({ label: (latest.names ?? lifeNames(stories))[i], base: fifth?.baseIndex === i, cells: lifeRibbon(life).map(c => c.state) }));
  if (fifth) ribbons.push({ label: '改签后', fifth: true, cells: lifeRibbon(fifth.path).map(c => c.state) });
  return {
    mode, type, hero, ribbons,
    issued: latest.dataVersion,
    years: latest.mc?.bands?.map(b => b[2]) ?? [],
    enough: latest.odds?.enough ?? bwd.s0 <= 0,
    monthlyText: wholeMoney(toDisplay((latest.odds?.s0 ?? Math.max(bwd.s0, 0)) / 12, p, cur), cur),
    place: cardPlace(places, S.town, latest.town),
    fifth: fifth && fifthBrief(fifth.base, fifth.story, latestMoney()) ? { ...fifthBrief(fifth.base, fifth.story, latestMoney()), baseName: (latest.names ?? lifeNames(stories))[fifth.baseIndex] } : null,
    // A spending goal is an amount, so a card without money says it was met without the number.
    goal: achieved ? { label: goal.label, plain: goal.paramId === 'expense' ? '每月支出降到了目标' : goal.label } : null,
    lever: personalLever(rankLevers(p, DATA, { retC: S.retC, top: 6 }), p, v => money(Math.round(toDisplay(v, p, cur)), cur)),
    // Forward, the age is the 8-in-10 age; working backward, the card says the odds of the plan as it is.
    odds: !hero.reachable ? '' : mode === 'bwd' ? oddsText(hero.success) : '八成把握',
    assumptions: assumptionLine({ r: p.r, pension: p.pension, selfPay: p.selfPay, events: p.events }),
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

// A pending simulation would put a stale success rate on the card, so finish it first. With a blank or a block
// nothing is worked out, and false says so. Results already up to date are reused.
function flushSimulation() {
  if (stopsNow().length) return false;
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
  // The chip, and the links that lead to what the result says, go to the problem instead.
  if (ev.target.closest?.('[data-chip]')) {
    stopAtProblem();
    return;
  }
  if (ev.target.closest?.('[data-needs-result]') && stopAtProblem()) {
    ev.preventDefault();
    return;
  }
  if (ev.target.closest?.('#nav-numbers')) {
    ev.preventDefault();
    goToNumbers();
    return;
  }
  // The ledger opens and closes in place; the toggle keeps the focus. Opening finishes a pending simulation first.
  const ledgerToggle = ev.target.closest?.('.ledger-toggle');
  if (ledgerToggle) {
    const focused = document.activeElement === ledgerToggle;
    const home = ledgerToggle.closest('#ledger-row') ? '#ledger-row' : '#hero';
    ledgerOpen = !ledgerOpen;
    if (ledgerOpen && !isHeld()) flushSimulation();
    renderLedger();
    // A finished simulation redraws the line, so the focus goes to the new toggle in the same place.
    if (focused) document.querySelector(`${home} .ledger-toggle`)?.focus();
    return;
  }
  // A ledger row's label goes back to its field.
  const ledgerField = ev.target.closest?.('#ledger [data-field]');
  if (ledgerField) {
    goToField(ledgerField.dataset.field);
    return;
  }
  if (ev.target.closest?.('.grp-plus')) {
    goToField('pension');
    return;
  }
  const fixButton = ev.target.closest?.('[data-fix]');
  if (fixButton) {
    applyFix(JSON.parse(fixButton.dataset.fix));
    return;
  }
  if (ev.target.closest?.('#life-tag')) {
    $('inputs-box').open = true;
    $('life-fold').open = true;
    $('life-fold').scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  // 只填总数: the parts go, spending is the total from before the split again and takes the cursor.
  if (ev.target.closest?.('[data-unsplit]')) {
    labValues = {};
    S = unsplit(S, DATA);
    countCalculation();
    syncSplit();
    refresh({ commit: true });
    fieldEl('expense').focus();
    return;
  }
  if (ev.target.id === 'split-life') {
    $('inputs-box').open = true;
    $('life-fold').open = true;
    $('life-mortgage').focus();
    return;
  }
  if (ev.target.closest?.('[data-pen-use]')) {
    if (problems(S, DATA).some(q => q.rule === 'B15')) {
      goToField('pen.years');
      return;
    }
    const est = penEstimate();
    if (!est?.est.eligible) return;
    S = applyPensionEstimate(S, { monthly: est.est.monthly, claimAge: est.claimAge, selfPay: est.selfPay }, DATA);
    labValues = {};
    countCalculation();
    refresh();
    return;
  }
  if (ev.target.id === 'export-csv' || ev.target.id === 'export-json') {
    if (stopAtProblem()) return;
    track('export_data');
    flushSimulation();
    if (ev.target.id === 'export-csv') download('fire-age.csv', 'text/csv;charset=utf-8', toCsv(latest));
    else download('fire-age.json', 'application/json', toJson(latest));
    return;
  }
  if (ev.target.id === 'share-btn') {
    if (stopAtProblem()) return;
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
    if (stopAtProblem()) return;
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
    if (stopAtProblem()) return;
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
      $('share-options').classList.toggle('type-only', document.querySelector('input[name="card-kind"]:checked')?.value === 'type');
      if (!$('share-panel').hidden && flushSimulation()) showCard(cardSpec(), { scroll: false });
      return;
    }
    const key = fieldKeyOf(ev.target);
    if (key) lastField = key;
    // The pension estimate and the town stop only themselves; leaving one of their fields shows that stop.
    if (ev.target.closest?.('.pen') || ev.target.closest?.('.town-row')) {
      judgeLeft();
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
    // Leaving a field is when its rules are judged.
    if (key && (isHeld() || stopsNow().some(q => !shown.has(q.id)))) judgeLeft();
  });
  // A field left by pressing on a button is judged once the press ends, so the stopped result does not hide or move
  // the button (生成放假卡, 导出) away from under the pointer before its click; the click then goes to the problem.
  window.addEventListener('pointerdown', () => { pressing = true; }, true);
  for (const type of ['pointerup', 'pointercancel']) {
    window.addEventListener(type, () => {
      pressing = false;
      if (judgeAfterPress) setTimeout(judgeLeft);
    }, true);
  }
  document.addEventListener('click', onClick);
  // A folded chart has no width to draw in, so the lives are drawn again when their section opens.
  $('lives-fold').addEventListener('toggle', () => { if ($('lives-fold').open && latest && !isHeld()) renderLives(); });
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
    resizeTimer = setTimeout(() => { if (latest?.mc && !isHeld()) renderSimulation(); }, 120);
  });
  // A locked total is not typed in: the cursor goes to the first part, where the total comes from, its fold opened.
  document.addEventListener('focusin', ev => {
    if (!splitOn(S) || (ev.target.id !== 's-expense' && ev.target.id !== 'p-expense')) return;
    const first = fieldEl('split.rent', ev.target.id === 'p-expense' ? 'pro' : 'simple');
    first.closest('details').open = true;
    first.focus();
  });
  // Leaving a field with a stop not yet shown (one that waited while it was typed) shows it.
  document.addEventListener('focusout', ev => {
    if (fieldKeyOf(ev.target) && stopsNow().some(q => !shown.has(q.id))) judgeLeft();
  });
  // Numbers saved with a blank or a broken rule open stopped, every mark shown.
  const stops = stopsNow();
  if (stops.length) {
    shown = new Set(stops.map(q => q.id));
    holdResult(stops);
  } else {
    renderFast();
    renderSimulation();
  }
  initAnalytics(location.href, DATA.version);
  track('visit');
}

init();

export const currentResult = () => latest;
