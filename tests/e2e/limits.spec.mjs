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

// Task 5 review round 1.
test('Shift+Tab from the first part goes back past the locked total to the fields before it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await page.fill('#split-rent', '5000');
  await expect(page.locator('#s-expense')).toHaveAttribute('readonly', '');
  await page.locator('#split-rent').focus();
  const seen = [];
  for (let i = 0; i < 8 && seen.at(-1) !== 's-assets'; i += 1) {
    await page.keyboard.press('Shift+Tab');
    seen.push(await page.evaluate(() => document.activeElement.id));
  }
  expect(seen.at(-1)).toBe('s-assets');
  expect(seen).not.toContain('split-rent');
  expect(seen).not.toContain('s-expense');
});

test('a closed split still leads on: tapping the locked total opens it and puts the cursor in the first part', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await page.fill('#split-rent', '5000');
  await expect(page.locator('#s-expense')).toHaveAttribute('readonly', '');
  await page.locator('#expense-split summary').click();
  await expect(page.locator('#expense-split')).not.toHaveAttribute('open', '');
  await page.locator('#s-expense').click();
  await expect(page.locator('#split-rent')).toBeFocused();
  await expect(page.locator('#expense-split')).toHaveAttribute('open', '');
});

test('the professional parts say they are monthly; the simple ones need not', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#expense-split .split-row')).not.toContainText('/月');
  await page.click('#to-pro');
  for (const k of ['rent', 'food', 'other']) await expect(page.locator(`label:has(#p-split-${k})`)).toContainText('/月');
});

test('a negative part keeps the total locked and the stop on the part', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  await page.fill('#split-rent', '-500'); await page.locator('#split-rent').press('Tab');
  await expect(page.locator('#s-expense')).toHaveAttribute('readonly', '');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：每月支出 ›');
  await expect(page.locator('#split-rent')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#s-expense')).not.toHaveAttribute('aria-invalid', 'true');
});

test('the sum line reads in words; its operators are not read', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  const sum = page.locator('#split-line-s .split-sum');
  await expect(sum).toHaveAttribute('aria-label', '三项合计 8,000：房租和房贷 5,000，吃饭 2,000，其他 1,000');
  await expect(sum.locator('[aria-hidden="true"]')).toHaveText(['=', '+', '+']);
});

// ---- Task 6: the lines under the fields and the exit buttons.
const roomy = async page => { await page.fill('#s-income', '30000'); await page.fill('#s-expense', '15000'); };
const mortgage = async (page, m, end = '2045') => {
  const fold = page.locator('#life-fold'); if (!(await fold.evaluate(el => el.open))) await fold.locator('summary').click();
  await page.fill('#life-mortgage', m); await page.fill('#life-mortgage-end', end); await page.locator('#life-mortgage-end').press('Tab');
};
const noScroll = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

test('a counted mortgage: the line under spending, the → line and the tag without an amount', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '7500');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 7,500');
  await expect(page.locator('#lines-retexp')).toContainText('→ 50 岁起 ¥7,500');
  await expect(page.locator('#life-tag')).toHaveText('已算：房贷到 2045 ›');
  await expect(page.locator('#life-issue, #life-after')).toHaveCount(0);
  await expect(page.locator('#estimate')).not.toContainText('估算值');
  // The └ and → are not read; 其中 is.
  await expect(page.locator('#lines-expense [aria-hidden="true"]')).toHaveText(['└']);
  await expect(page.locator('#lines-retexp .after [aria-hidden="true"]')).toHaveText(['→']);
  await noScroll(page);
});

test('A3 shows the relation and its three-word exits', async ({ page }) => {
  await page.goto('/'); await page.fill('#s-expense', '7000'); await mortgage(page, '7500');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 7,500 ≥ 每月支出 7,000 ✕');
  await expect(page.locator('#lines-expense .x')).toHaveAttribute('aria-label', '拦住');
  await expect(page.locator('#life-mortgage')).toHaveAttribute('aria-describedby', 'rel-mortgage.monthly');
  await noScroll(page);
  await page.getByRole('button', { name: '改每月支出' }).click();
  await expect(page.locator('#s-expense')).toBeFocused();
});

