# 可信与传播：第二批实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 类型体系改成"名号 · 门派"并加一句软肋；国内换城市可以自己填；养老金可以估算，并把放假后自缴社保医保算进去；简单模式加"有房贷或孩子？加上再算"的入口。

**Architecture:** 零依赖静态站点，不加构建步骤。新增 `site/js/pension.js`，只放养老金规则（纯函数，不碰 DOM）。`engine.js` 增加两种随时间变化的支出：领取养老金之前的自缴（`selfPay`），和到期会结束的支出（`events`）；`planFlows`、`fiNeed`、`savingsAt` 三处接入，`odds.js` 的缓存键跟着加。文案在 `views.js`，DOM 在 `app.js`，卡片在 `card.js`，类型规则在 `holiday.js`。

**Tech Stack:** 原生 ES modules、Canvas 2D、node:test、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-08-trust-and-sharing-design.md`（H 节、E 节第 1 段、I 节开头和第 1 项；实施批次一节的第二批）

## 作者已拍板的 4 件事

规格没有写到这些细节。作者 2026-11-10 确认全部按下面的取法做，执行方式为子代理逐任务。

1. **房贷和孩子的口径**：认为它们**已经算在"每月支出"和"退休后每月想花"里**，到期后支出相应减少。页面上写明。理由：用户填的是总支出，不会先把月供扣掉。风险：有人填支出时没算月供，结果会偏乐观，所以入口第一行就写这句话。
2. **孩子要多问一项**：规格说只问月供、还到哪年、孩子几个、几岁，但没有金额就算不了。加一格"每个孩子每月花多少"，由用户填，不给默认值。孩子的花销算到 22 岁（规格的五段模板到 18–22 岁为止）。
3. **养老金估算的假设**，都在页面上标"本工具设定"：
   - 计发基数按今天的钱算，以后只跟物价涨（偏保守）。
   - 个人账户的记账利率按与通胀持平算（偏保守）。
   - 累计缴费年限由用户确认，默认是"已缴年限 + 距离领取的年数"，也就是假设放假后继续自缴到领取。
   - 领取年龄不是整岁时，向上取到整岁再进模型；计发月数按已满的整岁查表。
4. **软肋和类型文案是初稿**，见 Task 1、Task 2 里的原文，作者可以直接改字。

## Global Constraints

- **上线规则**：整批完成、`npm test`、`npx playwright test`、`node scripts/lint-copy.mjs site/index.html site/method.html site/sources.html` 全部通过、作者在本地 http://localhost:4173 确认之后才推送。中途按任务提交到本地，不推送。
- 第一批的约束全部继续有效：简单模式只说"X 成把握"；用户可见文字不出现"杠杆""解锁""🔒""裸放"；分享卡默认不出现金额和进度百分比；资产配置不进"提前的办法"。
- 字母代码（如 EHTS）只出现在方法页、导出文件和 `data-code` 属性里；结果页和卡片上不显示。
- 类型文案不把投资收益写成确定会来的东西：不出现"复利""钱生钱""替你上班"。
- "只发类型"的卡和软肋句子里不出现任何数字。
- 养老金规则里的每个数（延迟办法、最低缴费年限、计发月数、自缴比例）写进代码前先对照官方原文，出处记进 `docs/data-sources.md` 和方法页。作者自定的取法标"本工具设定"。
- 不提供城市花销参考值，不提供社平工资默认值：都由用户填，页面提示去哪里查。
- 所有金额按今天的钱算。只有房贷按名义值：月供固定，实际价值每年按长期通胀缩水。

## Review Focus

- 浏览器里存着第一批的旧状态（没有 `real`、`town`、`pen` 和自缴字段）时不能报错，按空值处理；存着格式不对的 `real` 时按空处理。（Task 5、7）
- 改了月供、孩子或自缴金额后，放假年龄必须跟着变：`odds.js` 的缓存键要包含 `selfPay` 和 `events`。（Task 5、7）
- 月供加孩子花销超过每月支出，或超过退休后每月想花时：支出不能变成负数，页面不能出现 `NaN`，要有一句提示。（Task 7、8）
- 累计缴费年限不满最低年限、出生年月没填、1965 年以前出生、工作地不是中国大陆：估算不能出 `NaN`；不满年限时养老金按 0 算并说明；工作地不是中国大陆时不显示估算，`selfPay` 为 0。（Task 4、6）
- 自填的地名含 HTML 符号、表情或超过 6 个字：页面上转义，截到 6 个字，卡片上不溢出；每月花销留空时不出结果行。（Task 3）

---

### Task 1：类型体系改名，字母代码退到方法页（H）

**Files:** `site/js/holiday.js`、`site/js/views.js`、`site/js/card.js`、`site/css/app.css`、`site/method.html`；测试 `tests/holiday.test.mjs`、`tests/card.test.mjs`、`tests/e2e/holiday.spec.mjs`。

**Interfaces（`holiday.js`）：**
- `AXES` 的 `poles` 改为：启程 `{ E: '早班', L: '正点' }`，路费 `{ S: '现攒', G: '老本' }`。目的地、行李不变。
- 启程的 `rule` 改为"放假年龄在 50 岁前（含 50 岁）是早班，50 岁后或还到不了是正点。"；路费的 `rule` 改为"放假那天的钱，一半以上来自今天已有的存款（连同它的收益）是老本，否则是现攒。"规则句里不写字母。
- `TYPES` 里 7 条文案改写（其余不动）：
  - 垂钓客：老本够厚，早早收工，坐在河边等鱼咬钩。
  - 晒背猫：不着急，等老本慢慢长，够了就躺下。
  - 庄园主：老本打底，早早住进自己的大院子。
  - 冲浪客：老本留在岸上，人在浪上漂。
  - 房车客：不赶路，带着老本上路，开到哪算哪。
  - 帆船船长：带着老本，趁风好早早出海。
  - 岛主：攒下的老本送你上岛，剩下的时间归海浪。

- [ ] 写测试：`AXES` 的两组新词；16 条 `blurb` 和 4 条派别 `blurb` 都不含"复利""钱生钱""替你上班"；`typeHtml(type)` 的结果不含 `type.code`，也不含 `>E 早班<` 这类"字母 + 词"；`allTypesHtml()` 的可见文字不含任何 4 字母代码（`data-code` 属性保留）；`typeHtml` 里名字和派名排成"采菊人 · 归园派"。
- [ ] 跑测试，确认失败。
- [ ] 实现：`typeHtml` 删掉 `.type-code`，标题写 `${type.name} · ${type.group}`，派名从右侧 pill 里去掉；轴的两极只显示词。`allTypesHtml` 删掉 `.type-en` 里的代码。`variantsHtml` 表格下加一句："英文圈的 Lean / Fat 多按绝对金额分；本工具的轻装 / 宽裕按'和现在比'来分。"
- [ ] `site/method.html` 的"放假类型"一节：新词和字母对照写在这里（"E 早班 / L 正点""S 现攒 / G 老本"），并说明字母代码只用于方法页和导出。
- [ ] e2e：手机结果页 `#type-now` 的文字不匹配 `/[EL][HA][TF][SG]/`。
- [ ] `npm test && npx playwright test` 通过，提交。

