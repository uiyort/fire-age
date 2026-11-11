import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const ageOf = async page => {
  const text = await page.locator('#sticky-result .sticky-age').innerText();
  const m = /(\d+) 岁/.exec(text);
  return m ? Number(m[1]) : 0;
};

// The examples spend ¥6,000 a month, less than a ¥7,500 mortgage; these numbers can hold one.
const roomForMortgage = async page => {
  await page.fill('#s-income', '30000');
  await page.fill('#s-expense', '15000');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))));
};

const addMortgage = async (page, monthly = '7500', end = '2045') => {
  const fold = page.locator('#life-fold');
  if (!(await fold.evaluate(el => el.open))) await fold.locator('summary').click();
  await page.fill('#life-mortgage', monthly);
  await page.fill('#life-mortgage-end', end);
};

const amountOf = text => Number(/¥([\d,]+)/.exec(text)[1].replace(/,/g, ''));

test.describe('mortgage and children', () => {
  test('the fold sits right under monthly spending, one line high, and says what it is', async ({ page }) => {
    await page.goto('/');
    const fold = page.locator('#life-fold');
    await expect(fold).toBeVisible();
    await expect(fold.locator('summary')).toHaveText('有房贷或孩子？到期后开销会降');
    expect(await fold.evaluate(el => el.open)).toBe(false);
    expect(await fold.evaluate(el => el.parentElement.closest('form')?.id)).toBe('simple-form');
    expect(await fold.evaluate(el => el.previousElementSibling?.id)).toBe('expense-split');
    expect(await fold.evaluate(el => el.classList.contains('card'))).toBe(false);
    expect((await fold.boundingBox()).height).toBeLessThan(48);
    await expect(page.locator('#life-mortgage')).toBeHidden();
    await expect(page.locator('#life-tag')).toBeHidden();
    await expect(page.locator('#simple-form input:visible, #simple-form select:visible')).toHaveCount(7);

    await fold.locator('summary').click();
    await expect(fold).toContainText('月供和孩子的花销，算在每月支出里，也算在退休后每月想花里。到期以后，这部分自动减掉。');
    await expect(fold).not.toContainText('这些已经算在上面的每月支出里');
    await expect(fold).toContainText('没算：给孩子买房或婚嫁、赡养父母、出国读书、提前还款或利率变化。');
    await expect(page.locator('#life-after')).toBeHidden();
    await page.locator('#life-mortgage').press('Enter');
    await expect(page).toHaveURL(/\/$/);

    await page.locator('#to-pro').click();
    await expect.poll(() => fold.evaluate(el => el.parentElement.closest('form')?.id)).toBe('pro-form');
    expect(await fold.evaluate(el => el.previousElementSibling?.querySelector('#p-expense') !== null)).toBe(true);
    await expect(fold).toBeVisible();
    await page.locator('#to-simple').click();
    await expect.poll(() => fold.evaluate(el => el.previousElementSibling?.id)).toBe('expense-split');
  });

  test('a mortgage: the tag under the big age, the spending after it ends, and the gain', async ({ page }) => {
    await page.goto('/');
    await roomForMortgage(page);
    const before = await ageOf(page);
    expect(before).toBeGreaterThan(0);
    await expect(page.locator('#estimate')).toContainText('估算值，请按你计划的实际生活改写。');
    await expect(page.locator('#estimate')).not.toContainText('要包含月供和孩子');
    await expect(page.locator('#type-section')).not.toContainText('类型也可能跟着变');
    await addMortgage(page);

    const tag = page.locator('#life-tag');
    await expect(tag).toHaveText(/^已算：房贷到 2045 · 之后每月约 ¥[\d,]+ ›$/);
    expect(await tag.evaluate(el => el.previousElementSibling?.classList.contains('hero-big'))).toBe(true);
    const after = page.locator('#life-after');
    await expect(after).toHaveText(/^到期后，退休后每月约花 ¥[\d,]+。$/);
    expect(amountOf(await after.innerText())).toBe(amountOf(await tag.innerText()));
    expect(amountOf(await after.innerText())).toBe(7500);
    await expect(page.locator('#life-gain')).toHaveText(/^(算上到期，比不算早 \d+ 年放假。|算上到期，放假年龄没变。)$/);
    await expect.poll(() => ageOf(page)).toBeLessThanOrEqual(before);
    await expect(page.locator('#estimate')).toContainText('估算值，请按你计划的实际生活改写。要包含月供和孩子，到期会自动减掉。');
    await expect(page.locator('#type-section p.fine')).toHaveText('算上到期支出，放假可能更早，类型也可能跟着变。');

    await page.fill('#life-kids', '1');
    await page.fill('#life-kid-age', '5');
    await page.fill('#life-kid-monthly', '1500');
    await expect(tag).toHaveText(/^已算：房贷到 2045、孩子到 22 岁 · 之后每月约 ¥[\d,]+ ›$/);
    const withBoth = await ageOf(page);

    await page.fill('#life-mortgage', '99999');
    await expect(page.locator('#life-issue')).toContainText('超过了每月支出');
    await expect(tag).toBeHidden();
    await expect(after).toBeHidden();
    await expect(page.locator('#life-gain')).toBeHidden();
    await expect.poll(() => ageOf(page)).toBe(before);

    await page.fill('#life-mortgage', '7500');
    await expect(page.locator('#life-issue')).toBeHidden();
    await page.locator('#to-pro').click();
    await expect(tag).toHaveText(/^已算：房贷到 2045、孩子到 22 岁 · /);
    await expect.poll(() => tag.evaluate(el => el.previousElementSibling?.id)).toBe('headline');
    await expect(page.locator('#life-mortgage')).toHaveValue('7500');
    await expect(page.locator('#life-kid-monthly')).toHaveValue('1500');
    await expect(page.locator('#sticky-result .sticky-age')).toContainText(`${withBoth}`);
    await page.locator('#to-simple').click();
    await expect.poll(() => tag.evaluate(el => el.previousElementSibling?.classList.contains('hero-big'))).toBe(true);
  });

  test('spending after retirement that left out the mortgage is pointed out', async ({ page }) => {
    await page.goto('/');
    await roomForMortgage(page);
    await addMortgage(page);
    await expect(page.locator('#life-after')).not.toContainText('比现在少很多');
    await page.fill('#s-retexp', '8000');
    await expect(page.locator('#life-after')).toHaveText('到期后，退休后每月约花 ¥500。比现在少很多。如果退休后每月想花里没有包含月供和孩子，请把它们加回去。');
  });

  test('the tag opens the numbers and the fold', async ({ page }) => {
    await page.goto('/');
    await roomForMortgage(page);
    await addMortgage(page);
    await page.locator('#life-fold summary').click();
    expect(await page.locator('#life-fold').evaluate(el => el.open)).toBe(false);
    await page.evaluate(() => { document.getElementById('inputs-box').open = false; });
    await page.locator('#life-tag').click();
    expect(await page.locator('#inputs-box').evaluate(el => el.open)).toBe(true);
    expect(await page.locator('#life-fold').evaluate(el => el.open)).toBe(true);
    await expect(page.locator('#life-mortgage')).toBeInViewport();
  });

  test('a rent or mortgage in the split offers the fold', async ({ page }) => {
    await page.goto('/');
    await page.locator('#expense-split summary').click();
    const link = page.locator('#split-life');
    await expect(link).toBeHidden();
    await page.fill('#split-food', '2000');
    await expect(link).toBeHidden();
    await page.fill('#split-rent', '5000');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('房贷会还完？填上还到哪年 ›');
    await page.fill('#split-rent', '0');
    await expect(link).toBeHidden();
    await page.fill('#split-rent', '5000');
    await link.click();
    expect(await page.locator('#life-fold').evaluate(el => el.open)).toBe(true);
    await expect(page.locator('#life-mortgage')).toBeFocused();
    await page.fill('#s-expense', '9000');
    await expect(link).toBeHidden();
  });

  test('the view note names what the professional view changes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mode-note')).toHaveText('专业版：改收益、通胀等全部假设');
    await page.locator('#to-pro').click();
    await expect(page.locator('#mode-note')).toHaveText('简单版：只填几个数');
  });

  test('a town that spends less than the mortgage gives no age', async ({ page }) => {
    await page.goto('/');
    await roomForMortgage(page);
    await addMortgage(page);
    await page.locator('#places-fold > summary').click();
    await page.fill('#town-name', '大理');
    const line = page.locator('#town-result');
    // A spend that holds the mortgage gives an age, so the check below can tell an age from none.
    await page.fill('#town-monthly', '12000');
    await expect(line).toHaveText(/\d+ 岁放假/);
    await page.fill('#town-monthly', '3000');
    await expect(line).toContainText('比月供和孩子的花销还少');
    // The sentence asks to add the items back; it gives no age.
    await expect(line).not.toHaveText(/\d+ 岁/);
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
    await page.fill('#life-kid-monthly', '1500');
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
