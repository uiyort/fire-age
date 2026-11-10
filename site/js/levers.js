// Ranks what would move this person's holiday age the most, and measures each parameter's effect.
import { buildParams, fwdSolve, swrFor } from './engine.js';
import { oddsSolve, oddsYears, successAt } from './odds.js';

const rebuild = (p, changes) => buildParams({ ...p, ...changes }, p.fx);

function leverCandidates(p, data, retC) {
  const out = [
    { id: 'spend', label: '支出降 10%', next: rebuild(p, { expense: p.expense * 0.9, retExp: p.retExp * 0.9 }) },
    { id: 'growth', label: '收入增速提高 1 个百分点', next: rebuild(p, { growth: p.growth + 1 }) },
  ];
  if (p.income > 0) out.push({ id: 'saveRate', label: '储蓄率提高 5 个百分点', next: rebuild(p, { expense: p.expense - p.income * 0.05 }) });
  if (p.drag > 0) out.push({ id: 'fee', label: '投资费率降 0.5 个百分点', next: rebuild(p, { drag: Math.max(p.drag - 0.5, 0) }) });

  // Moving away is not listed: it is a different life, not a way to retire earlier from this one. It has its own section.
  return out;
}

// A step small enough to take this month: about 2% of monthly income, rounded to a plain amount, saved each month.
export function smallStep(p) {
  if (!(p.income > 0)) return null;
  const raw = p.income / 12 * 0.02;
  const amount = raw < 1000 ? Math.max(Math.round(raw / 100) * 100, 100) : Math.round(raw / 500) * 500;
  const beforeYears = oddsYears(p), afterYears = oddsYears(rebuild(p, { expense: p.expense - amount * 12 }));
  if (afterYears === null) return null;
  const unlocks = beforeYears === null;
  const gainYears = unlocks ? null : beforeYears - afterYears;
  if (!unlocks && gainYears <= 1e-9) return null;
  return { id: 'small', amount, beforeYears, afterYears, gainYears, unlocks };
}

export function rankLevers(p, data, { retC, top = 3 }) {
  const beforeYears = oddsYears(p);
  const scored = [];
  for (const { id, label, next } of leverCandidates(p, data, retC)) {
    const afterYears = oddsYears(next);
    if (afterYears === null) continue;
    const unlocks = beforeYears === null;
    const gainYears = unlocks ? null : beforeYears - afterYears;
    if (!unlocks && gainYears <= 1e-9) continue;
    scored.push({ id, label, beforeYears, afterYears, gainYears, unlocks });
  }
  scored.sort((a, b) => (a.unlocks && b.unlocks ? a.afterYears - b.afterYears : b.gainYears - a.gainYears));
  return scored.slice(0, top);
}

// The lever in the person's own money.
const ACTIONS = {
  spend: (p, D) => `每月少花 10%（约 ${D(p.expense * 0.1 / 12)}）`,
  saveRate: (p, D) => `每月多存 ${D(p.income * 0.05 / 12)}`,
  growth: () => '收入每年多涨 1 个百分点',
  fee: () => '投资费率降 0.5 个百分点',
};

// The same steps with no amount in them, for a card that shows no money.
const ACTIONS_PLAIN = {
  spend: '每月少花一成',
  saveRate: '每月多存收入的 5%',
  growth: '收入每年多涨 1 个百分点',
  fee: '投资费率降 0.5 个百分点',
};

export function personalLever(levers, p, D) {
  const lever = levers.find(l => ACTIONS[l.id]);
  if (!lever) return null;
  const action = ACTIONS[lever.id](p, D), plain = ACTIONS_PLAIN[lever.id];
  return lever.unlocks ? { action, plain, unlockAge: Math.round(p.age + lever.afterYears) } : { action, plain, gain: lever.gainYears };
}

function currentSwrPercent(p) {
  const t = fwdSolve(p) ?? 0;
  return swrFor(p, p.life - p.age - t) * 100;
}

const IMPACT_STEPS = {
  assets: { stepLabel: '现有资产多 10%', change: p => ({ assets: p.assets * 1.1 }) },
  income: { stepLabel: '收入高 10%', change: p => ({ income: p.income * 1.1 }) },
  expense: { stepLabel: '当前支出少 10%（退休支出不变）', change: p => ({ expense: p.expense * 0.9 }) },
  growth: { stepLabel: '收入增速高 1 个百分点', change: p => ({ growth: p.growth + 1 }) },
  retExp: { stepLabel: '退休支出少 10%', change: p => ({ retExp: p.retExp * 0.9 }) },
  life: { stepLabel: '规划年龄多 5 岁', change: p => ({ life: p.life + 5 }) },
  pension: { stepLabel: '养老金多 10%', change: p => ({ pension: p.pension * 1.1 }) },
  pAge: { stepLabel: '早 1 年领取养老金', change: p => ({ pAge: p.pAge - 1 }) },
  eq: { stepLabel: '股票占比高 10 个百分点', change: p => ({ eq: Math.min(p.eq + 10, 100) }), note: '代价是中途波动更大，成功率也会变，这是取舍，不是建议。' },
  eqReal: { stepLabel: '股票实际收益高 1 个百分点', change: p => ({ eqReal: p.eqReal + 1 }) },
  bondY: { stepLabel: '国债收益率高 1 个百分点', change: p => ({ bondY: p.bondY + 1 }) },
  infl: { stepLabel: '长期通胀低 0.5 个百分点', change: p => ({ infl: p.infl - 0.5 }) },
  drag: { stepLabel: '税费拖累少 0.5 个百分点', change: p => ({ drag: Math.max(p.drag - 0.5, 0) }) },
  fxDrift: { stepLabel: '退休地货币每年少升值 1 个百分点', change: p => ({ fxDrift: p.fxDrift - 1 }) },
  flexCut: { stepLabel: '大跌后多少花 10 个百分点', change: p => ({ flexCut: Math.min((p.flexCut ?? 0) + 10, 100) }) },
  sigEq: { stepLabel: '股票波动率高 0.02', change: p => ({ sigEq: p.sigEq + 0.02 }) },
  sigBd: { stepLabel: '债券波动率高 0.02', change: p => ({ sigBd: p.sigBd + 0.02 }) },
  rho: { stepLabel: '股债相关性高 0.2', change: p => ({ rho: Math.min(p.rho + 0.2, 1) }) },
};

