import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('sharing produces one long-pressable image', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  const img = page.locator('#share-img');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#share-hint')).toContainText('长按');
  await expect(img).toHaveAttribute('alt', /岁/);
  await expect(page.locator('#share-copy')).toHaveCount(0);
  expect(await img.evaluate(el => el.naturalWidth)).toBe(1080);
  expect(await img.evaluate(el => el.naturalHeight)).toBe(1440);
});

test('a very large amount in baht still produces a card', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#s-ret', 'TH');
  await page.fill('#s-assets', '99999999999');
  await page.click('#share-btn');
  await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
  expect(await page.locator('#share-img').getAttribute('alt')).not.toContain('NaN');
});

test('a goal has no card of its own', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levers [data-goal]').first().click();
  await page.fill('#s-expense', '5000');
  await expect(page.locator('#goal')).toContainText('已达成');
  await expect(page.locator('#goal-card')).toHaveCount(0);
});
