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
// A birth month typed by hand as "1996-6" reads as "1996-06".
const cleanBirth = v => {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{1,2})$/.exec(v.trim()) : null;
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
};
export function cleanPen(raw) {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const index = penNum(t.index);
  const base = penNum(t.base);
  return {
    birth: cleanBirth(t.birth),
    kind: PEN_KINDS.includes(t.kind) ? t.kind : 'm',
    paidYears: penNum(t.paidYears, 60),
    years: penNum(t.years, 60),
    account: penNum(t.account),
    base: base > 0 ? base : null,
    index: index === null ? 1 : Math.min(Math.max(index, 0.6), 3),
  };
}

// Spending that ends at a known age, already inside the monthly spending: a mortgage (monthly payment, last year)
// and children (how many, the youngest's age, monthly cost each). Any item may be blank.
export const REAL_DEFAULT = { mortgage: { monthly: null, endYear: null }, kids: { count: null, age: null, monthly: null } };
const realNum = v => {
  if (v === null || v === undefined || typeof v === 'boolean' || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const group = (raw, keys) => {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(keys.map(k => [k, realNum(t[k])]));
};
export function cleanReal(raw) {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { mortgage: group(t.mortgage, ['monthly', 'endYear']), kids: group(t.kids, ['count', 'age', 'monthly']) };
}
// The automatic retirement spending holds the items at their own value, so with data it is estimated again.
export function setReal(S, part, field, rawText, data = null) {
  const next = { ...S, real: cleanReal({ ...S.real, [part]: { ...S.real?.[part], [field]: rawText } }) };
  if (data && !S.touched?.retExp) next.retExp = Math.round(estimateRetireSpend(next.expense ?? 0, next.workC, next.retC, data, itemsYearly(next)));
  return next;
}

// Yearly amounts of the two items, or null while an item is not filled in.
function realItems(S) {
  const { mortgage: m, kids: k } = cleanReal(S.real);
  return {
    mortgage: m.monthly > 0 && m.endYear !== null ? { yearly: m.monthly * 12, endYear: m.endYear } : null,
    kids: k.count > 0 && k.monthly > 0 && k.age !== null ? { yearly: k.count * k.monthly * 12, age: k.age } : null,
  };
}

// The payments are in the work currency; retExp is in the retirement currency, so it is converted before comparing.
export function lifeIssue(S, data) {
  const { mortgage, kids } = realItems(S);
  const monthly = ((mortgage?.yearly ?? 0) + (kids?.yearly ?? 0)) / 12;
  if (monthly <= 0) return '';
  if (monthly > (S.expense ?? 0) / 12) return '月供和孩子的花销加起来超过了每月支出，请检查这两处';
  const retW = convert(S.retExp ?? 0, curOf(data, S.retC), curOf(data, S.workC), data);
  if (monthly > retW / 12) return '退休后每月想花里也要算上月供和孩子的花销';
  return '';
}

// "Until year Y" means the payments continue through year Y, so they stop at the start of the year after.
export function eventsOf(S, data, thisYear = new Date().getFullYear()) {
  return lifeIssue(S, data) ? [] : itemEvents(S, thisYear);
}

function itemEvents(S, thisYear) {
  const { mortgage, kids } = realItems(S);
  const out = [];
  if (mortgage) out.push({ id: 'mortgage', amount: mortgage.yearly, endAge: Math.round(S.age) + (mortgage.endYear - thisYear) + 1, nominal: true });
  if (kids) out.push({ id: 'kids', amount: kids.yearly, endAge: Math.round(S.age) + (22 - kids.age), nominal: false });
  return out.filter(e => e.endAge > S.age);
}

// The yearly amount (work currency) of the items still running, as the automatic estimate holds them apart.
// Items larger than the whole spending are dropped by the model, so the estimate does not hold them apart either.
export function itemsYearly(S, thisYear = new Date().getFullYear()) {
  const sum = itemEvents(S, thisYear).reduce((total, e) => total + e.amount, 0);
  return sum > (S.expense ?? 0) ? 0 : sum;
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
    autoSwr: true, touched: {}, notice: '', town: { name: '', monthly: null }, pen: { ...PEN_DEFAULT }, real: cleanReal(null),
    ...values,
    lastValid: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)),
  };
}

// Spending that follows local prices is scaled by the price ratio; the items (a mortgage, children; yearly, work
// currency) stay what they are and move at the market rate, so the amount removed when one ends is the amount held.
export function estimateRetireSpend(annualExpense, workC, retC, data, items = 0) {
  if (workC === retC) return annualExpense;
  const ratio = data.countries[retC].priceLevel.value / data.countries[workC].priceLevel.value;
  const from = curOf(data, workC), to = curOf(data, retC);
  return convert(Math.max(annualExpense - items, 0), from, to, data) * ratio + convert(items, from, to, data);
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
    next.retExp = data ? Math.round(estimateRetireSpend(spent, S.workC, S.retC, data, itemsYearly(next))) : spent;
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
  // The payments are work-currency money, like the other work-currency fields.
  const r = cleanReal(S.real);
  const conv = v => (v === null ? null : Math.round(convert(v, from, to, data)));
  moved.real = { mortgage: { ...r.mortgage, monthly: conv(r.mortgage.monthly) }, kids: { ...r.kids, monthly: conv(r.kids.monthly) } };
  if (!S.touched.retExp) moved.retExp = Math.round(estimateRetireSpend(moved.expense ?? 0, code, S.retC, data, itemsYearly(moved)));
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
    moved.retExp = Math.round(estimateRetireSpend(S.expense ?? 0, S.workC, code, data, itemsYearly(S)));
  }
  return moved;
}

export function toParams(S, data, thisYear = new Date().getFullYear()) {
  const raw = { autoSwr: S.autoSwr, wCur: curOf(data, S.workC), rCur: curOf(data, S.retC) };
  for (const id of NUMERIC_FIELDS) {
    raw[id] = S[id] ?? (MONEY_FIELDS.includes(id) ? 0 : S.lastValid[id]);
  }
  const fx = { USD: 1 };
  for (const [cur, field] of Object.entries(data.fx)) fx[cur] = field.value;
  // Self-paid pension and medical insurance (monthly inputs) only count in mainland China with a pension on file.
  // A saved value that is not a number counts as 0.
  const own = v => (Number.isFinite(Number(v)) ? Math.max(Number(v), 0) : 0);
  raw.selfPension = own(raw.selfPension);
  raw.selfMedical = own(raw.selfMedical);
  raw.selfPay = S.workC === 'CN' && raw.pension > 0 ? (raw.selfPension + raw.selfMedical) * 12 : 0;
  raw.events = eventsOf(S, data, thisYear);
  return buildParams(raw, fx);
}

export const TOWN_NAME_MAX = 6;
const cleanTown = t => {
  const raw = t && typeof t === 'object' && !Array.isArray(t) ? t : {};
  const monthly = Number(raw.monthly);
  return {
    name: typeof raw.name === 'string' ? [...raw.name.trim()].slice(0, TOWN_NAME_MAX).join('') : '',
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
    return { ...base, ...saved, ...fresh, town: cleanTown(saved.town), pen: cleanPen(saved.pen), real: cleanReal(saved.real), dispCur: dispOk ? saved.dispCur : base.dispCur, lastValid: { ...base.lastValid, ...saved.lastValid, ...fresh }, touched };
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

