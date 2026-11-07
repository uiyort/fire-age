import { test, expect } from '@playwright/test';

test('the studio renders decks and is not indexable', async ({ page }) => {
  await page.goto('/studio/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.click('#generate');
  await expect(page.locator('.deck img').first()).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#bundle')).toContainText('dataVersion');
  await expect(page.locator('.deck')).toHaveCount(6);
});

test('broken persona JSON explains itself instead of failing silently', async ({ page }) => {
  await page.goto('/studio/');
  await page.fill('#personas', '{not json');
  await page.click('#generate');
  await expect(page.locator('#studio-error')).toContainText('JSON');
});
