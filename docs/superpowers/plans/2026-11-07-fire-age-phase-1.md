# 放假年龄 / FIRE Age 第一阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 把现有单页计算器改造成可公开传播、手机优先、边算边学、可被专业人士核对的"放假年龄"网站，并配套作者自用的内容生成器和数据更新脚本。

**Architecture：** 无构建步骤的静态站点。`site/` 下用原生 ES 模块，计算逻辑是不碰 DOM 的纯函数，用 `node:test` 测试；界面和手机行为用 Playwright 测试。访问统计是唯一的服务端代码，一个 Cloudflare Pages Function。市场数据由脚本生成一个 ES 模块，随页面一起发布，所以没有"数据加载失败"这种状态。

**Tech Stack：** HTML、CSS、原生 JavaScript（ES2022 模块）；Node 24（`node:test`、脚本）；`@playwright/test`（仅开发依赖）；GitHub Actions；Cloudflare Pages、Pages Functions、Workers Analytics Engine。运行时没有第三方依赖。

**Spec：** `docs/superpowers/specs/2026-10-26-fire-age-design.md`

## Global Constraints

- 中文名"放假年龄"，英文名"FIRE Age"，副标题"财务自由 / 提前退休计算器"。
- "余生皆假期"只能在句子里引用（如"从 41 岁起，余生皆假期"），不能当产品名或品牌名。
- 全站不推荐具体基金、股票或理财产品，不给出个人配置比例建议，不出现收益承诺用语（稳赚、保本、暴富）。
- 页脚和方法页写明：本工具仅用于教育和测算，不构成投资建议。
- 第一阶段没有账户、登录、留资、收费、小程序，也不自动发帖或评论。
- 不收集个人信息。用户数据只存在浏览器本地存储里，分享图片在本地生成且不上传。
- 页面运行时只请求同源资源。不用 Google Fonts，只用系统字体。
- 手机优先：390×844 视口下页面没有横向滚动。
- 所有金额都是今日购买力（实际值）。
- 每个市场数值都带来源网址、观测日期、抓取日期和状态；只使用允许再发布的来源，并在来源页列出授权条款。
- 语气乐观向上，结果不理想时也用积极的说法。
- 许可证：AGPL-3.0。
- 运营不需要手工操作：数据更新、测速都由脚本完成。
- 任何要花钱的事项，先把预估发给作者确认，确认前不做。
- 提交信息用英文 Conventional Commits，并以 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 结尾。

## Review Focus

- 用户在手机上清空一个输入框（打字途中常见）：金额按 0 算，年龄等字段沿用上一个有效值，不能悄悄变回示例默认值，也不能出现 NaN。（Task 3）
- 支出大于等于收入，或收入为 0：显示"目前存不下钱"和可行的杠杆，不出现 NaN、负的储蓄率或崩溃。（Task 1、Task 5）
- 内置浏览器禁用本地存储、剪贴板或下载：计算照常工作；图片能长按保存；复制失败时选中文字让用户手动复制。（Task 3、Task 6）
- 日元、泰铢等大数字，或很长的金额：分享卡上的文字缩小以适应宽度，不被裁切。（Task 6）
- 用户手动改过退休支出后切换国家：手改的数字不被覆盖，只提示可能需要调整。（Task 3）

---

## 文件结构

```text
index.html                     移动到 site/ 并拆分（Task 1、Task 4）
package.json  .gitignore  LICENSE  README.md  README.en.md  wrangler.toml
data/assumptions.json          本工具自己的固定假设
.github/workflows/update-data.yml  每月自动更新数据
scripts/serve.mjs              本地静态服务器（测试用）
scripts/update-data.mjs        抓取并生成数据版本
scripts/check-cn.mjs           大陆访问自动测速
scripts/lint-copy.mjs          合规用语检查，也用于检查内容草稿
scripts/stats.mjs              查询访问统计
functions/api/e.js             统计接口
site/index.html  method.html  sources.html  _headers
site/css/app.css
site/data/2026-11.json         数据归档（公开）
site/js/engine.js              金融模型（纯函数）
site/js/data-latest.js         脚本生成的当前数据
site/js/state.js               输入状态、切换国家、本地存储
site/js/levers.js              最大杠杆、参数影响
site/js/params.js              学习卡内容
site/js/goals.js               小目标和回访对比
site/js/card.js                分享卡内容和绘制
site/js/export.js              CSV、JSON 导出
site/js/analytics.js           发送统计事件
site/js/chart.js  app.js       界面
site/js/studio.js              内容生成器逻辑
site/js/studio-page.js         内容生成器页面交互
site/studio/index.html         内容生成器页面（公开站点不链接）
site/studio/personas.json      人物参数
docs/method.md  docs/data-sources.md  docs/content-brief.md
docs/competitor-analysis.md  docs/deploy.md
tests/*.test.mjs               单元测试
tests/fixtures/ecb.xml         欧洲央行汇率样本
tests/e2e/*.spec.mjs           浏览器测试
```

---

### Task 1: 建仓库，把模型提取成可测试的引擎

**Files:**
- Create: `.gitignore`、`package.json`、`LICENSE`、`scripts/serve.mjs`、`site/js/engine.js`、`tests/engine.test.mjs`
- Modify: 把 `index.html` 移到 `site/index.html`

**Interfaces:**
- Produces（均从 `site/js/engine.js` 导出）：
  - `buildParams(raw, fx) -> P`：`raw` 含 `age, life, assets, income, expense, growth, retExp, pension, pAge, tAge, eq, eqReal, bondY, infl, drag, fxDrift, swr, autoSwr, sigEq, sigBd, rho, wCur, rCur`。其中百分比字段都是百分数，`sigEq`、`sigBd`、`rho` 是小数。`P` 在 `raw` 基础上增加 `fx, w, bondReal, r, sigma`，其中 `r` 下限为 -0.5。`fx` 是"每美元单位数"的数字映射，含 `USD: 1`。和现有 `readInputs` 一样做钳制：`life >= age + 2`，`age + 1 <= tAge <= life - 1`。
  - `longRunInflation(cpi, target) -> number`、`conv(v, from, to, fx) -> number`
  - `swrFor(p, H)`、`fiNeed(p, t, E?, r?)`、`savingsAt(p, t, s0?)`、`assetsAt(p, n, {r, s0, A0}?)`
  - `fwdSolve(p, {r, s0, E}?) -> 整数年 | null`
  - `fiYears(p, {r, s0, E}?) -> 小数年 | null`
  - `bwdSolve(p) -> {n, need, s0, reqR, maxE, reqA0, An}`
  - `monteCarlo(p, retireT, s0, {paths=2000, seed=20261026}?) -> {bands, success, paths, seed}`
  - `dualAges(p) -> {withPension: number|null, withoutPension: number|null}`（整数年龄）
  - `savingsRate(p) -> number | null`（收入不大于 0 时返回 `null`）

- [ ] **Step 1: 初始化仓库并保留基线**

```bash
git init -b main
```

写 `.gitignore`（`node_modules/`、`test-results/`、`playwright-report/`、`.wrangler/`、`.dev.vars`）。提交现有 `index.html` 和 `docs/`，提交信息 `chore: import existing calculator and phase 1 docs`。然后 `git switch -c feat/phase-1`，后续任务都在这个分支上。

- [ ] **Step 2: 配置工程**

