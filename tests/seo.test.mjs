import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(`site/${f}`, 'utf8');
const attr = (html, re) => html.match(re)?.[1] ?? null;
const canonical = html => attr(html, /<link rel="canonical" href="([^"]+)">/);
const meta = (html, key) => attr(html, new RegExp(`<meta (?:name|property)="${key}" content="([^"]+)">`));

// The site address is written once in robots.txt; every other absolute address must agree with it,
// so moving to a new domain is one find-and-replace that this test checks.
const origin = attr(read('robots.txt'), /^Sitemap: (https:\/\/[^/\s]+)\/sitemap\.xml$/m);

// Cloudflare Pages redirects /method.html to /method, so the canonical addresses have no extension.
const PUBLIC = { 'index.html': '/', 'method.html': '/method', 'sources.html': '/sources' };

test('robots.txt names the sitemap and keeps crawlers out of the API', () => {
  assert.ok(origin, 'Sitemap line with an https address');
  assert.match(read('robots.txt'), /^User-agent: \*$/m);
  assert.match(read('robots.txt'), /^Disallow: \/api\/$/m);
});

test('the sitemap lists the public pages and nothing else', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, Object.values(PUBLIC).map(path => origin + path));
});

test('each public page has a canonical address, a description and sharing tags', () => {
  for (const [file, path] of Object.entries(PUBLIC)) {
    const html = read(file);
    assert.equal(canonical(html), origin + path, file);
    assert.equal(meta(html, 'og:url'), origin + path, file);
    const description = meta(html, 'description');
    assert.ok(description && description.length >= 40 && description.length <= 120, `${file} description length`);
    assert.equal(meta(html, 'og:description'), description, file);
    assert.equal(meta(html, 'og:title'), attr(html, /<title>(.*?)<\/title>/), file);
    assert.equal(meta(html, 'og:site_name'), '放假年龄', file);
  }
});

test('the studio stays out of the sitemap and out of search results', () => {
  assert.ok(!read('sitemap.xml').includes('studio'));
  assert.match(read('studio/index.html'), /<meta name="robots" content="noindex, nofollow">/);
  assert.equal(canonical(read('studio/index.html')), null);
});

test('an unknown address gets a 404 page that stays out of search and leads home', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.equal(canonical(html), null);
  // Served at any depth, so every link and stylesheet starts from the site root.
  assert.match(html, /<link rel="stylesheet" href="\/css\/app\.css">/);
  assert.match(html, /<a href="\/">/);
  assert.ok(!/(?:href|src)="(?!\/|https:)/.test(html));
  assert.ok(!read('sitemap.xml').includes('404'));
});

test('the home page says what the tool is without running any script', () => {
  const about = attr(read('index.html'), /<section class="about" id="about">([\s\S]*?)<\/section>/);
  assert.ok(about, 'about section');
  for (const word of ['放假年龄', '财务自由', '提前退休', '计算器', '八成把握']) assert.ok(about.includes(word), word);
  assert.match(about, /href="method\.html"/);
  assert.match(about, /href="sources\.html"/);
  const title = attr(read('index.html'), /<title>(.*?)<\/title>/);
  assert.ok(title.startsWith('放假年龄'));
  for (const word of ['财务自由', '提前退休', '计算器']) assert.ok(title.includes(word), word);
});
