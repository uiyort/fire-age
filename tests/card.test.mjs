import test from 'node:test';
import assert from 'node:assert/strict';
import { resultCardSpec, goalCardSpec, fitFontSize, wrapText } from '../site/js/card.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const fwd = { mode: 'fwd', age: 30, retireAge: 41, years: 11, success: 0.59, needText: '¥317.75万' };

test('result card carries the age, slogan, brand and search hint', () => {
  const s = resultCardSpec(fwd);
  assert.equal(s.hero, '41 岁');
  assert.equal(s.sentence, '从 41 岁起，余生皆假期');
  assert.equal(s.brand, '放假年龄 / FIRE Age');
  assert.equal(s.searchHint, '搜：放假年龄');
  assert.deepEqual(s.size, [1080, 1080]);
  assert.match(s.comment, /放假年龄是 41 岁/);
  assert.match(s.comment, /你的呢/);
});

test('cards contain no links or QR codes', () => {
  const s = JSON.stringify(resultCardSpec(fwd));
  assert.ok(!/https?:|www\.|\.com|二维码/.test(s));
});

test('an unreachable result stays upbeat and shows no fake age', () => {
  const s = resultCardSpec({ mode: 'fwd', age: 30, retireAge: null, years: null, success: null });
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify(s)));
  assert.match(s.sentence, /一步步|杠杆/);
});

test('someone who can stop now gets the today wording', () => {
  const s = resultCardSpec({ mode: 'fwd', age: 50, retireAge: 50, years: 0, success: 0.95, needText: '¥1万' });
  assert.equal(s.sentence, '从今天起，余生皆假期');
});

test('backward card uses the monthly amount', () => {
  const s = resultCardSpec({ mode: 'bwd', targetAge: 45, monthlyText: '8,600', enough: false, success: 0.8 });
  assert.equal(s.sentence, '想 45 岁放假，每月需存 8,600');
  assert.equal(s.hero, '45 岁');
  const done = resultCardSpec({ mode: 'bwd', targetAge: 45, monthlyText: '0', enough: true, success: 0.8 });
  assert.equal(done.sentence, '想 45 岁放假，现在的存款已经够了');
});

test('goal card reports the years gained', () => {
  const s = goalCardSpec({ label: '储蓄率到 45%' }, { yearsDelta: 2, achieved: true });
  assert.equal(s.sentence, '储蓄率到 45%，放假年龄提前了 2 年');
  assert.equal(s.kind, 'goal');
  const none = goalCardSpec({ label: '储蓄率到 45%' }, { yearsDelta: null, achieved: true });
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify(none)));
});

test('long amounts shrink to fit and respect the minimum', () => {
  const measure = (t, px) => t.length * px * 0.6;
  const px = fitFontSize(measure, 'THB 1,234,567,890,123', 400, 96, 24);
  assert.ok(measure('THB 1,234,567,890,123', px) <= 400 || px === 24);
  assert.equal(fitFontSize(measure, '41 岁', 900, 96, 24), 96);
});

test('long sentences wrap without losing characters', () => {
  const measure = t => t.length * 10;
  const text = '按现在的节奏还到不了放假那天，先试试杠杆，一步步来';
  const out = wrapText(measure, text, 100);
  assert.equal(out.join(''), text);
  for (const line of out) assert.ok(measure(line) <= 100);
});

test('card copy passes the compliance lint', () => {
  assert.deepEqual(findBannedCopy(JSON.stringify(resultCardSpec(fwd))), []);
});