`package.json`：`"type": "module"`、`"private": true`、`"license": "AGPL-3.0-only"`，脚本 `"test": "node --test tests/*.test.mjs"`、`"e2e": "playwright test"`、`"serve": "node scripts/serve.mjs"`。写入 AGPL-3.0 许可证全文（从 https://www.gnu.org/licenses/agpl-3.0.txt 取）。`scripts/serve.mjs` 用 `node:http` 在 `PORT`（默认 4173）上提供 `site/`，拒绝解析到 `site/` 之外的路径。`git mv index.html site/index.html`。

- [ ] **Step 3: 写失败的回归测试**

数值来自现有模型的实测结果，用来保证提取时行为不变。

```js
// tests/engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParams, fwdSolve, fiYears, fiNeed, assetsAt, bwdSolve, monteCarlo, dualAges, savingsRate, longRunInflation } from '../site/js/engine.js';

const FX = { USD: 1, CNY: 6.6688, MYR: 4.08 };
const base = (o = {}) => buildParams({
  age: 30, life: 95, assets: 500000, income: 300000, expense: 120000, growth: 2,
  retExp: 120000, pension: 36000, pAge: 63, tAge: 45, eq: 60, eqReal: 5, bondY: 1.65,
  infl: 1.5, drag: 0.2, fxDrift: 0, swr: 3.9, autoSwr: true, sigEq: 0.17, sigBd: 0.06,
  rho: 0.2, wCur: 'CNY', rCur: 'CNY', ...o }, FX);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} !~ ${b}`);

test('regression: forward result matches the published calculator', () => {
  const p = base();
  near(p.r, 0.0286, 1e-9);
  near(p.sigma, 0.1094, 1e-3);
  const t = fwdSolve(p);
  assert.equal(p.age + t, 41);
  near(fiNeed(p, t), 3177478, 1);
  near(assetsAt(p, t), 3352547, 1);
});

test('regression: Monte Carlo is reproducible with the default seed', () => {
  const p = base();
  const a = monteCarlo(p, fwdSolve(p), null);
  const b = monteCarlo(p, fwdSolve(p), null);
  near(a.success, 0.587, 0.001);
  assert.equal(a.success, b.success);
  assert.equal(a.paths, 2000);
  assert.equal(a.seed, 20261026);
});

test('backward solutions round-trip', () => {
  const p = base();
  const b = bwdSolve(p);
  near(b.need, 3041559, 1);
  near(assetsAt(p, b.n, { s0: b.s0 }), b.need, 1);
  near(fiNeed(p, b.n, b.maxE), b.An, 1);
  near(b.reqR, 0.0055, 1e-4);
});

test('fiYears falls inside the solved year and is fractional', () => {
  const p = base();
  const t = fwdSolve(p), y = fiYears(p);
  assert.ok(y > t - 1 && y <= t);
  assert.equal(fiYears(base({ assets: 1e9 })), 0);
});

test('pension gives two ages, and no pension gives equal ages', () => {
  const d = dualAges(base());
  assert.ok(d.withPension < d.withoutPension);
  const n = dualAges(base({ pension: 0 }));
  assert.equal(n.withPension, n.withoutPension);
});

test('spending at or above income never produces NaN', () => {
  for (const o of [{ income: 100000, expense: 120000 }, { income: 0 }, { income: 0, expense: 0, assets: 0 }]) {
    const p = base(o);
    const t = fwdSolve(p);
    assert.ok(t === null || Number.isInteger(t));
    const y = fiYears(p);
    assert.ok(y === null || Number.isFinite(y));
    const b = bwdSolve(p);
    for (const k of ['need', 's0', 'maxE', 'reqA0', 'An']) assert.ok(Number.isFinite(b[k]), k);
    assert.ok(!Number.isNaN(b.reqR));
  }
  assert.equal(savingsRate(base({ income: 0 })), null);
});

test('age extremes and absurd assumptions stay finite', () => {
  for (const o of [{ age: 94, tAge: 94 }, { age: 70, pAge: 63 }, { eqReal: -500 }, { retExp: 0, pension: 0 }]) {
    const p = base(o);
    assert.ok(p.r >= -0.5);
    const mc = monteCarlo(p, fwdSolve(p), null, { paths: 50 });
    for (const row of mc.bands) for (const v of row) assert.ok(Number.isFinite(v));
  }
});

test('long-run inflation is the midpoint of CPI and target', () => {
  assert.equal(longRunInflation(0.9, 2), 1.5);
  assert.equal(longRunInflation(4, 2.5), 3.3);
});
```

- [ ] **Step 4: 运行，确认失败**

Run: `npm test`
Expected: FAIL，提示找不到 `site/js/engine.js`。

- [ ] **Step 5: 实现 `site/js/engine.js`**

从 `site/index.html` 的模型部分移植 `swrFor`、`fiNeed`、`savingsAt`、`assetsAt`、`fwdSolve`、`bisect`、`bwdSolve`、`mulberry32`、`monteCarlo`，RNG 的调用顺序不变。改动只有：

- 汇率来自 `p.fx`，不再用全局变量。
- 波动率和相关性来自 `p.sigEq`、`p.sigBd`、`p.rho`。
- `monteCarlo` 接受 `{paths, seed}` 并在结果里返回。
- `bwdSolve` 的 `reqR` 可以是 `±Infinity`，表示超出 -10% 到 30% 的求解范围。
- `dualAges` 对 `pension: 0` 的同一份参数再求解一次。

`fiYears` 的算法：`t = fwdSolve`。`t` 为 `null` 或 0 时直接返回 `t`。否则设 `gapPrev = fiNeed(t-1) - A(t-1)`、`gapNow = A(t) - fiNeed(t)`，返回 `t - 1 + gapPrev / (gapPrev + gapNow)`。

- [ ] **Step 6: 运行，确认通过**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "refactor: extract financial model into tested engine module"
```

---

### Task 2: 全自动数据管线

**Files:**
- Create: `data/assumptions.json`、`scripts/update-data.mjs`、`.github/workflows/update-data.yml`、`site/js/data-latest.js`、`site/data/2026-11.json`、`tests/data.test.mjs`、`tests/fixtures/ecb.xml`、`tests/fixtures/bis.csv`、`tests/fixtures/chinamoney.json`、`tests/fixtures/hkma.json`

**Interfaces:**
- Produces：`site/js/data-latest.js` 默认导出 `DATA`：

```js
{
  version: '2026-11', generatedAt: '<ISO>',
  fx: { CNY: FIELD },                 // 每 1 美元的单位数；USD 恒为 1，不列出
  countries: { CN: {
    name: '中国大陆', cur: 'CNY', roles: ['work', 'retire'],
    priceLevel: FIELD,
    // 以下字段只有 roles 含 'work' 的国家才有
    cpi: FIELD, target: FIELD, y10: FIELD, pAge: FIELD, drag: FIELD } },
  sources: [ { id, name, url, license, termsUrl } ],
}
// FIELD = { value, sourceId, url, observedAt, fetchedAt, status, note? }
// status: 'official' | 'carried' | 'assumed'
```

- `scripts/update-data.mjs` 导出：`parseEcbFx(xml)`、`crossToUsd(eurRates)`、`parseBisCpi(csv) -> {CN: {value, observedAt}}`、`parseChinaMoney10y(json)`、`parseHkma10y(json)`、`priceLevel(ppp, fx)`、`mergeField(previous, fetched, {now}) -> FIELD`。

全部数据自动抓取，没有手工录入：

