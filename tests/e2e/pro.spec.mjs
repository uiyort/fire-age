import { test, expect } from '@playwright/test';
import DATA from '../../site/js/data-latest.js';

test('sources page lists every source with its licence', async ({ page }) => {
  await page.goto('/sources.html');
  for (const s of DATA.sources) await expect(page.locator(`[data-source="${s.id}"]`)).toContainText(s.license);
  await expect(page.locator('body')).toContainText(DATA.version);
});

test('sources page marks assumed values and states their basis', async ({ page }) => {
  await page.goto('/sources.html');
  await expect(page.locator('[data-field="HK.y10"]')).toContainText('假设');
  // The basis is told once, under the assumptions; the cell points there so the table stays narrow on a phone.
  await expect(page.locator('[data-field="HK.y10"]')).toContainText('见下文');
  await expect(page.locator('main')).toContainText('金管局');
  await expect(page.locator('[data-field="CN.y10"]')).not.toContainText('假设');
  await expect(page.locator('[data-field="CN.y10"]')).toContainText('官方');
  await expect(page.locator('[data-source="oecd"]')).toContainText('CC BY 4.0');
});

test('method page publishes the formulas and the disclaimer', async ({ page }) => {
  await page.goto('/method.html');
  for (const t of ['组合实际收益', '安全提取率', '蒙特卡洛', '20261026', '不构成投资建议']) await expect(page.locator('body')).toContainText(t);
});

test('the main page shows the data version and links both pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#data-version')).toContainText(DATA.version);
  // The about section links both pages, so the footer does not repeat them.
  await expect(page.locator('#about a[href="method.html"]')).toBeVisible();
  await expect(page.locator('#about a[href="sources.html"]')).toBeVisible();
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
