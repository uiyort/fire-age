// Financial model for 放假年龄 / FIRE Age. Pure functions, no DOM.
// All amounts are real (today's purchasing power), computed in the work currency.

const CLAMP_R_MIN = -0.5;
const SWR_BY_HORIZON = [[30, 3.9], [40, 3.5], [50, 3.3], [60, 3.1]];

export const DEFAULT_SEED = 20261026;
export const DEFAULT_PATHS = 2000;

export const conv = (v, from, to, fx) => v / fx[from] * fx[to];

export const longRunInflation = (cpi, target) => Math.round((cpi + target) / 2 * 10) / 10;

export function buildParams(raw, fx) {
  const p = { ...raw, fx };
  p.age = Math.round(raw.age);
  p.life = Math.max(Math.round(raw.life), p.age + 2);
  p.tAge = Math.min(Math.max(Math.round(raw.tAge), p.age + 1), p.life - 1);
  p.flexCut = Math.min(Math.max(raw.flexCut ?? 0, 0), 100);
  const w = Math.min(Math.max(raw.eq, 0), 100) / 100;
  p.w = w;
  p.bondReal = (raw.bondY - raw.infl) / 100;
  p.r = Math.max(w * raw.eqReal / 100 + (1 - w) * p.bondReal - raw.drag / 100, CLAMP_R_MIN);
  p.sigma = Math.sqrt(w * w * raw.sigEq ** 2 + (1 - w) ** 2 * raw.sigBd ** 2 + 2 * w * (1 - w) * raw.rho * raw.sigEq * raw.sigBd);
  return p;
}

export function swrFor(p, H) {
  if (!p.autoSwr) return p.swr / 100;
  const pts = SWR_BY_HORIZON;
  if (H <= pts[0][0]) return pts[0][1] / 100;
  const last = pts[pts.length - 1];
  if (H >= last[0]) return last[1] / 100;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i], [b, vb] = pts[i + 1];
    if (H <= b) return (va + (vb - va) * (H - a) / (b - a)) / 100;
  }
  return last[1] / 100;
}

// Retirement spend and pension at year t, converted to the work currency.
// Currency drift only exists between two currencies.
const drift = (p, t) => (p.rCur === p.wCur ? 1 : Math.pow(1 + p.fxDrift / 100, t));
const spendW = (p, t, E) => conv(E, p.rCur, p.wCur, p.fx) * drift(p, t);
const pensW = (p, t) => conv(p.pension, p.rCur, p.wCur, p.fx) * drift(p, t);

// Assets needed at the start of year t to retire then and spend E (retirement currency) until p.life.
export function fiNeed(p, t, E = p.retExp, r = p.r) {
  const a = p.age + t, H = Math.max(p.life - a, 1);
  const Ew = spendW(p, t, E), Pw = pensW(p, t);
  if (Pw <= 0) return Ew / swrFor(p, H);
  if (p.pAge <= a) return Math.max(Ew - Pw, 0) / swrFor(p, H);
  const b = Math.min(p.pAge - a, H);
  let pv = 0;
  for (let k = 0; k < b; k++) pv += Ew / Math.pow(1 + r, k);
  if (b < H) pv += Math.max(Ew - Pw, 0) / swrFor(p, H - b) / Math.pow(1 + r, b);
  // A pension can only help: never ask for more than the same plan with no pension.
  return Math.min(pv, Ew / swrFor(p, H));
}

export const savingsAt = (p, t, s0 = null) =>
  s0 != null ? s0 * Math.pow(1 + p.growth / 100, t) : p.income * Math.pow(1 + p.growth / 100, t) - p.expense;

// Assets cannot fall below zero. Pass floor: false only to value a stream of savings on its own.
export function assetsAt(p, n, { r = p.r, s0 = null, A0 = p.assets, floor = true } = {}) {
  let A = A0;
  for (let t = 0; t < n; t++) {
    A = A * (1 + r) + savingsAt(p, t, s0);
    if (floor && A < 0) A = 0;
  }
  return A;
}

export function fwdSolve(p, { r = p.r, s0 = null, E = p.retExp } = {}) {
  let A = p.assets;
  const maxT = p.life - p.age - 1;
  for (let t = 0; t <= maxT; t++) {
    if (A >= fiNeed(p, t, E, r)) return t;
    A = Math.max(A * (1 + r) + savingsAt(p, t, s0), 0);
  }
  return null;
}

// Years until financial independence, interpolated inside the year it happens.
export function fiYears(p, { r = p.r, s0 = null, E = p.retExp } = {}) {
  const t = fwdSolve(p, { r, s0, E });
  if (t === null || t === 0) return t;
  const gapPrev = fiNeed(p, t - 1, E, r) - assetsAt(p, t - 1, { r, s0 });
  const gapNow = assetsAt(p, t, { r, s0 }) - fiNeed(p, t, E, r);
  return t - 1 + gapPrev / (gapPrev + gapNow);
}

