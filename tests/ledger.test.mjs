// The ledger behind the fund line (spec §7), the one denominator of N 倍 and the implied rate (spec §9.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, storyRows, problems, toParams } from '../site/js/state.js';
import { firstDraw } from '../site/js/engine.js';
import { bwdOdds, oddsAround, oddsSolve, needLine, successAt } from '../site/js/odds.js';
import { heroModel } from '../site/js/holiday.js';
import { heroHtml, heldHeroHtml, ledgerHtml, tilesHtml } from '../site/js/views.js';

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
