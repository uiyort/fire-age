// The ledger behind the fund line (spec §7): closed it is the fund line, open it is three sections, stopped it stops.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('the fund line is the ledger\'s closed state and opens in place', async ({ page }) => {
  await page.goto('/');
  const fund = page.locator('#hero .fund');
  await expect(fund).toContainText(/放假资金：已有 ¥[\d.]+万 \/ 需要 ¥[\d.]+万（\d+%）/);
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
