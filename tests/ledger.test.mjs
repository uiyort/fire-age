// The ledger behind the fund line (spec §7), the one denominator of N 倍 and the implied rate (spec §9.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, setRetireCountry, toParams } from '../site/js/state.js';
import { firstDraw, fwdSolve } from '../site/js/engine.js';
import { bwdOdds, oddsAround, oddsSolve, oddsYears, needLine, successAt } from '../site/js/odds.js';
import { heroModel } from '../site/js/holiday.js';
import { heroHtml, heldHeroHtml, ledgerHtml, proLedgerRowHtml, sideCardHtml, stickyHtml, tilesHtml } from '../site/js/views.js';

const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const S = { ...defaultState(DATA), income: 360000, expense: 180000, retExp: 180000,
  real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
const solve = s => { const p = toParams(s, DATA, 2026); const t = oddsSolve(p); return { p, t, need: needLine(p)[t] }; };

test('oddsAround: three years round the holiday, from the same simulation', () => {
  const { p, t } = solve(S);
  const rows = oddsAround(p, t);
  assert.deepEqual(rows.map(r => r.t), [t - 1, t, t + 1]);
  assert.deepEqual(rows.map(r => r.age), [p.age + t - 1, p.age + t, p.age + t + 1]);
  assert.equal(rows[1].share, successAt(p, t)); assert.equal(rows[1].count, Math.round(successAt(p, t) * 2000));
  assert.deepEqual(oddsAround(p, 0).map(r => r.t), [0, 1]);
  const T = p.life - p.age - 1;
  assert.deepEqual(oddsAround(p, T).map(r => r.t), [T - 1, T]);
});

test('the multiple and the implied rate share one denominator: the first holiday year\'s draw', () => {
  const { p, t, need } = solve(S);
  const h = heroModel({ mode: 'fwd', p, t, bwd: null, success: 0.8, need });
  assert.equal(h.times, Math.round(need / firstDraw(p, t)));
  const tiles = tilesHtml({ mode: 'fwd', p, t, bwd: null, mc: null, dispCur: 'CNY', target: needLine(p) });
  assert.match(tiles, new RegExp(`反推的提取率是 ${(firstDraw(p, t) / need * 100).toFixed(1)}%`));
});

test('the fund line is the ledger\'s closed state: no 年的花销, a toggle instead', () => {
  const { p, t, need } = solve(S);
  const h = heroModel({ mode: 'fwd', p, t, bwd: null, success: 0.8, need });
  const closed = heroHtml(h, { p, dispCur: 'CNY' });
  assert.ok(!closed.includes('年的花销'));
  assert.match(strip(closed), /放假资金：已有 ¥20万 \/ 需要 ¥\d+万（ ?\d+% ?） 怎么算的 ▸/);
  assert.match(closed, /<button type="button" class="ledger-toggle" aria-expanded="false" aria-controls="ledger">/);
  const open = heroHtml(h, { p, dispCur: 'CNY', open: true });
  assert.match(open, /aria-expanded="true"/); assert.ok(strip(open).includes('怎么算的 ▾'));
  assert.ok(strip(heldHeroHtml()).includes('放假资金 — 怎么算的 ▸'));
  const far = heroModel({ mode: 'fwd', p, t: null, bwd: null, success: null, need });
  assert.ok(strip(heroHtml(far, { p, dispCur: 'CNY' })).includes('放假资金：按现在的节奏到不了 怎么算的 ▸'));
});

test('ledgerHtml simple: the three sections in the spec\'s words', () => {
  const plan = solve(S); const { p, t } = plan;
  const html = ledgerHtml({ rows: storyRows(S, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' });
  const text = strip(html);
  for (const s of ['① 攒钱', `30 → ${30 + t} 岁`, '已有 ¥20万', '到手 ¥30,000/月', '− 支出 ¥15,000/月', '└ 其中月供 7,500 → 2045', '= 每月存下 ¥15,000', '收入每年 +2% 本工具设定',
    `→ ${29 + t} 岁每月存下`, '② 放假以后 每月花', `${30 + t}–49 退休后 ≈ ¥15,000`, '50 起 月供 ¥7,500', '63 起 养老金 — ›',
    `⇒ ${30 + t} 岁放假要有 ¥391万`, `≈ 年支出 × ${Math.round(plan.need / firstDraw(p, t))} 倍 · 八成年景够花到 95 岁`, '③ 2,000 种年景', '平均每年 2.9% 本工具设定',
    `⇒ 第一个到八成 ${30 + t} 岁`, '≈ 估算 · 按今天的钱', '计算方法 ›']) assert.ok(text.includes(s), s);
  assert.match(html, /<s[^>]*>月供<\/s>/); assert.match(html, /href="method\.html#accumulate"/);
  assert.match(html, /href="method\.html#need-line"/); assert.match(html, /href="method\.html#odds"/);
  assert.ok(!text.includes(' / 2,000') && !text.includes('成功率') && !text.includes('%（'));   // the simple view says only X 成
  // One line per year round the holiday, ten dots each, the holiday year marked.
  for (const r of oddsAround(p, t)) {
    const dots = '●'.repeat(Math.floor(r.count / 2000 * 10)) + '○'.repeat(10 - Math.floor(r.count / 2000 * 10));
    assert.ok(text.includes(`${r.age} 岁 ${dots} ${Math.floor(r.share * 10)} 成`), `${r.age}`);
  }
  assert.match(html, new RegExp(`class="[^"]*\\bpick\\b[^"]*"[^>]*>(?:(?!</div>).)*${30 + t} 岁`));
  // Every input row's label goes back to its field; the └ row under retirement spending is the field line's, not the ledger's.
  for (const f of ['assets', 'income', 'expense', 'mortgage.monthly', 'retExp', 'pension']) assert.match(html, new RegExp(`<button type="button" class="link[^"]*" data-field="${f.replace('.', '\\.')}"`), f);
  assert.equal((text.match(/其中月供/g) ?? []).length, 1);
});

test('ledgerHtml: an item that ended before the holiday is not drawn again as its own → row', () => {
  const p = toParams(S, DATA, 2026); const t = 23;
  const plan = { p, t, need: needLine(p)[t] };
  const text = strip(ledgerHtml({ rows: storyRows(S, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' }));
  assert.ok(!text.includes('50 起'));
  assert.ok(text.includes('53 起 退休后 月供 ≈ ¥7,500'), text);
});

test('ledgerHtml held, unreachable, today and backward', () => {
  const s = { ...S, expense: 84000 };
  const held = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, null), list: problems(s, DATA, 2026), odds: [], plan: null, state: 'held', view: 'simple', mode: 'fwd', p: null, dispCur: 'CNY' }));
  for (const x of ['└ 其中月供 7,500 ≥ 每月支出 7,000 ✕ ›', '= 每月存下 —', '⇒ ② 要有 —', '⇒ ③ 放假年龄 —']) assert.ok(held.includes(x), x);
  // Everything after the stopped row waits: no amount, no ② rows, no line from storyRows' own 放假要有.
  for (const x of ['退休后', '放假要有', '7,500 → 2045', '③ 2,000']) assert.ok(!held.includes(x), x);
  const heldHtml = ledgerHtml({ rows: storyRows(s, DATA, 2026, null), list: problems(s, DATA, 2026), odds: [], plan: null, state: 'held', view: 'simple', mode: 'fwd', p: null, dispCur: 'CNY' });
  assert.equal((heldHtml.match(/aria-label="没有数"/g) ?? []).length, 3);
  const blank = { ...S, expense: null };
  const blankText = strip(ledgerHtml({ rows: storyRows(blank, DATA, 2026, null), list: problems(blank, DATA, 2026), odds: [], plan: null, state: 'held', view: 'simple', mode: 'fwd', p: null, dispCur: 'CNY' }));
  assert.ok(blankText.includes('支出 待填 ›'), blankText);
  assert.ok(!blankText.includes('其中月供'));

  const poor = { ...defaultState(DATA), income: 72000, expense: 72000 };
  const p = toParams(poor, DATA, 2026); const T = p.life - p.age - 1;
  const unPlan = { p, t: T, need: null, unreachable: true };
  const un = strip(ledgerHtml({ rows: storyRows(poor, DATA, 2026, unPlan), list: [], odds: oddsAround(p, T), plan: unPlan, state: 'unreachable', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' }));
  for (const x of [`${p.age} → ${p.age + T} 岁`, `② 如果 ${p.age + T} 岁放假`, `${p.age + T} 岁 `, '规划期内到不了八成']) assert.ok(un.includes(x), x);
  for (const x of ['放假要有', '年支出 ×', `${p.age + T - 1} 岁 ●`, '第一个到八成']) assert.ok(!un.includes(x), x);

  const rich = { ...S, assets: 20000000 };
  const now = solve(rich);
  assert.equal(now.t, 0);
  const today = strip(ledgerHtml({ rows: storyRows(rich, DATA, 2026, now), list: [], odds: oddsAround(now.p, 0), plan: now, state: 'now', view: 'simple', mode: 'fwd', p: now.p, dispCur: 'CNY' }));
  assert.match(today, /① 攒钱 不用再攒 ② 放假以后/);
  assert.match(today, /今天 [●○]{10} \d+ 成/);
  for (const x of ['到手', '每月存下', '31 岁 ●']) assert.ok(!today.includes(x), x);

  const back = { ...S, mode: 'bwd', tAge: 45 };
  const bp = toParams(back, DATA, 2026); const n = 15;
  const bPlan = { p: bp, t: n, need: needLine(bp)[n] };
  const bo = bwdOdds(bp);
  const bwd = strip(ledgerHtml({ rows: storyRows(back, DATA, 2026, bPlan), list: [], odds: oddsAround(bp, n), plan: bPlan, state: 'ok', view: 'simple', mode: 'bwd', p: bp, dispCur: 'CNY', bwdOdds: bo }));
  for (const x of ['30 → 45 岁', `45 岁（你定的） `, `⇒ 要八成：第一年每月存 ¥${Math.round(bo.s0 / 12).toLocaleString('en-US')}`]) assert.ok(bwd.includes(x), x);
  for (const x of ['44 岁 ●', '46 岁 ●', '第一个到八成']) assert.ok(!bwd.includes(x), x);
});

// ---- Review round 1.

test('ledgerHtml: a saving below zero later on is written with U+2212 and the orange !', () => {
  const s = { ...defaultState(DATA), income: 60000, expense: 360000 };
  const p = toParams(s, DATA, 2026); const T = p.life - p.age - 1;
  const plan = { p, t: T, need: null, unreachable: true };
  const html = ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: [], odds: oddsAround(p, T), plan, state: 'unreachable', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' });
  assert.ok(!html.includes('¥-'), 'no ASCII minus');
  assert.match(strip(html), new RegExp(`→ ${p.age + T - 1} 岁每月存下 ! −¥[0-9,]+`));
  assert.match(html, /<span class="warn"><span aria-label="提示">!<\/span> −¥[\d,]+<\/span>/);
});

test('ledgerHtml held: only the stops shown on the page stop it; one still being typed is a plain row', () => {
  const s = { ...S, expense: 84000, pension: -1200 };
  const all = problems(s, DATA, 2026);
  assert.ok(all.some(q => q.rule === 'A3') && all.some(q => q.rule === 'B2' && q.field === 'pension'));
  const shownOnly = all.filter(q => q.rule === 'B2');
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, null), list: shownOnly, odds: [], plan: null, state: 'held', view: 'simple', mode: 'fwd', p: null, dispCur: 'CNY' }));
  assert.ok(!text.includes('≥ 每月支出'), text);
  assert.ok(text.includes('└ 其中月供 7,500 → 2045'), text);
  assert.ok(text.includes('② 放假以后') && text.includes('预计每月养老金 −100 &lt; 0 ✕ ›'), text);
  assert.equal((text.match(/✕/g) ?? []).length, 1);
});

test('ledgerHtml backward: savings already enough say so, not ¥0', () => {
  const back = { ...S, assets: 20000000, mode: 'bwd', tAge: 45 };
  const p = toParams(back, DATA, 2026); const n = 15;
  const plan = { p, t: n, need: needLine(p)[n] };
  const bo = bwdOdds(p);
  assert.equal(bo.enough, true);
  const text = strip(ledgerHtml({ rows: storyRows(back, DATA, 2026, plan), list: [], odds: oddsAround(p, n), plan, state: 'ok', view: 'simple', mode: 'bwd', p, dispCur: 'CNY', bwdOdds: bo }));
  assert.ok(text.includes('⇒ 现在的存款已经够了'), text);
  assert.ok(!text.includes('¥0') && !text.includes('要八成'));
});

test('ledgerHtml ②: rows in age order; one that starts before the holiday starts at it', () => {
  const poor = { ...defaultState(DATA), income: 72000, expense: 72000, pension: 36000, pAge: 63 };
  const p = toParams(poor, DATA, 2026); const T = p.life - p.age - 1;
  const plan = { p, t: T, need: null, unreachable: true };
  const un = strip(ledgerHtml({ rows: storyRows(poor, DATA, 2026, plan), list: [], odds: oddsAround(p, T), plan, state: 'unreachable', view: 'simple', mode: 'fwd', p, dispCur: 'CNY' }));
  assert.ok(un.includes(`${p.age + T} 起 养老金 −¥3,000`), un);
  assert.ok(!un.includes('63 起'));
  assert.ok(un.indexOf('退休后') < un.indexOf('养老金'));
  const s = { ...S, pension: 48000, pAge: 63, selfPension: 1000, selfMedical: 500 };
  const q = solve(s);
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, q), list: [], odds: oddsAround(q.p, q.t), plan: q, state: 'ok', view: 'simple', mode: 'fwd', p: q.p, dispCur: 'CNY' }));
  const at = x => text.indexOf(x);
  const h = 30 + q.t;
  for (const x of [`${h}–49 退休后`, `${h}–63 自缴`, '50 起 月供', '63 起 养老金']) assert.ok(at(x) >= 0, x);
  assert.ok(at(`${h}–49 退休后`) < at(`${h}–63 自缴`) && at(`${h}–63 自缴`) < at('50 起 月供') && at('50 起 月供') < at('63 起 养老金'));
});

