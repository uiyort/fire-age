# 可信与传播：第一批实施计划（修订版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 放假年龄改为"八成把握"年龄，全站口径统一；去掉专业模式门槛；改掉看不懂的说法；换地方放假移出"怎么提前"；简单模式中段折叠；问卷改自报股票占比；分享卡默认不带金额；输入更容易填准。

**Architecture:** 零依赖静态站点。新增 `site/js/odds.js`，负责八成把握的全部计算，和 `engine.js` 的 `monteCarlo` 共用同一组随机抽样，所以两边的成功率一致。所有以"年"为单位的比较都改用 `odds.js`。文案在 `views.js`，DOM 在 `app.js`，卡片在 `card.js`。

**Tech Stack:** 原生 ES modules、Canvas 2D、node:test、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-08-trust-and-sharing-design.md`（实施批次一节的第一批 11 项）

## Global Constraints

- **上线规则**：整批完成、`npm test` 和 `npx playwright test` 全部通过、作者在本地 http://localhost:4173 确认之后才推送。中途可以按任务提交到本地，但不推送。
- 简单模式里，把握一律写成"X 成把握"或"10 个平行的你里 X 个"，X = `peopleOf(success)`，**向下取整**，不足 1 成写"不到 1 成"。专业模式保留百分比。
- 分档和金句按**原始成功率**判定：≥ 0.8 用金句；0.5 到 0.8 写"可以放，但要带着后手放"；< 0.5 写"钱够花的把握不到一半：晚几年放，或者放假后留一点收入"。
- 删掉所有"这 N 条人生里，M 条……"的统计说法。
- 用户可见的文字里不再出现"杠杆""解锁""🔒""裸放"。
- 分享卡默认不出现任何金额和进度百分比；保留小号"搜：放假年龄"；不出现"网页 · 免注册 · 不用下载"、二维码或网址。工作台图卡不放"搜"。
- 资产配置（股票占比）永远不进"提前的办法"。

## Review Focus

- `odds.js` 的成功率必须和 `monteCarlo` 在同样输入下完全相等（共用抽样）。用单元测试覆盖。
- 成功率恰好在 0.8 附近（如 0.795 和 0.8）时：0.795 显示 7 成、不用金句；0.8 显示 8 成、用金句。用单元测试覆盖。
- 模拟没有结果（到不了）时，标题、吸顶栏和卡片不能出现 `null`、`NaN`、"null 成"。
- 浏览器里存着旧问卷答案（`nerve` 键）或旧的小目标（按确定性年数存的）时不能报错：旧答案丢弃，旧目标清除。
- 折叠起来的区块里，滑杆、"换一批年景"、问卷都要能用；现有 e2e 先展开再操作，不能删测试过关。
- 性能：手机上每次输入后的同步渲染不超过约 150ms。`odds.js` 要缓存抽样和增长因子，并按参数缓存求解结果。

---

### Task 1：专业模式不再上锁（A）

**Files:** `site/js/app.js`、`site/js/state.js`、`site/index.html`、`site/method.html`、`site/css/app.css`、`site/js/analytics.js`；测试 `tests/e2e/pro.spec.mjs`、`tests/state.test.mjs`、`tests/analytics.test.mjs`、相关 e2e 的存储预设。

- [ ] e2e 先改：第一次访问点 `#to-pro`，`#pro-form` 直接可见；页面不含"🔒""解锁"；简单视图下有说明"全部假设和养老金"。
- [ ] 实现：删 `isProUnlocked`、`unlockPro`、`askToUnlock`、`#pro-lock-note`、`#pro-enter`、`pro_unlock` 事件；`#share-sub` 改"一张图收下你的结论。"；method.html 改"专业模式随时可以打开"。
- [ ] `npm test && npx playwright test` 通过。

### Task 2：八成把握的计算（B）

**Files:** 新建 `site/js/odds.js`；修改 `site/js/engine.js`（`monteCarlo` 改用共享抽样）；测试新建 `tests/odds.test.mjs`。

