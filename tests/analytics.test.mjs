import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/e.js';
import { channelFromUrl } from '../site/js/analytics.js';

const post = (body, env) => onRequestPost({ request: new Request('https://x/api/e', { method: 'POST', body }), env });
const sink = () => { const pts = []; return { pts, EVENTS: { writeDataPoint: d => pts.push(d) } }; };

test('a valid event stores only event, channel and version', async () => {
  const env = sink();
  const r = await post(JSON.stringify({ e: 'visit', c: 'db1', v: '2026-11', assets: 500000 }), env);
  assert.equal(r.status, 204);
  assert.deepEqual(env.pts, [{ blobs: ['visit', 'db1', '2026-11'], indexes: ['visit'] }]);
});

test('unknown events and bad bodies are rejected without writing', async () => {
  const env = sink();
  assert.equal((await post(JSON.stringify({ e: 'evil' }), env)).status, 400);
  assert.equal((await post('not json', env)).status, 400);
  assert.equal((await post('null', env)).status, 400);
  assert.equal(env.pts.length, 0);
});

test('a malformed channel is stored as direct', async () => {
  const env = sink();
  await post(JSON.stringify({ e: 'visit', c: '<script>', v: '2026-11' }), env);
  assert.equal(env.pts[0].blobs[1], 'direct');
});

test('a malformed version is not stored verbatim', async () => {
  const env = sink();
  await post(JSON.stringify({ e: 'visit', c: 'db1', v: 'x'.repeat(5000) }), env);
  assert.equal(env.pts[0].blobs[2], '');
});

test('a missing analytics binding does not break the request', async () => {
  assert.equal((await post(JSON.stringify({ e: 'visit' }), {})).status, 204);
});

test('channel comes from the ch parameter and is sanitised', () => {
  assert.equal(channelFromUrl('https://x/?ch=db1'), 'db1');
  assert.equal(channelFromUrl('https://x/'), 'direct');
  assert.equal(channelFromUrl('https://x/?ch=%3Cscript%3E'), 'direct');
});

test('drawing a life is a countable event', async () => {
  const { EVENTS } = await import('../functions/api/e.js');
  assert.ok(EVENTS.has('life_draw'));
});

test('finishing the quiz is a countable event, and copying no longer is', async () => {
  const { EVENTS } = await import('../functions/api/e.js');
  assert.ok(EVENTS.has('quiz_done'));
  assert.ok(!EVENTS.has('copy_text'));
});
