import { test, expect } from '@playwright/test';
import DATA from '../../site/js/data-latest.js';

test('sources page lists every source with its licence', async ({ page }) => {
  await page.goto('/sources.html');
  for (const s of DATA.sources) await expect(page.locator(`[data-source="${s.id}"]`)).toContainText(s.license);
  await expect(page.locator('body')).toContainText(DATA.version);
});

test('sources page marks assumed values and states their basis', async ({ page }) => {
  await page.goto('/sources.html');
  await expect(page.locator('[data-field="CN.y10"]')).toContainText('假设');
  await expect(page.locator('[data-field="CN.y10"]')).toContainText('中国货币网');
});

test('method page publishes the formulas and the disclaimer', async ({ page }) => {
  await page.goto('/method.html');
  for (const t of ['组合实际收益', '安全提取率', '蒙特卡洛', '20261026', '不构成投资建议']) await expect(page.locator('body')).toContainText(t);
});

test('the main page shows the data version and links both pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#data-version')).toContainText(DATA.version);
  await expect(page.locator('footer a[href="method.html"]')).toBeVisible();
  await expect(page.locator('footer a[href="sources.html"]')).toBeVisible();
});

test('exports download from the pro view', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  const csv = page.waitForEvent('download');
  await page.click('#export-csv');
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  const json = page.waitForEvent('download');
  await page.click('#export-json');
  expect((await json).suggestedFilename()).toMatch(/\.json$/);
});
