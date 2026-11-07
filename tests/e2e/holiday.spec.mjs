import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const noBadText = /NaN|undefined|null/;

test('the conclusion is drawn: life bar, parallel people, money bar', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('#hero');
  await expect(hero.locator('.lifebar .work')).toBeVisible();
  await expect(hero.locator('.lifebar .rest')).toBeVisible();
  await expect(hero).toContainText('个周一');
  await expect(hero.locator('.people svg')).toHaveCount(10);
  await expect(hero.locator('.people svg.on').first()).toBeVisible();
  await expect(hero).toContainText('10 个平行的你');
  await expect(hero.locator('.fund-bar i')).toBeAttached();
  await expect(page.locator('#tiles')).toBeHidden();
});

test('the professional view keeps the exact numbers', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  await expect(page.locator('#tiles')).toBeVisible();
  await expect(page.locator('#tiles')).toContainText('放假所需资产');
});

test('someone who cannot reach the goal gets a complete, upbeat conclusion', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '0');
  await page.fill('#s-income', '3000');
  await page.fill('#s-expense', '9000');
  const hero = page.locator('#hero');
  await expect(hero).toContainText('还没看到放假那天');
  await expect(hero.locator('.lifebar .rest')).toHaveCount(0);
  await expect(hero.locator('.people')).toHaveCount(0);
  await expect(hero).not.toContainText(noBadText);
  for (const id of ['#type-now', '#places', '#lives', '#life-story']) await expect(page.locator(id)).not.toContainText(noBadText);
});

test('the holiday type has a code, four axes and a full table with the person marked', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#type-now .type-code')).toHaveText(/^[EL][HA][TF][SG]$/);
  await expect(page.locator('#type-now .axis')).toHaveCount(4);
  await page.locator('#type-all summary').click();
  await expect(page.locator('#type-all .type-cell')).toHaveCount(16);
  await expect(page.locator('#type-all .type-cell.mine')).toHaveCount(1);
  const before = await page.locator('#type-now .type-code').innerText();
  await page.selectOption('#s-ret', 'TH');
  await expect(page.locator('#type-now .type-code')).not.toHaveText(before);
});

test('a lever shows its gain in Mondays', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#levers .gain').first()).toContainText('个周一');
});

test('the place ranking lists every country and updates with inputs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#places .place')).toHaveCount(11);
  await expect(page.locator('#places .place.current')).toHaveCount(1);
  await expect(page.locator('#places-card')).toContainText('签证');
  const before = await page.locator('#places').innerText();
  await page.fill('#s-assets', '2000000');
  await expect(page.locator('#places')).not.toHaveText(before);
});

test('only one card button exists, at the end of the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /卡片|放假卡/ })).toHaveCount(1);
  const last = await page.evaluate(() => [...document.querySelectorAll('.results > section')].at(-1).id);
  expect(last).toBe('share-section');
});

test('the one card opens beside its button and closes when the numbers change', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  await expect(page.locator('#share-section #share-panel')).toBeVisible();
  await expect(page.locator('#share-panel')).toBeInViewport();
  await page.fill('#s-assets', '900000');
  await expect(page.locator('#share-panel')).toBeHidden();
});

test('a card can be closed', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  await page.click('#share-close');
  await expect(page.locator('#share-panel')).toBeHidden();
});

test('four lives are there from the start, each with a name, a ribbon and an ending', async ({ page }) => {
  await page.goto('/');
  const lives = page.locator('#lives .life');
  await expect(lives).toHaveCount(4);
  await expect(page.locator('#lives .life[aria-pressed="true"]')).toHaveCount(1);
  await expect(lives.first().locator('.life-name')).not.toBeEmpty();
  await expect(lives.first().locator('.ribbon rect').first()).toBeAttached();
  await expect(page.locator('#lives-chart-legend')).toContainText('钱花完');
  await expect(page.locator('#lives-chart path').first()).toBeAttached();
  await expect(page.locator('#life-story li').first()).toBeVisible();
});

test('switching tells another story, drawing again changes them', async ({ page }) => {
  await page.goto('/');
  const seed = await page.locator('#life-seed').innerText();
  const story = await page.locator('#life-story').innerText();
  await page.locator('#lives .life').nth(1).click();
  await expect(page.locator('#lives .life').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#life-story')).not.toHaveText(story);
  await page.click('#life-draw');
  await expect(page.locator('#life-seed')).not.toHaveText(seed);
});

test('drawn lives follow the inputs', async ({ page }) => {
  await page.goto('/');
  const story = await page.locator('#life-story').innerText();
  await page.fill('#s-assets', '3000000');
  await expect(page.locator('#life-story')).not.toHaveText(story);
});

test('a decision slider writes the fifth life, and clearing removes it', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#headline .say').innerText();
  const details = page.locator('#cards details[data-id="expense"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('60000');
  await expect(details.locator('output')).toContainText('→');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(1);
  expect(await page.locator('#headline .say').innerText()).toBe(before);
  await page.click('#lab-clear');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
  await expect(page.locator('#life-fifth-empty')).toBeVisible();
});

test('an assumption slider only previews, because nobody chooses the market', async ({ page }) => {
  await page.goto('/');
  const details = page.locator('#cards details[data-id="sigEq"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('0.3');
  await expect(details.locator('output')).toContainText('成功率');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
});

test('changing the real plan clears slider rewrites', async ({ page }) => {
  await page.goto('/');
  const details = page.locator('#cards details[data-id="retExp"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('60000');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(1);
  await page.fill('#s-assets', '900000');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
});

test('moving a slider lights up that parameter, and progress survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#lab-progress')).toContainText('0/20');
  const details = page.locator('#cards details[data-id="assets"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('900000');
  await expect(page.locator('#lab-progress')).toContainText('1/20');
  await expect(details).toHaveClass(/played/);
  await page.reload();
  await expect(page.locator('#lab-progress')).toContainText('1/20');
  await expect(page.locator('#cards details[data-id="assets"]')).toHaveClass(/played/);
});

test('parameters are grouped under headings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#cards h4')).toHaveCount(4);
  await expect(page.locator('#cards details')).toHaveCount(14);
});