### Task 2：每型一句软肋（H）

**Files:** `site/js/holiday.js`、`site/js/views.js`、`site/js/card.js`、`site/js/app.js`、`site/method.html`；测试 `tests/holiday.test.mjs`、`tests/card.test.mjs`。

**Interfaces：**
- `holiday.js` 新增 `weakness(type, { success = null, pensionShare = 0 } = {}): string`。`pensionShare` = 领取后养老金 ÷ 退休支出（同一货币，0 到 1）。按下面的顺序，第一条符合的就是结果：

| 顺序 | 条件 | 句子 |
|---|---|---|
| 1 | `type.status.id === 'waiting'` | 按现在的节奏还到不了，最要紧的是让每个月能存下钱。 |
| 2 | `success !== null && success < 0.8` | 把握还不到八成，最怕放假头几年就撞上大跌。 |
| 3 | `pensionShare >= 0.5` | 一半以上的开销指望养老金，最怕领取年龄再推迟，或者待遇不如预期。 |
| 4 | 目的地是 A | 换了地方生活，最怕汇率和当地物价一起涨，还有签证和医保。 |
| 5 | 行李是 F | 放假后花得比现在多，最怕花销只涨不降。 |
| 6 | 路费是 G | 钱主要靠老本，最怕放假前后遇上大跌。 |
| 7 | 启程是 E | 钱主要靠自己现攒，余量薄，最怕放假头五年就撞上大跌。 |
| 8 | 其余 | 靠一年一年攒到点，最怕中途收入断档。 |