// ---- The professional ledger (spec §7.3).

test('ledgerHtml pro: every consideration the model uses, in years', () => {
  const s = { ...S, view: 'pro' };
  const plan = solve(s); const { p, t, need } = plan;
  const mc = { bands: Array.from({ length: p.life - p.age + 1 }, () => [0, 0, 4294780, 0, 0]) };
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'pro', mode: 'fwd', p, dispCur: 'CNY', mc }));
  for (const x of [`t = 0…${t - 1}`, '税后年收入 · 实际增长 +2%/年 本工具设定', '当前年支出 · 按今天的钱不变 本工具设定', '└ 其中月供 90,000/年 → 2045',
    `月供实际 × (1 + ${p.infl}%)^−t`, '年末存入 · 资产不低于 0 本工具设定', '年初取出', '一年跌 ≥ 15% 次年少花（只砍生活费，月供、自缴照付）',
    '退休币升值（只算到放假那年） — 同币种', '放假线（每条路径倒推，取 80 分位）', `反推提取率 ${(firstDraw(p, t) / need * 100).toFixed(1)}% · 对照 3.9%`,
    '③ 2,000 条路径 · 种子 20261026 本工具设定', `r = 60% × 5% + 40% × (`, ' / 2,000 ', '⇒ 第一个到 80%', '插值', '中位资产 ¥4,294,780', '按固定收益算（约五成）',
    '本工具设定 · 按今天的钱 · 实际收益', '计算方法 ›']) assert.ok(text.includes(x), x);
});

