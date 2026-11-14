// The exits of the rules: a value button that fixes the number, an optional flag (A11) that never stops the result.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: { cookies: [], origins: [] } });

const withSaved = async (page, over) => {
  await page.goto('/');
  await page.evaluate(o => { const k = 'fire-age-v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...o })); }, over);
  await page.reload();
};
// The form sits in a closed box on a phone; a button inside it needs it open.
const openForm = page => page.evaluate(() => { document.getElementById('inputs-box').open = true; });
const kids = { count: null, age: null, monthly: null };
const mortgage = { monthly: 7500, endYear: 2045 };

test('A11 shows under 每月支出 and its button adds the mortgage', async ({ page }) => {
  await withSaved(page, { expense: 96000, real: { mortgage: { monthly: 7500, endYear: 2030 }, kids } });
  await openForm(page);
  const warn = page.locator('#lines-expense .row.warn');
  await expect(warn).toHaveText('└ 扣掉月供只剩 500/月 !');
  await expect(page.locator('.chip')).toHaveCount(0);
  await expect(page.locator('#hero')).not.toContainText('— 岁放假');
  const fix = page.locator('#lines-expense').getByRole('button', { name: '每月支出加上月供改成 15,500' });
  await expect(fix).toHaveText('每月支出 + 月供 → 15,500');
  await fix.click();
  await expect(page.locator('#s-expense')).toHaveValue('15500');
  // The default income no longer covers 15,500, so the saving flag (B14) may show; A11's own line is gone.
  await expect(page.locator('#lines-expense')).not.toContainText('扣掉月供');
});

test('A3 value exit', async ({ page }) => {
  await withSaved(page, { expense: 84000, real: { mortgage, kids } });
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
  await page.locator('#sticky-result .chip').click();
  await page.locator('button.fix', { hasText: '每月支出 + 月供 → 14,500' }).click();
  await expect(page.locator('.chip')).toHaveCount(0);
  await expect(page.locator('#hero')).not.toContainText('— 岁放假');
});

test('A4 hides the label link while blocked', async ({ page }) => {
  await withSaved(page, { retExp: 72000, touched: { retExp: true }, expense: 216000, real: { mortgage, kids } });
  await openForm(page);
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：退休后 ›');
  await expect(page.locator('.est-back:visible')).toHaveCount(0);
  const fix = page.locator('#lines-retexp .fixes .fix').first();
  await expect(fix).toHaveText('退休后每月想花 + 月供 → 13,500');
  await fix.click();
  await expect(page.locator('.est-back:visible')).toHaveCount(1);
  await expect(page.locator('.chip')).toHaveCount(0);
});

test('two-digit year', async ({ page }) => {
  await page.goto('/');
  const y = new Date().getFullYear();
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '3000'); await page.fill('#life-mortgage-end', '35');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#rel-mortgage\\.endYear')).toHaveText(`还到哪年 35 不在 ${y - 50}–${y + 40} ✕`);
  await page.getByRole('button', { name: '还到哪年改成 2035' }).click();
  await expect(page.locator('#life-mortgage-end')).toHaveValue('2035');
  await expect(page.locator('.chip')).toHaveCount(0);
});

test('zero spending stops with no value button', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', '0');
  await page.locator('#s-expense').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：每月支出 ›');
  await expect(page.locator('#rel-expense')).toHaveText('每月支出 0 ✕');
  await expect(page.locator('.field-after:has(#rel-expense)')).toBeVisible();
  await expect(page.locator('.field-after:has(#rel-expense) .fix')).toHaveCount(0);
});

test('typed retirement spending of 0 waits like a blank', async ({ page }) => {
  await withSaved(page, { retExp: 0, touched: { retExp: true } });
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填：退休后 ›');
  await openForm(page);
  await page.fill('#s-retexp', '6000');
  await page.locator('#s-retexp').press('Tab');
  await expect(page.locator('.chip')).toHaveCount(0);
});

test('A11 button sits right under its line, before the saving flag', async ({ page }) => {
  await withSaved(page, { expense: 96000, income: 60000, real: { mortgage: { monthly: 7500, endYear: 2030 }, kids } });
  await openForm(page);
  await expect(page.locator('#lines-expense')).toContainText('! 每月存下');
  await expect(page.locator('#lines-expense .row.warn:has-text("扣掉月供") + .fixes .fix')).toHaveText('每月支出 + 月供 → 15,500');
});
