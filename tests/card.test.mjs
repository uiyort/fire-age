import test from 'node:test';
import assert from 'node:assert/strict';
import { barcodeBars, lifeBars, summaryCardSpec, placeCardSpec, lifeCardSpec, typeCardSpec, fitFontSize, fitLines, noteLayout, wrapText } from '../site/js/card.js';
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
  assert.equal(s.sentence, type.blurb, 'the line under the age is the type\'s own, not a fixed slogan');
  assert.equal(s.code, 'EHTS');
  assert.equal(s.typeName, '采菊人');
  assert.equal(s.emoji, '🌼');
  assert.equal(s.brand, '放假年龄 / FIRE Age');
  assert.equal(s.searchHint, '搜：放假年龄');
  assert.deepEqual(s.size, [1080, 1440]);
});

test('the card keeps every label short', () => {
  const s = summaryCardSpec({ ...summary, fifth: { main: '有钱花的假期 25 → 22 年', detail: '晚 3 年放假 · 67 岁花完', baseName: '中途断粮' } });
  assert.ok([...s.sentence].length <= 20, s.sentence);
  assert.ok([...s.note.label].length <= 12, s.note.label);
  assert.deepEqual(s.stampLabels, ['撑到 95 岁', '还要上的周一', '点亮参数']);
});

test('with a written life, the card shows only that life and the one it rewrote', () => {
  const row = (label, extra = {}) => ({ label, cells: ['work', 'holiday'], ...extra });
  const ribbons = [row('顺风局'), row('中途断粮', { base: true }), row('起步就难'), row('改签后', { fifth: true })];
  const fifth = { main: '有钱花的假期 25 → 22 年', detail: '', baseName: '中途断粮' };
  assert.deepEqual(summaryCardSpec({ ...summary, ribbons, fifth }).ribbons.map(r => r.label), ['中途断粮', '改签后']);
  assert.equal(summaryCardSpec({ ...summary, ribbons: ribbons.slice(0, 3) }).ribbons.length, 3);
});

test('a written life reads like a changed ticket: the old value struck out, the new one beside it', () => {
  const note = main => summaryCardSpec({ ...summary, fifth: { main, detail: '', baseName: '中途断粮' } }).note;
  assert.deepEqual(note('最后剩下 120万 → 80万').change, { prefix: '最后剩下 ', was: '120万', now: '80万' });
  assert.equal(note('52 岁就能放假').change, null, 'nothing to strike out');
  assert.equal(note('52 岁就能放假').tag, '已改签');
});

test('the age wears a boarding stamp that tells how far the trip has got', () => {
  const words = s => ({ main: s.boarding.main, sub: s.boarding.sub });
  assert.deepEqual(words(summaryCardSpec(summary)), { main: '已登机', sub: 'BOARDED' });
  assert.deepEqual(words(summaryCardSpec({ ...summary, hero: { ...hero, workYears: 0 } })), { main: '已起飞', sub: 'DEPARTED' });
  assert.deepEqual(words(summaryCardSpec({ ...summary, hero: { ...hero, reachable: false } })), { main: '候补中', sub: 'STANDBY' });
  assert.deepEqual(words(summaryCardSpec({ ...summary, mode: 'bwd', monthlyText: '8,600', enough: false })), { main: '待登机', sub: 'BOARDING' });
  assert.deepEqual(words(summaryCardSpec({ ...summary, mode: 'bwd', enough: true })), { main: '已登机', sub: 'BOARDED' });
});

test('each type group has its own stamp, in its own shape and ink, carrying the type code', () => {
  const stamp = group => summaryCardSpec({ ...summary, type: { ...type, group } }).boarding;
  const groups = ['归园派', '主场派', '漫游派', '环球派'].map(stamp);
  assert.equal(new Set(groups.map(g => g.shape)).size, 4);
  assert.equal(new Set(groups.map(g => g.ink)).size, 4);
  assert.equal(stamp('归园派').code, 'EHTS');
});

test('the foot of the card is a barcode with the pass number under it', () => {
  const s = summaryCardSpec(summary);
  assert.equal(s.barcode, 'FIRE AGE · ' + s.code + ' · 43');
  assert.deepEqual(s.ticket, { flight: 'FA043', cabin: '经济舱', issued: '', route: '30 → 43 → 95' });
  const rich = summaryCardSpec({ ...summary, issued: '2026-11', type: { ...type, axes: type.axes.map((a, i) => (i === 2 ? { ...a, letter: 'F', pole: '宽裕' } : a)) } });
  assert.equal(rich.ticket.cabin, '商务舱');
  assert.equal(rich.ticket.issued, '2026.11');
  assert.equal(summaryCardSpec({ ...summary, hero: { ...hero, reachable: false } }).ticket.flight, 'FA---');
  assert.deepEqual(barcodeBars('FIRE AGE · EHTS · 43', 300), barcodeBars('FIRE AGE · EHTS · 43', 300), 'the same pass draws the same bars');
  assert.notDeepEqual(barcodeBars('FIRE AGE · EHTS · 43', 300), barcodeBars('FIRE AGE · LAFG · 51', 300));
  const bars = barcodeBars('FIRE AGE · EHTS · 43', 300);
  assert.ok(bars.every(([x, w]) => x >= 0 && x + w <= 300 && w >= 2));
});

