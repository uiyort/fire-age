import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParams, monteCarlo, fwdSolve, fiNeed, planFlows, dualAges } from '../site/js/engine.js';
import { ODDS, successAt, oddsSolve, oddsYears, oddsRuler, needLine, bwdOdds, decilePaths, dualOdds, extendRow } from '../site/js/odds.js';
import { walkPath, growthFactors } from '../site/js/engine.js';

const FX = { USD: 1, CNY: 6.6688, MYR: 4.08 };
const base = (o = {}) => buildParams({
  age: 30, life: 95, assets: 500000, income: 300000, expense: 120000, growth: 2,
  retExp: 120000, pension: 36000, pAge: 63, tAge: 45, eq: 60, eqReal: 5, bondY: 1.65,
  infl: 1.5, drag: 0.2, fxDrift: 0, swr: 3.9, autoSwr: true, sigEq: 0.17, sigBd: 0.06,
  rho: 0.2, wCur: 'CNY', rCur: 'CNY', ...o }, FX);

test('the fast success count is exactly the one the full simulation gives', () => {
  for (const q of [base(), base({ flexCut: 20 }), base({ rCur: 'MYR', retExp: 60000, fxDrift: 1 }), base({ pension: 0 })]) {
    for (const t of [0, 8, 14, 30]) assert.equal(successAt(q, t), monteCarlo(q, t).success, `t=${t}`);
  }
  const s0 = 150000;
  assert.equal(successAt(base(), 15, s0), monteCarlo(base(), 15, s0).success);
});

test('the holiday age is the first year with 8 in 10 odds', () => {
  const p = base();
  const t = oddsSolve(p);
  assert.equal(ODDS, 0.8);
  assert.ok(successAt(p, t) >= 0.8);
  assert.ok(successAt(p, t - 1) < 0.8);
  assert.equal(p.age + t, 44);
  assert.equal(p.age + fwdSolve(p), 41);
});

test('the odds ruler gives the ages for 5, 8 and 9 in 10', () => {
  assert.deepEqual(oddsRuler(base()), { five: 41, eight: 44, nine: 46 });
  const far = oddsRuler(base({ income: 100000, assets: 0, pension: 0, growth: 0 }));
  assert.equal(far.eight, null);
});

test('fractional years fall between the year before and the year the odds are reached', () => {
  const p = base();
  const y = oddsYears(p);
  assert.ok(y > oddsSolve(p) - 1 && y <= oddsSolve(p), String(y));
  assert.equal(oddsYears(base({ assets: 1e8 })), 0);
  assert.equal(oddsYears(base({ income: 100000, assets: 0, pension: 0, growth: 0 })), null);
  assert.ok(oddsYears(base({ retExp: 108000, expense: 108000 })) < y);
});

test('the holiday line is the money that, spent from that year, lasts in 8 of 10 lives', () => {
  const p = base();
  const line = needLine(p);
  assert.equal(line.length, p.life - p.age + 1);
  const t = oddsSolve(p);
  // Retiring at year t with exactly the line, and nothing else, lasts in about 8 of 10 lives.
  const atLine = successAt({ ...p, assets: 0 }, t, null, { startAssets: line[t], startAt: t });
  assert.ok(atLine >= 0.8 && atLine < 0.81, String(atLine));
  assert.ok(line[t] > line[t + 10], 'a later holiday needs less');
  assert.equal(line[p.life - p.age], 0);
});

test('the holiday line holds across currencies', () => {
  for (const p of [base({ rCur: 'MYR', retExp: 60000, pension: 0, fxDrift: 1 }), base({ rCur: 'MYR', retExp: 60000, pension: 20000, pAge: 63, fxDrift: -1.5, flexCut: 20 })]) {
    const line = needLine(p);
    for (const t of [3, 20, 36]) {
      const atLine = successAt({ ...p, assets: 0 }, t, null, { startAssets: line[t], startAt: t });
      assert.ok(atLine >= 0.8 && atLine < 0.81, `t=${t}: ${atLine}`);
    }
  }
});

test('working backward finds the saving that gives 8 in 10 at the chosen age', () => {
  const p = base({ tAge: 42 });
  const { s0, success, enough } = bwdOdds(p);
  assert.equal(enough, false);
  assert.ok(successAt(p, 12, s0) >= 0.8);
  assert.ok(successAt(p, 12, s0 * 0.97) < 0.8);
  assert.equal(success, successAt(p, 12));
  assert.equal(bwdOdds(base({ assets: 1e8, tAge: 40 })).enough, true);
});

