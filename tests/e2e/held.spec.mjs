// The stopped result is seen everywhere: 放假年龄 — with its chip by the big age (from 1024 px), on the sticky bar below
// that, and on the first-visit page; the empty learn zone is hidden while it holds.
import { test, expect } from '@playwright/test';

const fresh = { cookies: [], origins: [] };
const stopped = { expense: 84000, real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } };
const withSaved = async (page, over) => {
  await page.goto('/');
  await page.evaluate(o => { const k = 'fire-age-v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...o })); }, over);
  await page.reload();
};

test.describe('at 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 }, storageState: fresh });
  test('the chip stands by the big age and jumps to the stopped field', async ({ page }) => {
    await withSaved(page, stopped);
    await expect(page.locator('#hero .hero-big')).toContainText('放假年龄 —');
    await expect(page.locator('#hero .chip')).toBeVisible();
    await expect(page.locator('#hero .chip')).toHaveText(await page.locator('#side-card .chip').innerText());
    await page.locator('#hero .chip').click();
    await expect(page.locator('#life-mortgage')).toBeFocused();
  });
  test('the professional view: no learn zone, the headline reads 财务独立年龄 —', async ({ page }) => {
    await withSaved(page, { ...stopped, view: 'pro' });
    await expect(page.locator('#zone-learn')).toBeHidden();
    await expect(page.getByRole('heading', { name: '敏感度' })).toHaveCount(0);
    expect((await page.locator('#headline').innerText()).startsWith('财务独立年龄 —')).toBe(true);
  });
});

test.describe('at 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: fresh });
  test('the sticky chip shows, the hero chip and the learn zone do not, 参数 goes to the stopped field', async ({ page }) => {
    await withSaved(page, stopped);
    await expect(page.locator('#hero .chip')).toBeHidden();
    await expect(page.locator('#sticky-result .chip')).toBeVisible();
    await expect(page.locator('#zone-learn')).toBeHidden();
    await expect(page.getByText('你能决定的参数')).toBeHidden();
    await page.locator('.zone-nav a', { hasText: '参数' }).click();
    await expect(page.locator('#life-mortgage')).toBeFocused();
  });
  test('the first-visit page names what is blank on its own line, and goes on once it is filled', async ({ page }) => {
    await page.goto('/');
    await page.fill('#s-expense', '');
    await page.click('#start-calc');
    await expect(page.locator('#start-chip')).toBeVisible();
    await expect(page.locator('#start-chip')).toContainText('待填：每月支出 ›');
    await expect(page.locator('body')).toHaveClass(/intro/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    // A tap right after an edit of another field must still reach the chip (it is not rebuilt under the finger).
    await page.fill('#s-age', '31');
    await page.locator('#start-chip .chip').tap();
    await expect(page.locator('#s-expense')).toBeFocused();
    await page.fill('#s-expense', '6000');
    await page.locator('#s-expense').blur();
    await expect(page.locator('#start-chip')).toBeHidden();
    await page.click('#start-calc');
    await expect(page.locator('body')).not.toHaveClass(/intro/);
    // A shown result splits its age across elements, so prove it by what the stopped hero never has.
    await expect(page.locator('#hero')).not.toContainText('—');
    await expect(page.locator('#hero')).toContainText(/岁放假|现在就能放假/);
  });
});
