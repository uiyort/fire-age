// Questions about the years ahead. Each answer is the person's own view, written into a parameter:
// it shapes the life waiting to be written, and can be carried into the professional view.
import { longRunInflation } from './engine.js';

const DEFAULT_GROWTH = 2, DEFAULT_EQ = 60, DEFAULT_EQ_REAL = 5, DEFAULT_CUT = 0;

// The assumptions a new visitor starts with, so the same answer always means the same value.
export function baselineOf(data, workC) {
  const c = data.countries[workC];
  return {
    eqReal: DEFAULT_EQ_REAL,
    eq: DEFAULT_EQ,
    flexCut: DEFAULT_CUT,
    infl: longRunInflation(c.cpi.value, c.target.value),
    bondY: c.y10.value,
    growth: DEFAULT_GROWTH,
  };
}

const round = v => Math.round(v * 100) / 100;
// Every question offers three answers; a test checks this.
const OPTION_COUNT = 3;

// Shares of what other people answered are shown only once this many full sets have been counted.
export const MIN_SHOWN = 30;

export const SCENARIOS = [
  {
    id: 'market', param: 'eqReal', question: '未来几十年，股市的年景你怎么看？',
    options: () => [['偏差，年化 3.5%', 3.5], ['普通，年化 5%', 5], ['不错，年化 6.5%', 6.5]],
    insight: '这里说的是扣掉通胀后的长期收益。差 1 个百分点，几十年下来差出一大截。',
  },
  {
    id: 'crash', param: 'flexCut', question: '碰上大跌那年，第二年你愿意少花多少？',
    options: () => [['照常花', 0], ['少花 10%', 10], ['少花 30%', 30]],
    insight: '放假后最怕刚开始就遇到坏年份。大跌后少花一点，不会让放假提前，有时能让钱撑得更久，但大跌本身不常见。',
  },
  {
    id: 'nerve', param: 'eq', question: '账户一年跌掉三成，你撑得住吗？',
    options: () => [['撑不住，股票少一点（40%）', 40], ['撑得住（60%）', 60], ['还能再多一点（70%）', 70]],
    insight: '股票多，长期预期收益高，中途也晃得更厉害。这是你自己的取舍，不是建议。',
  },
  {
    id: 'prices', param: 'infl', question: '未来的物价，你觉得会怎样？',
    options: base => [[`更稳（${round(base.infl - 0.5)}%）`, round(base.infl - 0.5)], [`差不多（${base.infl}%）`, base.infl], [`涨得更快（${round(base.infl + 1)}%）`, round(base.infl + 1)]],
    insight: '通胀吃掉债券的实际收益。金额都按今天的购买力计算，所以这里影响的是收益，不是支出。',
  },
  {
    id: 'rates', param: 'bondY', question: '未来的利率，你觉得会怎样？',
    options: base => [[`更低（${round(Math.max(base.bondY - 1, 0))}%）`, round(Math.max(base.bondY - 1, 0))], [`差不多（${base.bondY}%）`, base.bondY], [`更高（${round(base.bondY + 1)}%）`, round(base.bondY + 1)]],
    insight: '组合里债券的部分靠它吃饭。利率低的年景，要靠更高的储蓄率来补。',
  },
  {
    id: 'wages', param: 'growth', question: '未来的工资年景，你觉得会怎样？',
    options: base => [['基本不涨（0%）', 0], [`跑赢通胀一点（${base.growth}%）`, base.growth], [`涨得不错（${base.growth + 2}%）`, base.growth + 2]],
    insight: '这里是扣掉通胀后的涨幅。离放假越远，它的累积作用越大。',
  },
];

export const scenarioOptions = (scenario, base) => scenario.options(base).map(([label, value]) => ({ label, value }));

// Stored answers, keeping only current questions with an option that exists.
export function cleanAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const s of SCENARIOS) {
    const v = raw[s.id];
    if (Number.isInteger(v) && v >= 0 && v < OPTION_COUNT) out[s.id] = v;
  }
  return out;
}

// The body sent for counting: every current question answered, nothing else, or nothing at all.
export function countBody(answers) {
  const clean = cleanAnswers(answers);
  return SCENARIOS.every(s => clean[s.id] !== undefined) ? { a: Object.fromEntries(SCENARIOS.map(s => [s.id, clean[s.id]])) } : null;
}

// Answers as parameter values. Answers to questions that no longer exist are ignored.
export function answerValues(answers, base) {
  const values = {};
  for (const scenario of SCENARIOS) {
    const chosen = answers[scenario.id];
    if (chosen !== undefined) values[scenario.param] = scenarioOptions(scenario, base)[chosen].value;
  }
  return values;
}
