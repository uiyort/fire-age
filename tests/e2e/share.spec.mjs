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
  const natural = await img.evaluate(el => el.naturalWidth);
  expect(natural).toBe(1080);
});

test('a refused clipboard falls back to selecting the text', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); });
  await page.goto('/');
  await page.click('#share-btn');
  await page.click('#share-copy');
  await expect(page.locator('#share-copy-status')).toContainText('长按选中');
});

test('a phone with no clipboard API at all still falls back', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined }); });
  await page.goto('/');
  await page.click('#share-btn');
  await page.click('#share-copy');
  await expect(page.locator('#share-copy-status')).toContainText('长按选中');
});

test('a very large amount in baht still produces a card', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#s-ret', 'TH');
  await page.fill('#s-assets', '99999999999');
  await page.click('#share-btn');
  await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#share-comment')).not.toContainText('NaN');
});

test('an achieved goal offers its own card', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levers [data-goal]').first().click();
  await expect(page.locator('#goal-card')).toHaveCount(0);
  await page.fill('#s-expense', '5000');
  await page.locator('#goal-card').click();
  await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#share-comment')).toContainText('小目标');
});