| 字段 | 来源（均已实测能取到） | 授权 |
|---|---|---|
| 汇率 | 欧洲央行 `eurofxref-daily.xml`，交叉换算成每美元 | 允许再发布，注明来源，并说明换算过 |
| 价格水平 | 世界银行 `PA.NUS.PRVT.PP` ÷ `PA.NUS.FCRF` | CC BY 4.0，按其格式署名 |
| CPI | BIS `WS_LONG_CPI`，同比 | 免费产品可用，注明 BIS；**日后如果收费，要重新确认** |
| 10 年期国债：美国 | FRED `DGS10` | 执行时核对 |
| 10 年期国债：DE、UK、JP、AU、CA | FRED `IRLTLT01<国家>M156N`（月度） | 执行时核对 |
| 10 年期国债：中国 | 中国货币网 `SddsIntrRateGovYldHis` 的 `tenRate` | 执行时核对 |
| 10 年期国债：香港 | 金管局 API `gov-bond/instit-bond-price-yield-daily`（`segment=Benchmark`） | data.gov.hk 条款，署名；执行时核对 |

**国家范围（因"不做手工"而调整）：**

- 债券收益率只影响工作地的收益假设。退休地只需要汇率和价格水平。
- 工作地 + 退休地：CN、US、DE、UK、JP、HK、AU、CA。
- 只能选作退休地：SG、MY、TH。亚洲开发银行的页面虽然有它们的收益率，但条款禁止未经同意再发布，不能用。
- SG 如果能在 data.gov.sg 或 MAS 找到自动来源（开放许可允许商业使用），就升级为工作地；找不到就保持只作退休地。
- TW 整个去掉：汇率、价格水平和 CPI 都没有自动来源。

`data/assumptions.json` 只放不随市场变化的本工具假设：名称、货币、`roles`、通胀目标、`drag`、`pAge`，一次写好。它们的 `status` 是 `assumed`，统一用 `sourceId: 'assumption'`，`url` 和 `termsUrl` 指向 `method.html`，`license` 写 AGPL-3.0，并写明 `note`。

- [ ] **Step 1: 写失败的测试**

```js
// tests/data.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEcbFx, crossToUsd, parseBisCpi, parseChinaMoney10y, parseHkma10y, priceLevel, mergeField } from '../scripts/update-data.mjs';
import DATA from '../site/js/data-latest.js';

const fixture = f => readFileSync(`tests/fixtures/${f}`, 'utf8');

test('ECB rates cross into units per USD', () => {
  const usd = crossToUsd(parseEcbFx(fixture('ecb.xml'))); // USD 1.1165, CNY 7.4485
  assert.ok(Math.abs(usd.CNY - 7.4485 / 1.1165) < 1e-9);
  assert.ok(Math.abs(usd.EUR - 1 / 1.1165) < 1e-9);
  assert.equal(usd.USD, undefined);
});

test('BIS, ChinaMoney and HKMA responses parse to value and date', () => {
  const cpi = parseBisCpi(fixture('bis.csv'));         // CN 2026-09 0.9
  assert.deepEqual(cpi.CN, { value: 0.9, observedAt: '2026-09' });
  const cn = parseChinaMoney10y(fixture('chinamoney.json')); // 2026-11-06 1.5878
  assert.deepEqual(cn, { value: 1.5878, observedAt: '2026-11-06' });
  const hk = parseHkma10y(fixture('hkma.json'));
  assert.ok(Number.isFinite(hk.value) && hk.observedAt);
});

test('price level is PPP over market rate', () => {
  assert.ok(Math.abs(priceLevel(3.4, 6.8) - 0.5) < 1e-12);
});

const prev = { value: 10, sourceId: 'x', url: 'u', observedAt: '2026-09', fetchedAt: '2026-10-01', status: 'official' };

test('a failed fetch carries the old value and keeps its observation date', () => {
  const out = mergeField(prev, null, { now: '2026-11-07' });
  assert.equal(out.value, 10);
  assert.equal(out.status, 'carried');
  assert.equal(out.observedAt, '2026-09');
});

test('a jump above 20% is carried and flagged instead of being published', () => {
  const out = mergeField(prev, { value: 13, observedAt: '2026-10' }, { now: '2026-11-07' });
  assert.equal(out.value, 10);
  assert.equal(out.status, 'carried');
  assert.match(out.note, /20%/);
});

test('a normal update is official and stamped', () => {
  const out = mergeField(prev, { value: 11, observedAt: '2026-10' }, { now: '2026-11-07' });
  assert.equal(out.status, 'official');
  assert.equal(out.observedAt, '2026-10');
  assert.equal(out.fetchedAt, '2026-11-07');
});

test('published data is complete and sourced', () => {
  const work = ['CN', 'US', 'DE', 'UK', 'JP', 'HK', 'AU', 'CA'];
  const all = [...work, 'SG', 'MY', 'TH'];
  assert.deepEqual(Object.keys(DATA.countries).sort(), [...all].sort());
  for (const c of work) assert.ok(DATA.countries[c].roles.includes('work'), c);
  for (const c of ['MY', 'TH']) assert.deepEqual(DATA.countries[c].roles, ['retire']);
  const ids = new Set(DATA.sources.map(s => s.id));
  const fields = [...Object.values(DATA.fx), ...Object.values(DATA.countries).flatMap(c =>
    c.roles.includes('work') ? [c.priceLevel, c.cpi, c.target, c.y10, c.pAge, c.drag] : [c.priceLevel])];
  for (const f of fields) {
    assert.ok(Number.isFinite(f.value) && f.url && f.observedAt && f.fetchedAt);
    assert.ok(['official', 'carried', 'assumed'].includes(f.status));
    assert.ok(ids.has(f.sourceId), f.sourceId);
    if (f.status === 'assumed') assert.ok(f.note, 'assumed field needs a basis');
  }
  for (const s of DATA.sources) assert.ok(s.license && s.termsUrl, s.id);
  assert.ok(!/tradingeconomics|investing\.com|bloomberg|asianbondsonline/i.test(JSON.stringify(DATA)));
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `scripts/update-data.mjs`**

命令：`node scripts/update-data.mjs`（版本号取当前年月）。读取 `data/assumptions.json` 和上一版数据，抓取所有字段，单个字段失败或跳变超过 20% 时走 `mergeField` 沿用旧值，然后写 `site/data/<version>.json` 和 `site/js/data-latest.js`，并打印所有 `carried` 字段。用 Node 的 `fetch`，每次请求 30 秒超时，重试 2 次。只在作为主模块运行时才抓取。

没有上一版时（首次运行），抓取失败要直接报错退出，不能生成残缺数据。

- [ ] **Step 4: 核对授权并生成数据**

阅读 FRED、中国货币网、金管局的使用条款，填写 `sources` 的 `license` 和 `termsUrl`。如果某个来源禁止再发布或读不到条款，**停下来列给作者决定，不要自行放行**。中国的 10 年期国债是核心数据，它的授权结论要明确写在报告里。

Run: `node scripts/update-data.mjs && npm test`
Expected: 生成两个文件，全部 PASS。

- [ ] **Step 5: 加每月自动更新**

`.github/workflows/update-data.yml`：每月 16 日运行（多数国家的 CPI 已发布）并支持手动触发，步骤是运行脚本、`npm test`、通过后把数据文件提交到 `main`，Cloudflare Pages 随之自动部署。测试不通过就不提交，网站继续用上一版，GitHub 会发失败通知邮件。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add fully automated market data pipeline"
```

---

### Task 3: 输入状态层

