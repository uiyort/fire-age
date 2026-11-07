import { test, expect } from '@playwright/test';

const collect = async page => {
  const events = [];
  await page.route('**/api/e', route => {
    events.push(JSON.parse(route.request().postData()));
    return route.fulfill({ status: 204 });
  });
  return events;
};

test('a visit is counted with its channel and carries no input values', async ({ page }) => {
  const events = await collect(page);
  await page.goto('/?ch=db1');
  await expect.poll(() => events.map(e => e.e)).toContain('visit');
  expect(events[0].c).toBe('db1');
  expect(Object.keys(events[0]).sort()).toEqual(['c', 'e', 'v']);
});

test('calc_done fires once, only after the person changes something', async ({ page }) => {
  const events = await collect(page);
  await page.goto('/');
  await page.waitForTimeout(400);
  expect(events.filter(e => e.e === 'calc_done')).toHaveLength(0);
  await page.fill('#s-age', '35');
  await page.fill('#s-age', '36');
  await expect.poll(() => events.filter(e => e.e === 'calc_done').length).toBe(1);
  await page.waitForTimeout(300);
  expect(events.filter(e => e.e === 'calc_done')).toHaveLength(1);
});

test('the main interactions are each recorded', async ({ page }) => {
  const events = await collect(page);
  await page.goto('/');
  await page.click('#to-bwd');
  await page.click('#help-age');
  await page.click('#share-btn');
  await page.click('#to-pro');
  await page.click('#export-json');
  for (const name of ['mode_switch', 'card_open', 'card_generate', 'export_data']) {
    await expect.poll(() => events.map(e => e.e)).toContain(name);
  }
});

test('an open learning card is counted once and stays open while typing', async ({ page }) => {
  const events = await collect(page);
  await page.goto('/');
  await page.locator('#cards summary').first().click();
  await expect.poll(() => events.filter(e => e.e === 'card_open').length).toBe(1);
  await page.fill('#s-age', '35');
  await page.waitForTimeout(300);
  expect(events.filter(e => e.e === 'card_open')).toHaveLength(1);
  await expect(page.locator('#cards details').first()).toHaveAttribute('open', '');
});

test('a failing analytics endpoint leaves the page working', async ({ page }) => {
  await page.route('**/api/e', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#headline')).toContainText('岁');
});

test('analytics sets no cookies', async ({ page, context }) => {
  await collect(page);
  await page.goto('/');
  expect(await context.cookies()).toEqual([]);
});
