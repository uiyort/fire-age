// The holiday age by the odds: the first year from which 8 in 10 simulated lives have money to the end of the plan.
// Every function here runs on the same draws as monteCarlo, so a success rate here is the one the simulation shows.
import { DEFAULT_PATHS, DEFAULT_SEED, HARD_FALL, fwdSolve, growthFactors, normalDraws, planFlows, walkPath } from './engine.js';

export const ODDS = 0.8;

// Share of lives whose money lasts when the holiday starts in year retireT.
// startAt and startAssets begin the walk later, with a given amount and the holiday already started.
export function successAt(p, retireT, s0 = null, { paths = DEFAULT_PATHS, seed = DEFAULT_SEED, startAt = 0, startAssets = p.assets } = {}) {
  if (retireT === null || retireT === undefined) return null;
  const Y = p.life - p.age;
  const g = growthFactors(p, paths, seed);
  const { full, after, sav } = planFlows(p, retireT, s0);
  let ok = 0;
  for (let i = 0; i < paths; i++) {
    const row = i * Y;
    let A = startAssets, alive = true;
    let afterFall = startAt > 0 && g[row + startAt - 1] - 1 <= HARD_FALL;
    for (let t = startAt; t < Y; t++) {
      const gr = g[row + t];
      if (t >= retireT) {
        A -= afterFall ? after[t] : full[t];
        if (A < 0) { alive = false; break; }
        A *= gr;
      } else {
        A = A * gr + sav[t];
        if (A < 0) A = 0;
      }
      afterFall = gr - 1 <= HARD_FALL;
    }
    if (alive) ok++;
  }
  return ok / paths;
}

// Solves are asked for again and again while a page renders, so the answers are kept for the plans seen lately.
const KEY_FIELDS = ['age', 'life', 'assets', 'income', 'expense', 'growth', 'retExp', 'pension', 'pAge', 'r', 'sigma', 'flexCut', 'fxDrift', 'rCur', 'wCur'];
const memo = new Map();
function remember(kind, p, extra, compute) {
  const key = `${kind}|${KEY_FIELDS.map(k => p[k]).join('|')}|${p.fx?.[p.rCur]}|${p.fx?.[p.wCur]}|${extra}`;
  if (memo.has(key)) return memo.get(key);
  const value = compute();
  if (memo.size >= 600) memo.delete(memo.keys().next().value);
  memo.set(key, value);
  return value;
}

// Each extra year of work leaves every life with more money and fewer years to spend it, so the odds only rise
// with the holiday year, and a binary search finds the first year that reaches the target.
export function oddsSolve(p, { target = ODDS, s0 = null } = {}) {
  return remember('solve', p, `${target}|${s0}`, () => {
    const maxT = p.life - p.age - 1;
    if (maxT < 0) return null;
    const ok = t => successAt(p, t, s0) >= target;
    // The year with even odds on a fixed return is close, so the search starts there and walks a few years first.
    let t = Math.min(fwdSolve(p, { s0 }) ?? maxT, maxT);
    if (ok(t)) {
      while (t > 0 && ok(t - 1)) t--;
      return t;
    }
    for (let step = 0; step < 6 && t < maxT; step++) {
      t++;
      if (ok(t)) return t;
    }
    if (!ok(maxT)) return null;
    let lo = t + 1, hi = maxT;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (successAt(p, mid, s0) >= target) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  });
}

// Years until the odds are reached, between whole years by where the target falls between the two years' odds.
export function oddsYears(p, { target = ODDS, s0 = null } = {}) {
  const t = oddsSolve(p, { target, s0 });
  if (t === null || t === 0) return t;
  return remember('years', p, `${target}|${s0}`, () => {
    const before = successAt(p, t - 1, s0), after = successAt(p, t, s0);
    return t - 1 + (target - before) / (after - before);
  });
}

const ageOf = (p, t) => (t === null ? null : p.age + t);

export function oddsRuler(p, { s0 = null } = {}) {
  return {
    five: ageOf(p, oddsSolve(p, { target: 0.5, s0 })),
    eight: ageOf(p, oddsSolve(p, { target: ODDS, s0 })),
    nine: ageOf(p, oddsSolve(p, { target: 0.9, s0 })),
  };
}

