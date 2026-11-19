// The ledger behind the fund line (spec §7): closed it is the fund line, open it is three sections, stopped it stops.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('the fund line is the ledger\'s closed state and opens in place', async ({ page }) => {
  await page.goto('/');
  const fund = page.locator('#hero .fund');
  await expect(fund).toContainText(/放假资金：已有 ¥[\d.]+万，需要 ¥[\d.]+万（\d+%）/);
  await expect(fund).not.toContainText('年的花销');
  const toggle = page.locator('.ledger-toggle').first();
  await expect(toggle).toHaveText('怎么算的 ▸');
  await expect(page.locator('#ledger')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveText('怎么算的 ▾'); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#ledger')).toBeVisible();
  await expect(page.locator('#ledger')).toContainText('① 攒钱');
  await expect(page.locator('#ledger')).toContainText('③ 2,000 种年景');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#ledger [data-field="expense"]').click();
  await expect(page.locator('#s-expense')).toBeFocused();
});

test('open, the ledger follows every change; closed again, it is gone', async ({ page }) => {
  await page.goto('/');
  await page.locator('.ledger-toggle').first().click();
  await page.fill('#s-expense', '9000'); await page.locator('#s-expense').press('Tab');
  await expect(page.locator('#ledger')).toContainText('¥9,000/月');
  const toggle = page.locator('.ledger-toggle').first();
  await expect(toggle).toHaveText('怎么算的 ▾');
  await toggle.click();
  await expect(page.locator('#ledger')).toBeHidden();
  await expect(toggle).toHaveText('怎么算的 ▸'); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('stopped, the ledger still opens and stops at the stopped row', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045'); await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#hero .fund')).toContainText('放假资金 —');
  await page.locator('.ledger-toggle').first().click();
  await expect(page.locator('#ledger')).toContainText('└ 其中月供 7,500 ≥ 每月支出 7,000');
  await expect(page.locator('#ledger')).toContainText('⇒ ③ 放假年龄 —');
  await expect(page.locator('#ledger')).not.toContainText('退休后');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  // Fixed, the open ledger comes back with the numbers.
  await page.fill('#s-expense', '15000'); await page.locator('#s-expense').press('Tab');
  await expect(page.locator('#ledger')).toContainText('② 放假以后');
  await expect(page.locator('#ledger')).toContainText('└ 其中月供 7,500 → 2045');
});

// ---- Review round 1.

test('held, a stop still being typed does not turn the open ledger red', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045'); await page.locator('#life-mortgage-end').press('Tab');
  await page.locator('.ledger-toggle').first().click();
  await expect(page.locator('#ledger')).toContainText('≥ 每月支出 7,000');
  await page.locator('#s-expense').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('-5');
  await expect(page.locator('#s-expense')).not.toHaveAttribute('aria-invalid', 'true');
  const chip = (await page.locator('#sticky-result .chip').textContent()) ?? '';
  await expect(page.locator('#ledger')).not.toContainText('每月支出 −5');
  // Each red row in the ledger is a stop the chip counts.
  const red = await page.locator('#ledger .lg-row.bad').count();
  expect(red).toBeLessThanOrEqual(/(\d+) 处/.test(chip) ? Number(chip.match(/(\d+) 处/)[1]) : 1);
  // Left, the stop is shown on the page and in the ledger alike.
  await page.locator('#s-expense').press('Tab');
  await expect(page.locator('#s-expense')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ledger')).toContainText('每月支出 −5');
});

test('in the professional view the open ledger is the professional one', async ({ page }) => {
  await page.goto('/');
  await page.locator('.ledger-toggle').first().click();
  await expect(page.locator('#ledger')).toBeVisible();
  await page.click('#to-pro');
  await expect(page.locator('#ledger')).toBeVisible();
  await expect(page.locator('#ledger')).not.toContainText('③ 2,000 种年景');
  await expect(page.locator('#ledger')).toContainText('③ 2,000 条路径 · 种子 20261026');
  await expect(page.locator('#ledger-row .ledger-toggle')).toHaveText('怎么算的 ▾');
});

// ---- The professional ledger and the professional view's considerations (Task 9).

test('the professional view: its rows, its labels and its checks', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await expect(page.locator('#ledger-row')).toContainText(/放假线 ¥[\d,]+ · \d+\.\d%/);
  await expect(page.locator('#pro-form')).toContainText('一年跌 ≥ 15% 后少花');
  await expect(page.locator('#pro-form')).toContainText('八成 · 2,000 次 · 种子 20261026');
  await expect(page.locator('#p-growth').locator('xpath=ancestor::div[contains(@class,"f")][1]')).toContainText('本工具设定');
  await expect(page.locator('#pro-form')).toContainText('养老金上限 = 年支出');
  await page.fill('#p-eqReal', '12'); await page.locator('#p-eqReal').press('Tab');
  await expect(page.locator('#pro-form')).toContainText('! 常见 −2 到 10');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.fill('#p-pension', '90000'); await page.locator('#p-pension').press('Tab');
  await expect(page.locator('#pro-form')).toContainText('! 养老金 90,000 > 年支出 72,000 · 多出 18,000 不计');
  await page.locator('#ledger-row .ledger-toggle').click();
  await expect(page.locator('#ledger')).toContainText('③ 2,000 条路径 · 种子 20261026');
});

