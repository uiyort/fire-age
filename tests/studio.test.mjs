import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import DATA from '../site/js/data-latest.js';
import { personaResult, buildDeck, exportBundle } from '../site/js/studio.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const personas = JSON.parse(readFileSync('site/studio/personas.json', 'utf8'));

test('the persona list includes the cases named in the spec', () => {
  const labels = personas.map(p => p.label).join(' ');
  assert.match(labels, /上海/);
  assert.match(labels, /吉隆坡/);
  assert.equal(personas.length, 6);
});

test('each deck has eight 3:4 cards and ends by asking for comments', () => {
  for (const persona of personas) {
    const deck = buildDeck(personaResult(persona, DATA));
    assert.deepEqual(deck.map(c => c.kind), ['cover', 'result', 'type', 'lever', 'place', 'life', 'learn', 'ask']);
    for (const c of deck) assert.deepEqual(c.size, [1080, 1440]);
    assert.match(deck[7].sentence, /评论区晒出你的放假年龄/);
    const text = JSON.stringify(deck);
    assert.ok(!/https?:|www\.|二维码|NaN|undefined|null/.test(text), persona.label);
    assert.deepEqual(findBannedCopy(text), []);
  }
});

test('a persona who never reaches the goal still gets a complete, upbeat deck', () => {
  const stuck = { label: '测试', workC: 'CN', retC: 'CN', age: 40, assets: 0, income: 60000, expense: 60000, growth: 0 };
  const deck = buildDeck(personaResult(stuck, DATA));
  assert.equal(deck.length, 8);
  assert.ok(!/NaN|undefined|null/.test(JSON.stringify(deck)));
});

test('a person with no helpful lever still gets a lever card', () => {
  const rich = { label: '测试', workC: 'CN', retC: 'CN', age: 40, assets: 1e9, income: 60000, expense: 60000 };
  const deck = buildDeck(personaResult(rich, DATA));
  assert.ok(deck[3].hero);
  assert.ok(!/NaN|undefined|null/.test(JSON.stringify(deck)));
});

test('persona amounts are taken as written in the work currency', () => {
  const r = personaResult({ label: 'HK', workC: 'HK', retC: 'CN', age: 33, assets: 800000, income: 600000, expense: 300000 }, DATA);
  assert.equal(r.inputs.income, 600000);
  assert.equal(r.inputs.wCur, 'HKD');
  assert.equal(r.inputs.rCur, 'CNY');
});

test('the bundle gives Claude the numbers and the data version', () => {
  const b = JSON.parse(exportBundle(personas.map(p => personaResult(p, DATA)), DATA.version));
  assert.equal(b.dataVersion, DATA.version);
  assert.equal(b.results.length, personas.length);
  assert.ok(b.results[0].levers.length > 0);
  assert.equal(typeof b.results[0].label, 'string');
});

test('public pages do not link to the studio', () => {
  for (const f of ['site/index.html', 'site/method.html', 'site/sources.html']) {
    assert.ok(!readFileSync(f, 'utf8').includes('studio'), f);
  }
});

test('the bundle gives Claude the type, Mondays, places and one drawn life', () => {
  const r = JSON.parse(exportBundle([personaResult(personas[0], DATA)], DATA.version)).results[0];
  assert.equal(typeof r.type.name, 'string');
  assert.equal(typeof r.mondays, 'number');
  assert.equal(r.places.length, Object.keys(DATA.countries).length);
  assert.equal(typeof r.life.seed, 'number');
});
