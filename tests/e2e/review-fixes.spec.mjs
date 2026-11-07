// Browser regressions for defects found in the whole-branch review.
import { test, expect } from '@playwright/test';

test('I1: backspacing an age does not compute with the half-typed digit', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-age', '35');
  await page.locator('#s-age').blur();
  await expect(page.locator('#headline')).toContainText('放假');
  const settled = await page.locator('#headline .say').innerText();
  await page.locator('#s-age').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(400); // Let the page recompute, or the old text would pass trivially.
  expect(await page.locator('#headline .say').innerText()).toBe(settled);
});

test('I5: the hand-edit prompt also appears in the professional view', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  await page.fill('#p-retExp', '120000');
  await page.selectOption('#p-ret', 'TH');
  await expect(page.locator('#estimate .notice')).toContainText('手动填写');
});

test('I10: changing work currency clears a goal set in the old currency', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levers [data-goal]').first().click();
  await expect(page.locator('#goal')).toBeVisible();
  await page.selectOption('#s-work', 'US');
  await expect(page.locator('#goal')).toBeHidden();
});
