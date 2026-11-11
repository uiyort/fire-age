import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe('the pension estimate', () => {
  test('estimate, use it, change the self-pay, and see it go away abroad', async ({ page }) => {
    await page.goto('/');
    const fold = page.locator('#pen-fold-s');
    await expect(fold).toBeVisible();
    await fold.locator('summary').click();
    await page.fill('#pen-s-birth', '1996-06');
    await page.selectOption('#pen-s-kind', 'm');
    await page.fill('#pen-s-paid', '8');
    await page.fill('#pen-s-account', '60000');
    await page.fill('#pen-s-base', '8000');
    const result = page.locator('#pen-result-s');
    await expect(result).toContainText('63 岁');
    await expect(result).toContainText('本工具设定');
    await expect(result).not.toContainText(/NaN|undefined|null/);

    await result.getByRole('button', { name: '用这个结果' }).click();
    await expect(page.locator('#s-pension')).not.toHaveValue('');
    await expect(page.locator('#pen-age-s')).toContainText('领取年龄 63 岁');
    await expect(page.locator('#s-selfPension')).toHaveValue('960');

    const bar = page.locator('#sticky-result');
    await expect(bar).toContainText('岁');
    const before = await bar.innerText();
    await page.fill('#s-selfPension', '0');
    await expect(bar).not.toHaveText(before);

    await page.fill('#pen-s-years', '10');
    await expect(result).toContainText('不能按月领取');
    await expect(result).not.toContainText(/NaN|undefined|null/);

    await page.selectOption('#s-work', 'US');
    await expect(page.locator('#pen-fold-s')).toBeHidden();
    await expect(page.locator('#s-selfPension')).toBeHidden();
  });

  test('the professional form has the estimate too, and the mode note names the assumptions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mode-note')).toHaveText('专业版：改收益、通胀等全部假设');
    await page.locator('#to-pro').click();
    await expect(page.locator('#pen-fold-p')).toBeVisible();
    await page.locator('#pen-fold-p summary').click();
    await page.fill('#pen-p-birth', '1996-06');
    await page.fill('#pen-p-base', '8000');
    await expect(page.locator('#pen-result-p')).toContainText('63 岁');
  });

  test('self-pay inputs refuse negatives', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#s-selfPension')).toHaveAttribute('min', '0');
  });

  test('a cleared claim age shows the age the model uses, never null', async ({ page }) => {
    await page.goto('/');
    await page.locator('#to-pro').click();
    await page.fill('#p-pension', '36000');
    await page.fill('#p-pAge', '');
    await page.locator('#to-simple').click();
    const line = page.locator('#pen-age-s');
    await expect(line).toBeVisible();
    await expect(line).toHaveText(/^领取年龄 \d+ 岁/);
    await expect(line).not.toContainText(/null|undefined|NaN/);
  });
});