test('ledgerHtml pro: a return floored at −50% says so on the r row', () => {
  const s = { ...S, view: 'pro', eq: 100, eqReal: -60 };
  const p = toParams(s, DATA, 2026); const T = p.life - p.age - 1;
  const plan = { p, t: T, need: null, unreachable: true };
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: problems(s, DATA, 2026), odds: oddsAround(p, T).slice(-1), plan, state: 'unreachable', view: 'pro', mode: 'fwd', p, dispCur: 'CNY', mc: null }));
  assert.ok(text.includes('r = 100% × −60%'));
  assert.ok(text.includes('! 按 −50% 算'));
  assert.ok(text.includes('−50.00%') && !text.includes('-50'));   // U+2212, beyond the brief
});

// Beyond the brief: the spec example's numbers, row by row, and the held states.
test('ledgerHtml pro: the spec example, each number the engine\'s', () => {
  const s = { ...S, view: 'pro' };
  const plan = solve(s); const { p, t, need } = plan;
  const html = ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'pro', mode: 'fwd', p, dispCur: 'CNY', mc: null });
  const text = strip(html);
  const h = 30 + t;
  for (const x of ['① 攒钱', '可投资资产 ¥200,000', '¥360,000', '− 当前年支出', '¥180,000', `t = ${t - 1} 时 ¥${Math.round(90000 * Math.pow(1 + p.infl / 100, -(t - 1))).toLocaleString('en-US')}`,
    `= 年储蓄 t0 → t${t - 1} 180,000 → 301,536`, '② 放假以后 年初取出', `${h}–49 退休后年支出 ≈ ¥180,000`, `月供实际变轻，${h} 岁实付 ¥163,066`, '50 起 月供 ¥90,000',
    '→ 63 自缴（工作地中国大陆且填了养老金才计） —', '养老金（超出年支出不计） — ›', '少花（只砍生活费，月供、自缴照付） 0%',
    `⇒ 放假线（每条路径倒推，取 80 分位） ¥${Math.round(need).toLocaleString('en-US')}`, `≈ 年支出 × ${Math.round(need / firstDraw(p, t))} 倍`,
    `r = 60% × 5% + 40% × (${p.bondY}% − ${p.infl}%) − ${p.drag}% ${(p.r * 100).toFixed(2)}%`, `σ（股 17% · 债 6% · ρ 0.2） ${(p.sigma * 100).toFixed(1)}%`,
    `⇒ 第一个到 80% ${h} 岁`, `按固定收益算（约五成） ${p.age + fwdSolve(p)} 岁`, `${h} 岁中位资产 —`]) assert.ok(text.includes(x), x);
  for (const o of oddsAround(p, t)) assert.ok(text.includes(`${o.age} 岁 ${o.count.toLocaleString('en-US')} / 2,000 ${(o.share * 100).toFixed(1)}%`), `${o.age}`);
  assert.match(html, new RegExp(`class="[^"]*\\bpick\\b[^"]*"[^>]*>(?:(?!</div>).)*${h} 岁`));
  assert.match(text, new RegExp(`插值 ${oddsYears(p).toFixed(1)} 年`));
  // The labels go back to their fields; the year's spending cut is a field too.
  for (const f of ['assets', 'income', 'growth', 'expense', 'mortgage.monthly', 'retExp', 'pension', 'flexCut']) assert.match(html, new RegExp(`data-field="${f.replace('.', '\\.')}"`), f);
  assert.ok(!text.includes('≈ (年支出'));   // one currency: no cross-country estimate
  assert.ok(!html.includes('-¥') && !/ -\d/.test(text));
});