test('the page stays within a phone screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#scenario [data-scn]').first().click();
  await page.click('#share-btn');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});


const answer = async (page, option = 0) => page.locator('#scenario [data-scn]').nth(option).click();

test('the last life is called waiting to be written', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#life-fifth-empty')).toContainText('等你来写');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('第五条');
});

test('answering about the years ahead writes the life, against the hardest one', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#scenario')).toContainText('第 1 /');
  await expect(page.locator('#scenario .scn-reveal')).toHaveCount(0);
  await answer(page);
  const fifth = page.locator('#lives .life.fifth');
  await expect(fifth).toHaveCount(1);
  await expect(fifth.locator('.life-name')).toHaveText('等你来写');
  await expect(fifth).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#life-story .fifth-compare')).toContainText('同样的年景');
  await expect(page.locator('#scenario .scn-reveal')).toContainText('同样的年景');
  await expect(page.locator('#life-changes')).toContainText('已写入');
});

test('an answer can be changed before moving on', async ({ page }) => {
  await page.goto('/');
  await answer(page, 0);
  const first = await page.locator('#lives .life.fifth .life-end').innerText();
  await answer(page, 2);
  await expect(page.locator('#scenario [data-scn]').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lives .life.fifth .life-end')).not.toHaveText(first);
});

test('answers light up their parameters and survive a reload', async ({ page }) => {
  await page.goto('/');
  await answer(page);
  await expect(page.locator('#lab-progress')).toContainText('1/20');
  await page.reload();
  await expect(page.locator('#lab-progress')).toContainText('1/20');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(1);
});

test('the questions finish with a summary, one answer can be changed, and one button clears them all', async ({ page }) => {
  await page.goto('/');
  const box = page.locator('#scenario');
  while (await box.locator('[data-scn]').count()) {
    await answer(page);
    await box.locator('#scn-next').click();
  }
  await expect(box.locator('#scn-restart')).toHaveCount(0);
  await box.locator('[data-scn-goto]').nth(1).click();
  await expect(box).toContainText('第 2 /');
  await expect(box.locator('[data-scn]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.click('#lab-clear');
  await expect(box).toContainText('第 1 /');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
});

test('the questions stay the same when the years are redrawn, and the written life follows the new draw', async ({ page }) => {
  await page.goto('/');
  await answer(page);
  await page.click('#life-draw');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(1);
  await expect(page.locator('#scenario [data-scn]').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#scenario-sub')).toContainText('换一批年景');
});

test('answers can be carried into the professional view, by choice', async ({ page }) => {
  await page.goto('/');
  await answer(page);
  const say = await page.locator('#headline .say').innerText();
  await page.click('#to-pro');
  await expect(page.locator('#p-eqReal')).toHaveValue('5');
  await expect(page.locator('#views-banner')).toContainText('股票实际收益');
  await page.click('#views-apply');
  await expect(page.locator('#p-eqReal')).toHaveValue('3.5');
  await expect(page.locator('#views-banner')).toContainText('已带入');
  await expect(page.locator('#headline .say')).not.toHaveText(say);
});

test('the bad-year cut is a professional assumption', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-pro');
  await expect(page.locator('#p-flexCut')).toHaveValue('0');
  const before = await page.locator('#tiles').innerText();
  await page.fill('#p-flexCut', '30');
  await expect(page.locator('#tiles')).not.toHaveText(before);
});

test('the chart is coloured by year, marks bad years on the line, and has a line at the holiday', async ({ page }) => {
  await page.goto('/');
  const chart = page.locator('#lives-chart');
  await expect(chart.locator('.seg-work').first()).toBeAttached();
  await expect(chart.locator('.seg-holiday').first()).toBeAttached();
  await expect(chart.locator('.axis-cell')).toHaveCount(0);
  await expect(chart.locator('.bad-dot').first()).toBeAttached();
  await expect(chart).toContainText('40岁');
  await expect(chart.locator('#retire-line')).toBeAttached();
  await expect(chart).toContainText('上班');
  await expect(chart).toContainText('放假');
  const legend = page.locator('#lives-chart-legend');
  for (const text of ['上班', '放假有钱花', '钱花完', '大跌']) await expect(legend).toContainText(text);
});

test('a life that runs out shows it on the line', async ({ page }) => {
  await page.goto('/');
  await page.locator('#lives .life').nth(2).click();
  const chart = page.locator('#lives-chart');
  await expect(chart.locator('.seg-broke').first()).toBeAttached();
});

test('the written life is drawn against the life it rewrites', async ({ page }) => {
  await page.goto('/');
  await answer(page);
  await expect(page.locator('#lives-chart-legend')).toContainText('原计划');
  await expect(page.locator('#lives-chart .line-compare')).toHaveCount(1);
});

test('someone who cannot reach the goal has no holiday line', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '0');
  await page.fill('#s-income', '3000');
  await page.fill('#s-expense', '9000');
  await expect(page.locator('#lives-chart #retire-line')).toHaveCount(0);
  await expect(page.locator('#lives-chart .seg-work').first()).toBeAttached();
});
