import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findBannedCopy } from '../scripts/lint-copy.mjs';
import { summarizeProbes } from '../scripts/check-cn.mjs';

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk('site').filter(f => f.endsWith('.html'));

test('no page loads a script, stylesheet or font from another origin', () => {
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    assert.ok(!/<script[^>]+src=["']https?:/i.test(html), f);
    // A canonical link names this page's own address and loads nothing.
    assert.ok(!/<link(?![^>]*rel="canonical")[^>]+href=["']https?:/i.test(html), f);
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/i.test(html), f);
  }
  assert.ok(!/@import|url\(["']?https?:/i.test(readFileSync('site/css/app.css', 'utf8')));
});

test('pages use no inline script, which the content security policy would block', () => {
  for (const f of pages) assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(readFileSync(f, 'utf8')), f);
});

test('site copy passes the compliance lint', () => {
  for (const f of pages) assert.deepEqual(findBannedCopy(readFileSync(f, 'utf8')), [], f);
});

test('the book title is not used as the product name', () => {
  for (const f of pages) {
    const title = readFileSync(f, 'utf8').match(/<title>(.*?)<\/title>/)?.[1] ?? '';
    assert.ok(!title.includes('余生皆假期'), f);
  }
});

test('headers block framing, set the policy and hide the studio', () => {
  const h = readFileSync('site/_headers', 'utf8');
  assert.match(h, /Content-Security-Policy:.*default-src 'self'/);
  assert.match(h, /frame-ancestors 'none'/);
  assert.match(h, /\/studio\/\*[\s\S]*X-Robots-Tag: noindex/);
});

test('the mainland check passes on most probes within 3 seconds', () => {
  const ok = { result: { status: 'finished', statusCode: 200, timings: { total: 900 } } };
  const slow = { result: { status: 'finished', statusCode: 200, timings: { total: 5600 } } };
  const failed = { result: { status: 'failed', statusCode: null, timings: { total: 15001 } } };
  assert.equal(summarizeProbes([ok, ok, ok, ok, slow, failed]).pass, true);
  assert.equal(summarizeProbes([ok, slow, slow, failed]).pass, false);
  assert.equal(summarizeProbes([]).pass, false);
  assert.equal(summarizeProbes([{ result: { status: 'finished', statusCode: 500, timings: { total: 100 } } }]).pass, false);
});

test('required open-source files exist and no secrets are tracked', () => {
  for (const f of ['LICENSE', 'README.md', 'README.en.md', 'docs/method.md', 'docs/data-sources.md', 'docs/deploy.md']) assert.ok(existsSync(f), f);
  assert.ok(readFileSync('.gitignore', 'utf8').includes('.dev.vars'));
});
