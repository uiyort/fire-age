# Content brief

For Claude when writing copy from a studio data bundle, and for the author when reviewing it. The author publishes everything by hand. Nothing here connects to a platform account.

## Workflow

1. Open `/studio/`, generate decks, and copy the data bundle.
2. Ask Claude to write copy from the bundle using this brief.
3. Save the drafts to a file and run `node scripts/lint-copy.mjs <file>`.
4. Edit them in your own words and publish by hand.

## Rules for every piece

- Use only numbers that appear in the bundle, and name the data version.
- Write in Chinese and use the name 放假年龄. Search is the way in, because links are often not clickable.
- End with a question that invites a comment, such as 评论区晒出你的放假年龄.
- Stay upbeat, including when the result is poor. Say 再坚持 11 年, not 还要熬 11 年.
- "余生皆假期" may appear only inside a sentence, such as 从 41 岁起，余生皆假期. It is a novel's title and is never the product name.
- Discuss calculation and principles only. Never name a fund, stock or other product, never suggest an allocation percentage, and never promise returns.
- Never use 稳赚, 保本, 暴富 or similar wording.

## By platform

**Xiaohongshu.** A title of at most 20 characters built around one surprising number, then a short body of 3 to 5 lines. No links or QR codes, in the images or the text. Use the tags #FIRE #提前退休 #财务自由.

**Douban.** A long post in a first-person, sharing voice, for FIRE, savings and digital nomad groups. Show the working: inputs, the assumption behind the return, the withdrawal rate, and what surprised you. Invite corrections. A link may be included where the group's rules allow it, so check them first.

**Bilibili comments.** Two or three sentences on the topic of one specific video, with one concrete number. Each comment must respond to that video, so the author adapts every draft after watching it. Never post the same text twice. Bulk or repeated comments risk an account ban.

## Honesty about the numbers

- Results rest on assumptions. Say so when a number is the headline.
- The China and Hong Kong 10-year yields are fixed assumptions, not live data. Mention this if the yield is central to the point.
- The success rate is a simulation, not a forecast.
