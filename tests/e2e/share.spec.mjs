import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('sharing produces a long-pressable image', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  const img = page.locator('#share-img');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#share-hint')).toContainText('长按');
  await expect(page.locator('#share-img')).toHaveAttribute('alt', /岁/);
  await expect(page.locator('#share-copy')).toHaveCount(0);
  await expect(page.locator('#share-comment')).toHaveCount(0);
  const natural = await img.evaluate(el => el.naturalWidth);
  expect(natural).toBe(1080);
});

test('a very large amount in baht still produces a card', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#s-ret', 'TH');
  await page.fill('#s-assets', '99999999999');
  await page.click('#share-btn');
  await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
  expect(await page.locator('#share-img').getAttribute('alt')).not.toContain('NaN');
});

test('an achieved goal offers its own card', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levers [data-goal]').first().click();
  await expect(page.locator('#goal-card')).toHaveCount(0);
  await page.fill('#s-expense', '5000');
  await page.locator('#goal-card').click();
  await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#goal #share-panel')).toBeVisible();
});