test('A2: 房租和房贷 → 9,000 fixes it in one tap', async ({ page }) => {
  await page.goto('/');
  await page.locator('#expense-split summary').click();
  for (const [k, v] of [['rent', '5000'], ['food', '2000'], ['other', '1000']]) await page.fill(`#split-${k}`, v);
  await mortgage(page, '9000');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 9,000 > 房租和房贷 5,000');
  // The exits sit under the mortgage box, the solid field.
  const fixes = page.locator('#life-fold .fixes');
  await expect(fixes.locator('button')).toHaveText(['房租和房贷 → 9,000', '改月供']);
  await noScroll(page);
  await page.getByRole('button', { name: '房租和房贷改成 9,000' }).click();
  await expect(page.locator('#split-rent')).toHaveValue('9000');
  await expect(page.locator('#s-expense')).toHaveValue('12000');
  await expect(page.locator('.chip')).toHaveCount(0);
  await expect(page.locator('#split-rent')).toBeFocused();
  await expect(page.locator('.fixes')).toHaveCount(0);
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 9,000');
  await expect(page.locator('#lines-expense .bad')).toHaveCount(0);
});

test('A4: typed retirement spending below the items; 改回估算 brings back ≈', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '7500');
  await expect(page.locator('#estimate .f-pre')).toBeVisible();
  await page.fill('#s-retexp', '6000'); await page.locator('#s-retexp').press('Tab');
  await expect(page.locator('#lines-retexp')).toContainText('└ 其中月供 7,500 ≥ 退休后每月想花 6,000');
  await expect(page.locator('#lines-retexp')).toContainText('→ 50 岁起 —');
  await expect(page.locator('#lines-retexp [aria-label="没有数"]')).toHaveText('—');
  await expect(page.locator('#sticky-result .chip')).toHaveText('拦住：退休后 ›');
  await expect(page.locator('#estimate .f-pre')).toBeHidden();
  await expect(page.locator('#s-retexp')).toHaveAttribute('aria-describedby', 'rel-retExp');
  // Typed by hand: a link right of the label goes back to the estimate too.
  await expect(page.locator('#estimate .lab [data-fix]')).toHaveText('改回估算');
  await noScroll(page);
  await page.getByRole('button', { name: '改回估算 ≈ 15,000' }).click();
  await expect(page.locator('#s-retexp')).toHaveValue('15000');
  await expect(page.locator('#estimate .f-pre')).toHaveText('≈');
  await expect(page.locator('#estimate .f-pre')).toBeVisible();
  await expect(page.locator('#estimate .lab [data-fix]')).toBeHidden();
  await expect(page.locator('.chip')).toHaveCount(0);
  await expect(page.locator('#lines-retexp')).toContainText('→ 50 岁起 ¥7,500');
});

test('a fix that leaves another problem moves the chip on and leaves no stale mark', async ({ page }) => {
  await page.goto('/');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '3000'); await page.locator('#life-mortgage').press('Tab');
  await page.fill('#life-kids', '1.5'); await page.locator('#life-kids').press('Tab');
  await expect(page.locator('#rel-kids\\.count')).toContainText('孩子几个 1.5 ✕');
  await page.getByRole('button', { name: '孩子几个改成 1' }).click();
  await expect(page.locator('#life-kids')).toHaveValue('1');
  await expect(page.locator('#life-kids')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#life-kids')).not.toHaveAttribute('aria-describedby', /./);
  await expect(page.locator('#rel-kids\\.count')).toHaveCount(0);
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填 2 处 ›');
  await expect(page.locator('#hero')).toContainText('— 岁放假');
});

