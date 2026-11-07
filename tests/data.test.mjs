import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseEcbFx, crossToUsd, parseBisCpi, parseTreasury10y, parseEcbIrs, parseBoe, parseMofJp, parseRba, parseBoc,
  parseWorldBank, priceLevel, mergeField,
} from '../scripts/update-data.mjs';
import DATA from '../site/js/data-latest.js';

const fixture = f => readFileSync(`tests/fixtures/${f}`, 'utf8');

test('ECB rates cross into units per USD', () => {
  const usd = crossToUsd(parseEcbFx(fixture('ecb.xml')));
  assert.ok(Math.abs(usd.rates.CNY - 7.4485 / 1.1165) < 1e-9);
  assert.ok(Math.abs(usd.rates.EUR - 1 / 1.1165) < 1e-9);
  assert.equal(usd.rates.USD, undefined);
  assert.equal(usd.observedAt, '2026-11-06');
});

test('BIS CPI parses per area', () => {
  const cpi = parseBisCpi(fixture('bis.csv'));
  assert.deepEqual(cpi.CN, { value: 0.9, observedAt: '2026-09' });
  assert.equal(cpi.US.observedAt, '2026-09');
});

test('each bond source parses to the latest value and date', () => {
  assert.deepEqual(parseTreasury10y(fixture('ust.csv')), { value: 4.86, observedAt: '2026-11-06' });
  assert.deepEqual(parseEcbIrs(fixture('ecb-irs.csv')), { value: 3.473, observedAt: '2026-09' });
  assert.deepEqual(parseBoe(fixture('boe.csv')), { value: 5.3516, observedAt: '2026-10-20' });
  assert.deepEqual(parseMofJp(fixture('mof-jp.csv')), { value: 2.806, observedAt: '2026-11-05' });
  assert.deepEqual(parseRba(fixture('rba.csv')), { value: 5.082, observedAt: '2026-11-04' });
  assert.deepEqual(parseBoc(fixture('boc.csv')), { value: 3.67, observedAt: '2026-11-05' });
});

test('World Bank parsing skips empty values', () => {
  assert.deepEqual(parseWorldBank(fixture('worldbank.json')), { CN: { value: 3.4, observedAt: '2025' } });
});

test('price level is PPP over market rate', () => {
  assert.ok(Math.abs(priceLevel(3.4, 6.8) - 0.5) < 1e-12);
});

const prev = { value: 10, sourceId: 'x', url: 'u', observedAt: '2026-09', fetchedAt: '2026-10-01', status: 'official' };

test('a failed fetch carries the old value and keeps its observation date', () => {
  const out = mergeField(prev, null, { now: '2026-11-07' });
  assert.equal(out.value, 10);
  assert.equal(out.status, 'carried');
  assert.equal(out.observedAt, '2026-09');
});

test('a jump above 20% is carried and flagged instead of being published', () => {
  const out = mergeField(prev, { value: 13, observedAt: '2026-10' }, { now: '2026-11-07' });
  assert.equal(out.value, 10);
  assert.equal(out.status, 'carried');
  assert.match(out.note, /20%/);
});

test('a percentage rate may move proportionally but not by more than 2 points', () => {
  const low = { ...prev, value: 0.9 };
  assert.equal(mergeField(low, { value: 1.3, observedAt: '2026-10' }, { now: '2026-11-07', kind: 'rate' }).status, 'official');
  const out = mergeField(low, { value: 3.2, observedAt: '2026-10' }, { now: '2026-11-07', kind: 'rate' });
  assert.equal(out.status, 'carried');
  assert.match(out.note, /2 个百分点/);
});

test('a normal update is official and stamped', () => {
  const out = mergeField(prev, { value: 11, observedAt: '2026-10' }, { now: '2026-11-07' });
  assert.equal(out.status, 'official');
  assert.equal(out.observedAt, '2026-10');
  assert.equal(out.fetchedAt, '2026-11-07');
  assert.equal(out.note, undefined);
});

test('a first run with nothing fetched refuses to invent a value', () => {
  assert.throws(() => mergeField(null, null, { now: '2026-11-07' }), /no value/i);
});

test('published data is complete and sourced', () => {
  const work = ['CN', 'US', 'DE', 'UK', 'JP', 'HK', 'AU', 'CA'];
  const all = [...work, 'SG', 'MY', 'TH'];
  assert.deepEqual(Object.keys(DATA.countries).sort(), [...all].sort());
  for (const c of work) assert.ok(DATA.countries[c].roles.includes('work'), c);
  for (const c of ['SG', 'MY', 'TH']) assert.deepEqual(DATA.countries[c].roles, ['retire']);
  for (const c of all) assert.ok(DATA.fx[DATA.countries[c].cur] || DATA.countries[c].cur === 'USD', c);
  const ids = new Set(DATA.sources.map(s => s.id));
  const fields = [...Object.values(DATA.fx), ...Object.values(DATA.countries).flatMap(c =>
    c.roles.includes('work') ? [c.priceLevel, c.cpi, c.target, c.y10, c.pAge, c.drag] : [c.priceLevel])];
  for (const f of fields) {
    assert.ok(Number.isFinite(f.value) && f.url && f.observedAt && f.fetchedAt);
    assert.ok(['official', 'carried', 'assumed'].includes(f.status));
    assert.ok(ids.has(f.sourceId), f.sourceId);
    if (f.status === 'assumed') assert.ok(f.note, 'assumed field needs a basis');
  }
  for (const s of DATA.sources) assert.ok(s.license && s.termsUrl, s.id);
  assert.ok(!/tradingeconomics|investing\.com|bloomberg|asianbondsonline|chinamoney\.com|fred\.stlouisfed/i.test(JSON.stringify(DATA.sources) + JSON.stringify(Object.values(DATA.countries).map(c => c.y10?.url))));
});
