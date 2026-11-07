import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { onRequestGet, onRequestPost, QUESTIONS } from '../functions/api/views.js';
import { MIN_SHOWN, SCENARIOS, baselineOf } from '../site/js/scenario.js';
import { PARAMS } from '../site/js/params.js';
import { scenarioHtml } from '../site/js/views.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

// An in-memory stand-in for the D1 table: (question, option) -> n.
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind: (...args) => ({ sql, args }),
        all: async () => ({ results: [...rows].map(([key, n]) => ({ question: key.split('|')[0], option: Number(key.split('|')[1]), n })) }),
      };
    },
    async batch(statements) {
      for (const { sql, args } of statements) {
        assert.match(sql, /ON CONFLICT/);
        const key = `${args[0]}|${args[1]}`;
        rows.set(key, (rows.get(key) ?? 0) + 1);
      }
    },
  };
}

const full = Object.fromEntries(SCENARIOS.map(s => [s.id, 1]));
const post = (body, env) => onRequestPost({ request: new Request('https://x/api/views', { method: 'POST', body: JSON.stringify(body) }), env });
const get = env => onRequestGet({ request: new Request('https://x/api/views'), env });

test('the server knows the same questions as the page', () => {
  assert.deepEqual(QUESTIONS, SCENARIOS.map(s => s.id));
});

test('a full set of answers is counted, with nothing else stored', async () => {
  const env = { VIEWS: fakeDb() };
  const r = await post({ a: full, ip: '1.2.3.4', assets: 500000 }, env);
  assert.equal(r.status, 204);
  assert.equal(env.VIEWS.rows.get('_total|0'), 1);
  for (const id of QUESTIONS) assert.equal(env.VIEWS.rows.get(`${id}|1`), 1);
  assert.equal(env.VIEWS.rows.size, QUESTIONS.length + 1);
});

test('partial, unknown or out-of-range answers are rejected without writing', async () => {
  const env = { VIEWS: fakeDb() };
  const { market: _gone, ...partial } = full;
  for (const body of [{ a: partial }, { a: { ...full, evil: 1 } }, { a: { ...full, market: 3 } }, { a: { ...full, market: '1' } }, { a: { ...full, market: 1.5 } }, null, 'x']) {
    assert.equal((await post(body, env)).status, 400, JSON.stringify(body));
  }
  assert.equal(env.VIEWS.rows.size, 0);
});

test('totals come back as shares per option, and are cached briefly', async () => {
  const env = { VIEWS: fakeDb() };
  await post({ a: full }, env);
  await post({ a: { ...full, market: 0 } }, env);
  const r = await get(env);
  assert.match(r.headers.get('cache-control'), /max-age=\d+/);
  const body = await r.json();
  assert.equal(body.total, 2);
  assert.deepEqual(body.counts.market, [1, 1, 0]);
  assert.deepEqual(body.counts.crash, [0, 2, 0]);
});

test('without a database the endpoints say so instead of failing', async () => {
  assert.equal((await post({ a: full }, {})).status, 503);
  assert.equal((await get({})).status, 503);
});

const base = baselineOf(DATA, 'CN');
const params = Object.fromEntries(PARAMS.map(c => [c.id, c]));
const done = crowd => scenarioHtml({ index: SCENARIOS.length, answers: full, base, effect: '', params, crowd });

test('the summary says what is kept, and has no button unless counting failed', () => {
  const html = done({ status: 'loading' });
  assert.ok(!html.includes('crowd-join'));
  assert.match(html, /匿名/);
  assert.match(html, /不记录/);
  assert.deepEqual(findBannedCopy(html), []);
  assert.match(done({ status: 'error' }), /crowd-join/);
});

test('with enough answers, each row shows how many people see it the same way', () => {
  const counts = Object.fromEntries(SCENARIOS.map(s => [s.id, [10, 30, 60]]));
  const html = done({ status: 'shown', total: 100, counts });
  assert.equal((html.match(/30% 也这么看/g) ?? []).length, SCENARIOS.length);
  assert.match(html, /100 人/);
  assert.ok(!html.includes('crowd-join'));
});

test('with too few answers, no shares are shown yet', () => {
  const counts = Object.fromEntries(SCENARIOS.map(s => [s.id, [1, 1, 1]]));
  const html = done({ status: 'shown', total: MIN_SHOWN - 1, counts });
  assert.ok(!/也这么看/.test(html));
  assert.match(html, new RegExp(`满 ${MIN_SHOWN} 人`));
});

test('a failed request is said plainly', () => {
  assert.match(done({ status: 'error' }), /稍后/);
});