test('ledgerHtml pro: two currencies show the drift and the cross-country estimate', () => {
  const s = { ...setRetireCountry(S, 'TH', DATA), view: 'pro', fxDrift: -1 };
  const plan = solve(s); const { p, t } = plan;
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: [], odds: oddsAround(p, t), plan, state: 'ok', view: 'pro', mode: 'fwd', p, dispCur: 'CNY', mc: null }));
  assert.ok(text.includes('退休币升值（只算到放假那年） −1%'), text);
  assert.ok(text.includes('≈ (年支出 − 月供和孩子) × 物价比 + 月供和孩子'));
});

test('ledgerHtml pro held: a stop in ① cuts there; a ③ input cuts at the r row; spending below 0 says so', () => {
  const a3 = { ...S, view: 'pro', expense: 84000 };
  const held = strip(ledgerHtml({ rows: storyRows(a3, DATA, 2026, null), list: problems(a3, DATA, 2026), plan: null, state: 'held', view: 'pro', mode: 'fwd', p: null, dispCur: 'CNY' }));
  for (const x of ['└ 其中月供 90,000/年 ≥ 当前年支出 84,000 ✕ ›', '= 年储蓄 —', '⇒ 放假线 —', '⇒ ③ 放假年龄 —']) assert.ok(held.includes(x), x);
  assert.ok(!held.includes('② 要有'));   // fix round 1: in pro the line is 放假线
  assert.ok(!held.includes('退休后年支出'));
  const eq = { ...S, view: 'pro', eq: 150 };
  const three = strip(ledgerHtml({ rows: storyRows(eq, DATA, 2026, null), list: problems(eq, DATA, 2026), plan: null, state: 'held', view: 'pro', mode: 'fwd', p: null, dispCur: 'CNY' }));
  for (const x of ['① 攒钱', '② 放假以后', '退休后年支出', '放假线（每条路径倒推，取 80 分位） —', '③ 2,000 条路径 · 种子 20261026', '股票占比 150 &gt; 100 ✕ ›', '⇒ ③ 放假年龄 —']) assert.ok(three.includes(x), x);
  assert.ok(three.indexOf('② 放假以后') < three.indexOf('股票占比 150'));
  const flex = { ...S, view: 'pro', flexCut: 150 };
  const cut = strip(ledgerHtml({ rows: storyRows(flex, DATA, 2026, null), list: problems(flex, DATA, 2026), plan: null, state: 'held', view: 'pro', mode: 'fwd', p: null, dispCur: 'CNY' }));
  assert.ok(cut.includes('一年跌 ≥ 15% 后少花 150 &gt; 100 ✕ ›'), cut);
  assert.ok(!cut.includes('150%'));
  const poor = { ...defaultState(DATA), view: 'pro', income: 60000, expense: 72000 };
  const p = toParams(poor, DATA, 2026); const T = p.life - p.age - 1;
  const plan = { p, t: T, need: null, unreachable: true };
  const un = strip(ledgerHtml({ rows: storyRows(poor, DATA, 2026, plan), list: problems(poor, DATA, 2026), odds: oddsAround(p, T).slice(-1), plan, state: 'unreachable', view: 'pro', mode: 'fwd', p, dispCur: 'CNY' }));
  for (const x of ['年末存入 · 资产不低于 0 本工具设定 ! 存款用完后按 0 算', `② 如果 ${p.age + T} 岁放假`, '规划期内到不了八成']) assert.ok(un.includes(x), x);
  for (const x of ['放假线（', '第一个到 80%', '插值']) assert.ok(!un.includes(x), x);
});

