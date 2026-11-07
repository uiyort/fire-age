import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('the result shows Mondays left and a holiday type with a stated reason', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tiles')).toContainText('个周一');
  await expect(page.locator('#type-now')).toContainText('型');
  await expect(page.locator('#type-now .why')).not.toBeEmpty();
  await page.locator('#type-all summary').click();
  await expect(page.locator('#type-all li')).toHaveCount(9);
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
  await expect(page.locator('#share-comment')).toContainText('你想去哪');
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
  await expect(page.locator('#share-comment')).toContainText('你抽到');
  await expect(page.locator('#share-comment')).not.toContainText('NaN');
});

test('someone who cannot reach the goal sees complete, upbeat new sections', async ({ page }) => {
  await page.goto('/');
  await page.fill('#s-assets', '0');
  await page.fill('#s-income', '3000');
  await page.fill('#s-expense', '9000');
  await page.click('#life-draw');
  await page.click('#place-card');
  for (const id of ['#tiles', '#type-now', '#places', '#lives', '#life-story', '#share-comment']) {
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
