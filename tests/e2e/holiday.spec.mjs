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
  await expect(page.locator('#life-legend')).toContainText('钱花完');
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

test('the fifth life waits until the lab has rewritten something', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#life-fifth-empty')).toContainText('第五条人生');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
});

test('a quiz answer writes the fifth life, shown against the hardest life', async ({ page }) => {
  await page.goto('/');
  await page.locator('#quiz [data-quiz]').first().click();
  await expect(page.locator('#quiz .quiz-reveal')).toContainText('第五条人生');
  const fifth = page.locator('#lives .life.fifth');
  await expect(fifth).toHaveCount(1);
  await expect(fifth).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#life-story .fifth-compare')).toContainText('同样的年景');
  await expect(page.locator('#life-changes')).toContainText('已写入');
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

test('the quiz finishes with a score and can restart', async ({ page }) => {
  await page.goto('/');
  const quiz = page.locator('#quiz');
  await expect(quiz).toContainText('第 1 /');
  await expect(quiz.locator('.quiz-reveal')).toHaveCount(0);
  await quiz.locator('[data-quiz]').first().click();
  await expect(quiz.locator('.quiz-reveal')).toContainText('年');
  while (await quiz.locator('#quiz-next').count()) {
    await quiz.locator('#quiz-next').click();
    if (await quiz.locator('[data-quiz]').count()) await quiz.locator('[data-quiz]').first().click();
  }
  await expect(quiz).toContainText('猜对');
  await page.click('#quiz-restart');
  await expect(quiz).toContainText('第 1 /');
});

test('moving a slider lights up that parameter, and progress survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#lab-progress')).toContainText('0/19');
  const details = page.locator('#cards details[data-id="assets"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('900000');
  await expect(page.locator('#lab-progress')).toContainText('1/19');
  await expect(details).toHaveClass(/played/);
  await page.reload();
  await expect(page.locator('#lab-progress')).toContainText('1/19');
  await expect(page.locator('#cards details[data-id="assets"]')).toHaveClass(/played/);
});

test('parameters are grouped under headings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#cards h4')).toHaveCount(4);
  await expect(page.locator('#cards details')).toHaveCount(19);
});

test('the page stays within a phone screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#quiz [data-quiz]').first().click();
  await page.click('#share-btn');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the chart names its lines, and the fifth life is drawn against the life it rewrites', async ({ page }) => {
  await page.goto('/');
  const legend = page.locator('#lives-chart-legend');
  await expect(legend).toContainText('选中');
  await expect(legend).not.toContainText('第五条');
  await page.locator('#quiz [data-quiz]').first().click();
  await expect(legend).toContainText('第五条');
  await expect(page.locator('#lives-chart path[stroke="var(--s1)"]')).toHaveCount(1);
  await expect(page.locator('#lives-chart path[stroke="var(--s2)"]')).toHaveCount(1);
});