- `holidayType(p, data, { workC, retC, retireT, success = null })` 的返回值加 `weakness`。`pensionShare` 在函数里算：`p.retExp > 0 ? min(p.pension ÷ p.retExp, 1) : 0`。`app.js` 和 `studio.js` 的调用处传入当前的成功率。
- `typeCardSpec(type, { search })` 的返回值加 `weakness: type.weakness`，画在类型一句话的下面，字号不小于 28px。

- [ ] 写测试：8 条规则各一个用例，顺序正确（同时满足 3 和 4 时出 3）；16 种类型在默认输入下都有非空软肋；所有句子不含数字（`/\d/`）；`typeCardSpec` 带出 `weakness`。
- [ ] 跑测试，确认失败。
- [ ] 实现 `weakness`，接进 `holidayType`、`typeHtml`（类型说明下面一行，前面写"软肋："）、`typeCardSpec` 和 `renderCard` 的类型卡。
- [ ] 用 scratchpad 里的脚本把 16 种类型卡各渲染一张，逐张看：软肋不溢出、不和下方四个字段重叠。
- [ ] `site/method.html` 写上这张规则表，并说明"由你填的数字按规则触发，不是性格判断"。
- [ ] 测试通过，提交。

### Task 3：国内换城市，自己填（E 第 1 段）

**Files:** `site/index.html`、`site/js/app.js`、`site/js/holiday.js`、`site/js/views.js`、`site/js/state.js`、`site/js/card.js`、`site/css/app.css`、`site/method.html`；测试 `tests/holiday.test.mjs`、`tests/state.test.mjs`、`tests/card.test.mjs`、`tests/e2e/holiday.spec.mjs`。

**Interfaces：**
- 状态新增 `town: { name: string, monthly: number | null }`，默认 `{ name: '', monthly: null }`，`name` 存入时截到 6 个字（按字符，不按字节）。
- `holiday.js` 新增 `townPlan(p, monthly): { age: number | null, years: number | null, gain: number | null }`：把 `retExp` 换成 `monthly × 12`（退休地货币），其他不变，用 `oddsSolve` / `oddsYears` 算；`gain` = 现在的小数年 − 新的小数年，任一边到不了时为 `null`。
- `views.js` 新增 `townHtml(town, plan, p)`：一句"在{地名}每月花 {金额}：{年龄} 岁放假，早 {N} 年（八成把握）"；晚的时候写"晚 {N} 年"；到不了写"按这个花销还到不了"。地名经过转义。
- `summaryCardSpec` 的 `place` 参数：填了地名并且 `gain >= 0.05` 时，用 `{ name: town.name, gain }`，优先于国外排名的第一名。