// For each holiday year: the money that, spent from that year on, lasts in the target share of lives.
// Each life is walked backward from the end: what it needs at the start of a year is that year's spending
// plus what it needs a year later, discounted by that year's growth.
export function needLine(p, { target = ODDS, paths = DEFAULT_PATHS, seed = DEFAULT_SEED } = {}) {
  return remember('line', p, `${target}|${paths}|${seed}`, () => {
    const Y = p.life - p.age;
    const g = growthFactors(p, paths, seed);
    const k = Math.max(Math.ceil(target * paths) - 1, 0);
    const cols = Array.from({ length: Y }, () => new Float64Array(paths));
    // Spending and pension after the holiday are fixed at that year's currency drift, so between two currencies
    // every amount from year T on is the no-drift amount times drift^T. One walk without drift serves every year,
    // and each year's line is scaled by its drift afterwards.
    const one = planFlows({ ...p, fxDrift: 0 }, 0, null);
    for (let i = 0; i < paths; i++) {
      const row = i * Y;
      let need = 0;
      for (let t = Y - 1; t >= 0; t--) {
        need = (t > 0 && g[row + t - 1] - 1 <= HARD_FALL ? one.after[t] : one.full[t]) + need / g[row + t];
        cols[t][i] = need;
      }
    }
    const drift = T => (p.rCur === p.wCur ? 1 : Math.pow(1 + (p.fxDrift ?? 0) / 100, T));
    // A hair above the life at the quantile, so rounding in the walk forward never sinks that life.
    const line = cols.map((c, T) => c.sort()[k] * drift(T) * (1 + 1e-9));
    line.push(0);
    return line;
  });
}

// Working backward: the first year's saving that gives the target odds at p.tAge, and the odds of the plan as it is.
export function bwdOdds(p, { target = ODDS } = {}) {
  const n = p.tAge - p.age;
  return remember('bwd', p, `${target}|${p.tAge}`, () => {
    const success = successAt(p, n, null);
    if (successAt(p, n, 0) >= target) return { n, s0: 0, success, enough: true };
    let lo = 0, hi = Math.max(p.retExp, p.expense, p.income, 1);
    for (let i = 0; i < 60 && successAt(p, n, hi) < target; i++) hi *= 2;
    // A saving is said to the yuan a month at most, so the search stops once it is that close.
    for (let i = 0; i < 50 && hi - lo > Math.max(1, hi * 1e-4); i++) {
      const mid = (lo + hi) / 2;
      if (successAt(p, n, mid) >= target) hi = mid;
      else lo = mid;
    }
    return { n, s0: hi, success, enough: false };
  });
}

// Outcome of every life, so they can be lined up from hardest to easiest.
function outcomes(p, retireT, s0, paths, seed) {
  const Y = p.life - p.age;
  const g = growthFactors(p, paths, seed);
  const { full, after, sav } = planFlows(p, retireT, s0);
  const rank = new Float64Array(paths);
  for (let i = 0; i < paths; i++) {
    const row = i * Y;
    let A = p.assets, ruinT = -1, afterFall = false;
    for (let t = 0; t < Y; t++) {
      const gr = g[row + t];
      if (retireT !== null && t >= retireT) {
        A -= afterFall ? after[t] : full[t];
        if (A < 0) { ruinT = t; break; }
        A *= gr;
      } else {
        A = A * gr + sav[t];
        if (A < 0) A = 0;
      }
      afterFall = gr - 1 <= HARD_FALL;
    }
    // Lives that ran out come first, the earliest first; then the rest by what is left at the end.
    // The offset is small enough that every year keeps its own value (near 1e18 a double steps by 128).
    rank[i] = ruinT >= 0 ? ruinT - 1e6 : A;
  }
  return Array.from({ length: paths }, (_, i) => i).sort((a, b) => rank[a] - rank[b] || a - b);
}

// Ten parallel lives, one at the start of each tenth of all lives from hardest to easiest. shift picks another life
// in the same tenth. Each comes with its draws, so it can be walked again under another plan.
export function decilePaths(p, retireT, s0 = null, shift = 0, { paths = DEFAULT_PATHS, seed = DEFAULT_SEED } = {}) {
  const Y = p.life - p.age;
  const order = outcomes(p, retireT, s0, paths, seed);
  const z = normalDraws(paths, Y, seed);
  const size = Math.floor(paths / 10);
  return Array.from({ length: 10 }, (_, k) => {
    const index = order[k * size + (((shift % size) + size) % size)];
    const row = z.slice(index * Y, index * Y + Y);
    return { index, z: row, ...walkPath(p, retireT, s0, row) };
  });
}

// The draws of one life, carried to a longer plan: the shared years keep their luck, later years get draws of their own.
export function extendRow(z, length, index, seed = DEFAULT_SEED) {
  if (length <= z.length) return z.slice(0, length);
  const extra = normalDraws(1, length - z.length, seed + 1 + index);
  const out = new Float64Array(length);
  out.set(z);
  out.set(extra, z.length);
  return out;
}

export function dualOdds(p) {
  const bare = { ...p, pension: 0 };
  const age = q => ageOf(q, oddsSolve(q));
  const withPension = age(p), withoutPension = age(bare);
  const a = oddsYears(p), b = oddsYears(bare);
  return { withPension, withoutPension, gain: a === null || b === null ? null : b - a };
}