test('the barcode is the life itself: one bar a year, its height the assets, its weight work or holiday', () => {
  const bars = lifeBars([100, 200, 400, 300, 0], 2);
  assert.deepEqual(bars.map(b => b.state), ['work', 'work', 'holiday', 'holiday', 'broke']);
  assert.deepEqual(bars.map(b => b.h), [0.25, 0.5, 1, 0.75, 0]);
  assert.equal(bars[2].start, true, 'the first holiday year is marked');
  assert.equal(bars.filter(b => b.start).length, 1);
  assert.deepEqual(lifeBars([], 2), []);
  assert.ok(lifeBars([0, 0], 1).every(b => Number.isFinite(b.h)));
  const s = summaryCardSpec({ ...summary, years: [100, 200, 400] });
  assert.equal(s.lifeBars.length, 3);
  assert.equal(summaryCardSpec(summary).lifeBars.length, 0);
});

test('the summary card spells out the type as four ticket fields', () => {
  const s = summaryCardSpec(summary);
  assert.deepEqual(s.fields, [
    { label: '启程', letter: 'E', pole: '早', value: '再上 13 年班' },
    { label: '目的地', letter: 'H', pole: '在地', value: '中国大陆' },
    { label: '行李', letter: 'T', pole: '轻装', value: '40%' },
    { label: '路费', letter: 'S', pole: '靠存', value: '30%' },
  ]);
});

test('the summary card is a ticket: route, people, Mondays and a barcode of lives', () => {
  const s = summaryCardSpec(summary);
  assert.deepEqual(s.route, { startAge: 30, holidayAge: 43, endAge: 95, work: 13, holiday: 52 });
  assert.equal(s.people, 7);
  assert.equal(s.mondays, 678);
  assert.deepEqual(s.lit, { done: 3, total: 20 });
  assert.equal(s.ribbons.length, 1);
});

test('the summary card carries one note at most, the most personal one, as a label, a main line and a detail', () => {
  const lever = { action: '每月多存 ¥1,250', gain: 1.4 };
  const fifth = { main: '有钱花的假期 25 → 22 年', detail: '晚 3 年放假 · 67 岁花完', baseName: '中途断粮' };
  const all = { ...summary, place: { name: '泰国', gain: 4.3 }, fifth, goal: '储蓄率到 45%', lever };
  assert.deepEqual(summaryCardSpec(all).note, {
    label: '你写的人生', tag: '已改签', main: '有钱花的假期 25 → 22 年', detail: '晚 3 年放假 · 67 岁花完',
    change: { prefix: '有钱花的假期 ', was: '25', now: '22 年' },
  });
  assert.deepEqual(summaryCardSpec({ ...all, fifth: null }).note, { label: '小目标达成', main: '储蓄率到 45%', detail: '' });
  assert.deepEqual(summaryCardSpec({ ...all, fifth: null, goal: null }).note, { label: '你的杠杆', main: '每月多存 ¥1,250', detail: '早 1.4 年放假' });
  assert.deepEqual(summaryCardSpec({ ...all, fifth: null, goal: null, lever: null }).note, { label: '同样的钱', main: '去泰国放假', detail: '早 4.3 年' });
  assert.equal(summaryCardSpec(summary).note, null);
});

test('a lever that makes the holiday reachable says the age', () => {
  assert.deepEqual(summaryCardSpec({ ...summary, lever: { action: '每月多存 ¥1,250', unlockAge: 58 } }).note, { label: '你的杠杆', main: '每月多存 ¥1,250', detail: '就能在 58 岁放假' });
});

test('the summary card has no links or QR codes and passes the compliance lint', () => {
  const s = JSON.stringify(summaryCardSpec({ ...summary, place: { name: '泰国', gain: 4.3 } }));
  assert.ok(!/https?:|www\.|\.com|二维码/.test(s));
  assert.deepEqual(findBannedCopy(s), []);
});

test('an unreachable result stays upbeat and shows no fake age', () => {
  const s = summaryCardSpec({ mode: 'fwd', type, hero: { ...hero, reachable: false, holidayAge: null, workYears: 65, holidayYears: 0, mondays: 0, people: null }, ribbons: [] });
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify([s.hero, s.sentence, s.note ?? {}])));
  assert.equal(s.mondays, null, 'no countdown when there is no holiday to count down to');
  assert.equal(s.hero, '还在路上');
  assert.match(s.sentence, /一步步|杠杆/);
  assert.equal(s.people, null);
});

test('someone who can stop now gets the today wording', () => {
  const s = summaryCardSpec({ mode: 'fwd', type, hero: { ...hero, holidayAge: 30, workYears: 0, holidayYears: 65, mondays: 0 }, ribbons: [] });
  assert.equal(s.hero, '现在');
  assert.equal(s.sentence, type.blurb);
  assert.equal(s.fields[0].value, '现在就走');
  assert.equal(s.mondays, 0);
});

test('a backward result uses the monthly amount', () => {
  const s = summaryCardSpec({ ...summary, mode: 'bwd', monthlyText: '8,600', enough: false });
  assert.equal(s.sentence, '每月存 8,600 就能到');
  const done = summaryCardSpec({ ...summary, mode: 'bwd', monthlyText: '0', enough: true });
  assert.equal(done.sentence, '现在的存款已经够了');
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
