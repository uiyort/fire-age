# Copy framework

How every word on the site is written. [content-brief.md](content-brief.md) covers posts on other platforms; this file covers the site itself, from the headline to the method page. Set 2026-11-17 after the backward headline was found wordy, full of colons and unclear.

## The reader

Someone in their twenties to forties, on a phone, who knows "攒够 25 倍" from social media but not the maths. They read the first line, glance at the big number, and stop when a sentence makes them work. Every layer below must make sense to that reader on its own.

## Layers

| Layer | What it is | Its job |
|---|---|---|
| L1 Conclusion | The headline sentence, the hero's big line, the sticky bar | Say the one thing that matters, with its condition |
| L2 Support | The line under the headline, odds, ten people, fund line, tiles | Back the conclusion with one fact each |
| L3 Action | 怎么提前, the four ways, the lab | Say what to do and what it reaches |
| L4 Explanation | 怎么算的, tooltips, parameter notes, the method page | Say how a number is made, in order |
| L5 Input | Labels, units, hints, stops and their fixes | Say what to type and what is wrong with it |
| L6 Sharing | The card and its captions | Read correctly to a stranger with no page around it |
| L7 Pages | Titles, descriptions, about, sources, 404 | Say what the site is |

## Rules

### Structure

1. **Condition, fact, way, result.** A sentence that judges a plan says under what condition, then the fact, then what changes it, and ends on what that reaches: 如果 40 岁放假，钱够花到 95 岁的把握只有 3 成。每月存够 ¥X，或者等到 52 岁再放，就有八成把握。
2. **One fact once.** A fact is said once per screen. Do not follow 只有 4 成把握 with 把握不到一半.
3. **Conclusion first.** Each layer opens with its point; reasons and caveats follow.
4. **Short.** A sentence in L1–L3 stays under about 40 characters; split it rather than chain clauses.

### Meaning

5. **Name what the odds are about.** 把握 always says of what: 钱够花到 95 岁的把握. An age says what it is the age of: 46 岁就有八成把握, not a bare 46 岁.
6. **No vague references.** Not 按现在的计划, 后手, 这样 without a noun. Say the numbers or the action.
7. **Say what a figure counts.** A multiple says what it multiplies: 年支出 × 42 倍 means the first holiday year's draw from savings.
8. **Never claim safety the odds do not support.** 现在就能放假, 已经够了 and 假期中 only at 8 in 10 or better; below it, say 今天就停 and the odds.

### Symbols

9. **No colon inside a sentence.** A colon is allowed between a label and its value (放假资金：已有 ¥180万). In prose, use a comma or a full stop. On the reference pages (method, sources) a colon may also open a list, a formula or a definition, but never join two clauses.
10. **No slash for "or" or "versus".** Write 算上养老金 46 岁，不算要到 51 岁, not 46 岁 / 51 岁. Slashes stay only in units (¥/月) and fractions.
11. **No arrow inside a sentence.** Arrows belong to diagrams and to the hero's 再上 N 年班 → 放假 M 年.
12. **Brackets sparingly.** Use one only for a unit or a source; never put a second idea in brackets.

### Numbers and terms

13. **Odds** are written in tenths, rounded down, as digits with a space: 4 成. The named standards keep their Chinese numerals: 八成把握 (the holiday age's standard), and 五成 and 九成 on the odds ruler. A sentence that needs both puts the figure first and the standard last: 把握只有 4 成……就有八成把握.
14. **Money** in the simple view is monthly where it was typed monthly.
15. **Terms** are fixed: 放假 (stop working, retire early), 放假年龄 (the 8-in-10 age), 放假线 (what the 8-in-10 needs), 放假资金, 把握, 倍数. Conclusions, results and explanations say 放假. Input labels keep the word readers already use, 退休 (退休后每月想花, 退休地, 想在哪里退休), so the form reads like the question in their head. Decided 2026-11-18.

### Voice

16. **Plain and upbeat.** Spoken Chinese, no finance jargon. 再坚持 11 年, not 还要熬 11 年.
17. **Compliance** as in content-brief.md: no product names, no allocation advice, no 稳赚, 保本, 杠杆, 解锁 or 裸放.

## Checking

`tests/e2e/copy.spec.mjs` renders the page in typical situations, in both views, and fails on rules 9–11 and on measured odds written as a Chinese numeral. On the reference pages it checks rules 10 and 11 only. The other rules need a reader: review every new or changed sentence against them, layer by layer.
