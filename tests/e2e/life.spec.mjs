import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const ageOf = async page => {
  const text = await page.locator('#sticky-result .sticky-age').innerText();
  const m = /(\d+) 岁/.exec(text);
  return m ? Number(m[1]) : 0;
};

test.describe('mortgage and children', () => {
  test('fold, tag, warning and the professional view', async ({ page }) => {
    await page.goto('/');
    const fold = page.locator('#life-fold');
    await expect(fold).toBeVisible();
    await expect(fold.locator('summary')).toHaveText('有房贷或孩子？加上再算');
    expect(await fold.evaluate(el => el.open)).toBe(false);
    await expect(page.locator('#life-mortgage')).toBeHidden();
    await expect(page.locator('#life-tag')).toBeHidden();

    await expect(page.locator('#simple-form input:visible, #simple-form select:visible')).toHaveCount(7);
    const before = await ageOf(page);
    expect(before).toBeGreaterThan(0);
    await fold.locator('summary').click();
    await expect(fold).toContainText('这些已经算在上面的每月支出里。到期以后，支出相应减少。');

    await page.fill('#life-mortgage', '4000');
    await page.fill('#life-mortgage-end', '2045');
    await expect(page.locator('#life-tag')).toHaveText('已含 1 项真实生活');
    await expect.poll(() => ageOf(page)).toBeLessThanOrEqual(before);

    await page.fill('#life-kids', '1');
    await page.fill('#life-kid-age', '5');
    await page.fill('#life-kid-monthly', '2000');
    await expect(page.locator('#life-tag')).toHaveText('已含 2 项真实生活');
    const withBoth = await ageOf(page);
    expect(withBoth).toBeLessThanOrEqual(before);

    await page.fill('#life-mortgage', '99999');
    await expect(page.locator('#life-issue')).toContainText('超过了每月支出');
    await expect(page.locator('#life-tag')).toBeHidden();
    await expect.poll(() => ageOf(page)).toBe(before);

    await page.fill('#life-mortgage', '4000');
    await expect(page.locator('#life-tag')).toHaveText('已含 2 项真实生活');
    await expect(page.locator('#life-issue')).toBeHidden();

    await page.locator('#to-pro').click();
    await expect(page.locator('#life-tag')).toHaveText('已含 2 项真实生活');
    await expect(page.locator('#life-mortgage')).toHaveValue('4000');
    await expect(page.locator('#life-kid-monthly')).toHaveValue('2000');
    await expect(page.locator('#sticky-result .sticky-age')).toContainText(`${withBoth}`);
  });

  test('the tag scrolls to the fold and opens it', async ({ page }) => {
    await page.goto('/');
    await page.locator('#life-fold summary').click();
    await page.fill('#life-mortgage', '4000');
    await page.fill('#life-mortgage-end', '2045');
    await page.locator('#life-fold summary').click();
    expect(await page.locator('#life-fold').evaluate(el => el.open)).toBe(false);
    await page.locator('#life-tag').click();
    expect(await page.locator('#life-fold').evaluate(el => el.open)).toBe(true);
  });

  test('entries that are ignored say so, and the inputs take whole numbers', async ({ page }) => {
    await page.goto('/');
    await page.locator('#life-fold summary').click();
    await expect(page.locator('#life-kids')).toHaveAttribute('min', '1');
    await expect(page.locator('#life-kid-age')).toHaveAttribute('max', '22');
    await expect(page.locator('#life-kid-age')).toHaveAttribute('step', '1');
    await expect(page.locator('#life-mortgage-end')).toHaveAttribute('min', String(new Date().getFullYear()));
    await page.fill('#life-kids', '1');
    await page.fill('#life-kid-age', '25');
    await page.fill('#life-kid-monthly', '2000');
    await expect(page.locator('#life-issue')).toHaveText('孩子已满 22 岁，这一项不再计入。');
    await expect(page.locator('#life-tag')).toBeHidden();
    await page.fill('#life-kid-age', '5');
    await expect(page.locator('#life-issue')).toBeHidden();
    await page.fill('#life-mortgage', '4000');
    await page.fill('#life-mortgage-end', '2020');
    await expect(page.locator('#life-issue')).toHaveText('这一年已经过了，月供不再计入。');
  });

  test('the new tag does not restyle the hardest-life pill', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lives-fold summary').click();
    const pill = page.locator('.pill.life-tag').first();
    await expect(pill).toBeVisible();
    const style = () => pill.evaluate(el => { const c = getComputedStyle(el); return { border: c.borderTopColor, margin: c.marginLeft }; });
    const base = await style();
    expect(base.margin).toBe('6px');
    await page.locator('#life-fold summary').click();
    await page.fill('#life-mortgage', '4000');
    await page.fill('#life-mortgage-end', '2045');
    await expect(page.locator('#life-tag')).toBeVisible();
    expect(await style()).toEqual(base);
    expect(base.border).not.toBe(await page.locator('#life-tag').evaluate(el => getComputedStyle(el).borderTopColor));
  });
});
