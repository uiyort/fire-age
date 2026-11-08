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
