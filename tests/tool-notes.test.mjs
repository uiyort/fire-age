import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_LABEL, WHY, toolTag } from '../site/js/tool-notes.js';

test('a tag is a button that names itself 本工具设定 and carries its explanation, escaped', () => {
  const html = toolTag('a "quoted" <b> & more');
  assert.match(html, /^<button type="button" class="tool" data-why="a &quot;quoted&quot; &lt;b&gt; &amp; more" aria-expanded="false" aria-controls="tool-pop">本工具设定<\/button>$/);
  assert.equal(TOOL_LABEL, '本工具设定');
});

test('every explanation follows the copy framework: no colon, slash or arrow, and ends a sentence', () => {
  const p = { w: 0.6, eqReal: 5, bondReal: 0.0018, drag: 0.2 };
  const all = [WHY.growth(2), WHY.growthField(), WHY.income(2), WHY.expense(), WHY.kids(22), WHY.floor(), WHY.median(51), WHY.ret(p), WHY.legend(), WHY.sim(2000, 20261026), WHY.low(0.25), WHY.pension()];
  for (const s of all) {
    assert.doesNotMatch(s, /[：:]|\S\/\S|→|undefined|NaN/, s);
    assert.match(s, /。$/, s);
  }
});

test('the explanations carry the numbers they explain', () => {
  assert.match(WHY.growth(2), /比物价多涨 2%/);
  assert.match(WHY.ret({ w: 0.6, eqReal: 5, bondReal: 0.0018, drag: 0.2 }), /股票占 60%，按每年 5% 算；债券占 40%.+约 0\.18%；再减 0\.2% 的税费/);
  assert.match(WHY.sim(2000, 20261026), /至少 1,600 种/);
  assert.match(WHY.median(51), /到 51 岁时/);
  assert.match(WHY.low(0.25), /现在的 25%/);
});
