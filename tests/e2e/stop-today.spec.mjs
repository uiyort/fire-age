// Working backward to the age the person is now: the odds of stopping today, with no saving to offer.
import { test, expect } from '@playwright/test';

const legend = (page, name) => page.locator('#simple-form legend', { hasText: name });

test('stopping today shows its odds, offers waiting and never a saving', async ({ page }) => {
  await page.goto('/#mode=bwd&tage=35&age=35&assets=1800000&income=6000&expense=6000');
  await expect(page.locator('#to-bwd')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#headline')).toContainText('想 35 岁放假');
  await expect(page.locator('#headline')).toContainText('2 成把握');
  await expect(page.locator('#headline')).toContainText('等到');
  await expect(page.locator('#headline')).not.toContainText('每月需存');
  await expect(page.locator('#hero')).toContainText('今天起放假');
  await expect(page.locator('#hero')).not.toContainText('现在就能放假');
  await expect(page.locator('#solves')).toContainText('没有攒钱的时间');
  await expect(page.locator('#solves')).not.toContainText(/NaN|Infinity|null/);
  await expect(page.locator('[data-chip]')).toHaveCount(0);
});

test('an age to holiday at before today is stopped, and the fix is today', async ({ page }) => {
  await page.goto('/#mode=bwd&tage=35&age=35');
  await page.evaluate(() => { document.getElementById('inputs-box').open = true; });
  await page.fill('#s-tage', '34');
  await page.locator('#s-tage').blur();
  await expect(legend(page, '想几岁放假')).toContainText('✕ 1');
  await page.fill('#s-tage', '35');
  await page.locator('#s-tage').blur();
  await expect(legend(page, '想几岁放假')).not.toContainText('✕');
});
