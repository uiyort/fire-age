import { test, expect } from '@playwright/test';

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

test.describe('layout on a phone', () => {
  test.use(phone);

  test('the result stays on screen while scrolling, and follows the inputs', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('#sticky-result');
    await expect(bar).toContainText('岁');
    await page.locator('#share-section').scrollIntoViewIfNeeded();
    await expect(bar).toBeInViewport();
    const before = await bar.innerText();
    await page.fill('#s-assets', '3000000');
    await expect(bar).not.toHaveText(before);
  });

  test('the navigation jumps to each zone', async ({ page }) => {
    await page.goto('/');
    for (const id of ['zone-faster', 'zone-risk', 'zone-learn', 'share-section']) {
      await expect(page.locator(`.zone-nav a[href="#${id}"]`)).toBeVisible();
    }
    await page.locator('.zone-nav a[href="#zone-risk"]').click();
    await expect(page.locator('#zone-risk .zone-title')).toBeInViewport();
  });

  test('a returning visitor starts with the inputs folded, and can open them', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#s-assets')).toBeVisible();
    await page.fill('#s-assets', '800000');
    await page.reload();
    await expect(page.locator('#s-assets')).toBeHidden();
    await page.locator('#inputs-box summary').click();
    await expect(page.locator('#s-assets')).toHaveValue('800000');
  });

  test('the place ranking shows the top few and folds the rest', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#places .place')).toHaveCount(11);
    await expect(page.locator('#places .place:visible')).toHaveCount(5);
    await page.locator('#places summary').click();
    await expect(page.locator('#places .place:visible')).toHaveCount(11);
  });

  test('the page stays within a phone screen', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('related things sit together', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.headline #type-now')).toBeVisible();
  await expect(page.locator('.headline #hero')).toBeVisible();
  await expect(page.locator('#zone-faster #levers')).toBeVisible();
  await expect(page.locator('#zone-faster #places')).toBeVisible();
  await expect(page.locator('#zone-risk #lives')).toBeVisible();
  await expect(page.locator('#zone-risk #quiz')).toBeVisible();
  await expect(page.locator('#zone-learn #cards')).toBeVisible();
});

test('each zone leads with its takeaway', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#lead-faster')).toContainText('提前');
  await expect(page.locator('#lead-risk')).toContainText('10 个');
});

test('on a wide screen the inputs stay open and beside the result, and lives sit beside the quiz', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.fill('#s-assets', '800000');
  await page.reload();
  await expect(page.locator('#s-assets')).toBeVisible();
  const lives = await page.locator('#lives').boundingBox();
  const quiz = await page.locator('#quiz').boundingBox();
  expect(quiz.x).toBeGreaterThan(lives.x + lives.width - 1);
});

test('the section has its new name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#life-section h2')).toHaveText('平行人生');
  await expect(page.locator('main')).not.toContainText(/(?<!第)五条人生/);
});

test.describe('professional view locked', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('it stays locked and says how to open it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#to-pro')).toContainText('🔒');
    await page.click('#to-pro');
    await expect(page.locator('#tiles')).toBeHidden();
    await expect(page.locator('#to-simple')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#pro-lock-note')).toBeInViewport();
    await expect(page.locator('#pro-lock-note')).toContainText('生成');
  });

  test('generating the card opens it, for good', async ({ page }) => {
    await page.goto('/');
    await page.click('#share-btn');
    await expect(page.locator('#to-pro')).not.toContainText('🔒');
    await page.click('#pro-enter');
    await expect(page.locator('#tiles')).toBeVisible();
    await page.reload();
    await expect(page.locator('#to-pro')).not.toContainText('🔒');
    await expect(page.locator('#tiles')).toBeVisible();
  });

  test('a saved professional view cannot bypass the lock', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fire-age-v1', JSON.stringify({ view: 'pro', workC: 'CN', retC: 'CN' })));
    await page.goto('/');
    await expect(page.locator('#tiles')).toBeHidden();
  });

  test('formulas and data sources stay open to everyone', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer a[href="method.html"]')).toBeVisible();
    await expect(page.locator('footer a[href="sources.html"]')).toBeVisible();
  });

  test('the page never asks people to share', async ({ page }) => {
    await page.goto('/');
    await page.click('#share-btn');
    await expect(page.locator('main')).not.toContainText('分享');
    await expect(page.locator('main')).not.toContainText('评论区');
  });
});

test('the professional view drops the fun and leads with the numbers', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  for (const id of ['#hero', '#type-now', '#type-all', '#life-section', '#quiz', '#goal', '#cards', '#share-section']) {
    await expect(page.locator(id)).toBeHidden();
  }
  for (const id of ['#tiles', '#chart', '#variants', '#heat-box', '#sensitivity', '#export-csv']) {
    await expect(page.locator(id)).toBeVisible();
  }
  await expect(page.locator('#headline')).not.toContainText('余生皆假期');
  await expect(page.locator('#headline')).toContainText('财务独立');
  await expect(page.locator('#levers')).not.toContainText('周一');
  await expect(page.locator('#levers [data-goal]')).toHaveCount(0);
  await expect(page.locator('#sensitivity tbody tr')).toHaveCount(19);
  await expect(page.locator('#sensitivity')).not.toContainText(/NaN|undefined|null/);
  await expect(page.locator('#places .place:visible')).toHaveCount(11);
  await expect(page.locator('#sticky-result')).toContainText('成功率');
});

test('the type block leaves the next step to the zone below', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#type-now')).not.toContainText('下一步');
});

test('the professional tiles have no Mondays', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  await expect(page.locator('#tiles')).not.toContainText('周一');
});

test('the empty fifth life points at what really writes it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#life-fifth-empty')).not.toContainText('放假实验室');
  await expect(page.locator('#life-fifth-empty')).toContainText('写你的第五条人生');
});