**Files:**
- Create: `site/js/state.js`、`tests/state.test.mjs`

**Interfaces:**
- Consumes：`buildParams`、`longRunInflation`（Task 1），`DATA`（Task 2）。
- Produces：
  - `defaultState(data) -> S`。`S` 的字段：`view: 'simple'|'pro'`、`mode: 'fwd'|'bwd'`、`workC, retC, dispCur`，`Task 1 raw` 的所有数值字段（可以是 `null`，表示空白），`touched: {retExp?: true}`。默认值就是 Task 1 测试里的示例，`eq: 60, eqReal: 5, sigEq: 0.17, sigBd: 0.06, rho: 0.2, life: 95`；`pension` 默认 `null`。
  - `setField(S, id, rawText) -> S`：空字符串写成 `null`。手改 `retExp` 时设置 `touched.retExp`。
  - `setWorkCountry(S, code, data) -> S`：只接受 `roles` 含 `work` 的国家，否则原样返回。换算 `assets, income, expense`，并填入该国 `infl`（`longRunInflation`）、`bondY`、`drag`、`pAge`。
  - `setRetireCountry(S, code, data) -> S`：`pension` 按汇率换算。`retExp` 没手改过时用 `estimateRetireSpend` 重算；手改过时保留数字，并设置 `S.notice`（含"调整"二字）提醒用户。
  - `estimateRetireSpend(annualExpense, workC, retC, data) -> number`：`expense ÷ FX[工作地] × (PL[退休地] ÷ PL[工作地]) × FX[退休地]`。
  - `toParams(S, data) -> P`：`null` 的金额字段（`assets, income, expense, retExp, pension`）按 0；其它 `null` 字段用 `S.lastValid` 里的上一个有效值（`setField` 负责维护，非数字文本按空白处理）。把 `data.fx` 展平成 `buildParams` 需要的数字映射。
  - `loadState(data, storage) -> S`、`saveState(S, storage) -> void`：键名 `fire-age-v1`，`storage` 可以抛错，也可以为 `null`。
  - `safeStorage() -> Storage | null`

- [ ] **Step 1: 写失败的测试**

```js
// tests/state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, setField, setWorkCountry, setRetireCountry, estimateRetireSpend, toParams, loadState, saveState } from '../site/js/state.js';

const fx = c => DATA.fx[c]?.value ?? 1;

test('clearing a money field means zero, never the example default', () => {
  const s = setField(defaultState(DATA), 'assets', '');
  assert.equal(s.assets, null);
  assert.equal(toParams(s, DATA).assets, 0);
});

test('clearing age keeps the last valid age', () => {
  let s = setField(defaultState(DATA), 'age', '35');
  s = setField(s, 'age', '');
  assert.equal(toParams(s, DATA).age, 35);
});

test('retirement spending estimate is an identity within one country', () => {
  assert.equal(estimateRetireSpend(120000, 'CN', 'CN', DATA), 120000);
});

test('retirement estimate uses price levels, not only the market rate', () => {
  const pl = c => DATA.countries[c].priceLevel.value;
  const out = estimateRetireSpend(120000, 'CN', 'MY', DATA);
  const expected = 120000 / fx('CNY') * (pl('MY') / pl('CN')) * fx('MYR');
  assert.ok(Math.abs(out - expected) < 1e-6);
});

test('switching retirement country keeps a hand-edited spend', () => {
  const edited = setField(defaultState(DATA), 'retExp', '88888');
  const moved = setRetireCountry(edited, 'MY', DATA);
  assert.equal(moved.retExp, 88888);
  assert.match(moved.notice, /调整/);
  const auto = setRetireCountry(defaultState(DATA), 'MY', DATA);
  assert.notEqual(auto.retExp, 120000);
});

test('switching work country preserves purchasing power and fills local data', () => {
  const s = setWorkCountry(defaultState(DATA), 'US', DATA);
  assert.ok(Math.abs(s.assets - 500000 / fx('CNY')) < 1);
  assert.equal(s.bondY, DATA.countries.US.y10.value);
  assert.equal(s.pAge, DATA.countries.US.pAge.value);
});

test('a retirement-only country cannot become the work country', () => {
  const s = defaultState(DATA);
  assert.equal(setWorkCountry(s, 'MY', DATA).workC, 'CN');
});

test('storage failures and corrupt saves fall back to defaults', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadState(DATA, throwing), defaultState(DATA));
  assert.doesNotThrow(() => saveState(defaultState(DATA), throwing));
  assert.deepEqual(loadState(DATA, null), defaultState(DATA));
  const corrupt = { getItem: () => '{not json', setItem() {} };
  assert.deepEqual(loadState(DATA, corrupt), defaultState(DATA));
  const unknown = { getItem: () => JSON.stringify({ workC: 'XX' }), setItem() {} };
  assert.equal(loadState(DATA, unknown).workC, 'CN');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `site/js/state.js`**

所有函数返回新对象，不修改入参。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add input state with country switching and safe storage"
```

---

### Task 4: 杠杆和学习卡内容

**Files:**
- Create: `site/js/levers.js`、`site/js/params.js`、`scripts/lint-copy.mjs`、`tests/levers.test.mjs`

**Interfaces:**
- Consumes：`fiYears`、`buildParams`（Task 1），`DATA`（Task 2）。
- Produces：
  - `rankLevers(p, data, {retC, top = 3}) -> [{id, label, beforeYears, afterYears, gainYears, unlocks}]`：去掉没有效果的杠杆。原本不可达、改后可达的 `unlocks: true`、`gainYears: null`，排在最前；其余按 `gainYears` 降序。
  - `impactOf(p, paramId) -> {stepLabel, gainYears | null}`
  - `PARAMS`（`params.js`）：`[{id, name, what, improve, stepLabel, range?: {text, sourceUrl}, noRangeReason?}]`
  - `findBannedCopy(text) -> string[]`（`lint-copy.mjs`）。命令行 `node scripts/lint-copy.mjs <file...>` 发现问题时以非零状态退出。

杠杆的变动幅度（设计文档的值）：

| id | 变动 |
|---|---|
| `spend` | `expense`、`retExp` 都乘 0.9 |
| `saveRate` | `expense` 减去 `income × 5%`，`retExp` 不变 |
| `fee` | `drag − 0.5`，下限 0；`drag` 已是 0 时跳过 |
| `growth` | `growth + 1` |
| `place` | 在 `data.countries` 里取价格水平最低且低于当前退休地的国家，`retExp` 乘以价格水平之比；没有更便宜的就跳过 |

股票占比不是杠杆，也不给"提高股票占比"的建议：把配置比例写成建议属于投资顾问范畴，学习卡只讲取舍。

- [ ] **Step 1: 写失败的测试**

