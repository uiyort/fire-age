// Working backward, 想几岁放假 is the first group of the form (its own ✕ count), gone again in the other direction;
// a box waiting to be filled shows no 0.
import { test, expect } from '@playwright/test';

const fresh = { cookies: [], origins: [] };
const legend = (page, name) => page.locator('#simple-form legend', { hasText: name });

async function backward(page) {
  await page.goto('/');
  await page.click('#to-bwd');
  await page.evaluate(() => { document.getElementById('inputs-box').open = true; });
}

async function backwardChecks(page) {
  const first = page.locator('#simple-form > fieldset').first();
  await expect(first.locator('legend')).toContainText('想几岁放假');
  await expect(first.locator('#s-tage')).toBeVisible();
  await page.fill('#s-tage', '25');
  await page.locator('#s-tage').blur();
  await expect(legend(page, '想几岁放假')).toContainText('✕ 1');
  await expect(legend(page, '养老金')).not.toContainText('✕');
  await expect(page.locator('[data-chip]').first()).toContainText('拦住：想几岁放假 ›');
  // Review Focus 4: back to the other direction, the group and its stop are gone.
  await page.click('#to-fwd');
  await expect(first).toBeHidden();
  await expect(page.locator('#simple-form legend', { hasText: '✕' })).toHaveCount(0);
  await expect(page.locator('[data-chip]')).toHaveCount(0);
  await expect(page.locator('#hero')).not.toContainText('—');
  await expect(page.locator('#hero')).toContainText(/岁放假|现在就能放假/);
}

test.describe('at 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: fresh });
  test('the first group is 想几岁放假, with its own count; the other direction leaves nothing behind', async ({ page }) => {
    await backward(page);
    await backwardChecks(page);
  });
  test('Tab reaches the age to holiday at before the age', async ({ page }) => {
    await backward(page);
    await expect(page.locator('#s-tage')).toBeVisible();
    // No tabindex in the form, so the order of Tab is the order of the page.
    const before = await page.evaluate(() => Boolean(document.getElementById('s-tage').compareDocumentPosition(document.getElementById('s-age')) & Node.DOCUMENT_POSITION_FOLLOWING));
    expect(before).toBe(true);
  });
  test('a box waiting to be filled shows no 0, and gets it back', async ({ page }) => {
    await page.goto('/');
    await page.fill('#s-expense', '');
    await page.locator('#s-expense').blur();
    await expect(page.locator('#s-expense')).toHaveAttribute('placeholder', '');
    await expect(page.locator('#s-expense')).toHaveAttribute('aria-invalid', 'true');
    await page.fill('#s-expense', '6000');
    await page.locator('#s-expense').blur();
    await expect(page.locator('#s-expense')).toHaveAttribute('placeholder', '0');
  });
  test('half-filled children: the box still to fill shows no 0', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { document.getElementById('life-fold').open = true; });
    await page.fill('#life-kids', '1');
    await page.locator('#life-kids').blur();
    await expect(page.locator('#life-kid-monthly')).toHaveAttribute('placeholder', '');
  });
});

test.describe('at 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 }, storageState: fresh });
  test('the first row of the sidebar is 想几岁放假', async ({ page }) => {
    await backward(page);
    await expect(page.locator('#simple-form .grp-head').first()).toContainText('想几岁放假');
    await backwardChecks(page);
  });
});
