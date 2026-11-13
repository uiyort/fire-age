// tests/method.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIMITS } from '../site/js/state.js';
import { PARAMS } from '../site/js/params.js';
const html = readFileSync(new URL('../site/method.html', import.meta.url), 'utf8');
const md = readFileSync(new URL('../docs/method.md', import.meta.url), 'utf8');

test('the method page writes the items into the formulas', () => {
  assert.ok(html.includes('− 当前支出 − 项目变化(t)'));
  assert.ok(html.includes('项目变化(t) = − 已结束项目的年金额之和 + 还没还完的房贷年金额 × ((1 + 通胀)^−t − 1)'));
  assert.ok(html.includes('第 t 年的支出 = 退休后支出 + 项目变化(t)（定义见上）'));
  assert.ok(md.includes('itemDelta(t)')); assert.ok(md.includes('a fall of 15% or more'));
});
test('the method page lists every limit the page enforces, as this tool\'s setting', () => {
  assert.ok(html.includes('id="limits"')); assert.ok(html.includes('这些上下限和常见范围都是本工具设定。'));
  for (const v of [...LIMITS.age, ...LIMITS.pAge, LIMITS.lifeMax, LIMITS.endYearBack, LIMITS.endYearAhead, `${LIMITS.low * 100}%`]) assert.ok(html.includes(String(v)), v);
  for (const [lo, hi] of Object.values(LIMITS.common)) assert.ok(html.includes(`${lo < 0 ? '−' + -lo : lo}–${hi}%`), `${lo}–${hi}`);
});
test('the odds section says why 八成 and why 2,000 runs', () => {
  const sec = html.split('id="odds"')[1].split('<h2')[0];
  for (const t of ['1,600', '2,000', '本工具设定']) assert.ok(sec.includes(t), t);
});
test('the bad-year card says 15% or more', () => {
  assert.ok(PARAMS.find(p => p.id === 'flexCut').what.includes('组合某年跌了 15% 或更多'));
});
