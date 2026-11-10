// Input state for the calculator: what the person typed, before it becomes model parameters.
import { buildParams, longRunInflation } from './engine.js';

const STORAGE_KEY = 'fire-age-v1';
const MONEY_FIELDS = ['assets', 'income', 'expense', 'retExp', 'pension', 'selfPension', 'selfMedical'];
const ASSUMPTION_FIELDS = ['infl', 'bondY', 'drag', 'pAge'];
const NUMERIC_FIELDS = [...MONEY_FIELDS, 'selfPension', 'selfMedical', 'age', 'growth', 'life', 'pAge', 'tAge', 'eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr', 'sigEq', 'sigBd', 'rho', 'flexCut'];

// What the pension estimate asks for. Numbers may be blank; index defaults to 1 and stays between 0.6 and 3.
export const PEN_DEFAULT = { birth: '', kind: 'm', paidYears: null, years: null, account: null, base: null, index: 1 };
const PEN_KINDS = ['m', 'f55', 'f50'];
const penNum = (v, max = Infinity) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : null;
};
export function cleanPen(raw) {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const index = penNum(t.index);
  const base = penNum(t.base);
  return {
    birth: typeof t.birth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(t.birth) ? t.birth : '',
    kind: PEN_KINDS.includes(t.kind) ? t.kind : 'm',
    paidYears: penNum(t.paidYears, 60),
    years: penNum(t.years, 60),
    account: penNum(t.account),
    base: base > 0 ? base : null,
    index: index === null ? 1 : Math.min(Math.max(index, 0.6), 3),
  };
}

export const setPen = (S, change) => ({ ...S, pen: cleanPen({ ...S.pen, ...change }) });

// "Use this result": the monthly estimate (yuan, today's money) becomes the yearly pension in the retirement
// currency, the whole-year claim age becomes the pension age, and self-paid insurance gets its default if blank.
export function applyPensionEstimate(S, { monthly, claimAge, selfPay }, data) {
  const pension = Math.round(convert(monthly * 12, curOf(data, 'CN'), curOf(data, S.retC), data));
  const next = { ...S, pension, pAge: claimAge, touched: { ...S.touched, pAge: true }, lastValid: { ...S.lastValid, pension, pAge: claimAge } };
  if (S.selfPension === null || S.selfPension === undefined) {
    next.selfPension = Math.round(selfPay);
    next.lastValid.selfPension = next.selfPension;
  }
  return next;
}

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
    // Example numbers at an ordinary level, labelled as examples on the page: take-home ¥12,000 a month,
    // spending ¥6,000, ¥200,000 saved.
    age: 30, assets: 200000, income: 144000, expense: 72000, growth: 2,
    retExp: 72000, life: 95, pension: null, tAge: 45, selfPension: null, selfMedical: null,
    eq: 60, eqReal: 5, fxDrift: 0, swr: 3.9,
    sigEq: 0.17, sigBd: 0.06, rho: 0.2, flexCut: 0,
    ...localAssumptions(data.countries.CN),
  };
  return {
    view: 'simple', mode: 'fwd', workC: 'CN', retC: 'CN', dispCur: 'CNY',
    autoSwr: true, touched: {}, notice: '', town: { name: '', monthly: null }, pen: { ...PEN_DEFAULT },
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

// The numbers a result rests on. Left blank, they would quietly count as zero or as an old value, so the
// result waits for them instead. A pension may stay blank; the age to holiday at matters only working backward.
const REQUIRED_FIELDS = ['age', 'assets', 'income', 'expense', 'retExp'];
export function missingFields(S) {
  const ids = S.mode === 'bwd' ? [...REQUIRED_FIELDS, 'tAge'] : REQUIRED_FIELDS;
  return ids.filter(id => S[id] === null || S[id] === undefined);
}

export const commitField =(S, id) => (S[id] === null || S[id] === undefined ? S : { ...S, lastValid: { ...S.lastValid, [id]: S[id] } });

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
  // Self-paid pension and medical insurance (monthly inputs) only count in mainland China with a pension on file.
  raw.selfPension = Math.max(raw.selfPension, 0);
  raw.selfMedical = Math.max(raw.selfMedical, 0);
  raw.selfPay = S.workC === 'CN' && raw.pension > 0 ? (raw.selfPension + raw.selfMedical) * 12 : 0;
  return buildParams(raw, fx);
}

export const TOWN_NAME_MAX = 6;
const cleanTown = t => {
  const raw = t && typeof t === 'object' && !Array.isArray(t) ? t : {};
  const monthly = Number(raw.monthly);
  return {
    name: typeof raw.name === 'string' ? [...raw.name].slice(0, TOWN_NAME_MAX).join('') : '',
    monthly: raw.monthly !== null && raw.monthly !== '' && Number.isFinite(monthly) && monthly > 0 ? monthly : null,
  };
};

// A town the person types: a name of at most six characters and a monthly spend in the retirement currency.
export function setTown(S, change) {
  return { ...S, town: cleanTown({ ...S.town, ...change }) };
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
    return { ...base, ...saved, ...fresh, town: cleanTown(saved.town), pen: cleanPen(saved.pen), dispCur: dispOk ? saved.dispCur : base.dispCur, lastValid: { ...base.lastValid, ...saved.lastValid, ...fresh }, touched };
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