const NO_YEARS = {
  age: '年龄决定你还有多少年可以复利',
  swr: '放假年龄按八成把握算，提取率只作对照，不改变放假年龄',
};

// gainYears is positive when the step brings the holiday age forward, negative when it pushes it back.
export function impactOf(p, paramId) {
  if (NO_YEARS[paramId]) return { stepLabel: NO_YEARS[paramId], gainYears: null };
  if (paramId === 'fxDrift' && p.rCur === p.wCur) return { stepLabel: '工作地和退休地用同一种货币，这一项不起作用。', gainYears: null };
  const step = IMPACT_STEPS[paramId];
  const before = oddsYears(p), after = oddsYears(rebuild(p, step.change(p)));
  const reach = after === null ? 'none' : before === null ? 'unlocks' : null;
  return { stepLabel: step.stepLabel, note: step.note, gainYears: reach ? null : before - after, ...(reach ? { reach } : {}) };
}

const RISK_PARAMS = ['eq', 'sigEq', 'sigBd', 'rho', 'flexCut'];

function niceStep(raw) {
  const unit = Math.pow(10, Math.floor(Math.log10(raw)));
  return raw / unit >= 5 ? 5 * unit : raw / unit >= 2 ? 2 * unit : unit;
}

function moneyRange(value, fallback, unit) {
  const max = Math.max(value * 2, fallback, 1000);
  return { min: 0, max, step: niceStep(max / 100), value, unit };
}

const TRY_RANGES = {
  age: p => ({ min: 18, max: Math.max(p.life - 2, 19), step: 1, value: p.age, unit: '岁' }),
  assets: p => moneyRange(p.assets, p.income * 5, 'work'),
  income: p => moneyRange(p.income, p.expense * 2, 'work'),
  expense: p => moneyRange(p.expense, p.income, 'work'),
  retExp: p => moneyRange(p.retExp, p.retExp, 'retire'),
  pension: p => moneyRange(p.pension, p.retExp, 'retire'),
  growth: p => ({ min: -2, max: 6, step: 0.5, value: p.growth, unit: '%' }),
  life: p => ({ min: Math.max(p.age + 2, 70), max: 110, step: 1, value: p.life, unit: '岁' }),
  pAge: p => ({ min: 50, max: 75, step: 1, value: p.pAge, unit: '岁' }),
  eq: p => ({ min: 0, max: 100, step: 5, value: p.eq, unit: '%' }),
  eqReal: p => ({ min: 0, max: 8, step: 0.5, value: p.eqReal, unit: '%' }),
  bondY: p => ({ min: 0, max: 8, step: 0.25, value: p.bondY, unit: '%' }),
  infl: p => ({ min: 0, max: 6, step: 0.25, value: p.infl, unit: '%' }),
  drag: p => ({ min: 0, max: 3, step: 0.25, value: p.drag, unit: '%' }),
  fxDrift: p => ({ min: -3, max: 3, step: 0.5, value: p.fxDrift, unit: '%' }),
  swr: p => ({ min: 2, max: 6, step: 0.25, value: currentSwrPercent(p), unit: '%' }),
  sigEq: p => ({ min: 0.05, max: 0.35, step: 0.01, value: p.sigEq, unit: '' }),
  sigBd: p => ({ min: 0.01, max: 0.15, step: 0.01, value: p.sigBd, unit: '' }),
  rho: p => ({ min: -1, max: 1, step: 0.1, value: p.rho, unit: '' }),
  flexCut: p => ({ min: 0, max: 50, step: 5, value: p.flexCut ?? 0, unit: '%' }),
};

// The slider range for a parameter, always wide enough to include the current value.
export function tryRange(p, id) {
  const range = TRY_RANGES[id](p);
  return { ...range, min: Math.min(range.min, range.value), max: Math.max(range.max, range.value) };
}

// What the plan would give with one value changed. Works on a copy, so the real plan is untouched.
export function tryParam(p, id, value) {
  const q = rebuild(p, { [id]: value, ...(id === 'swr' ? { autoSwr: false } : {}) });
  const t = oddsSolve(q);
  return {
    age: t === null ? null : q.age + t,
    success: RISK_PARAMS.includes(id) && t !== null ? successAt(q, t) : null,
  };
}

// What a person can decide. Age, savings already made and the market are not choices, so sliders for those only preview.
export const LIFE_CHOICES = ['income', 'expense', 'growth', 'retExp', 'life', 'pension', 'pAge', 'drag'];
// Working backward from a chosen age, the saving plan is set by that age, so income, spending and wage growth change nothing.
const FIXED_WHEN_BACKWARD = ['income', 'expense', 'growth'];
export const lifeChoices = mode => (mode === 'bwd' ? LIFE_CHOICES.filter(id => !FIXED_WHEN_BACKWARD.includes(id)) : LIFE_CHOICES);

// The plan with the person's answers and slider values applied. The real plan is untouched.
export function labPlan(p, { values = {}, minLife = 0 } = {}) {
  const life = values.life === undefined ? {} : { life: Math.max(values.life, minLife) };
  return rebuild(p, { ...values, ...life, ...(values.swr === undefined ? {} : { autoSwr: false }) });
}
