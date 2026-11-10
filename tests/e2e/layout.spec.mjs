import { test, expect } from '@playwright/test';
const openFolds = page => page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => { d.open = true; }));

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
    await page.locator('#inputs-box > summary').click();
    await expect(page.locator('#s-assets')).toHaveValue('800000');
  });

  test('the place ranking shows the top few and folds the rest', async ({ page }) => {
    await page.goto('/');
    await page.locator('#places-fold > summary').click();
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
  await page.goto('/'); await openFolds(page);
  await expect(page.locator('.headline #type-now')).toBeVisible();
  await expect(page.locator('.headline #hero')).toBeVisible();
  await expect(page.locator('#zone-faster #levers')).toBeVisible();
  await expect(page.locator('#zone-faster #places')).toHaveCount(0);
  await expect(page.locator('#places-fold > summary')).toBeVisible();
  await expect(page.locator('#zone-risk #lives')).toBeVisible();
  await expect(page.locator('#zone-risk #scenario')).toBeVisible();
  await expect(page.locator('#zone-learn #cards')).toBeVisible();
});

test('each zone leads with its takeaway', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#lead-faster')).toContainText('提前');
  await expect(page.locator('#lead-risk')).toContainText('10 个');
});

test('on a wide screen the inputs stay open and beside the result, and lives sit beside the quiz', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/'); await openFolds(page);
  await page.fill('#s-assets', '800000');
  await page.reload(); await openFolds(page);
  await expect(page.locator('#s-assets')).toBeVisible();
  const lives = await page.locator('#lives').boundingBox();
  const box = await page.locator('#scenario').boundingBox();
  expect(box.x).toBeGreaterThan(lives.x + lives.width - 1);
});

test('the section has its new name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#life-section h2')).toHaveText('平行人生');
  await expect(page.locator('main')).not.toContainText('五条人生');
});

test.describe('professional view open to all', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a first visit opens it straight away, with no lock and a note on what it holds', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#to-pro')).toHaveText('专业');
    await expect(page.locator('#mode-note')).toHaveText('专业版：全部假设，以及房贷、孩子、养老金');
    await page.click('#to-pro');
    await expect(page.locator('#pro-form')).toBeVisible();
    await expect(page.locator('#tiles')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('解锁');
    await expect(page.locator('body')).not.toContainText('🔒');
  });
});

test('the professional view drops the fun and leads with the numbers', async ({ page }) => {
  await page.goto('/'); await openFolds(page);
  await page.click('#to-pro');
  for (const id of ['#hero', '#type-now', '#type-all', '#life-section', '#scenario', '#goal', '#cards', '#share-section']) {
    await expect(page.locator(id)).toBeHidden();
  }
  for (const id of ['#tiles', '#chart', '#variants', '#heat-box', '#sensitivity', '#export-csv']) {
    await expect(page.locator(id)).toBeVisible();
  }
  await expect(page.locator('#headline')).not.toContainText('余生皆假期');
  await expect(page.locator('#headline')).toContainText('财务独立');
  await expect(page.locator('#levers')).not.toContainText('周一');
  await expect(page.locator('#levers [data-goal]')).toHaveCount(0);
  await expect(page.locator('#sensitivity tbody tr')).toHaveCount(20);
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

test('the story of the chosen life sits right under its chart', async ({ page }) => {
  await page.goto('/');
  const next = await page.evaluate(() => document.querySelector('#life-section .chart-box').nextElementSibling.id);
  expect(next).toBe('life-story');
});

test('the empty fifth life points at what really writes it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#life-fifth-empty')).toContainText('年景');
});

test.describe('UI review fixes', () => {
  test.use(phone);

  test('the spending split spans the row, shows its total, and clears when spending is typed by hand', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { document.getElementById('inputs-box').open = true; document.getElementById('expense-split').open = true; });
    const split = await page.locator('#expense-split').boundingBox();
    const form = await page.locator('#simple-form').boundingBox();
    expect(split.width).toBeGreaterThan(form.width * 0.9);
    const box = await page.locator('#split-rent').boundingBox();
    expect(box.width).toBeGreaterThan(80);
    await page.fill('#split-rent', '12500');
    await page.fill('#split-food', '3200');
    await page.fill('#split-other', '7633');
    await expect(page.locator('#s-expense')).toHaveValue('23333');
    await expect(page.locator('#split-note')).toHaveText('合计 ¥23,333，已填进每月支出。');
    await page.fill('#s-expense', '9000');
    await expect(page.locator('#split-rent')).toHaveValue('');
    await expect(page.locator('#split-note')).toHaveText('三项加起来，自动填进每月支出。');
  });

  test('the view note stays when the view changes, and names the other view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mode-note')).toHaveText('专业版：全部假设，以及房贷、孩子、养老金');
    await page.click('#to-pro');
    await expect(page.locator('#mode-note')).toBeVisible();
    await expect(page.locator('#mode-note')).toHaveText('简单版：只填几个数');
  });

  test('forward, the odds are told once on the ruler, which fits one line', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero .hero-odds')).toHaveCount(0);
    const ruler = page.locator('#hero .hero-ruler > summary');
    await expect(ruler).toContainText('八成');
    const steps = await ruler.locator('.step').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(steps).size).toBe(1);
  });

  test('the example label goes once the numbers are the person\'s own', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { document.getElementById('inputs-box').open = true; });
    await expect(page.locator('#simple-form .legend-note')).toBeVisible();
    await page.fill('#s-assets', '350000');
    await expect(page.locator('#simple-form .legend-note')).toBeHidden();
  });
});
