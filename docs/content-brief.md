# Content brief

For Claude when writing copy from a studio data bundle, and for the author when reviewing it. The author publishes everything by hand. Nothing here connects to a platform account.

## Workflow

1. Open `/studio/`, generate decks, and copy the data bundle.
2. Ask Claude to write copy from the bundle using this brief.
3. Save the drafts to a file and run `node scripts/lint-copy.mjs <file>`.
4. Edit them in your own words and publish by hand.

## Rules for every piece

- Use only numbers that appear in the bundle, and name the data version.
- Write in Chinese and use the name 放假年龄. Do not write "去搜" or ask readers to search in the post or on the images; studio images carry no search words. Let people ask in the comments.
- Studio images are worked examples for a made-up person. Every image says 算例, and the copy says 算例 · 假设人物. Never present them as your own numbers or write about them in the first person.
- Mark each post with the platform's "含 AI 生成内容" declaration.
- Rotate the image layouts and post sparingly; the same layout over and over reads as an ad.
- End with a question that invites a comment, such as 评论区晒出你的放假年龄.
- Stay upbeat, including when the result is poor. Say 再坚持 11 年, not 还要熬 11 年.
- "余生皆假期" may appear only inside a sentence, such as 八成把握：从 41 岁起，余生皆假期, and only when the odds are at least 8 in 10. It is a novel's title and is never the product name.
- The holiday age is the 8-in-10 age. Say 八成把握 with it, and say odds in tenths rounded down (6 成把握), never as a bare percentage in a headline.
- Never use 杠杆, 解锁 or 裸放; say 提前的办法.
- Discuss calculation and principles only. Never name a fund, stock or other product, never suggest an allocation percentage, and never promise returns.
- Never use 稳赚, 保本, 暴富 or similar wording.

## Lead with the experience, not the tool

Open with what the number did to the persona ("这位算例里的 30 岁上班族，还有 574 个周一就放假"), not with "我做了个工具". Do not lead with the name or a link; let people ask in the comments. Good hooks from the bundle:

- `mondays`: the holiday age turned into Mondays left.
- `type`: a four-letter code and a name, such as EHTS 采菊人. People can claim it and argue with it. The rules are public, so invite "你是哪一型".
- `places`: the same money ranked by country. Always mention that visas, tax and healthcare are not counted.
- `life`: one drawn life and its worst year. Say it is one sampled path under a stated seed, never a forecast.

## By platform

**Xiaohongshu.** A title of at most 20 characters built around one surprising number, then a short body of 3 to 5 lines. No links or QR codes, in the images or the text. Use the tags #FIRE #提前退休 #财务自由.

**Douban.** A long post in a sharing voice about a worked example, for FIRE, savings and digital nomad groups. Show the working: inputs, the assumption behind the return, the 8-in-10 holiday line and its multiple of yearly spending, and what surprised you. Invite corrections. A link may be included where the group's rules allow it, so check them first.

**Bilibili comments.** Two or three sentences on the topic of one specific video, with one concrete number. Each comment must respond to that video, so the author adapts every draft after watching it. Never post the same text twice. Bulk or repeated comments risk an account ban.

## Honesty about the numbers

- Results rest on assumptions. Say so when a number is the headline.
- The Hong Kong 10-year yield is a fixed assumption, and the China yield is a monthly OECD figure one to two months behind. Mention this if the yield is central to the point.
- The success rate is a simulation under this tool's assumptions, not a forecast. Say 按本工具假设模拟 when it is central.
