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

test.describe('what the card shows', () => {
  const card = async page => JSON.parse(await page.locator('#share-img').getAttribute('data-card'));

  test('by default the card shows no money; showing it brings the saved share back', async ({ page }) => {
    await page.goto('/');
    await page.click('#share-btn');
    await expect(page.locator('#share-img')).toHaveAttribute('data-card', /"kind":"summary"/);
    let c = await card(page);
    expect(c.fund).toBeNull();
    expect(c.note).not.toMatch(/[¥$]/);
    expect(c.search).toBe('搜：放假年龄');
    await expect(page.locator('#share-img')).not.toHaveAttribute('alt', /¥/);
    await page.check('#card-money');
    await expect(page.locator('#share-img')).not.toHaveAttribute('data-card', /"fund":null/);
    c = await card(page);
    expect(c.fund).toBeGreaterThanOrEqual(0);
  });

  test('hiding the age clears every line that gives it away', async ({ page }) => {
    await page.goto('/');
    await page.click('#share-btn');
    await page.uncheck('#card-now');
    await expect(page.locator('#share-img')).toHaveAttribute('data-card', /"now":""/);
    const c = await card(page);
    expect(c.route).toBe('');
  });

  test('the type-only card has the type and no age', async ({ page }) => {
    await page.goto('/');
    await page.click('#share-btn');
    await page.locator('.card-kind label', { hasText: '只发类型' }).click();
    await expect(page.locator('#share-img')).toHaveAttribute('data-card', /"kind":"type"/);
    await expect(page.locator('#share-img')).not.toHaveAttribute('alt', /岁/);
  });
});

test('with a number cleared, changing a card option does not recount the blank as zero', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  const headline = await page.locator('#headline').textContent();
  const card = await page.locator('#share-img').getAttribute('src');
  await page.locator('#inputs-box').evaluate(d => { d.open = true; });
  await page.fill('#s-assets', '');
  await page.locator('#s-income').focus();
  await expect(page.locator('#missing-note')).toBeVisible();
  await page.check('#card-money');
  await page.waitForTimeout(500);
  expect(await page.locator('#headline').textContent()).toBe(headline);
  expect(await page.locator('#share-img').getAttribute('src')).toBe(card);
});
