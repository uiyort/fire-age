import test from 'node:test';
import assert from 'node:assert/strict';
import { resultCardSpec, goalCardSpec, placeCardSpec, lifeCardSpec, fitFontSize, fitLines, wrapText } from '../site/js/card.js';
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

test('the result card carries the holiday type and the Mondays left', () => {
  const s = resultCardSpec({ ...fwd, typeName: '松鼠型', mondays: 574 });
  assert.equal(s.eyebrow, '松鼠型');
  assert.deepEqual(s.lines, ['还有 574 个周一就放假']);
  assert.match(s.comment, /574 个周一/);
  assert.match(s.comment, /松鼠型/);
});

test('the result card does not mention Mondays when there are none left', () => {
  const s = resultCardSpec({ mode: 'fwd', age: 30, retireAge: 30, years: 0, success: 1, needText: '¥1', mondays: 0, typeName: '假期中' });
  assert.ok(!JSON.stringify(s).includes('周一'));
});

const rows = [
  { code: 'TH', name: '泰国', age: 38, years: 7.2 },
  { code: 'MY', name: '马来西亚', age: 39, years: 8.1 },
  { code: 'CN', name: '中国大陆', age: 41, years: 10.4, current: true },
  { code: 'US', name: '美国', age: null, years: null },
];

test('the place card names the gain against the current place', () => {
  const s = placeCardSpec(rows);
  assert.equal(s.hero, '早 3.2 年');
  assert.match(s.sentence, /泰国/);
  assert.match(s.comment, /泰国.*38 岁.*中国大陆.*41 岁/);
  assert.ok(s.lines.some(l => l.includes('美国') && l.includes('还到不了')));
  assert.deepEqual(findBannedCopy(JSON.stringify(s)), []);
});

test('the place card stays honest when the current place is already earliest', () => {
  const s = placeCardSpec([{ code: 'CN', name: '中国大陆', age: 41, years: 10.4, current: true }, { code: 'US', name: '美国', age: 50, years: 20 }]);
  assert.equal(s.hero, '41 岁');
  assert.match(s.sentence, /已经是最早/);
});

test('the place card has no fake age when nothing is reachable', () => {
  const s = placeCardSpec([{ code: 'CN', name: '中国大陆', age: null, years: null, current: true }]);
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify(s)));
  assert.equal(s.hero, '还在路上');
});

const life = { outcome: 'lasted', endAge: 95, endText: '¥812万', retireAge: 41, worst: { age: 46, ret: -0.23 }, success: 0.86, paths: 2000 };

test('the life card tells the worst year and the ending', () => {
  const s = lifeCardSpec(life);
  assert.equal(s.hero, '撑到 95 岁');
  assert.match(s.sentence, /46 岁.*23%/);
  assert.match(s.comment, /86%.*2,?000/);
  assert.match(s.comment, /你抽到/);
});

test('the life card says plainly when the money runs out', () => {
  const s = lifeCardSpec({ ...life, outcome: 'ruined', ruinAge: 78 });
  assert.equal(s.hero, '78 岁花完');
  assert.match(s.sentence, /调整/);
});

test('the life card copes with a life that never takes the holiday', () => {
  const s = lifeCardSpec({ ...life, outcome: 'working', retireAge: null, success: null });
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify(s)));
  assert.ok(s.hero);
});

const byChars = (text, px) => [...text].length * px;

test('extra lines shrink to stay clear of the card footer', () => {
  const lines = ['泰国：38 岁', '马来西亚：39 岁', '中国大陆：43 岁', '日本：45 岁', '按物价水平估算，没算签证、税和医疗。'];
  const px = fitLines(byChars, lines, 920, 300);
  const height = lines.length * (px * 1.45 + 16);
  assert.ok(px < 42);
  assert.ok(height <= 300, String(height));
});

test('extra lines keep their full size when there is room', () => {
  assert.equal(fitLines(byChars, ['一行字'], 920, 300), 42);
});

test('a long place name keeps the place card sentence on one line', () => {
  const s = placeCardSpec([{ code: 'TH', name: '泰国', age: 38, years: 7 }, { code: 'DE', name: '德国（欧元区）', age: 47, years: 17, current: true }]);
  assert.ok([...s.sentence].length <= 15, s.sentence);
});

test('closing punctuation never starts a wrapped line', () => {
  const lines = wrapText(t => [...t].length, '一二三四。五六', 4);
  assert.deepEqual(lines, ['一二三', '四。五六']);
});
