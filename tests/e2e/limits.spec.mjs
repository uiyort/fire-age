// A broken rule or a blank stops the result: — 岁放假 and a red chip that jumps to the field. Nothing turns red while typing.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const fresh = { cookies: [], origins: [] };
// Opens the page once (it saves its state), merges the overrides into the saved state and reloads.
const withSaved = async (page, over) => {
  await page.goto('/');
  await page.evaluate(o => { const k = 'fire-age-v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...o })); }, over);
  await page.reload();
};

test.describe('the example path', () => {
  test.use({ storageState: fresh });
  test('no numbers typed, three taps to the card, no rule fires', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[aria-invalid="true"], .chip')).toHaveCount(0);
    await page.click('#start-calc');                                        // 1
    await page.locator('.zone-nav a', { hasText: '放假卡' }).click();       // 2
    await page.click('#share-btn');                                         // 3
    await expect(page.locator('#share-panel')).toBeVisible();
    await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
    await expect(page.locator('.chip')).toHaveCount(0);
  });
  test('your own numbers: four fields, three taps', async ({ page }) => {
    await page.goto('/');
    for (const [id, v] of [['#s-age', '35'], ['#s-assets', '300000'], ['#s-income', '15000'], ['#s-expense', '7000']]) await page.fill(id, v);
    await page.click('#start-calc');
    await page.locator('.zone-nav a', { hasText: '放假卡' }).click();
    await page.click('#share-btn');
    await expect(page.locator('#share-panel')).toBeVisible();
  });
});

test('a mortgage at or above monthly spending stops the result; the chip jumps to it', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#sticky-result')).toContainText('— 岁放假');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
  await expect(page.locator('#hero')).toContainText('— 岁放假');
  await expect(page.locator('.headline')).not.toContainText(/\d+ 岁放假/);
  for (const id of ['#type-section', '#zone-faster', '#zone-risk', '#places-fold', '#share-section', '#life-tag']) await expect(page.locator(id)).toBeHidden();
  await page.evaluate(() => { document.getElementById('inputs-box').open = false; document.getElementById('life-fold').open = false; });
  await page.locator('#sticky-result .chip').click();
  await expect(page.locator('#life-mortgage')).toBeFocused();
  await expect(page.locator('#life-mortgage')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#s-expense').locator('xpath=ancestor::div[contains(@class,"f")][1]')).toHaveClass(/cmp/);
});

test('typing turns nothing red and computes nothing; leaving the field stops; fixing clears at once', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#sticky-result').innerText();
  await page.locator('#s-age').fill('3');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  // innerText on both sides: the bar's hidden 再上 N 年班 is in the text content but not on screen.
  await expect(page.locator('#sticky-result')).toHaveText(before, { useInnerText: true });
  await page.locator('#s-age').press('Tab');
  await expect(page.locator('#s-age')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：年龄 ›');
  await page.locator('#s-age').fill('31');
  await expect(page.locator('#s-age')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sticky-result')).toContainText(/\d+ 岁放假/);
});

test('a blank shows 待填 and — , never the old result', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', ''); await page.locator('#s-expense').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填：每月支出 ›');
  await expect(page.locator('#hero')).toContainText('— 岁放假');
  await expect(page.locator('body')).toHaveClass(/result-held/);
});

test('the result links go to the problem instead', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-income', ''); await page.locator('#s-income').press('Tab');
  await page.evaluate(() => { document.getElementById('inputs-box').open = false; });
  for (const name of ['怎么提前', '撑得住吗', '放假卡']) {
    await page.locator('.zone-nav a', { hasText: name }).click();
    await expect(page.locator('#s-income')).toBeFocused();
    await page.locator('#s-age').focus();
  }
  await expect(page.locator('#share-panel')).toBeHidden();
});

test('saved numbers that break a rule (an older save with the mortgage above spending) open stopped, every mark shown', async ({ page }) => {
  await withSaved(page, { expense: 84000, real: { mortgage: { monthly: 7500, endYear: 2045 }, kids: { count: null, age: null, monthly: null } } });
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
  await expect(page.locator('#life-mortgage')).toHaveAttribute('aria-invalid', 'true');
});

