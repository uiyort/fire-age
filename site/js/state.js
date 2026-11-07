// Input state for the calculator: what the person typed, before it becomes model parameters.
import { buildParams, longRunInflation } from './engine.js';

const STORAGE_KEY = 'fire-age-v1';
const MONEY_FIELDS = ['assets', 'income', 'expense', 'retExp', 'pension'];
const ASSUMPTION_FIELDS = ['infl', 'bondY', 'drag', 'pAge'];
const NUMERIC_FIELDS = [...MONEY_FIELDS, 'age', 'growth', 'life', 'pAge', 'tAge', 'eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr', 'sigEq', 'sigBd', 'rho', 'flexCut'];

const fxOf = (data, cur) => (cur === 'USD' ? 1 : data.fx[cur].value);
const curOf = (data, code) => data.countries[code].cur;
const convert = (v, fromCur, toCur, data) => v / fxOf(data, fromCur) * fxOf(data, toCur);

function localAssumptions(country) {
  return {
    infl: longRunInflation(country.cpi.value, country.target.value),
    bondY: country.y10.value,
    drag: country.drag.value,
    pAge: country.pAge.value,
  };
}

export function defaultState(data) {
  const values = {
    age: 30, assets: 500000, income: 300000, expense: 120000, growth: 2,
    retExp: 120000, life: 95, pension: null, tAge: 45,
    eq: 60, eqReal: 5, fxDrift: 0, swr: 3.9,
    sigEq: 0.17, sigBd: 0.06, rho: 0.2, flexCut: 0,
    ...localAssumptions(data.countries.CN),
  };
  return {
    view: 'simple', mode: 'fwd', workC: 'CN', retC: 'CN', dispCur: 'CNY',
    autoSwr: true, touched: {}, notice: '',
    ...values,
    lastValid: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)),
  };
}

export function estimateRetireSpend(annualExpense, workC, retC, data) {
  if (workC === retC) return annualExpense;
  const ratio = data.countries[retC].priceLevel.value / data.countries[workC].priceLevel.value;
  return convert(annualExpense, curOf(data, workC), curOf(data, retC), data) * ratio;
}

// commit: false is for values still being typed, which must not become the fallback for a blank field.
export function setField(S, id, rawText, data, { commit = true } = {}) {
  const text = String(rawText).trim();
  const parsed = text === '' ? NaN : Number(text);
  const value = Number.isFinite(parsed) ? parsed : null;
  const next = { ...S, [id]: value, lastValid: value === null || !commit ? S.lastValid : { ...S.lastValid, [id]: value } };
  if (ASSUMPTION_FIELDS.includes(id)) next.touched = { ...S.touched, [id]: true };
  if (id === 'retExp') return { ...next, touched: { ...S.touched, retExp: true }, notice: '' };
  if (id === 'expense' && !S.touched.retExp) {
    const spent = value ?? 0;
    next.retExp = data ? Math.round(estimateRetireSpend(spent, S.workC, S.retC, data)) : spent;
  }
  return next;
}

export const commitField = (S, id) => (S[id] === null || S[id] === undefined ? S : { ...S, lastValid: { ...S.lastValid, [id]: S[id] } });

export function setWorkCountry(S, code, data) {
  const country = data.countries[code];
  if (!country?.roles.includes('work')) return S;
  const from = curOf(data, S.workC), to = country.cur;
  const moved = { ...S, workC: code, ...localAssumptions(country) };
  for (const id of ['assets', 'income', 'expense']) {
    if (S[id] !== null) moved[id] = Math.round(convert(S[id], from, to, data));
  }
  if (!S.touched.retExp) moved.retExp = Math.round(estimateRetireSpend(moved.expense ?? 0, code, S.retC, data));
  moved.lastValid = { ...S.lastValid, ...localAssumptions(country) };
  moved.touched = Object.fromEntries(Object.entries(S.touched).filter(([id]) => !ASSUMPTION_FIELDS.includes(id)));
  return moved;
}

export function setRetireCountry(S, code, data) {
  if (!data.countries[code]) return S;
  const moved = { ...S, retC: code, notice: '' };
  if (S.pension !== null) moved.pension = Math.round(convert(S.pension, curOf(data, S.retC), curOf(data, code), data));
  if (S.touched.retExp) {
    moved.notice = `退休地已改为${data.countries[code].name}，你手动填写的退休支出没有变，请按当地货币和花费调整。`;
  } else {
    moved.retExp = Math.round(estimateRetireSpend(S.expense ?? 0, S.workC, code, data));
  }
  return moved;
}

export function toParams(S, data) {
  const raw = { autoSwr: S.autoSwr, wCur: curOf(data, S.workC), rCur: curOf(data, S.retC) };
  for (const id of NUMERIC_FIELDS) {
    raw[id] = S[id] ?? (MONEY_FIELDS.includes(id) ? 0 : S.lastValid[id]);
  }
  const fx = { USD: 1 };
  for (const [cur, field] of Object.entries(data.fx)) fx[cur] = field.value;
  return buildParams(raw, fx);
}

export function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadState(data, storage) {
  const base = defaultState(data);
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!saved || !data.countries[saved.workC]?.roles.includes('work') || !data.countries[saved.retC]) return base;
    const dispOk = saved.dispCur === 'USD' || data.fx[saved.dispCur];
    const touched = saved.touched ?? {};
    // Assumptions nobody edited follow the current month's data rather than the saved copy.
    const local = localAssumptions(data.countries[saved.workC]);
    const fresh = Object.fromEntries(ASSUMPTION_FIELDS.filter(id => !touched[id]).map(id => [id, local[id]]));
    return { ...base, ...saved, ...fresh, dispCur: dispOk ? saved.dispCur : base.dispCur, lastValid: { ...base.lastValid, ...saved.lastValid, ...fresh }, touched };
  } catch {
    return base;
  }
}

export function saveState(S, storage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch {
    // Storage is a convenience; the calculator works without it.
  }
}

const PRO_KEY = 'fire-age-pro-v1';

export function isProUnlocked(storage) {
  try {
    return storage.getItem(PRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockPro(storage) {
  try {
    storage.setItem(PRO_KEY, '1');
  } catch {
    // Without storage the view stays open for this visit only.
  }
}