**Interfaces（`odds.js` 导出）：**
- `ODDS = 0.8`
- `successAt(p, retireT, s0 = null): number` 只算成功率，与 `monteCarlo(p, retireT, s0).success` 相等。
- `oddsSolve(p, { target = ODDS, s0 = null } = {}): number | null` 成功率第一次 ≥ target 的放假年份 t；规划期内达不到返回 null。
- `oddsYears(p, opts): number | null` 小数年：在跨过 target 的两年之间线性插值；t = 0 时返回 0。
- `oddsRuler(p): { five, eight, nine }` 三个年龄（可为 null）。
- `needLine(p, { target = ODDS } = {}): number[]` 每个放假年份 t 的放假线：每条路径倒推刚好够花的起始金额，取 target 分位。
- `bwdOdds(p, { target = ODDS } = {}): { s0, success }` 倒推：在 `p.tAge` 放假达到 target 所需的第一年储蓄，以及当前计划在 `p.tAge` 放假的成功率。
- `decilePaths(p, retireT, s0, shift = 0): Path[]` 10 条十分位代表路径（第 0%、10%……90% 位置，从最难到最顺），结构与 `lifePath` 相同；`shift` 在同一个十分位里换路径。
- `dualOdds(p)`：和 `dualAges` 一样的返回值，按八成把握算。

- [ ] 写测试：`successAt` 与 `monteCarlo` 相等；`oddsSolve` 返回的 t 满足 `successAt(t) >= 0.8 > successAt(t-1)`；默认案例八成把握 44 岁、五成 41 岁；`needLine` 在放假年份按 0.8 分位倒推后，用这笔钱从该年起模拟，成功率约 0.8；`decilePaths` 里钱够花的条数等于 `Math.floor(success * 10)`；`bwdOdds` 的 s0 让 `successAt(p, n, s0) >= 0.8`。
- [ ] 实现，`npm test` 通过。现有 `engine.test` 的 `monteCarlo` 回归值不变。

### Task 3：全站换成八成把握口径（B、D）

**Files:** `site/js/app.js`、`site/js/levers.js`、`site/js/holiday.js`、`site/js/views.js`、`site/js/goals.js`、`site/js/studio.js`、`site/js/card.js`、`site/js/chart.js`（如需）；测试 `tests/*.test.mjs`、e2e 里写死年龄的断言。

- [ ] `peopleOf` 改为向下取整；新增 `oddsText(success)`：null → ''，< 0.1 → "不到 1 成把握"，否则 "X 成把握"。
- [ ] 正推的 `t`、`fiYears` 全部换成 `oddsSolve` / `oddsYears`：`rankLevers`、`impactOf`、`tryParam`、`placeRanking`、`holidayType`、`variantsHtml`、`heatHtml`、goals、studio。`swr` 移出 `LIFE_CHOICES`，`impactOf('swr')` 返回"放假年龄按八成把握算，提取率只作对照"。
- [ ] 倒推：标题用 `bwdOdds` 的 s0，后面加"（八成把握）"；同时说"按现在的计划，这个年龄有 X 成把握"。专业模式的所需收益率、最多能花、今天需要本金标注"按固定收益算，约五成把握"。
- [ ] 放假线：`target = needLine(p)`；`heroModel` 的 `fund.need` 用放假年份的放假线；新增 `hero.times`（N = 放假线 ÷ 一年支出，取整）、`hero.months`（现有资产 ÷ 放假后每月支出，向下取整）、`hero.ruler`。
- [ ] 标题分档按原始成功率（见 Global Constraints）；正推金句"八成把握：从 44 岁起，余生皆假期"。
- [ ] 结果区：大字年龄下紧贴"八成把握 ⓘ"（问号说明"按本工具假设模拟：2,000 次里至少 1,600 次钱够花到 95 岁"）和"你已经攒够了 X 个月的假"；把握尺"五成 41 · 八成 44 · 九成 45"；放假线旁"≈ 年支出 × N 倍"。近里程碑"再存 ¥X，就攒够一整年的假"。
- [ ] 平行人生：`renderLives` 用 `decilePaths`，取第 0、2、5、8 条（最难、偏难、中间、顺）；"换一批年景"改 `shift`；`livesSummary` 不再计数。
- [ ] 旧的小目标（没有 `odds` 标记）在加载时清除。
- [ ] 专业模式：成功率旁注明几成；提取率对照"Morningstar 30 年九成把握是 3.9%；本工具在你的假设下反推是 X%"；放假线说明句。
- [ ] `npm test && npx playwright test` 通过，改过的断言跟着更新。

### Task 4：改掉看不懂的说法（C）

- [ ] "杠杆"改"提前的办法"（views、card、studio、index、app）；路费数值改"X% 来自今天已有的存款"；卡片"不晚于 50 岁"改"50 岁前"/"50 岁后"；结果页资金行"放假资金：已有 X / 需要 Y（Z%）"。
- [ ] 加全仓检查测试：用户可见文件不含"杠杆""裸放""解锁"。
- [ ] 测试通过。