// Beyond the brief.
test('the professional ledger: placed under the tiles, the engine\'s median once simulated, labels back to fields, 390 px', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await page.locator('#ledger-row .ledger-toggle').click();
  const ledger = page.locator('#ledger');
  await expect(ledger).toBeVisible();
  await expect(page.locator('#ledger-row .ledger-toggle')).toBeFocused();
  // The ledger follows its row, outside the simple view's hero.
  expect(await page.evaluate(() => document.getElementById('ledger-row').nextElementSibling?.id)).toBe('ledger');
  await expect(ledger).toContainText(/岁中位资产 ¥[\d,]+/);
  await expect(ledger).toContainText(/r = 60% × 5% \+ 40% × \([\d.]+% − [\d.]+%\) − [\d.]+%/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await ledger.locator('[data-field="flexCut"]').click();
  await expect(page.locator('#p-flexCut')).toBeFocused();
  // An assumption outside the common range: an orange frame, not a red one.
  await page.fill('#p-growth', '8'); await page.locator('#p-growth').press('Tab');
  const box = page.locator('#p-growth').locator('xpath=ancestor::div[contains(@class,"f")][1]');
  await expect(box).toHaveClass(/\bwarn\b/); await expect(box).not.toHaveClass(/\bbad\b/);
  await expect(box.locator('xpath=following-sibling::div[1]')).toContainText('! 常见 −2 到 5');
  // Back in the simple view, the ledger is the simple one again, in the hero's column.
  await page.click('#to-simple');
  await expect(ledger).toContainText('③ 2,000 种年景');
  expect(await page.evaluate(() => document.getElementById('hero').nextElementSibling?.id)).toBe('ledger');
});

test('the professional ledger stopped: 放假线 —, a ③ input stops at the r row', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await page.fill('#p-eq', '150'); await page.locator('#p-eq').press('Tab');
  await expect(page.locator('#ledger-row')).toContainText('放假线 — 怎么算的 ▸');
  await page.locator('#ledger-row .ledger-toggle').click();
  await expect(page.locator('#ledger')).toContainText('股票占比 150 > 100');
  await expect(page.locator('#ledger')).toContainText('⇒ ③ 放假年龄 —');
  await expect(page.locator('#ledger')).not.toContainText('第一个到 80%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('across currencies the professional form shows the rate and the estimate behind 年支出', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await page.selectOption('#p-ret', 'TH');
  await expect(page.locator('#pro-form')).toContainText(/汇率 1 THB = \d\.\d\d CNY/);
  await expect(page.locator('#pro-form')).toContainText(/≈ 72,000 × 物价比 [\d.]+ ÷ 汇率 [\d.]+/);
});

// ---- Review fix round 1.
test('the professional fund line follows the display currency, like the tiles', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await expect(page.locator('#ledger-row')).toContainText(/放假线 ¥[\d,]+/);
  await page.selectOption('#p-disp', 'USD');
  await expect(page.locator('#ledger-row')).toContainText(/放假线 USD [\d,]+ · \d+\.\d%/);
  await expect(page.locator('#ledger-row')).not.toContainText('¥');
  await expect(page.locator('#tiles')).toContainText('US$');
});

// ---- Review fixes batch (2026-11-14), item 9: the ledger adds up.
test('the family numbers: ② subtracts each ending item from the engine\'s spending, × N names its denominator, ① ends with the median', async ({ page }) => {
  await page.goto('/');
  for (const [id, v] of [['#s-age', '35'], ['#s-assets', '500000'], ['#s-income', '30000'], ['#s-expense', '18000']]) await page.fill(id, v);
  await page.locator('#life-fold summary').click();
  for (const [id, v] of [['#life-mortgage', '7500'], ['#life-mortgage-end', '2045'], ['#life-kids', '1'], ['#life-kid-age', '3'], ['#life-kid-monthly', '2000']]) await page.fill(id, v);
  await page.locator('#life-kid-monthly').press('Tab');
  await expect(page.locator('#hero')).not.toContainText('—');
  await expect(page.locator('#hero')).toContainText(/岁放假|现在就能放假/);
  await page.locator('.ledger-toggle').first().click();
  const ledger = page.locator('#ledger');
  await expect(ledger).toContainText(/− 减?\s*\d+ 起 孩子 2,000 =\s*剩?\s*(≈\s*)?¥[\d,]+/);
  await expect(ledger).toContainText(/− 减?\s*\d+ 起 月供 ≈ [\d,]+ =\s*剩?\s*(≈\s*)?¥[\d,]+/);
  await expect(ledger).toContainText(/≈ 年支出 ¥[\d.]+万 × \d+ 倍/);
  await expect(ledger).toContainText(/⇒ \d+ 岁时一般攒到 本工具设定 ¥[\d.]+万/);
  // The − rows carry no strike-through; the struck names stay in the lines under the field.
  const items = ledger.locator('.lg-row', { hasText: /^\s*− 减?\s*\d+ 起/ });
  await expect(items).toHaveCount(2);
  expect(await ledger.locator('.lg-row', { hasText: '起' }).locator('s').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