- [ ] 写测试：`townPlan` 花销减半时 `gain > 0`、花销翻倍时 `gain < 0`、花销为 0 或空时返回全 `null`；地名 `<b>清迈</b>` 在 `townHtml` 里被转义；7 个字的地名存成 6 个字；卡片 `place` 用了自填的地名。
- [ ] 跑测试，确认失败。
- [ ] 实现。`#places-fold` 里分两段：先是"国内换个城市，或者回老家"（两个输入框：地名、每月花销，下面是结果句和一句"花销请自己估，本工具不提供各城市的参考值"），然后是原有的国外排名。折叠标题的数字照旧只算国外排名。
- [ ] e2e（手机）：展开 `#places-fold`，填"大理"和 4000，结果句出现"大理"和"岁放假"；清空花销后结果句消失；生成放假卡不报错。
- [ ] `site/method.html`"换个地方放假"一节补一段说明。
- [ ] 测试通过，提交。

### Task 4：养老金规则（I 第 1 项）

**Files:** 新建 `site/js/pension.js`；测试新建 `tests/pension.test.mjs`；`docs/data-sources.md`。

- [ ] **先核对官方原文**，把网址和发布日期记进 `docs/data-sources.md`，再写代码：
  - 《全国人民代表大会常务委员会关于实施渐进式延迟法定退休年龄的决定》和所附《国务院关于渐进式延迟法定退休年龄的办法》（2024-09-13 通过，2025-01-01 施行）及其对照表。
  - 《国务院关于完善企业职工基本养老保险制度的决定》（国发〔2005〕38 号）所附个人账户养老金计发月数表。
  - 灵活就业人员参加企业职工基本养老保险的缴费比例和基数范围（国发〔2005〕38 号第三条及所在地规定）。
  - 下面的数是写计划时查到的，任何一个和原文对不上，以原文为准并改测试。

**Interfaces（`pension.js` 导出，全部纯函数）：**
- `statutoryAge({ birthYear, birthMonth, kind }): { years, months, claimYear } | null`，`kind` 是 `'m'`（男职工）、`'f55'`（原 55 岁退休的女职工）、`'f50'`（原 50 岁退休的女职工）。原年龄 60 / 55 / 50；起算出生年月 1965-01 / 1970-01 / 1975-01；`'m'` 和 `'f55'` 每 4 个月延 1 个月，最多 36 个月；`'f50'` 每 2 个月延 1 个月，最多 60 个月。延迟月数 = `min(上限, ceil(k ÷ 步长))`，`k` 是从起算年月（含）数到出生年月的月数；早于起算年月不延迟。`claimYear` 是达到这个年龄的公历年。输入不全返回 `null`。
- `minContribYears(claimYear): number`：2029 年及以前 15；2030 年 15.5，之后每年加 0.5；2039 年及以后 20。
- `PAYOUT_MONTHS`：40 到 70 岁的计发月数表，照官方附件逐项录入。`payoutMonths(age): number` 按已满的整岁查表，表外取最近的一端。
- `claimAgeWhole({ years, months }): number`：`months > 0` 时 `years + 1`。
- `estimatePension({ base, index, years, paidYears, account, claimAge, claimYear }): { eligible, basic, personal, monthly, minYears }`：
  - `basic = base × (1 + index) ÷ 2 × years × 1%`
  - `personal = (account + base × index × 8% × 12 × max(years − paidYears, 0)) ÷ payoutMonths(claimAge)`
  - `years < minContribYears(claimYear)` 时 `eligible: false`，`monthly: 0`。
- `selfPayDefault(base): number`：`base × 60% × 20%`，每月，灵活就业人员按最低档自缴养老保险。