```js
// tests/levers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, toParams, setField } from '../site/js/state.js';
import { rankLevers, impactOf } from '../site/js/levers.js';
import { PARAMS } from '../site/js/params.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const p = (edits = {}) => {
  let s = defaultState(DATA);
  for (const [k, v] of Object.entries(edits)) s = setField(s, k, String(v));
  return toParams(s, DATA);
};

test('levers are sorted by years gained and capped at three', () => {
  const out = rankLevers(p(), DATA, { retC: 'CN' });
  assert.ok(out.length <= 3 && out.length > 0);
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].gainYears >= out[i].gainYears);
  for (const l of out) assert.ok(l.gainYears > 0);
});

test('a lever that makes the goal reachable ranks first', () => {
  // 显式给出收益假设，让这个案例不随每月数据变化：基准情形到规划年龄都达不到。
  const stuck = p({ assets: 500000, income: 120000, expense: 120000, growth: 0, retExp: 120000, pension: 0, eq: 60, eqReal: 5, bondY: 1.65, infl: 1.5, drag: 0.2 });
  const out = rankLevers(stuck, DATA, { retC: 'CN' });
  assert.equal(out[0].unlocks, true);
  assert.equal(out[0].beforeYears, null);
  assert.ok(Number.isFinite(out[0].afterYears));
});

test('a zero fee drops out of the fee lever', () => {
  const out = rankLevers(p({ drag: 0 }), DATA, { retC: 'CN', top: 9 });
  assert.ok(!out.some(l => l.id === 'fee'));
});

test('retiring in the cheapest place offers no place lever', () => {
  const cheapest = Object.entries(DATA.countries).sort((a, b) => a[1].priceLevel.value - b[1].priceLevel.value)[0][0];
  const out = rankLevers(p(), DATA, { retC: cheapest, top: 9 });
  assert.ok(!out.some(l => l.id === 'place'));
});

test('every adjustable input has a learning card', () => {
  const ids = new Set(PARAMS.map(c => c.id));
  for (const id of ['age', 'assets', 'income', 'expense', 'growth', 'retExp', 'life', 'pension', 'pAge', 'eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift', 'swr', 'sigEq', 'sigBd', 'rho']) {
    assert.ok(ids.has(id), id);
  }
  for (const c of PARAMS) assert.ok(c.range ? c.range.sourceUrl : c.noRangeReason, c.id);
});

test('learning-card copy passes the compliance lint', () => {
  for (const c of PARAMS) assert.deepEqual(findBannedCopy(`${c.what} ${c.improve}`), [], c.id);
  assert.ok(findBannedCopy('这只基金稳赚').length > 0);
});

test('impact is reported per step in years', () => {
  const i = impactOf(p(), 'eqReal');
  assert.ok(i.stepLabel && (i.gainYears === null || Number.isFinite(i.gainYears)));
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现三个模块**

`findBannedCopy` 查找：稳赚、保本、暴富、必涨、无风险收益、荐股、买入、推荐基金。

`PARAMS` 每张卡用大白话写。参考区间只写能查到出处的：提取率引 Morningstar 3.9%、股票收益引 UBS 年鉴 6.6%、国债和通胀引 `DATA`。储蓄率、支出这类因人而异又没有权威基准的参数，写 `noRangeReason`（如"因人而异，没有通用标准"），不编造区间。

`impactOf` 的步长：`eqReal`、`bondY`、`infl`、`growth`、`drag`、`swr` 各 ±1 或 ±0.5 个百分点，`eq` 10 个百分点，金额 10%，年龄 1 岁。无法用"提前多少年"表达的（波动率、相关性影响成功率而非确定性年龄），`gainYears` 为 `null`，界面改为显示说明。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add lever ranking and parameter learning cards"
```

---

### Task 5: 手机优先的新界面

**Files:**
- Create: `site/css/app.css`、`site/js/chart.js`、`site/js/app.js`、`site/js/goals.js`、`playwright.config.mjs`、`tests/goals.test.mjs`、`tests/e2e/app.spec.mjs`
- Modify: `site/index.html`（整体替换为只有结构的页面）

**Interfaces:**
- Consumes：Task 1–4 的全部导出。
- Produces：
  - `goals.js`：`makeGoal(paramId, target, p, now) -> Goal`（`paramId` 是 `saveRate`，达到 `>= target`；或 `expense`、`drag`，达到 `<= target`）、`compareVisit(goal, p, now) -> {yearsDelta, achieved, current}`（`yearsDelta` 是设目标时的 `fiYears` 减现在的 `fiYears`，任一为 `null` 时为 `null`）、`loadGoal(storage)`、`saveGoal(goal, storage)`，键名 `fire-age-goal-v1`。
  - `app.js` 导出 `currentResult() -> {view, mode, p, retireT, years, dual, mc, bwd, levers, target, dataVersion}`，供 Task 6、Task 7 使用。`target` 是逐年的 `fiNeed` 数组。
  - 页面元素 id：`#simple-form`、`#pro-form`、`#to-pro`、`#to-simple`、`#to-fwd`、`#to-bwd`、`#solves`、`#headline`（结果主句）、`#levers`、`#cards`、`#help-<参数>`、`#card-<参数>`、`#goal`、`#share-btn`、`#export-csv`、`#export-json`、`#data-version`。

- [ ] **Step 1: 写失败的测试**

```js
// tests/goals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../site/js/data-latest.js';
import { defaultState, toParams, setField } from '../site/js/state.js';
import { makeGoal, compareVisit, loadGoal } from '../site/js/goals.js';

test('a met goal is achieved and reports years gained', () => {
  const before = toParams(defaultState(DATA), DATA);
  const goal = makeGoal('saveRate', 0.65, before, '2026-11-07');
  const after = toParams(setField(defaultState(DATA), 'expense', '90000'), DATA);
  const out = compareVisit(goal, after, '2026-12-07');
  assert.equal(out.achieved, true);
  assert.ok(out.yearsDelta > 0);
});

test('an unmet goal is not achieved', () => {
  const p = toParams(defaultState(DATA), DATA);
  assert.equal(compareVisit(makeGoal('saveRate', 0.9, p, '2026-11-07'), p, '2026-11-08').achieved, false);
});

test('a broken goal store reads as no goal', () => {
  assert.equal(loadGoal({ getItem() { throw new Error('denied'); } }), null);
  assert.equal(loadGoal(null), null);
});
```

```js
// tests/e2e/app.spec.mjs
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('simple mode works end to end on a phone with only same-origin requests', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', r => { if (!r.url().startsWith(baseURL) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('放假年龄');
  await expect(page.locator('#simple-form input:visible, #simple-form select:visible')).toHaveCount(7);
  await expect(page.locator('#headline')).toContainText('岁');
  await expect(page.locator('footer')).toContainText('不构成投资建议');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(external).toEqual([]);
});

test('clearing a field while typing never shows NaN', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '');
  await expect(page.locator('main')).not.toContainText('NaN');
  await expect(page.locator('main')).not.toContainText('Infinity');
});

test('spending above income explains itself', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '0');
  await page.fill('#s-income', '5000');
  await page.fill('#s-expense', '9000');
  await expect(page.locator('#headline')).toContainText('存不下钱');
  await expect(page.locator('#levers')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('NaN');
});

test('pension shows both ages', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-pension', '3000');
  await expect(page.locator('#headline')).toContainText('算上养老金');
  await expect(page.locator('#headline')).toContainText('不算养老金');
});

test('tapping a parameter opens its learning card with a personal impact', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#card-expense')).toBeHidden();
  await page.click('#help-expense');
  await expect(page.locator('#card-expense')).toBeVisible();
  await expect(page.locator('#card-expense')).toContainText('年');
});

test('simple mode also solves backward', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-bwd');
  await expect(page.locator('#headline')).toContainText('放假');
  await expect(page.locator('#headline')).toContainText('想');
  await expect(page.locator('#s-tage')).toBeVisible();
});

test('pro mode exposes all parameters and the backward solves', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  for (const id of ['eq', 'sigEq', 'sigBd', 'rho', 'swr', 'fxDrift', 'drag']) await expect(page.locator(`#p-${id}`)).toBeVisible();
  await page.click('#to-bwd');
  await expect(page.locator('#solves')).toContainText('多存');
  await expect(page.locator('#solves')).toContainText('本金');
  await expect(page.locator('body')).toContainText('20261026');
});

