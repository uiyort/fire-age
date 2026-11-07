// A guessing game on the person's own numbers: which of two changes moves the holiday age more?
// Guessing first makes the answer stick. The stock share is left out, because a right answer there would read as advice.
import { impactOf } from './levers.js';

const TIE_YEARS = 0.05;

const ROUNDS = [
  { a: 'income', b: 'expense', insight: '这两项改的都是每年能存多少。比例相同时，基数大的那一项多存得更多。' },
  { a: 'expense', b: 'retExp', insight: '当前支出只影响能存多少，退休支出决定放假线有多高：它每少一块钱，放假线要少好几十块。' },
  { a: 'assets', b: 'growth', insight: '现有资产多 10% 是一次性的，收入增速每年都在累积。离放假越远，增速越占优。' },
  { a: 'income', b: 'growth', insight: '一次涨 10% 马上见效，每年多涨 1 个点要慢慢滚。比的是你还有多少年可以滚。' },
  { a: 'drag', b: 'assets', insight: '费率看起来很小，却是每年从收益里扣。时间越长，扣掉的越多。' },
  { a: 'life', b: 'retExp', insight: '多规划 5 年，只是让提取率略低一点；退休支出少 10%，放假线直接少 10%。活得久比想象中便宜，花得多比想象中贵。' },
];

const side = (p, id) => {
  const { stepLabel, gainYears } = impactOf(p, id);
  return { id, label: stepLabel, gain: gainYears };
};

// Rounds where neither change moves the age are left out: there is nothing to guess.
export function quizRounds(p) {
  const rounds = [];
  for (const round of ROUNDS) {
    const a = side(p, round.a), b = side(p, round.b);
    if (a.gain === null || b.gain === null) continue;
    if (Math.abs(a.gain) < TIE_YEARS && Math.abs(b.gain) < TIE_YEARS) continue;
    const diff = Math.abs(a.gain) - Math.abs(b.gain);
    rounds.push({ a, b, insight: round.insight, answer: Math.abs(diff) < TIE_YEARS ? 'either' : diff > 0 ? 'a' : 'b' });
  }
  return rounds;
}

export const quizScore = (rounds, answers) =>
  rounds.filter((r, i) => answers[i] && (r.answer === 'either' || answers[i] === r.answer)).length;

export function quizTitle(score, total) {
  const share = total ? score / total : 0;
  if (share >= 0.8) return '放假军师';
  if (share >= 0.5) return '识途老马';
  return '新手上路';
}

// The changes picked so far, which become the plan of the fifth life.
export const pickedSteps = (rounds, answers) =>
  [...new Set(rounds.flatMap((round, i) => (answers[i] ? [round[answers[i]].id] : [])))];