test('A5 不算房贷; an ended mortgage is struck through; a range line and its → button', async ({ page }) => {
  await page.goto('/');
  await page.locator('#life-fold summary').click();
  await page.fill('#life-mortgage', '3000'); await page.locator('#life-mortgage').press('Tab');
  await expect(page.locator('#sticky-result .chip')).toHaveText('待填：房贷 ›');
  // A half-filled group adds no line; the chip and the frame say it.
  await expect(page.locator('#lines-expense')).toHaveText('');
  await page.getByRole('button', { name: '不算房贷' }).click();
  await expect(page.locator('#life-mortgage')).toHaveValue(''); await expect(page.locator('.chip')).toHaveCount(0);
  await mortgage(page, '4000', '2020');
  await expect(page.locator('#lines-expense s')).toHaveText('月供 4,000');
  await expect(page.locator('#lines-expense')).toContainText('2020 已还完');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await expect(page.locator('#rel-age')).toContainText('年龄 120 > 85');
  await expect(page.locator('#s-age')).toHaveAttribute('aria-describedby', 'rel-age');
  await noScroll(page);
  await page.getByRole('button', { name: '年龄改成 85' }).click();
  await expect(page.locator('#s-age')).toHaveValue('85');
  await expect(page.locator('#rel-age')).toHaveCount(0);
});

test('an end year out of range: the year unwritten in thousands, no value button', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '4000', '2200');
  const line = page.locator('#rel-mortgage\\.endYear');
  await expect(line).toHaveText(`还到哪年 2200 > ${new Date().getFullYear() + 40} ✕`);
  await expect(page.locator('#life-mortgage-end')).toHaveAttribute('aria-describedby', 'rel-mortgage.endYear');
  await expect(page.locator('.fixes')).toHaveCount(0);
  await expect(page.locator('#lines-expense')).toHaveText('');
  await noScroll(page);
});

test('spending above income: an orange line, the result still shows', async ({ page }) => {
  await page.goto('/'); await page.fill('#s-income', '5000'); await page.locator('#s-income').press('Tab');
  await expect(page.locator('#lines-expense')).toContainText('! 每月存下 −1,000');
  await expect(page.locator('#lines-expense .warn [aria-label="提示"]')).toHaveText('!');
  await expect(page.locator('.chip')).toHaveCount(0);
});

test('the town line and the pension estimate stop only themselves', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '4000');
  await page.locator('#places-fold > summary').click();
  await page.fill('#town-name', '大理'); await page.fill('#town-monthly', '3000');
  // Nothing red while the spend is typed.
  await expect(page.locator('#town-monthly')).not.toHaveAttribute('aria-invalid', 'true');
  await page.locator('#town-monthly').press('Tab');
  await expect(page.locator('#town-monthly')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#town-result')).toContainText('比月供和孩子的花销还少');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.getByRole('button', { name: '改花销' }).click();
  await expect(page.locator('#town-monthly')).toBeFocused();
  await page.fill('#town-monthly', '6000');
  await expect(page.locator('#town-monthly')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: '改花销' })).toHaveCount(0);
  await page.locator('#pen-fold-s summary').click();
  await page.fill('#pen-s-birth', '1990-06'); await page.fill('#pen-s-base', '8000');
  await page.fill('#pen-s-paid', '15'); await page.fill('#pen-s-years', '12'); await page.locator('#pen-s-years').press('Tab');
  await expect(page.locator('#pen-result-s')).toContainText('累计缴费 12 年 < 已缴 15 年');
  await expect(page.locator('#pen-s-years')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.chip')).toHaveCount(0);
  await page.getByRole('button', { name: '累计缴费改成 15' }).click();
  await expect(page.locator('#pen-s-years')).toHaveValue('15');
  await expect(page.locator('#pen-result-s')).not.toContainText('已缴 15 年');
  await expect(page.locator('#pen-s-years')).not.toHaveAttribute('aria-invalid', 'true');
  // An estimate that could be used: 用这个结果 goes to the field instead while the years do not add up.
  await page.fill('#pen-s-paid', '25'); await page.fill('#pen-s-years', '22'); await page.locator('#pen-s-years').press('Tab');
  await expect(page.locator('#pen-result-s')).toContainText('累计缴费 22 年 < 已缴 25 年');
  await page.locator('#pen-result-s [data-pen-use]').click();
  await expect(page.locator('#pen-s-years')).toBeFocused();
  await expect(page.locator('#s-pension')).toHaveValue('');
});