test('the page still calculates with storage blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }));
  await page.goto('/');
  await expect(page.locator('#headline')).toContainText('岁');
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm i -D @playwright/test
npx playwright install chromium
npm test
npm run e2e
```

`playwright.config.mjs`：`testDir: 'tests/e2e'`，`webServer` 运行 `node scripts/serve.mjs`，`baseURL: 'http://localhost:4173'`。
Expected: FAIL，缺少 `goals.js` 和页面元素。

- [ ] **Step 3: 实现界面**

**简单模式**（默认）问 7 项，单位是"每月"，写入状态时 ×12：`#s-age`、`#s-assets`、`#s-income`、`#s-expense`、`#s-work`（生活地，只列 `roles` 含 `work` 的国家）、`#s-ret`（退休地，列全部国家）、`#s-pension`（可选）。倒推时多一项 `#s-tage`（目标年龄）。退休后每月支出放在表单之外的结果区（`#s-retexp`），显示为可编辑的估算值，标注"估算值，请按你计划的实际生活改写"。`S.notice` 有内容时显示在它旁边。

**学习卡**：简单模式下点 `#help-<参数>` 展开 `#card-<参数>`；专业模式下常驻显示。卡片内容来自 `PARAMS` 和 `impactOf`。

**专业模式**用 `#p-<字段>` 展开全部参数，保留现有页面的显示币种、Lean/标准/Fat/Coast/Barista 表和敏感度热力图。切换模式不丢数据。

**结果主句 `#headline`**（文案固定）：

| 情况 | 文案 |
|---|---|
| 正推，已达到 | "恭喜，现在就可以放假。从今天起，余生皆假期。" |
| 正推，可达 | "你的放假年龄是 41 岁。再坚持 11 年，从 41 岁起，余生皆假期。" |
| 正推，不可达，能存下钱 | "按现在的节奏还到不了放假那天。先试试下面的杠杆，一步步来。" |
| 正推，不可达，存不下钱 | "目前存不下钱，所以先从下面的杠杆开始，每一步都算数。" |
| 倒推 | "想 45 岁放假，每月需存 8,600。"（已够时："想 45 岁放假，现在的存款已经够了。"） |
| 填了养老金 | 追加"算上养老金 41 岁 / 不算养老金 44 岁"。 |
| 没填养老金 | 追加"填上养老金，看看能提前多少。" |

小目标和回访：用户从杠杆一键设目标，再次打开时显示变化；存储不可用时隐藏这一块。

`app.js` 只负责把状态渲染成页面。输入事件用 `requestAnimationFrame` 合并后重算，蒙特卡洛在手机上跑在主线程，所以输入停止 150ms 后才重跑。

`chart.js` 从现有 `drawChart` 移植，并接收 `bands`、`target`、`retireT`。保留分位区间、中位线、自由线、悬停提示和数据表。

视觉沿用现有页面的玉绿色风格，颜色全部走 token，浅色和深色都要有。字体用系统字体栈，不加载网络字体。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test && npm run e2e`
Expected: 全部 PASS。

- [ ] **Step 5: 看一眼实际页面**

用 Playwright 分别截 390×844 和 1280×800、浅色和深色的图，修掉重叠、裁切和对比度问题。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: rebuild the calculator as a mobile-first two-level interface"
```

---

### Task 6: 分享卡和评论文案

**Files:**
- Create: `site/js/card.js`、`tests/card.test.mjs`、`tests/e2e/share.spec.mjs`
- Modify: `site/index.html`、`site/js/app.js`

**Interfaces:**
- Consumes：`currentResult()`（Task 5）、`compareVisit`（Task 5）。
- Produces（`card.js`）：
  - `toCardInput(currentResult) -> CardInput`：正推 `{mode: 'fwd', age, retireAge, years, success, needText}`，倒推 `{mode: 'bwd', targetAge, monthlyText, enough, success}`。
  - `resultCardSpec(input: CardInput) -> {kind: 'result', size: [1080, 1080], hero, sentence, stats: [{label, value}], brand: '放假年龄 / FIRE Age', searchHint: '搜：放假年龄', comment}`
  - `goalCardSpec(goal, comparison) -> 同样结构, kind: 'goal'`
  - `fitFontSize(measure, text, maxWidth, startPx, minPx) -> number`，其中 `measure(text, px) -> 宽度`
  - `renderCard(spec, canvas) -> void`：用系统字体绘制，所有文字经 `fitFontSize` 缩放。
  - `copyText(text, fallbackEl) -> Promise<'copied' | 'selected'>`

- [ ] **Step 1: 写失败的测试**

```js
// tests/card.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { resultCardSpec, goalCardSpec, fitFontSize } from '../site/js/card.js';
import { findBannedCopy } from '../scripts/lint-copy.mjs';

const fwd = { mode: 'fwd', age: 30, retireAge: 41, years: 11, success: 0.59, needText: '¥317.75万' };

test('result card carries the age, slogan, brand and search hint', () => {
  const s = resultCardSpec(fwd);
  assert.equal(s.hero, '41 岁');
  assert.equal(s.sentence, '从 41 岁起，余生皆假期');
  assert.equal(s.brand, '放假年龄 / FIRE Age');
  assert.equal(s.searchHint, '搜：放假年龄');
  assert.deepEqual(s.size, [1080, 1080]);
  assert.match(s.comment, /放假年龄是 41 岁/);
  assert.match(s.comment, /你的呢/);
});

test('cards contain no links or QR codes', () => {
  const s = JSON.stringify(resultCardSpec(fwd));
  assert.ok(!/https?:|www\.|\.com|二维码/.test(s));
});

test('an unreachable result stays upbeat and shows no fake age', () => {
  const s = resultCardSpec({ mode: 'fwd', age: 30, retireAge: null, years: null, success: null });
  assert.ok(!/null|NaN|undefined/.test(JSON.stringify(s)));
  assert.match(s.sentence, /一步步|杠杆/);
});

test('backward card uses the monthly amount', () => {
  const s = resultCardSpec({ mode: 'bwd', targetAge: 45, monthlyText: '8,600', enough: false, success: 0.8 });
  assert.equal(s.sentence, '想 45 岁放假，每月需存 8,600');
});

test('goal card reports the years gained', () => {
  const s = goalCardSpec({ label: '储蓄率到 45%' }, { yearsDelta: 2, achieved: true });
  assert.equal(s.sentence, '储蓄率到 45%，放假年龄提前了 2 年');
});

test('long amounts shrink to fit and respect the minimum', () => {
  const measure = (t, px) => t.length * px * 0.6;
  const px = fitFontSize(measure, 'THB 1,234,567,890,123', 400, 96, 24);
  assert.ok(measure('THB 1,234,567,890,123', px) <= 400 || px === 24);
  assert.equal(fitFontSize(measure, '41 岁', 900, 96, 24), 96);
});

test('card copy passes the compliance lint', () => {
  assert.deepEqual(findBannedCopy(JSON.stringify(resultCardSpec(fwd))), []);
});
```

```js
// tests/e2e/share.spec.mjs
import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('sharing produces a long-pressable image and comment text', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  const img = page.locator('#share-img');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#share-hint')).toContainText('长按');
  await expect(page.locator('#share-comment')).toContainText('放假年龄');
});

test('a refused clipboard falls back to selecting the text', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); });
  await page.goto('/');
  await page.click('#share-btn');
  await page.click('#share-copy');
  await expect(page.locator('#share-copy-status')).toContainText('长按选中');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test && npm run e2e`
Expected: FAIL，模块和元素不存在。

- [ ] **Step 3: 实现 `card.js` 和分享面板**

`card.js` 导入时不碰 DOM。已达到时 `sentence` 是"从今天起，余生皆假期"；倒推的 `hero` 是目标年龄，已够时 `sentence` 是"想 45 岁放假，现在的存款已经够了"。

分享面板展示 `<img id="share-img">`，并写明"长按图片保存"。元素 id：`#share-hint`、`#share-comment`、`#share-copy`、`#share-copy-status`；复制失败时状态显示"请长按选中文字复制"。不依赖 `<a download>`，因为内置浏览器常常拦截；桌面端额外提供下载按钮。

评论文案（固定模板）："我的放假年龄是 41 岁，成功率 59%。你的呢？"。不可达时："我还在努力凑放假年龄，正在用杠杆一点点提前。你的呢？"

回访且目标达成时，显示"生成达成卡"按钮，用 `goalCardSpec`。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test && npm run e2e`
Expected: 全部 PASS。

- [ ] **Step 5: 看一眼生成的卡片**

把默认结果和一个 THB 大金额结果导出成 PNG 查看，确认没有裁切，小图下也看得清放假年龄。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add shareable result and goal cards"
```

---

### Task 7: 专业人士可核对：导出、方法页、来源页

**Files:**
- Create: `site/js/export.js`、`site/method.html`、`site/sources.html`、`docs/method.md`、`docs/data-sources.md`、`docs/competitor-analysis.md`、`tests/export.test.mjs`、`tests/e2e/pro.spec.mjs`
- Modify: `site/index.html`、`site/js/app.js`

**Interfaces:**
- Consumes：`currentResult()`（Task 5）、`DATA`（Task 2）。
- Produces：`toCsv(result) -> string`（UTF-8，带 BOM，便于 Excel 打开）、`toJson(result) -> string`。

- [ ] **Step 1: 写失败的测试**

```js
// tests/export.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toJson } from '../site/js/export.js';

const result = {
  p: { age: 30, life: 32, r: 0.0286, sigma: 0.11, wCur: 'CNY' },
  retireT: 1,
  mc: { seed: 20261026, paths: 2000, success: 0.5, bands: [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5]] },
  target: [10, 11, 12], dataVersion: '2026-11',
};

test('CSV has one row per year with percentiles and the target line', () => {
  const lines = toCsv(result).replace(/^﻿/, '').trim().split(/\r?\n/);
  assert.equal(lines[0], 'age,p10,p25,p50,p75,p90,target');
  assert.equal(lines.length, 4);
  assert.equal(lines[1], '30,1,2,3,4,5,10');
});

test('JSON states everything needed to reproduce the run', () => {
  const j = JSON.parse(toJson(result));
  assert.equal(j.seed, 20261026);
  assert.equal(j.paths, 2000);
  assert.equal(j.dataVersion, '2026-11');
  assert.equal(j.assumptions.r, 0.0286);
  assert.ok(Array.isArray(j.yearly));
});
```

```js
// tests/e2e/pro.spec.mjs
import { test, expect } from '@playwright/test';
import DATA from '../../site/js/data-latest.js';

test('sources page lists every source with its licence', async ({ page }) => {
  await page.goto('/sources.html');
  for (const s of DATA.sources) await expect(page.locator(`[data-source="${s.id}"]`)).toContainText(s.license);
  await expect(page.locator('body')).toContainText(DATA.version);
});

test('method page publishes the formulas and the disclaimer', async ({ page }) => {
  await page.goto('/method.html');
  for (const t of ['组合实际收益', '安全提取率', '蒙特卡洛', '20261026', '不构成投资建议']) await expect(page.locator('body')).toContainText(t);
});

test('the main page shows the data version and links both pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#data-version')).toContainText(DATA.version);
  await expect(page.locator('a[href="method.html"]')).toBeVisible();
  await expect(page.locator('a[href="sources.html"]')).toBeVisible();
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test && npm run e2e`
Expected: FAIL。

- [ ] **Step 3: 实现**

方法页把现有页面"计算方法"的内容扩展成完整公式，包括养老金桥接、`fiYears` 插值、价格水平换算、长期通胀、提取率随退休年限下调（注明 40 年 3.5%、50 年 3.3%、60 年 3.1% 是本工具的经验假设，不是 Morningstar 数据），以及模型不包含的内容。

来源页从 `DATA` 渲染：每个字段的值、观测日期、状态（`carried`、`assumed` 要明确标出）、来源和授权条款。世界银行按其要求的格式署名，并说明世界银行未背书本工具；欧洲央行注明来源，并写明汇率是交叉换算后的结果。

`docs/method.md`、`docs/data-sources.md` 与页面内容一致。把现有页面的"同类工具对比"移到 `docs/competitor-analysis.md`，不再放在面向用户的页面上。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test && npm run e2e`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add exports, method page and sources page"
```

---

### Task 8: 访问统计

**Files:**
- Create: `functions/api/e.js`、`site/js/analytics.js`、`scripts/stats.mjs`、`wrangler.toml`、`tests/analytics.test.mjs`
- Modify: `site/js/app.js`（在各交互处调用 `track`）

**Interfaces:**
- Produces：
  - `functions/api/e.js` 导出 `onRequestPost({request, env}) -> Response`，以及 `EVENTS`。
  - `analytics.js` 导出 `track(name)`、`channelFromUrl(href) -> string`。
- 事件白名单：`visit`、`calc_done`、`mode_switch`、`card_open`、`card_generate`、`copy_text`、`export_data`。
- 请求体：`{"e": "<事件>", "c": "<渠道>", "v": "<数据版本>"}`。写入 `env.EVENTS.writeDataPoint({blobs: [e, c, v], indexes: [e]})`，不写 IP、UA、Cookie 或任何输入数值。

- [ ] **Step 1: 写失败的测试**

```js
// tests/analytics.test.mjs
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
  assert.equal(env.pts.length, 0);
});

test('a malformed channel is stored as direct', async () => {
  const env = sink();
  await post(JSON.stringify({ e: 'visit', c: '<script>' , v: '2026-11' }), env);
  assert.equal(env.pts[0].blobs[1], 'direct');
});

test('a missing analytics binding does not break the request', async () => {
  assert.equal((await post(JSON.stringify({ e: 'visit' }), {})).status, 204);
});

test('channel comes from the ch parameter and is sanitised', () => {
  assert.equal(channelFromUrl('https://x/?ch=db1'), 'db1');
  assert.equal(channelFromUrl('https://x/'), 'direct');
  assert.equal(channelFromUrl('https://x/?ch=%3Cscript%3E'), 'direct');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

`analytics.js` 导入时不碰 DOM 和 `navigator`。`track` 用 `navigator.sendBeacon`（请求体类型 `text/plain`），任何失败都静默，不影响页面。`card_open` 对应展开学习卡，`card_generate` 对应生成分享卡。渠道只放内存变量，不写存储。`calc_done` 在用户首次改动输入并出结果后触发，每次访问最多一次，打开页面看到示例结果不算。

`channelFromUrl` 和接口都用 `^[a-z0-9_-]{1,24}$` 校验渠道。

`wrangler.toml`：`pages_build_output_dir = "site"`，绑定 `EVENTS` 到数据集 `fire_age_events`。

`scripts/stats.mjs` 从环境变量 `CF_ACCOUNT_ID`、`CF_API_TOKEN` 读取凭据，查询 Analytics Engine SQL 接口，按事件和渠道输出最近 30 天的计数。凭据不进仓库。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test && npm run e2e`
Expected: 全部 PASS。本地没有这个接口，发送失败时页面不受影响。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add privacy-preserving event analytics"
```

---

### Task 9: 内容生成器

**Files:**
- Create: `site/studio/index.html`、`site/studio/personas.json`、`site/js/studio.js`（纯逻辑，导入时不碰 DOM）、`site/js/studio-page.js`（页面交互）、`docs/content-brief.md`、`tests/studio.test.mjs`、`tests/e2e/studio.spec.mjs`

**Interfaces:**
- Consumes：`buildParams`、引擎、`rankLevers`、`renderCard`、`fitFontSize`、`DATA`。
- Produces（`studio.js`）：
  - `personaResult(persona, data) -> {label, retireAge, years, success, need, levers, ...}`
  - `buildDeck(result) -> CardSpec[]`：5 张，1080×1440，依次为 `cover`、`result`、`lever`、`learn`、`ask`。
  - `exportBundle(results, dataVersion) -> string`：JSON，供 Claude 写文字用。

- [ ] **Step 1: 写失败的测试**

```js
// tests/studio.test.mjs
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
});

