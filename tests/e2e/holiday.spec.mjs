import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('the result shows Mondays left and a holiday type with a stated reason', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tiles')).toContainText('个周一');
  await expect(page.locator('#type-now .type-code')).toHaveText(/^[EL][HA][TF][SG]$/);
  await expect(page.locator('#type-now .axis')).toHaveCount(4);
  await page.locator('#type-all summary').click();
  await expect(page.locator('#type-all .type-cell')).toHaveCount(16);
  await expect(page.locator('#type-all .type-cell.mine')).toHaveCount(1);
});

test('a lever shows its gain in Mondays', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#levers .gain').first()).toContainText('个周一');
});

test('the place ranking lists every country, updates with inputs and produces a card', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#places .place');
  await expect(rows).toHaveCount(11);
  await expect(page.locator('#places .place.current')).toHaveCount(1);
  await expect(page.locator('#places-card')).toContainText('签证');
  const before = await page.locator('#places').innerText();
  await page.fill('#s-assets', '2000000');
  await expect(page.locator('#places')).not.toHaveText(before);
  await page.click('#place-card');
  await expect(page.locator('#share-img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('#places-card #share-panel')).toBeVisible();
  await expect(page.locator('#share-panel')).toBeInViewport();
});

test('drawing lives shows four, switching tells another story, drawing again changes them', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#lives .life')).toHaveCount(0);
  await page.click('#life-draw');
  await expect(page.locator('#lives .life')).toHaveCount(4);
  await expect(page.locator('#lives .life[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#life-story li').first()).toBeVisible();
  const seed = await page.locator('#life-seed').innerText();
  const story = await page.locator('#life-story').innerText();
  await page.locator('#lives .life').nth(1).click();
  await expect(page.locator('#lives .life').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#life-story')).not.toHaveText(story);
  await page.click('#life-draw');
  await expect(page.locator('#life-seed')).not.toHaveText(seed);
});

test('drawn lives follow the inputs and can become a card', async ({ page }) => {
  await page.goto('/');
  await page.click('#life-draw');
  const story = await page.locator('#life-story').innerText();
  await page.fill('#s-assets', '3000000');
  await expect(page.locator('#life-story')).not.toHaveText(story);
  await page.click('#life-card');
  await expect(page.locator('#life-section #share-panel')).toBeVisible();
  expect(await page.locator('#share-img').getAttribute('alt')).not.toContain('NaN');
});

test('someone who cannot reach the goal sees complete, upbeat new sections', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '0');
  await page.fill('#s-income', '3000');
  await page.fill('#s-expense', '9000');
  await page.click('#life-draw');
  await page.click('#place-card');
  for (const id of ['#tiles', '#type-now', '#places', '#lives', '#life-story']) {
    await expect(page.locator(id)).not.toContainText(/NaN|undefined|null/);
  }
  await expect(page.locator('#tiles')).not.toContainText('个周一');
});

test('the page stays within a phone screen with the new sections open', async ({ page }) => {
  await page.goto('/');
  await page.click('#life-draw');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('changing the destination changes the type, and the type card appears beside it', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#type-now .type-code').innerText();
  await page.selectOption('#s-ret', 'TH');
  await expect(page.locator('#type-now .type-code')).not.toHaveText(before);
  await page.click('#type-card-btn');
  await expect(page.locator('#type-section #share-panel')).toBeVisible();
});

test('a card disappears when the numbers change, so it is never out of date', async ({ page }) => {
  await page.goto('/');
  await page.click('#place-card');
  await expect(page.locator('#share-panel')).toBeVisible();
  await page.fill('#s-assets', '900000');
  await expect(page.locator('#share-panel')).toBeHidden();
});

test('a card can be closed', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  await page.click('#share-close');
  await expect(page.locator('#share-panel')).toBeHidden();
});

test('the quiz asks, reveals with real numbers, scores and offers a card', async ({ page }) => {
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
  await page.click('#quiz-card');
  await expect(page.locator('#lab-section #share-panel')).toBeVisible();
  await page.click('#quiz-restart');
  await expect(quiz).toContainText('第 1 /');
});

test('a slider shows the effect without touching the real plan', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#headline .say').innerText();
  const assets = await page.locator('#s-assets').inputValue();
  const details = page.locator('#cards details[data-id="expense"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('60000');
  await expect(details.locator('output')).toContainText('岁');
  await expect(details.locator('output')).toContainText('→');
  expect(await page.locator('#headline .say').innerText()).toBe(before);
  expect(await page.locator('#s-assets').inputValue()).toBe(assets);
});

test('a risk slider shows the success rate', async ({ page }) => {
  await page.goto('/');
  const details = page.locator('#cards details[data-id="sigEq"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('0.3');
  await expect(details.locator('output')).toContainText('成功率');
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