test('ten parallel lives sit at the deciles and the green ones match the odds rounded down', () => {
  const p = base();
  for (const t of [11, 13, 14, 16]) {
    const lives = decilePaths(p, t, null);
    assert.equal(lives.length, 10);
    const lasted = lives.filter(l => l.ruinAge === null).length;
    assert.equal(lasted, Math.floor(successAt(p, t) * 10 + 1e-9), `t=${t}`);
  }
  const lives = decilePaths(p, 14, null);
  assert.ok(lives[0].ruinAge !== null, 'the first is the hardest');
  assert.ok(lives[9].years.at(-1).assets >= lives[8].years.at(-1).assets);
  const other = decilePaths(p, 14, null, 3);
  assert.notEqual(other[5].index, lives[5].index);
});

test('a decile life walks the same luck again under another plan', () => {
  const p = base();
  const [hardest] = decilePaths(p, 14, null);
  const again = walkPath(p, 14, null, hardest.z);
  assert.deepEqual(again.years.map(y => y.assets), hardest.years.map(y => y.assets));
  const longer = extendRow(hardest.z, 70, hardest.index);
  assert.equal(longer.length, 70);
  assert.deepEqual(Array.from(longer.slice(0, 65)), Array.from(hardest.z));
});

test('with and without pension, by the same odds', () => {
  const d = dualOdds(base());
  assert.equal(d.withPension, 44);
  assert.ok(d.withoutPension >= d.withPension);
});

test('lives that run out are lined up by when they ran out, earliest first', () => {
  const p = base();
  for (const t of [11, 14, 16, 18]) {
    const ruined = decilePaths(p, t, null).filter(l => l.ruinAge !== null).map(l => l.ruinAge);
    assert.deepEqual(ruined, [...ruined].sort((a, b) => a - b), `t=${t}: ${ruined}`);
  }
});

test('selfPay: zero changes nothing, positive raises the need and never moves the holiday earlier', () => {
  const p0 = base(), z = base({ selfPay: 0 }), s = base({ selfPay: 24000 });
  assert.equal(oddsSolve(z), oddsSolve(p0));
  assert.equal(fiNeed(z, 10), fiNeed(p0, 10));
  assert.equal(monteCarlo(z, 10).success, monteCarlo(p0, 10).success);
  assert.ok(fiNeed(s, 10) > fiNeed(p0, 10));
  assert.ok(oddsSolve(s) >= oddsSolve(p0));
});

test('selfPay: the odds cache does not mix runs with different selfPay', () => {
  const a = oddsSolve(base({ selfPay: 0 }));
  const b = oddsSolve(base({ selfPay: 24000 }));
  assert.notEqual(a, b);
});

test('selfPay: spending from the pension age on is the same as without it', () => {
  const a = planFlows(base(), 10), b = planFlows(base({ selfPay: 24000 }), 10);
  const p = base();
  for (let t = 0; t <= p.life - p.age; t++) {
    if (p.age + t >= p.pAge) assert.equal(b.full[t], a.full[t], `t=${t}`);
    else assert.ok(b.full[t] > a.full[t], `t=${t}`);
  }
});

test('selfPay: the need keeps rising with selfPay on a realistic plan (the pension cap does not clip it)', () => {
  const q = s => base({ retExp: 72000, pension: 24000, assets: 200000, income: 144000, expense: 72000, selfPay: s });
  const n = [0, 24000, 60000, 100000].map(s => fiNeed(q(s), 10));
  for (let i = 1; i < n.length; i++) assert.ok(n[i] > n[i - 1], `step ${i}: ${n}`);
});

test('selfPay: the without-pension plan carries no self-pay', () => {
  const p = base({ selfPay: 60000 });
  const bare = base({ pension: 0, selfPay: 0 });
  assert.equal(dualOdds(p).withoutPension, (oddsSolve(bare) === null ? null : bare.age + oddsSolve(bare)));
  assert.equal(dualAges(p).withoutPension, dualAges(base()).withoutPension);
});