test('each deck has five 3:4 cards and ends by asking for comments', () => {
  for (const persona of personas) {
    const deck = buildDeck(personaResult(persona, DATA));
    assert.deepEqual(deck.map(c => c.kind), ['cover', 'result', 'lever', 'learn', 'ask']);
    for (const c of deck) assert.deepEqual(c.size, [1080, 1440]);
    assert.match(deck[4].sentence, /评论区晒出你的放假年龄/);
    const text = JSON.stringify(deck);
    assert.ok(!/https?:|www\.|二维码|NaN|undefined/.test(text));
    assert.deepEqual(findBannedCopy(text), []);
  }
});

test('the bundle gives Claude the numbers and the data version', () => {
  const b = JSON.parse(exportBundle(personas.map(p => personaResult(p, DATA)), DATA.version));
  assert.equal(b.dataVersion, DATA.version);
  assert.equal(b.results.length, personas.length);
  assert.ok(b.results[0].levers.length > 0);
});

test('public pages do not link to the studio', () => {
  for (const f of ['site/index.html', 'site/method.html', 'site/sources.html']) {
    assert.ok(!readFileSync(f, 'utf8').includes('studio'), f);
  }
});
```

```js
// tests/e2e/studio.spec.mjs
import { test, expect } from '@playwright/test';

