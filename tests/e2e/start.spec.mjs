import { test, expect } from '@playwright/test';

const fresh = { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'fire-age-pro-v1', value: '1' }] }] };

test.describe('a first visit on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: fresh });

  test('starts with the numbers to fill in, not with an age', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#start-calc')).toBeVisible();
    await expect(page.locator('#s-assets')).toBeVisible();
    await expect(page.locator('#hero')).toBeHidden();
    await expect(page.locator('#sticky-bar')).toBeHidden();
    await expect(page.locator('.results')).toBeHidden();
  });

  test('shows the result once asked, with the numbers folded away, and goes straight there next time', async ({ page }) => {
    await page.goto('/');
    await page.fill('#s-assets', '300000');
    await page.click('#start-calc');
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#hero')).toBeInViewport();
    await expect(page.locator('#start-calc')).toBeHidden();
    await expect(page.locator('#inputs-box')).not.toHaveAttribute('open', '');
    await page.reload();
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#start-calc')).toBeHidden();
  });

  test('in WeChat, saving the card points at the long press', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'fire-age-pro-v1', value: '1' }, { name: 'fire-age-started-v1', value: '1' }] }] }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50' });
    const page = await context.newPage();
    await page.goto('http://localhost:4173/');
    await page.click('#share-btn');
    await page.click('#share-save');
    await expect(page.locator('#share-hint')).toContainText('长按');
    await expect(page.locator('#share-hint')).toHaveClass(/emph/);
    await context.close();
  });
});

test.describe('a first visit on a computer', () => {
  test.use({ viewport: { width: 1280, height: 900 }, storageState: fresh });

  test('shows the numbers and the result side by side at once', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#start-calc')).toBeHidden();
  });

  test('saves the card as a file', async ({ page }) => {
    await page.goto('/');
    await page.click('#share-btn');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#share-save')]);
    expect(download.suggestedFilename()).toBe('fire-age.png');
  });
});

test.describe('a blank number the result rests on', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: fresh });

  test('stops the first calculation and points at the blank', async ({ page }) => {
    await page.goto('/');
    await page.fill('#s-expense', '');
    await page.click('#start-calc');
    await expect(page.locator('#start-calc')).toBeVisible();
    await expect(page.locator('#hero')).toBeHidden();
    await expect(page.locator('#s-expense')).toBeFocused();
    await expect(page.locator('#s-expense')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#missing-note')).toContainText('每月支出');
    await page.fill('#s-expense', '6000');
    await expect(page.locator('#missing-note')).toBeHidden();
    await page.click('#start-calc');
    await expect(page.locator('#hero')).toBeVisible();
  });
});

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a blank number holds the last result until it is filled in', async ({ page }) => {
    await page.goto('/');
    const initial = await page.locator('#headline').textContent();
    await page.fill('#s-income', '20000');
    await expect(page.locator('#headline')).not.toHaveText(initial);
    const before = await page.locator('#headline').textContent();
    await page.fill('#s-income', '');
    await expect(page.locator('#missing-note')).toContainText('每月到手收入');
    await expect(page.locator('body')).toHaveClass(/inputs-missing/);
    await expect(page.locator('#headline')).toHaveText(before);
    await page.locator('#s-age').focus();
    await expect(page.locator('#s-income')).toHaveAttribute('aria-invalid', 'true');
    await page.fill('#s-income', '30000');
    await expect(page.locator('body')).not.toHaveClass(/inputs-missing/);
    await expect(page.locator('#s-income')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#headline')).not.toHaveText(before);
  });

  test('the card waits for the blank too', async ({ page }) => {
    await page.goto('/');
    await page.fill('#s-age', '');
    await page.click('#share-btn');
    await expect(page.locator('#share-panel')).toBeHidden();
    await expect(page.locator('#s-age')).toBeFocused();
  });
});
