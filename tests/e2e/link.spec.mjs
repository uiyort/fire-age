import { test, expect } from '@playwright/test';

const LINK = '/?ch=zh#age=41&assets=800000&income=20000&expense=9000';
const base = [{ name: 'fire-age-pro-v1', value: '1' }, { name: 'fire-age-started-v1', value: '1' }];
const saved = JSON.stringify({ workC: 'CN', retC: 'CN', age: 50, assets: 1000000, income: 300000, expense: 120000, retExp: 120000 });
const stored = page => page.evaluate(() => localStorage.getItem('fire-age-v1'));

test('a link opens with its numbers, saves nothing until a change, then saves the change and drops the fragment', async ({ page }) => {
  await page.goto(LINK);
  await expect(page.locator('#s-age')).toHaveValue('41');
  await expect(page.locator('#s-income')).toHaveValue('20000');
  await expect(page.locator('#s-expense')).toHaveValue('9000');
  await expect(page.locator('#headline')).toContainText('岁');
  await expect(page.locator('#link-note')).toBeVisible();
  // A first visit has nothing of its own to go back to.
  await expect(page.locator('#link-back')).toHaveCount(0);
  expect(await stored(page)).toBeNull();

  await page.fill('#s-age', '42');
  await expect(page.locator('#link-note')).toBeHidden();
  expect(new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).searchParams.get('ch')).toBe('zh');
  expect(JSON.parse(await stored(page)).age).toBe(42);
  await page.reload();
  await expect(page.locator('#s-age')).toHaveValue('42');
});

test.describe('a returning visitor', () => {
  test.use({ storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [...base, { name: 'fire-age-v1', value: saved }] }] } });

  test('keeps their own numbers under a link and can go back to them', async ({ page }) => {
    await page.goto(LINK);
    await expect(page.locator('#s-age')).toHaveValue('41');
    expect(JSON.parse(await stored(page)).age).toBe(50);
    await page.click('#link-back');
    await expect(page.locator('#s-age')).toHaveValue('50');
    await expect(page.locator('#link-note')).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
  });
});

test('an ordinary fragment is not a link', async ({ page }) => {
  await page.goto('/#zone-faster');
  await expect(page.locator('#link-note')).toBeHidden();
  await expect(page.locator('#s-age')).toHaveValue('30');
});

test.describe('a first visit on a phone from a link', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: { cookies: [], origins: [] } });

  test('goes straight to the result of the link\'s numbers, without the start screen', async ({ page }) => {
    await page.goto('/#mode=bwd&tage=35&age=35&assets=1800000&income=6000&expense=6000&pension=2000');
    await expect(page.locator('#start-calc')).toBeHidden();
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#headline')).toBeInViewport();
    await expect(page.locator('#headline')).toContainText('如果今天就放假');
    await expect(page.locator('#link-note')).toBeVisible();
  });
});