- [ ] 写测试：
  - `statutoryAge`：男 1964-12 → 60 岁 0 个月；1965-01 → 60 岁 1 个月；1965-05 → 60 岁 2 个月；1976-08 → 62 岁 11 个月；1976-09 和 1990-06 → 63 岁 0 个月。`f55`：1970-01 → 55 岁 1 个月；1981-09 → 58 岁 0 个月。`f50`：1975-01 → 50 岁 1 个月；1975-03 → 50 岁 2 个月；1984-11 → 55 岁 0 个月。缺出生月份 → `null`。
  - `minContribYears`：2029 → 15；2030 → 15.5；2035 → 18；2039 → 20；2045 → 20。
  - `payoutMonths`：50 → 195；55 → 170；58 → 152；60 → 139；61 → 132；62 → 125；63 → 117；65 → 101。
  - `estimatePension({ base: 8000, index: 1, years: 30, paidYears: 10, account: 100000, claimAge: 63, claimYear: 2053 })`：`basic` = 2400，`personal` ≈ 2167.52，`monthly` ≈ 4567.52，`eligible` 为真。把 `years` 改成 12：`eligible` 为假，`monthly` 为 0，`minYears` 为 20。
  - `selfPayDefault(8000)` = 960。
- [ ] 跑测试，确认失败；实现；`npm test` 通过，提交。

### Task 5：模型算进放假后的自缴（I 第 1 项）

**Files:** `site/js/engine.js`、`site/js/odds.js`、`site/js/state.js`；测试 `tests/engine.test.mjs`、`tests/odds.test.mjs`、`tests/state.test.mjs`。

**Interfaces：**
- 模型参数新增 `p.selfPay`：每年，工作地货币，今天的钱，默认 0。只在"已经放假、还没到 `p.pAge`"的年份计入支出。
- `planFlows`：年龄小于 `p.pAge` 的年份，`gross` 加 `p.selfPay`。`fiNeed`：领取之前那一段的每年支出加 `p.selfPay`。模型不检查有没有养老金，由 `toParams` 保证没填养老金时 `selfPay` 为 0。
- 状态新增 `selfPension`、`selfMedical`（每月，可为空）。`toParams`：工作地是中国大陆并且填了养老金时，`selfPay = (selfPension + selfMedical) × 12`，否则 0。
- `odds.js` 的 `KEY_FIELDS` 加 `'selfPay'`。

- [ ] 写测试：`selfPay` 为 0 时，`monteCarlo`、`fiNeed`、`oddsSolve` 的现有回归值一个不变；`selfPay > 0` 时 `oddsSolve` 不早于原来、`fiNeed` 变大；先算 `selfPay = 0` 再算 `selfPay = 24000`，两次 `oddsSolve` 的结果不同（缓存没有串）；`p.age + t >= p.pAge` 的年份支出和没有自缴时相同；旧存档（没有这两个字段）`loadState` 后 `toParams(...).selfPay === 0`；工作地是美国时 `selfPay === 0`。
- [ ] 跑测试，确认失败；实现；`npm test` 通过，提交。

### Task 6：养老金估算的界面（I 第 1 项）

**Files:** `site/js/app.js`、`site/js/views.js`、`site/js/state.js`、`site/js/card.js`、`site/js/params.js`、`site/css/app.css`、`site/method.html`；测试 `tests/state.test.mjs`、`tests/card.test.mjs`、新建 `tests/e2e/pension.spec.mjs`。

**Interfaces：**
- 状态新增 `pen: { birth: 'YYYY-MM' | '', kind: 'm' | 'f55' | 'f50', paidYears, years, account, base, index }`，数字项可为空，`index` 默认 1。
- `views.js` 新增 `pensionEstimateHtml(result)`：显示法定领取年龄（几岁几个月）、基础养老金、个人账户养老金、合计每月，以及"本工具设定"的三条假设；不满最低年限时写"累计缴费不满 {N} 年，不能按月领取，这里按 0 算"。
- `assumptionLine({ r, pension, selfPay })`：第三项，没有养老金 →"未算养老金 / 社保自缴"；有养老金、`selfPay` 为 0 →"含养老金 · 未算社保自缴"；有养老金、`selfPay > 0` →"含养老金和社保自缴"。