test('proLedgerRowHtml: the professional fund line closed, held and out of reach', () => {
  assert.equal(strip(proLedgerRowHtml({ need: 3913531, success: 0.819, cur: 'CNY' })), '放假线 ¥3,913,531 · 81.9% 怎么算的 ▸');
  assert.equal(strip(proLedgerRowHtml({ held: true, open: true })), '放假线 — 怎么算的 ▾');
  assert.equal(strip(proLedgerRowHtml({ need: null, success: null, cur: 'CNY' })), '规划期内未达到 怎么算的 ▸');
  assert.match(proLedgerRowHtml({ held: true }), /aria-controls="ledger"/);
});

// ---- Review fix round 1.
test('ledgerHtml pro ②: a self-pay row with no amount sorts at its claim age, after 50 起 月供', () => {
  const s = { ...S, view: 'pro' };
  const plan = solve(s);
  const text = strip(ledgerHtml({ rows: storyRows(s, DATA, 2026, plan), list: [], odds: oddsAround(plan.p, plan.t), plan, state: 'ok', view: 'pro', mode: 'fwd', p: plan.p, dispCur: 'CNY' }));
  const at = x => text.indexOf(x);
  assert.ok(at('50 起 月供') >= 0 && at('→ 63 自缴') >= 0);
  assert.ok(at('月供实际变轻') < at('50 起 月供') && at('50 起 月供') < at('→ 63 自缴') && at('→ 63 自缴') < at('63 起 养老金'), text);
});

test('the stopped result reads 放假年龄 — with its chip, never — 岁', () => {
  const hero = strip(heldHeroHtml(false, '拦住：房贷 ›'));
  assert.ok(hero.startsWith('放假年龄 — 拦住：房贷 ›'), hero);
  assert.ok(strip(stickyHtml(null, { pro: true, chip: 'x' })).startsWith('财务独立年龄 —'));
  assert.ok(strip(sideCardHtml(null, { view: 'simple', chip: 'x' })).startsWith('放假年龄 —'));
  for (const h of [hero, strip(stickyHtml(null, { chip: 'x' })), strip(sideCardHtml(null, { view: 'pro', chip: 'x' }))]) assert.ok(!h.includes('— 岁'), h);
});
