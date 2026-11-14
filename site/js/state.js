// Input state for the calculator: what the person typed, before it becomes model parameters.
import { buildParams, firstDraw, longRunInflation, planFlows, savingsAt } from './engine.js';

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
// and children (how many, the youngest's age, monthly cost each). Any item may be blank. Any finite number is kept,
// negatives and fractions too, so problems() can stop them instead of letting them vanish.
export const REAL_DEFAULT = { mortgage: { monthly: null, endYear: null }, kids: { count: null, age: null, monthly: null } };
const realNum = v => {
  if (v === null || v === undefined || typeof v === 'boolean' || typeof v === 'object' || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  if (data && !S.touched?.retExp) next.retExp = Math.round(estimateRetireSpend(Math.max(next.expense ?? 0, 0), next.workC, next.retC, data, itemsYearly(next)));
  return next;
}

// Yearly amounts of the two items, or null while an item is not filled in or not valid: a mortgage needs a payment
// above 0 and a whole end year from 50 years back to 40 ahead; children need a whole count of at least 1, a whole
// age of at least 0 and a cost above 0. Whether an item has already ended is left to itemEvents.
const mortgageValid = (m, thisYear) => m.monthly > 0 && Number.isInteger(m.endYear)
  && m.endYear >= thisYear - LIMITS.endYearBack && m.endYear <= thisYear + LIMITS.endYearAhead;
const kidsValid = k => Number.isInteger(k.count) && k.count >= 1 && Number.isInteger(k.age) && k.age >= 0 && k.monthly > 0;
function realItems(S, thisYear = new Date().getFullYear()) {
  const { mortgage: m, kids: k } = cleanReal(S.real);
  return {
    mortgage: mortgageValid(m, thisYear) ? { yearly: m.monthly * 12, endYear: m.endYear } : null,
    kids: kidsValid(k) ? { yearly: k.count * k.monthly * 12, age: k.age } : null,
  };
}

// "Until year Y" means the payments continue through year Y, so they stop at the start of the year after.
// problems() stops the result before items that do not fit reach the model (A3, A4); dropping them here is only a
// backstop, on the same edges: items at or above the spending, or at or above the retirement spending.
export function eventsOf(S, data, thisYear = new Date().getFullYear()) {
  const events = itemEvents(S, thisYear);
  const yearly = events.reduce((total, e) => total + e.amount, 0);
  if (yearly <= 0) return events;
  if (yearly >= (S.expense ?? 0)) return [];
  if (convert(yearly, curOf(data, S.workC), curOf(data, S.retC), data) >= (S.retExp ?? 0)) return [];
  return events;
}

// The valid items that have not ended: a mortgage paid through this year or later, children up to 21.
function itemEvents(S, thisYear) {
  const { mortgage, kids } = realItems(S, thisYear);
  const out = [];
  if (mortgage && mortgage.endYear >= thisYear) out.push({ id: 'mortgage', amount: mortgage.yearly, endAge: Math.round(S.age) + (mortgage.endYear - thisYear) + 1, nominal: true });
  if (kids && kids.age < KIDS_END) out.push({ id: 'kids', amount: kids.yearly, endAge: Math.round(S.age) + (KIDS_END - kids.age), nominal: false });
  return out.filter(e => e.endAge > S.age);
}
const KIDS_END = 22;

// The yearly amount (work currency) of the items still running, as the automatic estimate holds them apart.
// Items at or above the whole spending are stopped (A3), so the estimate does not hold them apart either.
export function itemsYearly(S, thisYear = new Date().getFullYear()) {
  const sum = itemEvents(S, thisYear).reduce((total, e) => total + e.amount, 0);
  return sum >= (S.expense ?? 0) ? 0 : sum;
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
const convert = (v, fromCur, toCur, data) => (fromCur === toCur ? v : v / fxOf(data, fromCur) * fxOf(data, toCur));

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
    autoSwr: true, touched: {}, notice: '', town: { name: '', monthly: null }, pen: { ...PEN_DEFAULT }, real: cleanReal(null), split: cleanSplit(null),
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
  // Spending set directly (a slider brought in, an exit) leaves the split first, as 只填总数 would.
  if (id === 'expense' && splitOn(S)) S = unsplit(S, data);
  const text = String(rawText).trim();
  const parsed = text === '' ? NaN : Number(text);
  const value = Number.isFinite(parsed) ? parsed : null;
  const next = { ...S, [id]: value, lastValid: value === null || !commit ? S.lastValid : { ...S.lastValid, [id]: value } };
  if (ASSUMPTION_FIELDS.includes(id)) next.touched = { ...S.touched, [id]: true };
  if (id === 'retExp') return { ...next, touched: { ...S.touched, retExp: true }, notice: '' };
  if (id === 'expense' && !S.touched.retExp) {
    // A negative spending (stopped by B2) estimates from 0, so the stop stays on spending alone, as the split does.
    const spent = Math.max(value ?? 0, 0);
    next.retExp = data ? Math.round(estimateRetireSpend(spent, S.workC, S.retC, data, itemsYearly(next))) : spent;
  }
  return next;
}

// The numbers a result rests on. Left blank, they would quietly count as zero or as an old value, so the
// result waits for them instead. A pension may stay blank; the age to holiday at matters only working backward.
const REQUIRED_FIELDS = ['age', 'assets', 'income', 'expense', 'retExp'];
export function missingFields(S) {
  const ids = S.mode === 'bwd' ? [...REQUIRED_FIELDS, 'tAge'] : REQUIRED_FIELDS;
  const missing = ids.filter(id => S[id] === null || S[id] === undefined);
  // Typed retirement spending of 0 waits like a blank; the estimate being 0 (spending 0) is the spending's own stop.
  if (S.retExp === 0 && S.touched?.retExp) missing.push('retExp');
  return missing;
}

// ---- The relations between the numbers: one list that the chip, the frames, the group counts, the lines under the
// fields, the sidebar and the ledger all read from. The page never judges a relation itself.

const SPLIT_PARTS = ['rent', 'food', 'other'];
const SPLIT_KEYS = SPLIT_PARTS.map(k => `split.${k}`);
const ITEM_KEYS = ['mortgage.monthly', 'mortgage.endYear', 'kids.count', 'kids.age', 'kids.monthly'];
const PRO_ONLY = ['growth', 'life', 'pAge', 'eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr', 'sigEq', 'sigBd', 'rho', 'flexCut'];
const PRO_ORDER = ['age', 'assets', 'income', 'growth', 'expense', ...SPLIT_KEYS, ...ITEM_KEYS, 'retExp', 'life', 'pension', 'pAge',
  'selfPension', 'selfMedical', 'pen.years', 'tAge', 'eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr', 'sigEq', 'sigBd', 'rho', 'flexCut'];
// Page order of every field a rule can point at. The simple view lists the professional-only fields after its own;
// the town's spend sits in the result area, after the form.
export const FIELD_ORDER = {
  simple: ['age', 'assets', 'income', 'expense', ...SPLIT_KEYS, ...ITEM_KEYS, 'pension', 'selfPension', 'selfMedical', 'pen.years', 'tAge', 'retExp',
    ...PRO_ORDER.filter(k => PRO_ONLY.includes(k)), 'town.monthly'],
  pro: [...PRO_ORDER, 'town.monthly'],
};

const ROWS = {
  simple: {
    tage: ['tAge'], now: ['age', 'assets', 'income'], spend: ['expense', ...SPLIT_KEYS, ...ITEM_KEYS], where: [],
    pension: ['pension', 'selfPension', 'selfMedical', 'pen.years'], retire: ['retExp'],
  },
  pro: {
    region: [], now: ['age', 'assets', 'income', 'growth'], spend: ['expense', ...SPLIT_KEYS, ...ITEM_KEYS],
    retire: ['retExp', 'life', 'pension', 'pAge', 'selfPension', 'selfMedical', 'pen.years', 'tAge'],
    returns: ['eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr'], risk: ['sigEq', 'sigBd', 'rho', 'flexCut'], sim: [],
  },
};
// The row a field sits in. In the simple view a professional-only field keeps its professional row.
export function rowOf(field, view) {
  const find = v => Object.keys(ROWS[v]).find(row => ROWS[v][row].includes(field)) ?? null;
  return view === 'simple' ? find('simple') ?? find('pro') : find('pro');
}
const GROUP_OF = { simple: { spend: 'now', returns: null, risk: null }, pro: { spend: 'now' } };
// The form group (the header that counts the problems) a row belongs to.
export function formGroupOf(row, view) {
  if (row === null || row === undefined) return null;
  const map = GROUP_OF[view === 'simple' ? 'simple' : 'pro'];
  return row in map ? map[row] : row;
}

// What each form group's header says: the stops in it (counted by kind), whether it still holds the examples, whether
// an optional group is empty, and how many assumptions the person changed. by: 'row' counts the stops by sidebar row
// instead (spec §6.3), where spending and the age to holiday at are rows of their own.
const FORM_GROUPS = ['tage', 'now', 'where', 'pension', 'retire', 'region', 'returns', 'risk', 'sim'];
const RETURN_FIELDS = ['eq', 'eqReal', 'fxDrift'];
const RISK_FIELDS = ['sigEq', 'sigBd', 'rho', 'flexCut'];
const LOCAL_FIELDS = ['bondY', 'infl', 'drag'];
export function groupStates(S, list, data, { by = 'group' } = {}) {
  const view = S.view === 'pro' ? 'pro' : 'simple';
  const names = by === 'row' ? [...FORM_GROUPS, 'spend'] : FORM_GROUPS;
  const out = Object.fromEntries(names.map(g => [g, { blank: 0, block: 0, example: false, empty: false, changed: null }]));
  for (const q of list) {
    const g = q.kind === 'blank' || q.kind === 'block' ? (by === 'row' ? q.row : formGroupOf(q.row, view)) : null;
    if (g && out[g]) out[g][q.kind] += 1;
  }
  const start = defaultState(data);
  // 示例: the numbers are still the examples and nothing under spending (a mortgage, children) has been filled.
  const { mortgage: mort, kids: kid } = cleanReal(S.real);
  const filled = [mort.monthly, mort.endYear, kid.count, kid.age, kid.monthly].some(v => v !== null && v !== undefined);
  out.now.example = ['age', 'assets', 'income', 'expense'].every(k => S[k] === start[k]) && !splitOn(S) && !filled;
  out.pension.empty = !(S.pension > 0);
  const local = localAssumptions(data.countries[S.workC] ?? data.countries.CN);
  const differs = (k, base) => (S[k] !== base[k] ? 1 : 0);
  const sum = (keys, base) => keys.reduce((n, k) => n + differs(k, base), 0);
  out.returns.changed = sum(RETURN_FIELDS, start) + sum(LOCAL_FIELDS, local) + (S.autoSwr ? 0 : 1);
  out.risk.changed = sum(RISK_FIELDS, start);
  return out;
}

const SIMPLE_LABEL = {
  age: '年龄', assets: '已有存款和投资', income: '每月到手收入', expense: '每月支出', retExp: '退休后每月想花', pension: '预计每月养老金',
  selfPension: '放假后每月自缴养老保险', selfMedical: '放假后每月自缴医保', tAge: '想几岁放假',
  'split.rent': '房租和房贷', 'split.food': '吃饭', 'split.other': '其他', 'mortgage.monthly': '月供', 'mortgage.endYear': '还到哪年',
  'kids.count': '孩子几个', 'kids.age': '最小的孩子', 'kids.monthly': '每个孩子每月', 'pen.years': '累计缴费', 'town.monthly': '每月花销',
};
const PRO_LABEL = {
  ...SIMPLE_LABEL, assets: '可投资资产', income: '税后年收入', expense: '当前年支出', retExp: '年支出', pension: '养老金/年', tAge: '目标放假年龄',
  growth: '收入实际增长', life: '规划到', pAge: '领取年龄', eq: '股票占比', eqReal: '股票实际收益', bondY: '10 年国债', infl: '长期通胀',
  drag: '税费拖累', fxDrift: '退休币升值', swr: '安全提取率', sigEq: '股票波动率', sigBd: '债券波动率', rho: '股债相关性', flexCut: '一年跌 ≥ 15% 后少花',
};
// The field's name in the lines under the fields and in the exit buttons' spoken labels.
export const FIELD_LABEL = { simple: { ...PRO_LABEL, ...SIMPLE_LABEL }, pro: PRO_LABEL };

const SIMPLE_CHIP = {
  ...Object.fromEntries(PRO_ONLY.map(k => [k, PRO_LABEL[k]])), flexCut: '少花',
  age: '年龄', assets: '存款', income: '到手收入', expense: '每月支出', retExp: '退休后', pension: '养老金', selfPension: '自缴', selfMedical: '自缴',
  tAge: '想几岁放假', ...Object.fromEntries(SPLIT_KEYS.map(k => [k, '每月支出'])), 'mortgage.monthly': '房贷', 'mortgage.endYear': '房贷',
  'kids.count': '孩子', 'kids.age': '孩子', 'kids.monthly': '孩子', 'pen.years': '养老金', 'town.monthly': '每月花销',
};
// The item named on the red chip for a problem in that field.
export const CHIP_NAME = {
  simple: SIMPLE_CHIP,
  pro: { ...SIMPLE_CHIP, income: '年收入', expense: '当前年支出', ...Object.fromEntries(SPLIT_KEYS.map(k => [k, '当前年支出'])), retExp: '年支出', tAge: '目标年龄' },
};

const NUM = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
// A number as the page writes it: grouped, at most two decimals, a true minus sign.
export function num(v) {
  const text = NUM.format(Math.abs(v));
  return v < 0 && text !== '0' ? `−${text}` : text;
}
// A whole number to show: rounded, and never −0 (Math.round(−0.4) is −0, which other formatters print as "-0").
const whole = x => {
  const n = Math.round(x);
  return n === 0 ? 0 : n;
};

// Limits the tool sets (本工具设定), all listed on the method page.
export const LIMITS = {
  age: [16, 85], endYearBack: 50, endYearAhead: 40, pAge: [45, 75], lifeMin: 2, lifeMax: 110, swrMax: 10, low: 0.25,
  common: { growth: [-2, 5], eqReal: [-2, 10], bondY: [0, 8], infl: [0, 6], drag: [0, 2], fxDrift: [-3, 3] },
};

// The spending split: three monthly parts in the work currency and the yearly spending from just before the first
// part was entered. Anything that is not a number reads as blank, so an old or broken save reads as not split.
export function cleanSplit(raw) {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { rent: realNum(t.rent), food: realNum(t.food), other: realNum(t.other), before: realNum(t.before) };
}
// While any part is filled and not 0 the spending is their sum and cannot be typed directly. A negative part keeps
// the lock (B2 stops the part); every part blank or 0 is no split at all.
export const splitOn = S => {
  const sp = cleanSplit(S.split);
  return SPLIT_PARTS.some(k => sp[k] !== null && sp[k] !== 0);
};
const splitTotal = sp => SPLIT_PARTS.reduce((total, k) => total + (sp[k] ?? 0), 0) * 12;
// A split total below 0 (a negative part, stopped by B2) estimates from 0, so the stop stays on the part alone.
const reestimate = (S, data) => (data && !S.touched?.retExp
  ? { ...S, retExp: Math.round(estimateRetireSpend(Math.max(S.expense ?? 0, 0), S.workC, S.retC, data, itemsYearly(S))) }
  : S);

export function setSplit(S, part, rawText, data) {
  if (!SPLIT_PARTS.includes(part)) return S;
  const old = cleanSplit(S.split);
  const split = { ...old, [part]: realNum(rawText) };
  // Clearing every part by hand is the same as 只填总数.
  if (SPLIT_PARTS.every(k => split[k] === null)) return unsplit({ ...S, split }, data);
  if (SPLIT_PARTS.every(k => old[k] === null)) split.before = S.expense ?? null;
  const next = { ...S, split };
  // Every part now blank or 0 after the split was on: the same as 只填总数.
  if (splitOn(S) && !splitOn(next)) return unsplit(next, data);
  if (splitOn(next)) next.expense = splitTotal(split);
  return reestimate(next, data);
}

// 只填总数: the parts go and the spending returns to what it was before the split.
export function unsplit(S, data) {
  const { before } = cleanSplit(S.split);
  const next = { ...S, split: cleanSplit(null) };
  if (before !== null) next.expense = before;
  return reestimate(next, data);
}

// 改回估算: retirement spending is the page's own estimate again, and follows spending from now on.
export function resetRetExp(S, data) {
  const next = reestimate({ ...S, touched: { ...S.touched, retExp: false }, notice: '' }, data);
  return next.retExp === null || next.retExp === undefined ? next : { ...next, lastValid: { ...next.lastValid, retExp: next.retExp } };
}

const isSet = v => v !== null && v !== undefined;

// Every rule result, in page order: blank (待填), block (拦住), ended (struck through, not a problem), flag (!), local
// (stops only its own line). Amounts in rel are in the view's units; amounts in a fix's set are in state units.
// last: the field the person committed last, which takes the solid frame where a relation has two sides.
export function problems(S, data, thisYear = new Date().getFullYear(), { last = null } = {}) {
  const view = S.view === 'pro' ? 'pro' : 'simple';
  const pro = view === 'pro';
  const label = k => FIELD_LABEL[view][k];
  const out = [];
  const add = q => {
    const local = q.kind === 'local';
    out.push({
      id: `${q.rule}:${q.field}`, row: local ? null : rowOf(q.field, view), more: [], compare: [], at: q.field,
      chip: local ? null : CHIP_NAME[view][q.field], rel: null, note: null, fixes: [], ...q,
    });
  };
  const to = (field, n) => ({ text: `→ ${num(n)}`, aria: `${label(field)}改成 ${num(n)}`, set: { [field]: n } });
  const work = curOf(data, S.workC), ret = curOf(data, S.retC);
  const toRet = v => convert(v, work, ret, data);
  const { mortgage: m, kids: k } = cleanReal(S.real);
  const split = cleanSplit(S.split);
  const on = splitOn(S);

  // B1: the numbers a result rests on.
  for (const field of missingFields(S)) add({ rule: 'B1', kind: 'blank', field });

  // A5: a group filled in part waits for the rest; children counted as 0 need nothing more.
  const half = (name, cells, text) => {
    const blank = Object.keys(cells).filter(c => cells[c] === null).map(c => `${name}.${c}`);
    if (blank.length === 0 || blank.length === Object.keys(cells).length) return;
    add({ id: `A5:${name}`, rule: 'A5', kind: 'blank', field: blank[0], more: blank.slice(1), at: 'expense', fixes: [{ text, clear: name }] });
  };
  half('mortgage', m, '不算房贷');
  if (k.count !== 0) half('kids', k, '不算孩子');

  // A6: the end year is a whole year in range; before this year the mortgage has ended.
  if (m.endYear !== null) {
    const y = m.endYear, back = thisYear - LIMITS.endYearBack, ahead = thisYear + LIMITS.endYearAhead;
    const left = [{ label: label('mortgage.endYear'), value: y, year: true }];
    const rel = !Number.isInteger(y) ? { sub: false, left, op: null, right: null }
      : y < back || y > ahead ? { sub: false, left, op: '不在', right: { label: null, range: [back, ahead] } } : null;
    // A two-digit year is offered as 20xx when that lands in range.
    const full = 2000 + y;
    const yearFix = Number.isInteger(y) && y >= 0 && y <= 99 && full >= back && full <= ahead
      ? [{ text: `→ ${full}`, aria: `${label('mortgage.endYear')}改成 ${full}`, set: { 'mortgage.endYear': full } }] : [];
    if (rel) add({ rule: 'A6', kind: 'block', field: 'mortgage.endYear', at: 'expense', rel, fixes: yearFix });
    else if (y < thisYear && m.monthly > 0) {
      add({ id: 'end:mortgage', rule: 'A6', kind: 'ended', field: 'mortgage.endYear', at: 'expense',
        rel: { sub: true, ended: true, label: label('mortgage.monthly'), value: m.monthly, fact: `${y} 已还完` } });
    }
  }

  // A7: how many children: a whole number, not negative; 0 has ended.
  let kidsEnded = false;
  if (k.count !== null) {
    const left = [{ label: label('kids.count'), value: k.count }];
    if (k.count < 0) add({ rule: 'A7', kind: 'block', field: 'kids.count', at: 'expense', rel: { sub: false, left, op: '<', right: { label: null, value: 0 } }, fixes: [to('kids.count', 0)] });
    else if (!Number.isInteger(k.count)) {
      add({ rule: 'A7', kind: 'block', field: 'kids.count', at: 'expense', rel: { sub: false, left, op: null, right: null },
        fixes: [to('kids.count', Math.floor(k.count)), to('kids.count', Math.ceil(k.count))] });
    } else if (k.count === 0 && k.monthly > 0) {
      kidsEnded = true;
      add({ id: 'end:kids', rule: 'A7', kind: 'ended', field: 'kids.count', at: 'expense', rel: { sub: true, ended: true, label: '孩子', value: k.monthly, fact: '0 个' } });
    }
  }

  // A8: the youngest child's age: below 0 blocks; from 22 the children have ended.
  if (k.age !== null) {
    const left = [{ label: label('kids.age'), value: k.age }];
    if (k.age < 0) add({ rule: 'A8', kind: 'block', field: 'kids.age', at: 'expense', rel: { sub: false, left, op: '<', right: { label: null, value: 0 } }, fixes: [to('kids.age', 0)] });
    else if (!Number.isInteger(k.age)) {
      add({ rule: 'A8', kind: 'block', field: 'kids.age', at: 'expense', rel: { sub: false, left, op: null, right: null },
        fixes: [to('kids.age', Math.floor(k.age)), to('kids.age', Math.ceil(k.age))] });
    } else if (k.age >= KIDS_END && !kidsEnded && Number.isInteger(k.count) && k.count >= 1 && k.monthly > 0) {
      add({ id: 'end:kids', rule: 'A8', kind: 'ended', field: 'kids.age', at: 'expense',
        rel: { sub: true, ended: true, label: '孩子', value: k.count * k.monthly, fact: `已满 ${KIDS_END} 岁` } });
    }
  }

  // The items that would enter the model, and their yearly sum in the work currency.
  const events = itemEvents(S, thisYear);
  const mortgageOn = events.some(e => e.id === 'mortgage'), kidsOn = events.some(e => e.id === 'kids');
  const itemsY = events.reduce((total, e) => total + e.amount, 0);
  const items = (show, unit) => [
    mortgageOn && { label: label('mortgage.monthly'), value: show(m.monthly) },
    kidsOn && { label: '孩子', value: show(k.count * k.monthly) },
  ].filter(Boolean).map(x => (unit ? { ...x, unit } : x));

  // A2: with the split, the mortgage fits inside 房租和房贷 (equal is fine). It is the sharper form of A3.
  let a2 = false;
  if (on && mortgageOn && m.monthly > (split.rent ?? 0)) {
    a2 = true;
    const rent = split.rent ?? 0;
    const field = last === 'split.rent' ? 'split.rent' : 'mortgage.monthly';
    add({ id: 'A2', rule: 'A2', kind: 'block', field, compare: [field === 'split.rent' ? 'mortgage.monthly' : 'split.rent'], at: 'expense',
      chip: CHIP_NAME[view]['mortgage.monthly'],
      rel: { sub: true, left: [{ label: label('mortgage.monthly'), value: m.monthly }], op: '>', right: { label: label('split.rent'), value: rent } },
      fixes: [
        { text: `${label('split.rent')} → ${num(m.monthly)}`, aria: `${label('split.rent')}改成 ${num(m.monthly)}`, set: { 'split.rent': m.monthly } },
        { text: `改${label('mortgage.monthly')}`, focus: 'mortgage.monthly' },
      ] });
  }

  // The exit that adds the items to a spending: its text and aria name them; the amount is in the view's units. With
  // the split on, the mortgage goes into 房租和房贷 and the children into 其他 (monthly state values); otherwise the
  // spending field itself takes the sum. cur converts the items to the currency of the spending (retirement: toRet).
  const plus = (field, base, cur = v => v) => {
    const names = [mortgageOn && label('mortgage.monthly'), kidsOn && '孩子'].filter(Boolean);
    const itemsNow = cur(itemsY);
    // The number on the button is what the field shows once the exit is applied: read from the value that is set.
    const itemsMonthly = (mortgageOn ? m.monthly : 0) + (kidsOn ? k.count * k.monthly : 0);
    const total = field === 'expense' && on ? (split.rent ?? 0) + (split.food ?? 0) + (split.other ?? 0) + itemsMonthly : null;
    const X = total !== null ? (pro ? total * 12 : whole(total)) : pro ? Math.round(base + itemsNow) : whole(Math.round(base + itemsNow) / 12);
    const set = field === 'expense' && on
      ? { ...(mortgageOn ? { 'split.rent': (split.rent ?? 0) + m.monthly } : {}), ...(kidsOn ? { 'split.other': (split.other ?? 0) + k.count * k.monthly } : {}) }
      : { [field]: Math.round(base + itemsNow) };
    return { text: `${label(field)} + ${names.join(' + ')} → ${num(X)}`, aria: `${label(field)}加上${names.join('和')}改成 ${num(X)}`, set };
  };

  // A3: the items stay below the spending; equal blocks.
  let a3 = false;
  if (!a2 && isSet(S.expense) && itemsY > 0 && itemsY >= S.expense) {
    a3 = true;
    const spendField = on ? 'split.other' : 'expense';
    const sides = [spendField, ...(mortgageOn ? ['mortgage.monthly'] : []), ...(kidsOn ? ['kids.monthly'] : [])];
    const pick = [...(on ? SPLIT_KEYS : ['expense']), ...(mortgageOn ? ['mortgage.monthly'] : []), ...(kidsOn ? ['kids.count', 'kids.monthly'] : [])];
    const field = pick.includes(last) ? last : sides[1];
    const side = f => (f === 'expense' || SPLIT_KEYS.includes(f) ? 'spend' : f.split('.')[0]);
    add({ id: 'A3', rule: 'A3', kind: 'block', field, compare: sides.filter(f => side(f) !== side(field)), at: 'expense',
      rel: { sub: true, left: items(v => (pro ? v * 12 : v), pro ? '/年' : null), op: '≥', right: { label: label('expense'), value: pro ? S.expense : whole(S.expense / 12) } },
      fixes: [
        plus('expense', S.expense),
        ...(mortgageOn ? [{ text: `改${label('mortgage.monthly')}`, focus: 'mortgage.monthly' }] : []),
        ...(kidsOn ? [{ text: '改孩子', focus: 'kids.monthly' }] : []),
      ] });
  }

  // A4: typed retirement spending stays above the items (in the retirement currency); equal blocks. The estimate never does.
  let a4 = false;
  if (S.touched?.retExp && isSet(S.retExp) && itemsY > 0 && toRet(itemsY) >= S.retExp) {
    a4 = true;
    const shown = v => (work === ret ? v : whole(toRet(v)));
    const est = Math.round(estimateRetireSpend(Math.max(S.expense ?? 0, 0), S.workC, S.retC, data, itemsYearly(S, thisYear)));
    add({ id: 'A4', rule: 'A4', kind: 'block', field: 'retExp', at: 'retExp',
      rel: { sub: true, left: items(v => shown(pro ? v * 12 : v), pro ? '/年' : null), op: '≥', right: { label: label('retExp'), value: pro ? S.retExp : whole(S.retExp / 12) } },
      fixes: [plus('retExp', S.retExp, toRet), { text: `改回估算 ≈ ${num(pro ? est : whole(est / 12))}`, reset: 'retExp' }] });
  }

  // A9: a town's spend holds the items too; below them only that line stops. Equal is fine.
  const town = Number(S.town?.monthly);
  if (town > 0 && itemsY > 0 && town * 12 < toRet(itemsY)) {
    add({ id: 'A9', rule: 'A9', kind: 'local', field: 'town.monthly', fixes: [{ text: '改花销', focus: 'town.monthly' }] });
  }

  // A10: typed retirement spending that leaves less than a quarter of today's spending once the items end.
  if (!a4 && S.touched?.retExp && isSet(S.retExp) && isSet(S.expense) && itemsY > 0) {
    const afterMonthly = Math.round((S.retExp - toRet(itemsY)) / 12);
    if (convert(afterMonthly, ret, work, data) < S.expense / 12 * LIMITS.low) add({ id: 'A10', rule: 'A10', kind: 'flag', field: 'retExp', at: 'retExp' });
  }

  // A11: spending that the items leave under a quarter of; an optional exit, so a flag under 每月支出 and the result is
  // still worked out. Typed retirement spending does not matter here.
  if (!a2 && !a3 && isSet(S.expense) && S.expense > 0 && itemsY > 0 && S.expense - itemsY < S.expense * LIMITS.low) {
    const names = [mortgageOn && label('mortgage.monthly'), kidsOn && '孩子'].filter(Boolean).join('和');
    const left = S.expense - itemsY;
    add({ id: 'A11', rule: 'A11', kind: 'flag', field: 'expense', at: 'expense',
      note: `扣掉${names}只剩 ${num(pro ? Math.round(left) : whole(left / 12))}${pro ? '/年' : '/月'}`, fixes: [plus('expense', S.expense)] });
  }

  // ---- Ranges (B2-B9; B10 is a pro-only flag), the same in both views; only the labels and units follow the view.
  const NEG = ['assets', 'income', 'expense', 'retExp', 'pension', 'selfPension', 'selfMedical', ...SPLIT_KEYS, 'mortgage.monthly', 'kids.monthly'];
  const YEARLY = ['income', 'expense', 'retExp', 'pension'];
  const valueOf = f => {
    const [head, tail] = f.split('.');
    if (tail === undefined) return S[f];
    return head === 'split' ? split[tail] : head === 'pen' ? cleanPen(S.pen)[tail] : cleanReal(S.real)[head][tail];
  };
  // B2: no amount below 0. The exit drops the minus sign; savings go to 0.
  for (const f of NEG) {
    const v = valueOf(f);
    // A split total below 0 is a negative part, stopped there; the total itself is not typed.
    if (!isSet(v) || !(v < 0) || (f === 'expense' && on)) continue;
    const shown = x => (!pro && YEARLY.includes(f) ? whole(x / 12) : x);
    const fixTo = f === 'assets' ? 0 : Math.abs(v);
    add({ rule: 'B2', kind: 'block', field: f, at: f.includes('.') ? 'expense' : f,
      rel: { sub: false, left: [{ label: label(f), value: shown(v) }], op: '<', right: { label: null, value: 0 } },
      fixes: [{ text: `→ ${num(shown(fixTo))}`, aria: `${label(f)}改成 ${num(shown(fixTo))}`, set: { [f]: fixTo } }] });
  }
  // Spending of exactly 0 has nothing to build on; there is no value to offer.
  if (S.expense === 0 && !on) {
    add({ rule: 'B2', kind: 'block', field: 'expense', at: 'expense', rel: { sub: false, left: [{ label: label('expense'), value: 0 }], op: null, right: null }, fixes: [] });
  }
  // The age rules wait while the age itself is blocked (B3), so one wrong age is one problem.
  const A = S.age, ageOk = isSet(A) && A >= LIMITS.age[0] && A <= LIMITS.age[1], life = S.life, tAge = S.tAge, bwd = S.mode === 'bwd';
  const one = (rule, field, v, op, right, fix) => add({ rule, kind: 'block', field, rel: { sub: false, left: [{ label: label(field), value: v }], op, right }, fixes: fix === null ? [] : [to(field, fix)] });
  // B3: age 16 to 85.
  if (isSet(A) && (A < LIMITS.age[0] || A > LIMITS.age[1])) {
    const low = A < LIMITS.age[0], edge = LIMITS.age[low ? 0 : 1];
    one('B3', 'age', A, low ? '<' : '>', { label: null, value: edge }, edge);
  }
  // B4: working backward, the age to holiday at is above the age and below the plan end; equal blocks.
  if (bwd && isSet(tAge) && ageOk && tAge <= A) one('B4', 'tAge', tAge, '≤', { label: label('age'), value: A }, A + 1);
  else if (bwd && isSet(tAge) && ageOk && isSet(life) && tAge >= life) one('B4', 'tAge', tAge, '≥', { label: label('life'), value: life }, life - 1);
  // B5: the plan end from age + 2 to 110. Too small goes to 95, or to the least that works; when nothing up to 110
  // works there is no value button.
  if (isSet(life) && ageOk && life < A + LIMITS.lifeMin) {
    const back = bwd && isSet(tAge);
    const fix = 95 >= A + LIMITS.lifeMin && (!back || 95 > tAge) ? 95 : Math.max(A + LIMITS.lifeMin, back ? tAge + 1 : 0);
    one('B5', 'life', life, '<', { label: null, value: A + LIMITS.lifeMin }, fix <= LIMITS.lifeMax ? fix : null);
  } else if (isSet(life) && life > LIMITS.lifeMax) one('B5', 'life', life, '>', { label: null, value: LIMITS.lifeMax }, LIMITS.lifeMax);
  // B6-B9: plain ranges.
  const range = (rule, field, lo, hi, fixLow, fixHigh) => {
    const v = S[field];
    if (!isSet(v) || (v >= lo && v <= hi)) return;
    const low = v < lo;
    one(rule, field, v, low ? '<' : '>', { label: null, value: low ? lo : hi }, low ? fixLow(v) : fixHigh(v));
  };
  range('B6', 'pAge', LIMITS.pAge[0], LIMITS.pAge[1], () => LIMITS.pAge[0], () => LIMITS.pAge[1]);
  range('B7', 'eq', 0, 100, () => 0, () => 100);
  range('B7', 'flexCut', 0, 100, () => 0, () => 100);
  range('B8', 'rho', -1, 1, () => -1, () => 1);
  for (const f of ['sigEq', 'sigBd']) range('B9', f, 0, 1, v => Math.abs(v), v => Math.round(v / 100 * 1e6) / 1e6);
  // ---- Judgement flags, professional view only (the simple view has only A10 and B14).
  if (pro) {
    // B11: a changed assumption outside the common range. A default, or a value that follows the monthly data, never flags.
    const own = defaultState(data), follow = localAssumptions(data.countries[S.workC]);
    for (const [f, [lo, hi]] of Object.entries(LIMITS.common)) {
      const def = f in follow ? follow[f] : own[f];
      if (!isSet(S[f]) || S[f] === def || (S[f] >= lo && S[f] <= hi)) continue;
      add({ rule: 'B11', kind: 'flag', field: f, note: `常见 ${num(lo)} 到 ${num(hi)}` });
    }
    // B10: a typed withdrawal rate at or below 0, or above 10. It is a comparison only (it never changes the
    // result), so it warns and never stops anything.
    if (!S.autoSwr && isSet(S.swr) && (S.swr <= 0 || S.swr > LIMITS.swrMax)) {
      const low = S.swr <= 0;
      add({ rule: 'B10', kind: 'flag', field: 'swr', rel: { sub: false, left: [{ label: label('swr'), value: S.swr }], op: low ? '≤' : '>', right: { label: null, value: low ? 0 : LIMITS.swrMax } }, fixes: [] });
    }
    // B12: a pension above the year's spending: the rest is not counted.
    if (isSet(S.pension) && isSet(S.retExp) && S.pension > S.retExp) {
      add({ rule: 'B12', kind: 'flag', field: 'pension', rel: { sub: false, left: [{ label: '养老金', value: S.pension }], op: '>', right: { label: '年支出', value: S.retExp } }, note: `多出 ${num(S.pension - S.retExp)} 不计` });
    }
    // B13: the mix return, worked out as buildParams does before its floor, below −50%.
    if ([S.eq, S.eqReal, S.bondY, S.infl, S.drag].every(isSet)) {
      const w = Math.min(Math.max(S.eq, 0), 100) / 100;
      const r = w * S.eqReal / 100 + (1 - w) * (S.bondY - S.infl) / 100 - S.drag / 100;
      if (r < -0.5) add({ rule: 'B13', kind: 'flag', field: 'eqReal', at: 'ledger', note: '按 −50% 算' });
    }
  }

  // B15: the claim's years of payment cannot be fewer than the years already paid; only that line stops.
  const pen = cleanPen(S.pen);
  if (isSet(pen.paidYears) && isSet(pen.years) && pen.years < pen.paidYears) {
    add({ rule: 'B15', kind: 'local', field: 'pen.years',
      rel: { sub: false, left: [{ label: label('pen.years'), value: pen.years, unit: ' 年' }], op: '<', right: { label: '已缴', value: pen.paidYears, unit: ' 年' } },
      fixes: [to('pen.years', pen.paidYears)] });
  }

  // B14: spending above income still counts (savings stay at 0 or above), with an orange line under spending.
  if (isSet(S.income) && isSet(S.expense) && S.income < S.expense) {
    const yearly = S.income - S.expense;
    add({ id: 'B14', rule: 'B14', kind: 'flag', field: 'expense', at: 'expense',
      rel: { sub: false, left: [{ label: pro ? '年储蓄' : '每月存下', value: pro ? yearly : whole(yearly / 12) }], op: null, right: null },
      note: pro ? '存款用完后按 0 算' : null });
  }

  const order = FIELD_ORDER[view];
  return out.map((q, i) => [q, i]).sort(([a, i], [b, j]) => order.indexOf(a.field) - order.indexOf(b.field) || i - j).map(([q]) => q);
}

// ---- The rows under the fields, the group summaries and the ledger's sections ① ②, from one list, so no number is
// worked out twice. Amounts are in the view's units (simple monthly, professional yearly) and rounded; cur says which
// currency. plan = { p, t, need, unreachable } once the result is solved (t the holiday year, need the line at t), null
// while it is blocked or blank. A row that is blocked carries the very relation problems() draws under the field.
const TOOL = '本工具设定';
const ITEM_NAME = { mortgage: '月供', kids: '孩子' };
// The engine's spending at plan year y (work currency, today's money) for a holiday in year t, before pension and self-pay.
const spendAt = (p, t, y) => planFlows({ ...p, pension: 0, selfPay: 0 }, t, null).full[y];
export function storyRows(S, data, thisYear = new Date().getFullYear(), plan = null) {
  const view = S.view === 'pro' ? 'pro' : 'simple';
  const pro = view === 'pro';
  const per = pro ? 'year' : 'month';
  const yearly = v => (isSet(v) ? whole(pro ? v : v / 12) : null);
  const monthly = v => (isSet(v) ? whole(pro ? v * 12 : v) : null);
  const work = curOf(data, S.workC), ret = curOf(data, S.retC);
  const toRet = v => convert(v, work, ret, data);
  const monthlyRet = v => (isSet(v) ? (work === ret ? monthly(v) : whole(toRet(pro ? v * 12 : v))) : null);
  const pct = v => `${v >= 0 ? '+' : ''}${num(v)}%`;

  const qs = problems(S, data, thisYear);
  const rule = id => qs.find(q => q.rule === id);
  const a2 = rule('A2'), a3 = rule('A3'), a4 = rule('A4'), a10 = rule('A10'), b12 = rule('B12'), b14 = rule('B14');
  // A blank or a block in one of the row's own fields; the relations between rows (A2-A4) are placed by hand below.
  // stop is the problem's id, so a view can tell a stop it shows from one still being typed.
  const stop = fields => {
    const q = qs.find(x => (x.kind === 'block' || x.kind === 'blank') && fields.includes(x.field) && !['A2', 'A3', 'A4'].includes(x.rule));
    return q ? { status: q.kind, stop: q.id, ...(q.rel ? { rel: q.rel } : {}) } : null;
  };
  const ended = id => qs.find(q => q.id === `end:${id}`);

  const rows = [];
  const add = (key, section, label, value, o = {}) => rows.push({
    key, section, label, value, op: null, cur: null, per: null, status: null, field: null, under: null, tag: null, views: 'both', ...o,
  });

  const { p = null, t = null } = plan ?? {};
  const growth = isSet(S.growth) ? S.growth : S.lastValid?.growth ?? 0;
  const { mortgage: m, kids: k } = cleanReal(S.real);
  const events = itemEvents(S, thisYear);
  const mOn = events.some(e => e.id === 'mortgage'), kOn = events.some(e => e.id === 'kids');

  // ① Saving.
  add('have', 'now', pro ? '可投资资产' : '已有', isSet(S.assets) ? whole(S.assets) : null, { cur: 'work', field: 'assets', ...stop(['assets']) });
  add('income', 'now', pro ? `税后年收入 · 实际增长 ${pct(growth)}/年` : '到手', yearly(S.income),
    { cur: 'work', per, field: 'income', tag: pro ? TOOL : null, ...stop(['income']) });
  add('expense', 'now', pro ? '当前年支出 · 按今天的钱不变' : '支出', yearly(S.expense),
    { op: '−', cur: 'work', per, field: 'expense', tag: pro ? TOOL : null, ...stop(['expense']) });
  if (splitOn(S)) {
    const sp = cleanSplit(S.split);
    const parts = SPLIT_PARTS.map(x => sp[x] ?? 0);
    add('split', 'now', null, monthly(parts.reduce((a, b) => a + b, 0)),
      { op: '=', cur: 'work', per, field: 'split.rent', under: 'expense', parts, before: yearly(sp.before), ...stop(SPLIT_KEYS) });
  }
  const item = { op: '└', cur: 'work', per, under: 'expense' };
  if (a3 && mOn && kOn) {
    add('items', 'now', null, monthly(m.monthly + k.count * k.monthly), { ...item, field: a3.field, status: 'block', stop: a3.id, rel: a3.rel });
  } else {
    const mRel = a2 ?? (a3 && mOn ? a3 : null);
    const mStop = mRel ? { status: 'block', stop: mRel.id, rel: mRel.rel } : stop(['mortgage.monthly', 'mortgage.endYear']);
    const mEnd = ended('mortgage');
    if (mOn || mStop || mEnd) {
      add('mortgage', 'now', ITEM_NAME.mortgage, monthly(m.monthly),
        { ...item, field: 'mortgage.monthly', end: m.endYear, ...(mStop ?? (mEnd ? { status: 'ended', rel: mEnd.rel } : {})) });
    }
    const kStop = a3 && kOn ? { status: 'block', stop: a3.id, rel: a3.rel } : stop(['kids.count', 'kids.age', 'kids.monthly']);
    const kEnd = ended('kids');
    if (kOn || kStop || kEnd) {
      const value = kEnd ? kEnd.rel.value : kOn ? k.count * k.monthly : k.monthly;
      add('kids', 'now', pro ? `${ITEM_NAME.kids} → ${KIDS_END} 岁（按最小的）` : ITEM_NAME.kids, monthly(value),
        { ...item, field: 'kids.monthly', end: KIDS_END, tag: pro ? TOOL : null, ...(kStop ?? (kEnd ? { status: 'ended', rel: kEnd.rel } : {})) });
    }
  }
  // The real payment at t − 1, while the mortgage still runs in that year.
  const mEvent = events.find(e => e.id === 'mortgage');
  if (pro && plan && mOn && mEvent.endAge > p.age + Math.max(t - 1, 0)) {
    add('mortgageReal', 'now', `月供实际 × (1 + ${num(p.infl)}%)^−t`, whole(m.monthly * 12 * Math.pow(1 + p.infl / 100, -Math.max(t - 1, 0))),
      { cur: 'work', per, under: 'expense', views: 'pro' });
  }
  const save0 = plan ? savingsAt(p, 0) : isSet(S.income) && isSet(S.expense) ? S.income - S.expense : null;
  add('save', 'now', pro ? '年储蓄' : '每月存下', yearly(save0), {
    op: '=', cur: 'work', per, ...(b14 ? { status: 'flag', rel: b14.rel } : {}),
    ...(pro && plan && t >= 1 ? { values: [whole(savingsAt(p, 0)), whole(savingsAt(p, t - 1))] } : {}),
  });
  if (!pro) add('growth', 'now', `收入每年 ${pct(growth)}`, null, { tag: TOOL, views: 'simple' });
  if (!pro && plan && t > 1) {
    add('saveLate', 'now', `→ ${p.age + t - 1} 岁每月存下`, whole(savingsAt(p, t - 1) / 12), { cur: 'work', per, views: 'simple' });
  }
  if (pro) add('floor', 'now', '年末存入 · 资产不低于 0', null, { tag: TOOL, views: 'pro' });

  // ② After the holiday. The ages come from the items' end ages (at most two, C23) and the claim age. The section
  // starts at the holiday: an item that has ended by then is already out of the first row's amount (struck there),
  // and its → row is marked folded, kept only for the line under the field, which lists every end age to come.
  const holiday = plan ? p.age + t : null;
  const ends = isSet(S.age) ? [...new Set(events.map(e => e.endAge))].sort((a, b) => a - b).slice(0, 2) : [];
  const nextEnd = ends.find(e => e > (holiday ?? S.age));
  const leftAfter = gone => (isSet(S.retExp) ? S.retExp - toRet(gone.reduce((total, e) => total + e.amount, 0)) : null);
  const goneAtHoliday = holiday === null ? [] : events.filter(e => e.endAge <= holiday);
  const retStop = stop(['retExp']) ?? (a4 ? { status: 'block', stop: a4.id, rel: a4.rel } : !S.touched?.retExp ? { status: 'est' } : null);
  // With a plan, the simple view's first row is what the engine spends the first holiday year (the professional
  // retReal); the professional row stays the typed amount less the items gone, its real value on the next row.
  const engineFirst = !pro && plan !== null;
  add('retExp', 'after', pro ? '退休后年支出' : '退休后', engineFirst ? whole(spendAt(p, t, t) / 12) : yearly(leftAfter(goneAtHoliday)), {
    cur: engineFirst ? 'work' : 'retire', per, field: 'retExp', ages: [holiday, nextEnd === undefined ? null : nextEnd - 1], typed: yearly(S.retExp),
    ...(goneAtHoliday.length ? { struck: goneAtHoliday.map(e => ITEM_NAME[e.id]) } : {}), ...retStop,
  });
  // The holiday year's spending as the engine counts it (drift, the mortgage at its real value), before pension and self-pay.
  if (pro && plan && mOn && mEvent.endAge > holiday) {
    add('retReal', 'after', `月供实际变轻，${holiday} 岁实付`, whole(spendAt(p, t, t)),
      { cur: 'work', per, views: 'pro' });
  }
  const retItem = { op: '└', cur: 'retire', per, under: 'retExp' };
  if (a4) add('ret:items', 'after', null, null, { ...retItem, field: 'retExp', status: 'block', stop: a4.id, rel: a4.rel });
  else {
    if (mOn) add('ret:mortgage', 'after', ITEM_NAME.mortgage, monthlyRet(m.monthly), { ...retItem, field: 'mortgage.monthly' });
    if (kOn) add('ret:kids', 'after', ITEM_NAME.kids, monthlyRet(k.count * k.monthly), { ...retItem, field: 'kids.monthly' });
  }
  for (const age of ends) {
    const left = leftAfter(events.filter(e => e.endAge <= age));
    // A10 judges the amount left once every item has ended; each → row is judged on its own amount the same way.
    const low = a10 && left !== null && convert(whole(left / 12), ret, work, data) < S.expense / 12 * LIMITS.low;
    add(`after:${age}`, 'after', null, a4 ? null : yearly(left), {
      op: '→', cur: 'retire', per, under: 'retExp', ages: [age, null], struck: events.filter(e => e.endAge === age).map(e => ITEM_NAME[e.id]),
      ...(holiday !== null && age <= holiday ? { folded: true } : {}), ...(low ? { status: 'flag' } : {}),
    });
  }
  // The ledger's ② rows after the first, with a plan: − what the engine counted for the items ending at that age in
  // their last year (the same year with them already ended is the difference, so the mortgage's real-terms drift over
  // the years before stays out of it), = the engine's spending from that age. An end past the plan never comes.
  if (plan) {
    // What the engine spends the first holiday year, in the view's units (pro: the retReal row when there is one).
    let above = rows.find(r => r.key === 'retReal')?.value ?? yearly(spendAt(p, t, t));
    for (const age of ends.filter(a => a > holiday && a <= p.life)) {
      const gone = p.events.filter(e => e.endAge === age);
      if (!gone.length) continue;
      const y = age - 1 - p.age;
      const early = { ...p, events: p.events.map(e => (e.endAge === age ? { ...e, endAge: age - 1 } : e)) };
      const value = yearly(spendAt(p, t, age - p.age));
      const less = yearly(spendAt(p, t, y) - spendAt(early, t, y));
      // drift: the row above minus − is not = (the mortgage's real-terms drift over the years between), so the = is a ≈.
      add(`draw:${age}`, 'after', null, value, {
        op: '−', cur: 'work', per, ages: [age, null], items: gone.map(e => ITEM_NAME[e.id]),
        less, lessTyped: yearly(gone.reduce((total, e) => total + e.amount, 0)), drift: Math.abs(above - less - value) > 1,
      });
      above = value;
    }
  }
  const own = v => (Number.isFinite(Number(v)) ? Math.max(Number(v), 0) : 0);
  const selfPay = plan ? p.selfPay ?? 0 : S.workC === 'CN' && (S.pension ?? 0) > 0 ? (own(S.selfPension) + own(S.selfMedical)) * 12 : 0;
  const pAge = plan ? p.pAge : S.pAge ?? S.lastValid?.pAge ?? null;
  const selfStop = stop(['selfPension', 'selfMedical']);
  // Self-pay runs from the holiday until the pension starts; a holiday at or after the claim age pays none.
  const selfOn = selfPay > 0 && !(holiday !== null && isSet(pAge) && holiday >= pAge);
  if (pro || selfOn || selfStop) {
    add('self', 'after', pro ? '自缴（工作地中国大陆且填了养老金才计）' : '自缴', selfOn ? yearly(selfPay) : null,
      { cur: 'work', per, field: 'selfPension', ages: [holiday, pAge], ...selfStop });
  }
  add('pension', 'after', pro ? '养老金（超出年支出不计）' : '养老金', S.pension > 0 ? yearly(-S.pension) : null,
    { cur: 'retire', per, field: 'pension', ages: [pAge, null], ...(stop(['pension']) ?? (b12 ? { status: 'flag', rel: b12.rel } : {})) });
  if (pro) {
    // Their labels go back to their fields; a blocked cut (B7) stops the ledger at its own row.
    add('flexCut', 'after', '一年跌 ≥ 15% 次年少花（只砍生活费，月供、自缴照付）', S.flexCut ?? null, { field: 'flexCut', views: 'pro', ...stop(['flexCut']) });
    add('fxDrift', 'after', '退休币升值（只算到放假那年）', work === ret ? null : S.fxDrift ?? null, { field: 'fxDrift', views: 'pro', ...stop(['fxDrift']) });
    if (S.workC !== S.retC) add('cross', 'after', '≈ (年支出 − 月供和孩子) × 物价比 + 月供和孩子', null, { views: 'pro' });
  }
  const need = plan && !plan.unreachable && isSet(plan.need) ? plan.need : null;
  add('need', 'after', pro ? '放假线（每条路径倒推，取 80 分位）' : holiday === null ? '放假要有' : `${holiday} 岁放假要有`, need, { op: '⇒', cur: 'work' });
  const draw = need === null ? 0 : firstDraw(p, t);
  add('times', 'after', null, draw > 0 ? Math.round(need / draw) : null, { draw: need === null ? null : draw });

  // The cut: the first blocked or blank row keeps its value, every row after it waits. The items (└ under spending and
  // under retirement spending) only repeat an amount the person typed, so they stay.
  const cut = rows.findIndex(r => r.status === 'block' || r.status === 'blank');
  if (cut >= 0) {
    for (const r of rows.slice(cut + 1)) {
      if (r.op === '└') continue;
      r.value = null;
      if (r.values) r.values = null;
    }
  }
  return rows;
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
  const move = v => (v === null ? null : Math.round(convert(v, from, to, data)));
  moved.real = { mortgage: { ...r.mortgage, monthly: move(r.mortgage.monthly) }, kids: { ...r.kids, monthly: move(r.kids.monthly) } };
  // So are the split parts and the total remembered from before the split; the spending stays their sum.
  const sp = cleanSplit(S.split);
  moved.split = { rent: move(sp.rent), food: move(sp.food), other: move(sp.other), before: move(sp.before) };
  if (splitOn(moved)) moved.expense = splitTotal(moved.split);
  if (!S.touched.retExp) moved.retExp = Math.round(estimateRetireSpend(Math.max(moved.expense ?? 0, 0), code, S.retC, data, itemsYearly(moved)));
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
    moved.retExp = Math.round(estimateRetireSpend(Math.max(S.expense ?? 0, 0), S.workC, code, data, itemsYearly(S)));
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
    const S = { ...base, ...saved, ...fresh, town: cleanTown(saved.town), pen: cleanPen(saved.pen), real: cleanReal(saved.real), split: cleanSplit(saved.split), dispCur: dispOk ? saved.dispCur : base.dispCur, lastValid: { ...base.lastValid, ...saved.lastValid, ...fresh }, touched };
    // A split save is its parts: an older or hand-edited total that is not their sum is replaced by it.
    return splitOn(S) && S.expense !== splitTotal(S.split) ? reestimate({ ...S, expense: splitTotal(S.split) }, data) : S;
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

