import test from 'node:test';
import assert from 'node:assert/strict';
import { summaryCardSpec, placeCardSpec, lifeCardSpec, typeCardSpec, fitFontSize, fitLines, noteLayout, wrapText } from '../site/js/card.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const type = {
  code: 'EHTS', name: '采菊人', emoji: '🌼', group: '归园派', blurb: '早早收工，回家种花。',
  axes: [{ name: '启程', letter: 'E', pole: '早', value: '43 岁' }, { name: '目的地', letter: 'H', pole: '在地', value: '中国大陆' }, { name: '行李', letter: 'T', pole: '轻装', value: '40%' }, { name: '路费', letter: 'S', pole: '靠存', value: '30%' }],
};
const hero = { reachable: true, startAge: 30, holidayAge: 43, endAge: 95, workYears: 13, holidayYears: 52, mondays: 678, people: 7, fund: { share: 0.14 } };
const summary = { mode: 'fwd', type, hero, lit: { done: 3, total: 20 }, ribbons: [{ label: '顺风局', cells: ['work', 'holiday'] }] };

test('the summary card carries the age, slogan, type, brand and search hint', () => {
  const s = summaryCardSpec(summary);
  assert.equal(s.kind, 'summary');
  assert.equal(s.hero, '43 岁');
  assert.equal(s.sentence, '从 43 岁起，余生皆假期');
  assert.equal(s.code, 'EHTS');
  assert.equal(s.typeName, '采菊人');
  assert.equal(s.emoji, '🌼');
  assert.equal(s.brand, '放假年龄 / FIRE Age');
  assert.equal(s.searchHint, '搜：放假年龄');
  assert.deepEqual(s.size, [1080, 1440]);
});

test('the summary card is a ticket: route, people, Mondays, lit parameters and a barcode of lives', () => {
  const s = summaryCardSpec(summary);
  assert.deepEqual(s.route, { startAge: 30, holidayAge: 43, endAge: 95, work: 13, holiday: 52 });
  assert.equal(s.people, 7);
  assert.equal(s.mondays, 678);
  assert.deepEqual(s.lit, { done: 3, total: 20 });
  assert.equal(s.ribbons.length, 1);
});

test('the summary card carries one extra line at most, the most personal one', () => {
  const all = { ...summary, place: { name: '泰国', gain: 4.3 }, fifth: '同样的年景，从 71 岁花完变成撑到 95 岁', goal: '储蓄率到 45%' };
  assert.equal(summaryCardSpec(all).note, '等你来写：同样的年景，从 71 岁花完变成撑到 95 岁');
  assert.match(summaryCardSpec({ ...all, fifth: null }).note, /泰国.*4\.3 年/);
  assert.match(summaryCardSpec({ ...all, fifth: null, place: null }).note, /储蓄率到 45%/);
  assert.equal(summaryCardSpec(summary).note, '');
});

test('the summary card has no links or QR codes and passes the compliance lint', () => {
  const s = JSON.stringify(summaryCardSpec({ ...summary, place: { name: '泰国', gain: 4.3 } }));
  assert.ok(!/https?:|www\.|\.com|二维码/.test(s));
  assert.deepEqual(findBannedCopy(s), []);
});

test('an unreachable result stays upbeat and shows no fake age', () => {
  const s = summaryCardSpec({ mode: 'fwd', type, hero: { ...hero, reachable: false, holidayAge: null, workYears: 65, holidayYears: 0, mondays: 0, people: null }, ribbons: [] });
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify([s.hero, s.sentence, s.note])));
  assert.equal(s.mondays, null, 'no countdown when there is no holiday to count down to');
  assert.equal(s.hero, '还在路上');
  assert.match(s.sentence, /一步步|杠杆/);
  assert.equal(s.people, null);
});

test('someone who can stop now gets the today wording', () => {
  const s = summaryCardSpec({ mode: 'fwd', type, hero: { ...hero, holidayAge: 30, workYears: 0, holidayYears: 65, mondays: 0 }, ribbons: [] });
  assert.equal(s.hero, '现在');
  assert.equal(s.sentence, '从今天起，余生皆假期');
  assert.equal(s.mondays, 0);
});

test('a backward result uses the monthly amount', () => {
  const s = summaryCardSpec({ ...summary, mode: 'bwd', monthlyText: '8,600', enough: false });
  assert.equal(s.sentence, '想 43 岁放假，每月需存 8,600');
  const done = summaryCardSpec({ ...summary, mode: 'bwd', monthlyText: '0', enough: true });
  assert.equal(done.sentence, '想 43 岁放假，现在的存款已经够了');
});

test('long amounts shrink to fit and respect the minimum', () => {
  const measure = (t, px) => t.length * px * 0.6;
  const px = fitFontSize(measure, 'THB 1,234,567,890,123', 400, 96, 24);
  assert.ok(measure('THB 1,234,567,890,123', px) <= 400 || px === 24);
  assert.equal(fitFontSize(measure, '41 岁', 900, 96, 24), 96);
});

test('a long note on the card wraps onto two lines inside the margin', () => {
  const measure = (t, px) => [...t].length * px;
  const note = '等你来写：同样的年景，钱都撑到 95 岁，最后剩下的从 ¥577万 变成 ¥188万';
  const { px, lines } = noteLayout(measure, note, 872);
  assert.ok(lines.length <= 2);
  assert.ok(px >= 22);
  assert.equal(lines.join(''), note);
  for (const line of lines) assert.ok(measure(line, px) <= 872, line);
  assert.deepEqual(noteLayout(measure, '短句', 872), { px: 34, lines: ['短句'] });
});

test('long sentences wrap without losing characters', () => {
  const measure = t => t.length * 10;
  const text = '按现在的节奏还到不了放假那天，先试试杠杆，一步步来';
  const out = wrapText(measure, text, 100);
  assert.equal(out.join(''), text);
  for (const line of out) assert.ok(measure(line) <= 100);
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
  assert.deepEqual(wrapText(t => [...t].length, '一二三四。五六', 4), ['一二三', '四。五六']);
});

test('the type card shows the code, name, group and all four axes', () => {
  const s = typeCardSpec(type);
  assert.match(s.eyebrow, /EHTS/);
  assert.match(s.eyebrow, /归园派/);
  assert.match(s.hero, /采菊人/);
  assert.equal(s.sentence, type.blurb);
  assert.equal(s.stats.length, 4);
  assert.deepEqual(findBannedCopy(JSON.stringify(s)), []);
});