test('a professional-only value saved out of range: the chip names it in the simple view and the jump opens the professional view', async ({ page }) => {
  await withSaved(page, { view: 'simple', eq: 150 });
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：股票占比 ›');
  await page.locator('#sticky-result .chip').click();
  await expect(page.locator('#to-pro')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#p-eq')).toBeFocused();
});

test('a plan end saved above 110: the chip names 规划到 in the simple view and the jump opens the professional view', async ({ page }) => {
  await withSaved(page, { view: 'simple', life: 120 });
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：规划到 ›');
  await page.locator('#sticky-result .chip').click();
  await expect(page.locator('#to-pro')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#p-life')).toBeFocused();
  await expect(page.locator('#p-life')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sticky-result')).toContainText('财务独立 — 岁');
});

test('a help card shows nothing worked out from blocked numbers, and its numbers come back once fixed', async ({ page }) => {
  await page.goto('/');
  await page.click('#help-expense');
  await expect(page.locator('#card-expense')).toContainText('岁放假');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
  // A card open when the hold starts is drawn again without its numbers.
  await expect(page.locator('#card-expense')).toBeVisible();
  await expect(page.locator('#card-expense')).not.toContainText('岁放假');
  // A card opened while held has none either.
  await page.click('#help-income');
  await expect(page.locator('#card-income')).toBeVisible();
  for (const id of ['#card-income', '#card-expense']) {
    await expect(page.locator(id)).not.toContainText('岁放假');
    await expect(page.locator(id)).not.toContainText('提前');
  }
  await page.fill('#life-mortgage', '5000');
  await expect(page.locator('.chip')).toHaveCount(0);
  await expect(page.locator('#card-income')).toContainText('岁放假');
  await expect(page.locator('#card-expense')).toContainText('岁放假');
});

test('typing that fixes the shown stop and breaks another rule in the same field never leaves the fixed stop on the chip', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-age', ''); await page.locator('#s-age').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填：年龄 ›');
  await page.locator('#s-age').fill('3');
  await expect(page.locator('#sticky-result .chip')).not.toHaveText('待填：年龄 ›');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await page.locator('#s-age').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：年龄 ›');
  await expect(page.locator('#s-age')).toHaveAttribute('aria-invalid', 'true');
});

test('a mark does not change the size of the field', async ({ page }) => {
  await page.goto('/');
  const size = sel => page.locator(sel).evaluate(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  const age = await size('#s-age'), expense = await size('#s-expense');
  await page.fill('#s-age', '12');
  await page.fill('#s-expense', '7000');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '7500'); await page.fill('#life-mortgage-end', '2045');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#s-age')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#s-expense').locator('xpath=ancestor::div[contains(@class,"f")][1]')).toHaveClass(/cmp/);
  expect(await size('#s-age')).toEqual(age);
  expect(await size('#s-expense')).toEqual(expense);
});

test('no horizontal scroll at 390 px while stopped', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('splitting locks spending to the sum; 只填总数 brings back the old total; a reload keeps the parts', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await expect(page.locator('#expense-split summary')).toContainText('拆开来加');
  await expect(page.locator('#expense-split')).toContainText('房租和房贷');
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  const total = page.locator('#s-expense');
  await expect(total).toHaveValue('8000');
  await expect(total).toHaveAttribute('readonly', ''); await expect(total).toHaveAttribute('aria-readonly', 'true');
  await expect(page.locator('#split-line-s')).toContainText('= 5,000 + 2,000 + 1,000');
  await expect(page.locator('[data-unsplit]').first()).toHaveText('只填总数 ¥6,000');
  await total.click(); await expect(page.locator('#split-rent')).toBeFocused();
  await page.reload();
  // A returning visitor on a phone starts with the numbers folded.
  await page.locator('#inputs-box').evaluate(d => { d.open = true; });
  await expect(page.locator('#split-food')).toHaveValue('2000'); await expect(total).toHaveValue('8000');
  await page.locator('#split-line-s [data-unsplit]').click();
  await expect(total).toHaveValue('6000'); await expect(total).toBeFocused();
  await expect(total).not.toHaveAttribute('readonly', ''); await expect(page.locator('#split-rent')).toHaveValue('');
});

test('clearing all three parts by hand unlocks with the old total', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await page.fill('#split-rent', '5000'); await page.fill('#split-food', '2000');
  await page.fill('#split-rent', ''); await page.fill('#split-food', '');
  await expect(page.locator('#s-expense')).toHaveValue('6000');
  await expect(page.locator('#s-expense')).not.toHaveAttribute('readonly', '');
});

test('the professional view splits by month, shows × 12 and can leave the split', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await page.locator('#p-expense-split summary').click();
  for (const [k, v] of [['rent', '2000'], ['food', '1500'], ['other', '1000']]) await page.fill(`#p-split-${k}`, v);
  await expect(page.locator('#p-expense')).toHaveValue('54000');
  await expect(page.locator('#split-line-p')).toContainText('(2,000 + 1,500 + 1,000) × 12');
  await page.locator('#split-line-p [data-unsplit]').click();
  await expect(page.locator('#p-expense')).toHaveValue('72000');
});

test('a mortgage above the rent part stops the result', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '9000'); await page.fill('#life-mortgage-end', '2045');
  await page.locator('#life-mortgage-end').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：房贷 ›');
});

test('the two views share one split: parts typed in the simple view lock the professional total', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await page.fill('#split-rent', '5000'); await page.fill('#split-food', '1000');
  await expect(page.locator('#s-expense')).toHaveAttribute('aria-label', '每月支出，三项合计');
  await page.click('#to-pro');
  await expect(page.locator('#p-split-food')).toHaveValue('1000');
  await expect(page.locator('#p-expense')).toHaveValue('72000');
  await expect(page.locator('#p-expense')).toHaveAttribute('aria-label', '当前年支出，三项合计');
  await expect(page.locator('#p-expense-split')).toHaveAttribute('open', '');
  await page.locator('#p-expense').click(); await expect(page.locator('#p-split-rent')).toBeFocused();
});