test('the studio renders decks and is not indexable', async ({ page }) => {
  await page.goto('/studio/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.click('#generate');
  await expect(page.locator('.deck img').first()).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#bundle')).toContainText('dataVersion');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test && npm run e2e`
Expected: FAIL。

- [ ] **Step 3: 实现**

`personas.json` 每项含 `label`（如"上海 · 30 岁 · 月入 2 万""深圳工作 → 吉隆坡退休"）和计算所需的输入。城市只是文字标签，计算按国家。起始 6 个人物，覆盖不同收入和跨境场景。

页面可以编辑人物 JSON、生成图卡、逐张下载，并复制导出 JSON。图卡文字只放数字和短句，长文案不放在图上。

`docs/content-brief.md` 是 Claude 写文字时遵循的要求：

- 三种体裁的口吻：小红书标题和正文、豆瓣长帖（真诚分享，带计算过程）、B站评论（针对视频话题，带具体数字）。
- 每条都以提问结尾。
- 只讲测算，不提具体产品，不承诺收益。
- B站评论必须由作者本人针对具体视频修改后手动发布。
- 写完运行 `node scripts/lint-copy.mjs <草稿文件>`。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test && npm run e2e`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add content studio for card decks and copy bundles"
```

---

### Task 10: 开源文档、部署配置和上线前检查

**Files:**
- Create: `README.md`、`README.en.md`、`site/_headers`、`docs/deploy.md`、`scripts/check-cn.mjs`、`tests/release.test.mjs`
- Modify: `scripts/serve.mjs`（响应时带上 `site/_headers` 里的 CSP，让浏览器测试在线上同样的策略下运行）

**Interfaces:**
- Consumes：全部任务。

- [ ] **Step 1: 写失败的发布检查**

```js
// tests/release.test.mjs
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
    assert.ok(!/<link[^>]+href=["']https?:/i.test(html), f);
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/i.test(html), f);
  }
  assert.ok(!/@import|url\(["']?https?:/i.test(readFileSync('site/css/app.css', 'utf8')));
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
  assert.match(h, /\/studio\/\*[\s\S]*X-Robots-Tag: noindex/);
});

test('the mainland check passes on most probes within 3 seconds', () => {
  const ok = { result: { status: 'finished', statusCode: 200, timings: { total: 900 } } };
  const slow = { result: { status: 'finished', statusCode: 200, timings: { total: 5600 } } };
  const failed = { result: { status: 'failed', statusCode: null, timings: { total: 15001 } } };
  assert.equal(summarizeProbes([ok, ok, ok, ok, slow, failed]).pass, true);
  assert.equal(summarizeProbes([ok, slow, slow, failed]).pass, false);
  assert.equal(summarizeProbes([]).pass, false);
});

test('required open-source files exist and no secrets are tracked', () => {
  for (const f of ['LICENSE', 'README.md', 'README.en.md', 'docs/method.md', 'docs/data-sources.md', 'docs/deploy.md']) assert.ok(existsSync(f), f);
  assert.ok(readFileSync('.gitignore', 'utf8').includes('.dev.vars'));
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL，文件缺失。

- [ ] **Step 3: 实现**

`site/_headers`：`Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'`（页面动态设置的 `style` 属性需要 `unsafe-inline`；脚本不允许内联），`X-Content-Type-Options: nosniff`；`/js/*` 和 `/*.html` 用 `Cache-Control: no-cache`；`/studio/*` 加 `X-Robots-Tag: noindex`。

README（中英文）：一句话介绍、线上地址占位、本地运行和测试命令、方法和数据来源的链接、如何复现结果、免责声明、AGPL-3.0。

`scripts/check-cn.mjs <host>`：通过 Globalping 公开接口从中国大陆的探测点发 HTTPS 请求，打印每个点的结果和耗时。导出 `summarizeProbes(results) -> {pass, okRate, medianMs}`，超过半数探测点在 3 秒内返回 2xx 或 3xx 才算通过。探测点多在数据中心网络，结果比真实手机网络乐观，输出里要写明这一点。

`docs/deploy.md` 写清作者一次性要做的事（注册账号、付款、提供令牌），以及之后由脚本完成的部分。

- [ ] **Step 4: 运行全部测试**

Run: `npm test && npm run e2e`
Expected: 全部 PASS，贴出通过数量。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "docs: add open-source docs, deploy guide and release checks"
```

- [ ] **Step 6: 交给作者上线（不要自行执行）**

创建公开仓库、推送代码、购买域名、接入 Cloudflare 都是对外且难撤销的操作，需要作者的账号。向作者报告分支状态、测试结果和所有 `carried`、`assumed` 字段，并附上费用预估；作者确认后，再用作者提供的令牌通过 `gh` 和 `wrangler` 完成部署，运行 `scripts/check-cn.mjs` 并报告结果。