test('selfPay: starting the holiday with exactly the need line gives the target odds under currency drift', () => {
  for (const fxDrift of [2, -2]) {
    const p = base({ rCur: 'MYR', retExp: 60000, pension: 15000, selfPay: 40000, fxDrift });
    const line = needLine(p);
    for (const T of [5, 15, 25]) {
      const s = successAt(p, T, null, { startAt: T, startAssets: line[T] });
      assert.ok(Math.abs(s - 0.8) <= 0.01, `drift ${fxDrift} T=${T}: ${s}`);
    }
  }
});

// ---- spending that ends at a known age ----
const mort = (o = {}) => ({ id: 'mortgage', amount: 36000, endAge: 50, nominal: true, ...o });

test('events: a mortgage ending in 20 years never makes the holiday later', () => {
  const a = oddsSolve(base()), b = oddsSolve(base({ events: [mort({ endAge: 50 })] }));
  assert.ok(b <= a, `${b} vs ${a}`);
});

test('events: the odds cache does not mix runs with different end ages', () => {
  const a = oddsSolve(base({ events: [mort({ endAge: 36 })] }));
  const b = oddsSolve(base({ events: [mort({ endAge: 60 })] }));
  const c = oddsSolve(base({ events: [mort({ endAge: 36 })] }));
  assert.notEqual(a, b);
  assert.equal(a, c);
  const nl = needLine(base({ events: [mort({ endAge: 36 })] }))[10];
  assert.notEqual(nl, needLine(base({ events: [mort({ endAge: 60 })] }))[10]);
});

test('events: the without-pension plan keeps the events', () => {
  const p = base({ selfPay: 20000, events: [mort()] });
  const bare = base({ pension: 0, selfPay: 0, events: [mort()] });
  assert.equal(dualOdds(p).withoutPension, (oddsSolve(bare) === null ? null : bare.age + oddsSolve(bare)));
});

test('events: starting with exactly the need line gives the target odds, with and without drift', () => {
  for (const fxDrift of [2, -2, 0]) {
    const p = base({ rCur: 'MYR', retExp: 60000, pension: 15000, fxDrift, events: [mort({ amount: 30000, endAge: 45 })] });
    const line = needLine(p);
    for (const T of [5, 15, 25]) {
      const s = successAt(p, T, null, { startAt: T, startAssets: line[T] });
      assert.ok(Math.abs(s - 0.8) <= 0.01, `drift ${fxDrift} T=${T}: ${s}`);
    }
  }
  const q = base({ selfPay: 30000, events: [mort({ amount: 30000, endAge: 45 }), { id: 'kids', amount: 20000, endAge: 55, nominal: false }] });
  const line = needLine(q);
  for (const T of [5, 15, 25]) {
    const s = successAt(q, T, null, { startAt: T, startAssets: line[T] });
    assert.ok(Math.abs(s - 0.8) <= 0.01, `same currency T=${T}: ${s}`);
  }
});

test('events: the memo knows infl, even when r does not depend on it', () => {
  const q = infl => base({ eq: 100, infl, events: [mort({ endAge: 60 })] });
  const a = needLine(q(1.5))[10], b = needLine(q(6))[10];
  assert.notEqual(a, b);
  assert.ok(b < a);
});

test('events: in one currency the single backward walk equals a walk for each holiday year', () => {
  const p = base({ selfPay: 30000, flexCut: 20, events: [mort({ amount: 30000, endAge: 45 }), { id: 'kids', amount: 20000, endAge: 55, nominal: false }] });
  const Y = p.life - p.age, g = growthFactors(p), k = Math.ceil(0.8 * 2000) - 1;
  const line = needLine(p);
  for (let T = 0; T < Y; T++) {
    const { full, after } = planFlows(p, T, null);
    const c = new Float64Array(2000);
    for (let i = 0; i < 2000; i++) {
      let need = 0;
      for (let t = Y - 1; t >= T; t--) {
        const fall = t > 0 && g[i * Y + t - 1] - 1 <= -0.15;
        need = (fall ? after[t] : full[t]) + need / g[i * Y + t];
      }
      c[i] = need;
    }
    const ref = c.sort()[k] * (1 + 1e-9);
    assert.ok(Math.abs(line[T] - ref) <= 1e-9 * Math.max(1, ref), `T=${T}: ${line[T]} vs ${ref}`);
  }
});