### Task 5：换地方放假移出"怎么提前"（E）

- [ ] `leverCandidates` 删 `place`；`#places-card` 移出 `#zone-faster`，成为 `<details class="card fold" id="places-fold">`，summary"换个地方放假：最多早 N 年（未含签证医保）"（N 由 `placeRanking` 算，没有更早的地方时写"换个地方放假"）；国外行加"未含签证 · 医保 · 回国机票"；三条说明原文见规格 E 节。
- [ ] 单元测试和 e2e 通过。

### Task 6：中段折叠，简单模式只画选中的人生（F）

- [ ] `#lives-fold`、`#lab-fold` 默认收起，预告句留在外面；展开时重画折线图。
- [ ] `drawLivesChart` 新增 `{ only: boolean }`：简单视图只画选中那条（"等你来写"时同时画它和对比的虚线），并在图上标注名字；专业视图保持灰线。
- [ ] e2e：手机首次访问折叠块收起；展开后图里有 path；简单视图图里只有选中的线。

### Task 7：问卷改自报股票占比（F）

- [ ] `scenario.js`：`nerve` 改 `stocks`，题目"你现在的股票占比大概是多少？"，选项 30/50/70，insight 写"按你现在实际持有的比例选。这里只是记录，不是建议。"；`functions/api/views.js` 的 `QUESTIONS` 同步；`cleanAnswers` 丢弃 `nerve`。
- [ ] 自报占比只进"等你来写"，页面写明。"等你来写"的结果旁同时显示放假年龄、把握和"最差一年跌多少"，并标注"这是你选的配置下的结果，不代表更好"。
- [ ] 测试通过。

### Task 8：分享卡（G）

**Interfaces:**
- `summaryCardSpec({ ...现有参数, odds, months, privacy = { money: false, now: true }, assumptions = '', search = true })`。返回值：`odds`、`months`、`assumptions`；`fund` 只在 `privacy.money` 时出现；`now` 和 `route` 在 `privacy.now` 为假时为 ''；`ribbons`、`searchSub` 删除；`searchHint` 在 `search` 为假时为 ''；字段只有轴的词；条形码说明行不含字母代码。
- `personalLever` 返回 `plain`（不带金额）。
- `assumptionLine({ r, pension }): string` → "按今天的钱算 · 实际收益 2.9%/年 · 未算养老金 / 社保自缴"；有养老金时第三项"含养老金 · 未算社保自缴"。卡上接"按本工具假设模拟，方法见网页『计算方法』"，字号 24px。
- 卡上类型行写"采菊人 · 归园派"；印章盖派名，不再盖字母代码。
- `typeCardSpec(type)`：只发类型版，类型名、emoji、行话词、一句软肋占位（第二批补齐），没有数字。
- `#share-options`：单选"放假通行证 / 只发类型"，复选"显示金额"（默认关）、"显示现在年龄"（默认开）。

- [ ] 写卡片单元测试（默认无金额、显示金额恢复、隐藏年龄后 `now` 与 `route` 为空、假设行、无字母代码、搜索提示可关）和分享 e2e。
- [ ] 实现渲染，用 `scratchpad/pass.mjs`、`variants.mjs` 渲染检查不重叠、不溢出。
- [ ] 测试通过。

### Task 9：输入（F）

- [ ] 支出旁"不确定？拆成房租 / 吃饭 / 其他"，展开三格，填完自动加总写回支出。
- [ ] 示例数字换成更常见的水平，旁边写"示例，改成你的"。
- [ ] "改我的数字"里显示股票占比默认值和出处。
- [ ] e2e 覆盖拆开算。

### Task 10：工作台和文档（J）

- [ ] studio：deck 封面 eyebrow 加"算例 · "；图卡 `search: false`；passInput 走新口径。
- [ ] `site/method.html`、`docs/method.md`：八成把握定义、放假线、N 倍、取整、"按本工具假设模拟"、问卷、路费轴、分享卡隐私。
- [ ] `docs/content-brief.md`：算例标注、AI 声明、正文不写"去搜"。
- [ ] `scripts/lint-copy.mjs` 禁用词加"杠杆""解锁""裸放"。
- [ ] `npm test && npx playwright test && node scripts/lint-copy.mjs` 通过，请作者在 http://localhost:4173 和 /studio/ 检查。确认后分组提交并推送。