test('the professional view: yearly lines, ≈ and 改回估算 beside 年支出', async ({ page }) => {
  await page.goto('/'); await roomy(page); await mortgage(page, '7500');
  await page.click('#to-pro');
  await expect(page.locator('#lines-expense')).toContainText('└ 其中月供 90,000/年');
  await expect(page.locator('#lines-retexp')).toContainText('→ 50 岁起 ¥90,000');
  const pre = page.locator('#p-retExp').locator('xpath=preceding-sibling::span[contains(@class,"f-pre")]');
  await expect(pre).toBeVisible(); await expect(pre).toHaveText('≈');
  await page.fill('#p-retExp', '80000'); await page.locator('#p-retExp').press('Tab');
  await expect(page.locator('#lines-retexp')).toContainText('└ 其中月供 90,000/年 ≥ 年支出 80,000 ✕');
  await expect(pre).toBeHidden();
  await page.locator('#pro-form .lab [data-fix]').click();
  await expect(page.locator('#p-retExp')).toHaveValue('180000');
  await expect(pre).toBeVisible();
  await expect(page.locator('.chip')).toHaveCount(0);
  await noScroll(page);
});

test('group headers carry the state of their entries', async ({ page }) => {
  await page.goto('/');
  const now = page.locator('[data-grp="now"]').first();
  await expect(now).toHaveText('示例');
  await expect(page.locator('#simple-form')).not.toContainText('示例，改成你的');
  await expect(page.locator('#simple-form')).not.toContainText('（可以不填）');
  await page.locator('[data-grp="pension"] .grp-plus').click();
  await expect(page.locator('#s-pension')).toBeFocused();
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await expect(now.locator('.grp-x')).toHaveText('✕ 1');
  await expect(now.locator('.grp-x')).toHaveAttribute('aria-label', '拦住 1 处');
});

test('我的数字 leads the second row and opens the numbers at the first group with ✕', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.zone-nav a');
  await expect(links).toHaveText(['我的数字', '怎么提前', '撑得住吗', '参数', '放假卡']);
  const tops = await links.evaluateAll(as => as.map(a => a.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.evaluate(() => { document.getElementById('inputs-box').open = false; });
  await page.locator('#nav-numbers').click();
  expect(await page.locator('#inputs-box').evaluate(el => el.open)).toBe(true);
  // Two groups stopped: the link lands on the first of them, below the sticky bar.
  await page.fill('#s-retexp', ''); await page.locator('#s-retexp').press('Tab');
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('#nav-numbers').click();
  await page.waitForTimeout(300);
  const got = await page.evaluate(() => {
    const x = document.querySelector('#simple-form .grp-x, #estimate .grp-x');
    const head = x.closest('fieldset, .grp-legend');
    const first = [...document.querySelectorAll('#simple-form fieldset, #estimate .grp-legend')].find(g => g.querySelector('.grp-x'));
    return { top: head.getBoundingClientRect().top, bar: document.getElementById('sticky-bar').getBoundingClientRect().bottom, first: first === head, now: head.querySelector('[data-grp]').dataset.grp };
  });
  expect(got.first).toBe(true); expect(got.now).toBe('now');
  expect(got.top).toBeGreaterThanOrEqual(got.bar - 0.5);
});

test('the professional 现在 group says 示例 while the numbers are the examples', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  const now = page.locator('#pro-form [data-grp="now"]');
  await expect(now).toHaveText('示例');
  await page.fill('#p-assets', '350000'); await page.locator('#p-assets').press('Tab');
  await expect(now).toHaveText('');
});

test('the professional assumption groups say 默认 until changed, with the data month', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  const ret = page.locator('#pro-form [data-grp="returns"]');
  await expect(ret).toContainText(/默认.*\d{4}-\d{2} 数据/);
  await page.fill('#p-eq', '70'); await page.locator('#p-eq').press('Tab');
  await expect(ret).toContainText('已改 1');
});