- [ ] 写测试：`assumptionLine` 的三种情况；状态里 `pen` 的默认值和旧存档加载。
- [ ] e2e（手机，简单模式）：点养老金一格下面的"不知道？估一下"，填出生年月 1996-06、男、已缴 8 年、个人账户 60000、计发基数 8000；估算结果出现"63 岁"；点"用这个结果"后，养老金一格有值，页面写着领取年龄 63 岁，"放假后每月自缴养老保险"默认是 960；把它改成 0，吸顶栏的结果跟着变。工作地改成美国后估算入口消失。累计年限改成 10 年时出现"不能按月领取"。
- [ ] 跑测试，确认失败。
- [ ] 实现：养老金一格下面加折叠块（写法照现有的 `#expense-split`），简单和专业两个表单都有，只在工作地是中国大陆时显示。输入：出生年月、类别、已缴年限、到领取时累计缴费年限（默认已缴 + 距离领取的年数，可改）、个人账户余额、当地养老金计发基数（提示"在当地人社局网站，或 12333、国家社会保险公共服务平台查'养老金计发基数'"）、平均缴费指数（默认 1，范围 0.6 到 3）。"用这个结果"把养老金换成退休地货币、按年写进 `pension`（状态里的 `pension` 是年额，简单表单按月显示），把 `claimAgeWhole` 写进 `pAge`。再加两格：放假后每月自缴养老保险（默认 `selfPayDefault(base)`，可改为 0）、放假后每月自缴医保（用户填，说明"各地不同，缴满当地规定的年限后可以停，这里一直算到领取养老金那年"）。
- [ ] 模式开关旁的说明改成"专业版：全部假设，以及房贷、孩子、养老金"。`params.js` 里养老金、领取年龄两条的说明补上估算入口和自缴。
- [ ] `site/method.html` 加"养老金估算"一节：两条公式、三条"本工具设定"、延迟办法和最低年限的出处、自缴怎么进模型。
- [ ] 全部测试通过，提交。

### Task 7：模型算进到期会结束的支出（I 节开头）

**Files:** `site/js/engine.js`、`site/js/odds.js`、`site/js/state.js`；测试 `tests/engine.test.mjs`、`tests/odds.test.mjs`、`tests/state.test.mjs`。

**Interfaces：**
- 模型参数新增 `p.events: Array<{ id: string, amount: number, endAge: number, nominal: boolean }>`，默认 `[]`。`amount` 是每年、工作地货币、今天的钱，并且**已经包含在 `p.expense` 和 `p.retExp` 里**。
- `engine.js` 新增 `eventDelta(p, t): number`，第 t 年的支出相对今天的变化（工作地货币），对每项求和：`p.age + t >= endAge` 时 `−amount`；还没到期并且 `nominal` 时 `amount × ((1 + p.infl ÷ 100)^(−t) − 1)`；其余为 0。
- 接入三处：`savingsAt` 减去 `eventDelta(p, t)`，传没传 `s0` 都减；`planFlows` 的 `gross[t]` 加上 `eventDelta(p, t)`，不小于 0；`fiNeed(p, t)` 加上从第 t 年到规划终点的 `eventDelta` 按 `r` 贴现的现值，结果不小于 0。
- `odds.js` 的缓存键加上 `JSON.stringify(p.events ?? [])`。
- 状态新增 `real: { mortgage: { monthly, endYear }, kids: { count, age, monthly } }`，各项可为空（不叫 `life`：状态里的 `life` 已经是"规划到多少岁"）。`kids.age` 是最小的孩子的年龄，所有孩子的花销都算到最小的满 22 岁，偏保守。`state.js` 新增 `eventsOf(S, thisYear): Event[]`：月供和结束年份都填了 → `{ id: 'mortgage', amount: monthly × 12, endAge: S.age + (endYear − thisYear), nominal: true }`；孩子三项都填了 → `{ id: 'kids', amount: count × monthly × 12, endAge: S.age + (22 − age), nominal: false }`；`endAge <= S.age` 的不要。`toParams(S, data, thisYear = new Date().getFullYear())` 把它放进 `p.events`。
- `state.js` 新增 `lifeIssue(S): string`：月供加孩子花销超过每月支出 →"月供和孩子的花销加起来超过了每月支出，请检查这两处"；超过退休后每月想花 →"退休后每月想花里也要算上月供和孩子的花销"；没有问题返回 `''`。有问题时 `eventsOf` 返回 `[]`。