function bisect(f, lo, hi, iterations = 80) {
  let flo = f(lo);
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if ((fm >= 0) === (flo >= 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

export function bwdSolve(p) {
  const n = p.tAge - p.age, r = p.r, g = p.growth / 100;
  const need = fiNeed(p, n);
  let G = 0;
  for (let k = 0; k < n; k++) G += Math.pow(1 + g, k) * Math.pow(1 + r, n - 1 - k);
  const s0 = (need - p.assets * Math.pow(1 + r, n)) / G;

  const fr = rr => assetsAt(p, n, { r: rr }) - fiNeed(p, n, p.retExp, rr);
  let reqR;
  if (fr(0.30) < 0) reqR = Infinity;
  else if (fr(-0.10) >= 0) reqR = -Infinity;
  else reqR = bisect(fr, -0.10, 0.30);

  const An = assetsAt(p, n);
  const maxE = bisect(E => An - fiNeed(p, n, E), 0, conv(An, p.wCur, p.rCur, p.fx) + p.pension + 1);

  const futureSav = assetsAt(p, n, { A0: 0, floor: false });
  const reqA0 = Math.max((need - futureSav) / Math.pow(1 + r, n), 0);
  return { n, need, s0, reqR, maxE, reqA0, An };
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const HARD_FALL = -0.15;

// Yearly cash flows for a simulated plan. Spending after a hard fall can be cut by p.flexCut percent.
function planFlows(p, retireT, s0) {
  const gross = [], pens = [], sav = [];
  for (let t = 0; t <= p.life - p.age; t++) {
    // Drift stops at retirement, matching fiNeed: the need is fixed in the year the holiday starts.
    const k = retireT == null ? t : Math.min(t, retireT);
    gross.push(spendW(p, k, p.retExp));
    pens.push(p.age + t >= p.pAge ? pensW(p, k) : 0);
    sav.push(savingsAt(p, t, s0));
  }
  const cut = (p.flexCut ?? 0) / 100;
  const spendAt = (t, afterFall) => Math.max(gross[t] * (afterFall ? 1 - cut : 1) - pens[t], 0);
  return { spendAt, sav };
}

// One path of the same simulation monteCarlo runs: same draws, same order, same rules.
export function lifePath(p, retireT, s0, seed) {
  const Y = p.life - p.age;
  const rnd = mulberry32(seed);
  const mu = Math.log(1 + p.r), s = p.sigma;
  const { spendAt, sav } = planFlows(p, retireT, s0);
  const years = [];
  let A = p.assets, ruinAge = null, afterFall = false;
  for (let t = 0; t <= Y; t++) {
    if (t === Y) {
      years.push({ t, age: p.age + t, assets: A, ret: null });
      break;
    }
    const u1 = rnd() || 1e-12, u2 = rnd();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const gr = Math.exp(mu + s * z);
    years.push({ t, age: p.age + t, assets: A, ret: gr - 1 });
    if (retireT != null && t >= retireT) {
      A -= spendAt(t, afterFall);
      if (A < 0) {
        A = 0;
        ruinAge ??= p.age + t;
      }
      A *= gr;
    } else {
      A = Math.max(A * gr + sav[t], 0);
    }
    afterFall = gr - 1 <= HARD_FALL;
  }
  return { seed, retireT, years, ruinAge };
}

export function monteCarlo(p, retireT, s0 = null, { paths = DEFAULT_PATHS, seed = DEFAULT_SEED } = {}) {
  const Y = p.life - p.age;
  const rnd = mulberry32(seed);
  // p.r is a geometric return, so the median path compounds at exactly p.r.
  const mu = Math.log(1 + p.r), s = p.sigma;
  const cols = Array.from({ length: Y + 1 }, () => new Float64Array(paths));
  const { spendAt, sav } = planFlows(p, retireT, s0);
  let ok = 0;
  for (let i = 0; i < paths; i++) {
    let A = p.assets, alive = true, afterFall = false;
    for (let t = 0; t <= Y; t++) {
      cols[t][i] = A;
      if (t === Y) break;
      const u1 = rnd() || 1e-12, u2 = rnd();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const gr = Math.exp(mu + s * z);
      if (retireT != null && t >= retireT) {
        A -= spendAt(t, afterFall);
        if (A < 0) { A = 0; alive = false; }
        A *= gr;
      } else {
        A = A * gr + sav[t];
        if (A < 0) A = 0;
      }
      afterFall = gr - 1 <= HARD_FALL;
    }
    if (alive) ok++;
  }
  const q = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f * arr.length))];
  const bands = cols.map(c => {
    const a = Array.from(c).sort((x, y) => x - y);
    return [q(a, .1), q(a, .25), q(a, .5), q(a, .75), q(a, .9)];
  });
  return { bands, success: retireT == null ? null : ok / paths, paths, seed };
}

// Assets needed today so that compounding alone reaches the need when the pension starts.
export function coastNeed(p) {
  const t = Math.max(p.pAge - p.age, 0);
  return fiNeed(p, t) / Math.pow(1 + p.r, t);
}

export function dualAges(p) {
  const bare = { ...p, pension: 0 };
  const age = q => { const t = fwdSolve(q); return t === null ? null : q.age + t; };
  const withPension = age(p), withoutPension = age(bare);
  // How much earlier the pension makes the holiday, in fractional years.
  const gain = withPension === null || withoutPension === null ? null : fiYears(bare) - fiYears(p);
  return { withPension, withoutPension, gain };
}

export const savingsRate = p => (p.income > 0 ? (p.income - p.expense) / p.income : null);
