// The views helpers that draw the stopped result and, in later tasks, the lines under the fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chipText, heldHeadHtml, heldHeroHtml, stickyHtml } from '../site/js/views.js';

const b = (kind, chip) => ({ kind, chip });
test('chipText: blanks first, one names the item, several count', () => {
  assert.equal(chipText([]), '');
  assert.equal(chipText([b('flag', '每月存下')]), '');
  assert.equal(chipText([b('block', '房贷')]), '拦住：房贷 ›');
  assert.equal(chipText([b('block', '房贷'), b('block', '年龄')]), '拦住 2 处 ›');
  assert.equal(chipText([b('block', '房贷'), b('blank', '每月支出')]), '待填：每月支出 ›');
  assert.equal(chipText([b('blank', '每月支出'), b('blank', '退休后')]), '待填 2 处 ›');
});

test('the stopped result: — 岁放假, 放假资金 —, and 财务独立 — 岁 in the professional headline', () => {
  assert.equal(heldHeroHtml(), '<div class="hero-big"><span aria-label="暂无结果">—</span> 岁放假</div><div class="fund"><p>放假资金 —</p></div>');
  assert.equal(heldHeadHtml('pro'), '<p class="say">财务独立 <span aria-label="暂无结果">—</span> 岁</p>');
  assert.equal(heldHeadHtml('simple'), '');
});

test('stickyHtml with a chip: no age, the chip as a button; without one, as before', () => {
  const simple = stickyHtml(null, { chip: '拦住：房贷 ›' });
  assert.equal(simple, '<b class="sticky-age"><span aria-label="暂无结果">—</span> 岁放假</b><button type="button" class="chip" data-chip>拦住：房贷 ›</button>');
  const pro = stickyHtml(null, { pro: true, chip: '待填 2 处 ›' });
  assert.equal(pro, '<b class="sticky-age">财务独立 <span aria-label="暂无结果">—</span> 岁</b><button type="button" class="chip" data-chip>待填 2 处 ›</button>');
  const h = { reachable: false };
  assert.equal(stickyHtml(h, {}), '<b class="sticky-age">还在路上</b><span>先看提前的办法</span>');
});