- [ ] 写测试：`events` 为空时所有现有回归值不变；一笔 20 年后结束的月供让 `oddsSolve` 不晚于原来；名义月供的 `eventDelta` 第 0 年为 0、第 10 年为负、到期后等于 `−amount`；实际口径的孩子花销到期前为 0；`planFlows` 的支出没有负数；改 `endAge` 后 `oddsSolve` 结果变化（缓存没有串）；`eventsOf` 的三种情况和已到期的情况；`lifeIssue` 的两句提示；旧存档加载后 `p.events` 为 `[]`；存档里 `real` 是字符串或数组时按空处理。
- [ ] 跑测试，确认失败；实现；`npm test` 通过。
- [ ] 量一下性能：默认输入加两项支出，`oddsSolve` 冷启动一次的耗时和不加时相比不超过 1.2 倍。超过就把 `eventDelta` 按年预先算成数组。提交。

### Task 8："有房贷或孩子？加上再算"（I 节开头）

**Files:** `site/index.html`、`site/js/app.js`、`site/js/views.js`、`site/css/app.css`、`site/method.html`；测试新建 `tests/e2e/life.spec.mjs`。

- [ ] e2e（手机，简单模式）：结果页有折叠的"有房贷或孩子？加上再算"，默认收起，第一屏的输入格数没有变；展开后第一行写着"这些已经算在上面的每月支出里。到期以后，支出相应减少。"；填月供 4000、还到 2045 年，吸顶栏的放假年龄不晚于原来，结果区出现"已含 1 项真实生活"；再填 1 个孩子、5 岁、每月 2000，变成"已含 2 项真实生活"；月供填 99999 时出现 `lifeIssue` 的提示，标签消失，年龄回到原来；切到专业模式，标签和同一组输入都在，数值一致。
- [ ] 跑测试，确认失败。
- [ ] 实现：`<details class="card fold" id="life-fold">` 放在 `#inputs-box` 后面，两种模式都显示。五格：月供、还到哪年、孩子几个、最小的孩子几岁、每个孩子每月花多少。下面的小字："月供按固定金额算，物价上涨后它的实际负担逐年变轻。孩子的花销算到 22 岁。更细的安排（几个孩子年龄不同、兼职收入）会在后面的版本里加。"标签"已含 N 项真实生活"放在大字年龄下面那一行，点它滚到入口。
- [ ] `site/method.html` 加"房贷和孩子"一节：口径、公式、名义值的处理、22 岁的取法（本工具设定）。
- [ ] 全部测试通过，提交。

### Task 9：收尾和作者确认

**Files:** `docs/method.md`、`docs/data-sources.md`、`docs/content-brief.md`、`docs/superpowers/specs/2026-11-08-trust-and-sharing-design.md`、`tests/release.test.mjs`。

- [ ] `docs/method.md` 和方法页对齐：类型的新词和软肋规则、国内换城市、养老金估算、自缴、房贷和孩子。
- [ ] 规格文档里补记"需要作者先拍板的 4 件事"的最终取法。
- [ ] `tests/release.test.mjs` 加一条：`site/js/holiday.js` 的类型文案不含"复利""钱生钱""替你上班"。
- [ ] 用 scratchpad 里的脚本重新渲染放假通行证和 16 张类型卡，逐张看不重叠、不溢出；手机宽度 390 下首页没有横向滚动。
- [ ] `npm test && npx playwright test && node scripts/lint-copy.mjs site/index.html site/method.html site/sources.html` 全部通过。
- [ ] 请作者在 http://localhost:4173 检查。确认后推送。
