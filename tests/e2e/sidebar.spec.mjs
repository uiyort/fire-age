// The sidebar at 1024 px and wider (spec §6.3): rows with summaries and states, links and the result card at the
// bottom, no top bar. Between 900 and 1023 px the two columns stay as they were.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

test('a first visit shows every row open, no top bar, links and the result card at the bottom', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sticky-bar')).toBeHidden();
  const heads = page.locator('.grp-head:visible');
  await expect(heads).toHaveCount(5);
  for (const h of await heads.all()) await expect(h).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#side-links')).toContainText(/怎么提前 \d+ · 撑得住吗 · 参数 · 放假卡/);
  const n = await page.locator('#levers .lever').count();
  await expect(page.locator('#side-links')).toContainText(`怎么提前 ${n}`);
  await expect(page.locator('#side-card')).toContainText(/\d+ 岁放假/);
  const box = await page.locator('.inputs').boundingBox();
  expect(Math.round(box.width)).toBe(330); expect(box.height).toBeLessThanOrEqual(800);
  // The whole column is on screen, its links and card at the bottom: under the header at first, and once the page
  // scrolls, stuck 16 px from the top.
  const footEnd = async () => { const foot = await page.locator('#side-foot').boundingBox(); return Math.round(foot.y + foot.height); };
  expect(await footEnd()).toBe(800 - 16 - 1);
  await page.mouse.move(800, 400); await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(async () => Math.round((await page.locator('.inputs').boundingBox()).y)).toBe(16);
  await expect.poll(footEnd).toBe(800 - 16 - 1);
});

test('a returning visit folds the rows to their summaries; rows open on their own', async ({ page }) => {
  await page.goto('/'); await page.reload();
  const now = page.locator('.grp-head[data-row="now"]');
  await expect(now).toHaveAttribute('aria-expanded', 'false');
  await expect(now).toContainText('30 岁 · ¥20万 · 到手 ¥1.2万/月 · 存下 ¥6,000/月');
  await expect(page.locator('#s-age')).toBeHidden();
  await now.click(); await page.locator('.grp-head[data-row="where"]').click();
  await expect(now).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.grp-head[data-row="where"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#s-age')).toBeVisible();
  await expect(page.locator('#s-work')).toBeVisible();
  await expect(page.locator('#s-expense')).toBeHidden();
});

test('a stopped number opens its row and the card carries the chip', async ({ page }) => {
  await page.goto('/'); await page.reload();
  await page.locator('.grp-head[data-row="now"]').click();
  await page.fill('#s-age', '120'); await page.locator('#s-age').press('Tab');
  await page.locator('.grp-head[data-row="now"]').click();
  await expect(page.locator('#side-card')).toContainText('— 岁');
  await page.locator('#side-card .chip').click();
  await expect(page.locator('#s-age')).toBeFocused();
  await expect(page.locator('.grp-head[data-row="now"]')).toHaveAttribute('aria-expanded', 'true');
});

test('a returning visit with a stop opens only the row that holds it', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-expense', ''); await page.locator('#s-expense').press('Tab');
  await page.reload();
  await expect(page.locator('.grp-head[data-row="spend"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.grp-head[data-row="spend"] .grp-x')).toHaveText('✕ 1');
  await expect(page.locator('.grp-head[data-row="now"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.grp-head[data-row="now"] .grp-x')).toHaveCount(0);
});

test('the pointer over a column with nothing to scroll still scrolls the page', async ({ page }) => {
  await page.goto('/'); await page.reload();
  await page.mouse.move(200, 300); await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('怎么算的 opens the ledger', async ({ page }) => {
  await page.goto('/');
  await page.locator('#side-card [data-how]').click();
  await expect(page.locator('#ledger')).toBeVisible();
});

test('the professional view has seven rows with their summaries', async ({ page }) => {
  await page.goto('/'); await page.click('#to-pro');
  await expect(page.locator('.grp-head:visible')).toHaveCount(7);
  await expect(page.locator('.grp-head[data-row="sim"]')).toContainText('八成 · 2,000 次 · 种子 20261026');
  await expect(page.locator('.grp-head[data-row="sim"]')).toContainText('本工具设定');
  await expect(page.locator('#side-card')).toContainText(/财务独立 \d+ 岁 · \d+\.\d% · 怎么算的 ›/);
  await expect(page.locator('#side-links')).not.toContainText('放假卡');
});

test('working backward, the age to holiday at is the first row', async ({ page }) => {
  await page.goto('/'); await page.click('#to-bwd');
  await expect(page.locator('.grp-head:visible')).toHaveCount(6);
  await expect(page.locator('.grp-head:visible').first()).toHaveAttribute('data-row', 'tage');
  await expect(page.locator('.grp-head[data-row="tage"]')).toContainText('45 岁');
  await expect(page.locator('#side-card')).toContainText(/想 45 岁 · \d+ 成把握 · 怎么算的 ›/);
});

test.describe('between 900 and 1023 px', () => {
  test.use({ viewport: { width: 1000, height: 800 } });
  test('today\'s two columns stay, with the top bar and the group statuses', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sticky-bar')).toBeVisible();
    await expect(page.locator('.grp-head').first()).toBeHidden();
    await expect(page.locator('#side-foot')).toBeHidden();
    await expect(page.locator('[data-grp="now"]').first()).toHaveText('示例');
    await page.reload();
    await expect(page.locator('#s-age')).toBeVisible();
  });
});
