// The backward headline: one condition, one fact, then what reaches 8 in 10. No colons, no fact said twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { bwdOdds, dualOdds } from '../site/js/odds.js';
import { defaultState, setField, toParams } from '../site/js/state.js';
import { headlineText } from '../site/js/views.js';

const plan = o => {
  let S = { ...defaultState(DATA), mode: 'bwd' };
  for (const [id, v] of Object.entries(o)) S = setField(S, id, String(v), DATA);
  return toParams(S, DATA);
};
const say = (p, eightAge) => headlineText({ mode: 'bwd', p, t: null, odds: bwdOdds(p), eightAge, dual: dualOdds(p), dispCur: 'CNY' }).say;
const shared = s => {
  assert.doesNotMatch(s, /[：:]/, 'no colon');
  assert.doesNotMatch(s, /按现在的计划|带着后手|不到一半/, 'none of the old wording');
  assert.equal((s.match(/把握/g) ?? []).length <= 2, true, 'odds said at most twice: the fact and the target');
};

test('stopping today, short: the odds, then waiting or keeping some income', () => {
  const s = say(plan({ age: 35, tAge: 35, assets: 1800000, income: 72000, expense: 72000, retExp: 72000, pension: 24000 }), 46);
  assert.equal(s, '如果今天就放假，钱够花到 95 岁的把握只有 4 成。等到 46 岁再放，就有八成把握；也可以放假后保留一些收入。');
  shared(s);
});

test('a later age, short: saving or waiting, ending on what it reaches', () => {
  const p = plan({ age: 30, tAge: 40, assets: 200000, income: 144000, expense: 72000, retExp: 72000 });
  const s = say(p, 52);
  assert.match(s, /^如果 40 岁放假，钱够花到 95 岁的把握只有 \d 成。每月存够 ¥[\d,]+，或者等到 52 岁再放，就有八成把握。$/);
  shared(s);
});

test('in between: it can be done, with a way back', () => {
  const p = plan({ age: 30, tAge: 50, assets: 400000, income: 144000, expense: 120000, retExp: 72000 });
  const odds = bwdOdds(p).success;
  assert.ok(odds >= 0.5 && odds < 0.8, `hedge band, got ${odds}`);
  const s = say(p, 53);
  assert.match(s, /^如果 50 岁放假，钱够花到 95 岁的把握有 [5-7] 成，可以放，但最好留条后路。/);
  assert.match(s, /就有八成把握。$/);
  shared(s);
});

test('8 in 10 or better: the odds and the slogan', () => {
  const s = say(plan({ age: 35, tAge: 35, assets: 5000000, income: 72000, expense: 72000, retExp: 72000 }), 35);
  assert.match(s, /^如果今天就放假，钱够花到 95 岁的把握有 \d+ 成。从 35 岁起，余生皆假期。$/);
  shared(s);
});

test('under 1 in 10 is said as such', () => {
  const s = say(plan({ age: 35, tAge: 35, assets: 100000, income: 72000, expense: 72000, retExp: 72000 }), null);
  assert.match(s, /^如果今天就放假，钱够花到 95 岁的把握不到 1 成。/);
});

// Forward: the holiday age is the 8-in-10 age by definition, so the sentence names it and says what it takes.
const fwd = o => {
  const p = plan({ mode: 'fwd', ...o });
  return headlineText({ mode: 'fwd', p, t: oddsSolveFor(p), odds: null, dual: dualOdds(p), dispCur: 'CNY' }).say;
};
import { oddsSolve as oddsSolveFor } from '../site/js/odds.js';

test('forward, reachable: the age, the years to go and what they reach, then the slogan', () => {
  const s = fwd({ age: 30, assets: 200000, income: 144000, expense: 72000, retExp: 72000 });
  assert.match(s, /^你的放假年龄是 \d+ 岁。再坚持 \d+ 年，钱够花到 95 岁的把握就有八成。从 \d+ 岁起，余生皆假期。$/);
  shared(s);
});

test('forward, already there: congratulations and what is covered', () => {
  const s = fwd({ age: 40, assets: 8000000, income: 144000, expense: 72000, retExp: 72000 });
  assert.equal(s, '恭喜，现在就能放假，钱够花到 95 岁的把握已有八成。从今天起，余生皆假期。');
});

test('forward, saving nothing: the age the savings alone reach, and the first step', () => {
  const s = fwd({ age: 35, assets: 1800000, income: 72000, expense: 72000, retExp: 72000 });
  assert.match(s, /^目前每月存不下钱，只靠现有存款增长，放假年龄是 \d+ 岁。先让收入超过支出，每一步都算数。$/);
  shared(s);
});

test('forward, out of reach: what is short, of what, and where to start', () => {
  const saving = fwd({ age: 30, assets: 0, income: 72600, expense: 72000, retExp: 72000, growth: 0 });
  assert.equal(saving, '照现在每月存的钱，哪一年放假，钱够花到 95 岁的把握都不到八成。先试试下面提前的办法，一步步来。');
  const none = fwd({ age: 30, assets: 0, income: 72000, expense: 78000, retExp: 72000, growth: 0 });
  assert.equal(none, '目前每月存不下钱，哪一年放假，钱够花到 95 岁的把握都不到八成。先让收入超过支出，下面有提前的办法。');
});
