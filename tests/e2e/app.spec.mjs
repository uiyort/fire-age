import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('simple mode works end to end on a phone with only same-origin requests', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', r => { if (!r.url().startsWith(baseURL) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('放假年龄');
  await expect(page.locator('#simple-form input:visible, #simple-form select:visible')).toHaveCount(7);
  await expect(page.locator('#headline')).toContainText('岁');
  await expect(page.locator('footer')).toContainText('不构成投资建议');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(external).toEqual([]);
});

test('clearing a field while typing never shows NaN', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '');
  await expect(page.locator('main')).not.toContainText('NaN');
  await expect(page.locator('main')).not.toContainText('Infinity');
});

test('spending above income explains itself', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '0');
  await page.fill('#s-income', '5000');
  await page.fill('#s-expense', '9000');
  await expect(page.locator('#headline')).toContainText('存不下钱');
  await expect(page.locator('#levers')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('NaN');
});

test('pension shows both ages', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-pension', '3000');
  await expect(page.locator('#headline')).toContainText('算上养老金');
  await expect(page.locator('#headline')).toContainText('不算养老金');
});

test('tapping a parameter opens its learning card with a personal impact', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#card-expense')).toBeHidden();
  await page.click('#help-expense');
  await expect(page.locator('#card-expense')).toBeVisible();
  await expect(page.locator('#card-expense')).toContainText('年');
});

test('simple mode also solves backward', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-bwd');
  await expect(page.locator('#headline')).toContainText('放假');
  await expect(page.locator('#headline')).toContainText('想');
  await expect(page.locator('#s-tage')).toBeVisible();
});

test('pro mode exposes all parameters and the backward solves', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  for (const id of ['eq', 'sigEq', 'sigBd', 'rho', 'swr', 'fxDrift', 'drag']) await expect(page.locator(`#p-${id}`)).toBeVisible();
  await page.click('#to-bwd');
  await expect(page.locator('#solves')).toContainText('多存');
  await expect(page.locator('#solves')).toContainText('本金');
  await expect(page.locator('body')).toContainText('20261026');
});

test('retirement-only countries cannot be chosen as the place you live', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#s-work option[value="MY"]')).toHaveCount(0);
  await expect(page.locator('#s-ret option[value="MY"]')).toHaveCount(1);
  await page.selectOption('#s-ret', 'MY');
  await expect(page.locator('#estimate')).toContainText('估算值');
});

test('a lever can become a goal that survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levers [data-goal]').first().click();
  await expect(page.locator('#goal')).toContainText('我的小目标');
  const label = await page.locator('#goal b').textContent();
  await page.reload();
  await expect(page.locator('#goal b')).toHaveText(label);
});

test('the page still calculates with storage blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }));
  await page.goto('/');
  await expect(page.locator('#headline')).toContainText('岁');
});
