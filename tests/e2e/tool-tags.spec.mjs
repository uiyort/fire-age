// Every 本工具设定 is a button that opens its own explanation.
import { test, expect } from '@playwright/test';

const SITUATIONS = [
  '#age=30&assets=200000&income=12000&expense=6000',
  '#age=35&assets=1800000&income=6000&expense=6000&pension=2000&tage=35&mode=bwd',
  '#age=30&assets=0&income=6000&expense=6500',
];

for (const view of ['simple', 'pro']) {
  for (const hash of SITUATIONS) {
    test(`${view} view ${hash}: each 本工具设定 is a button with an explanation`, async ({ page }) => {
      await page.goto('/' + hash);
      if (view === 'pro') await page.click('#to-pro');
      await expect(page.locator('#headline')).not.toBeEmpty();
      const toggle = page.locator('.ledger-toggle:visible').first();
      if (await toggle.count()) await toggle.click();
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      const tags = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter(el => el.children.length === 0 && el.textContent.trim() === '本工具设定')
        .map(el => ({ tag: el.tagName, cls: el.className, why: el.dataset.why ?? '' })));
      expect(tags.length).toBeGreaterThan(0);
      for (const t of tags) {
        expect(t.tag).toBe('BUTTON');
        expect(t.cls).toBe('tool');
        expect(t.why.length).toBeGreaterThan(10);
      }
    });
  }
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tag opens its explanation under it, inside the screen, and closes again', async ({ page }) => {
    await page.goto('/#age=30&assets=200000&income=12000&expense=6000');
    await page.locator('.ledger-toggle:visible').first().click();
    const tag = page.locator('#ledger button.tool').first();
    const pop = page.locator('#tool-pop');
    await expect(pop).toBeHidden();
    await tag.click();
    await expect(pop).toBeVisible();
    await expect(pop).toContainText('比物价多涨 2%');
    await expect(tag).toHaveAttribute('aria-expanded', 'true');
    const box = await pop.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(390 - 16 + 1);
    // Again on the tag closes it; Escape and a click elsewhere close it too.
    await tag.click();
    await expect(pop).toBeHidden();
    await expect(tag).toHaveAttribute('aria-expanded', 'false');
    await tag.click();
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await tag.click();
    await page.locator('#headline').click();
    await expect(pop).toBeHidden();
  });

  test('the address bar showing or hiding (a height change) keeps the explanation open', async ({ page }) => {
    await page.goto('/#age=30&assets=200000&income=12000&expense=6000');
    await page.locator('.ledger-toggle:visible').first().click();
    await page.locator('#ledger button.tool').first().click();
    await page.setViewportSize({ width: 390, height: 760 });
    await expect(page.locator('#tool-pop')).toBeVisible();
    await page.setViewportSize({ width: 600, height: 760 });
    await expect(page.locator('#tool-pop')).toBeHidden();
  });

  test('another tag replaces the first explanation', async ({ page }) => {
    await page.goto('/#age=30&assets=200000&income=12000&expense=6000');
    await page.locator('.ledger-toggle:visible').first().click();
    const tags = page.locator('#ledger button.tool');
    await tags.nth(0).click();
    const first = await page.locator('#tool-pop').innerText();
    // The explanation covers what sits right under the tag, so the next tag tried is further down.
    await tags.last().click();
    await expect(page.locator('#tool-pop')).not.toHaveText(first);
    await expect(tags.nth(0)).toHaveAttribute('aria-expanded', 'false');
  });
});
