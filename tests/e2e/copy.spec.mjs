// The mechanical rules of docs/copy-framework.md, checked on the text a reader actually sees, in both views and in
// the situations that change the wording. The rules that need a reader are reviewed by hand.
import { test, expect } from '@playwright/test';

const SITUATIONS = {
  forward: '#age=30&assets=200000&income=12000&expense=6000',
  'saving nothing': '#age=35&assets=1800000&income=6000&expense=6000',
  'already there': '#age=40&assets=8000000&income=12000&expense=6000',
  'out of reach': '#age=30&assets=0&income=6000&expense=6500',
  'backward later': '#age=30&assets=200000&income=12000&expense=6000&tage=45&mode=bwd',
  'backward today': '#age=35&assets=1800000&income=6000&expense=6000&pension=2000&tage=35&mode=bwd',
  abroad: '#age=32&assets=600000&income=30000&expense=12000&retire=MY',
};

// A label and its value may be joined by a colon: a short name at the start of the line (rule 9).
const LABEL = /^[^，。；：、]{1,10}：/;
// Slashes are allowed in units and fractions only (rule 10).
const UNIT_SLASH = /\/\s*(月|年|人)|\d\s*\/\s*\d|https?:\/\/|\w\/ /g;

// Reference pages (L4) may open a list, a formula or a definition with a colon, so there only the colon check is off.
function problemsIn(text, { reference = false } = {}) {
  const found = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const sentence = /[。，；]/.test(line);
    const body = line.replace(LABEL, '');
    if (!reference && sentence && /：/.test(body)) found.push(`colon: ${line}`);
    if (/\S\s*\/\s*\S/.test(line.replace(UNIT_SLASH, ''))) found.push(`slash: ${line}`);
    if (sentence && /→/.test(line)) found.push(`arrow: ${line}`);
    // Measured odds are digits (4 成); the named standards keep their numeral (八成把握, 五成 / 九成 on the ruler).
    if (/[一二三四六七]成/.test(line)) found.push(`numeral: ${line}`);
  }
  return found;
}

for (const view of ['simple', 'pro']) {
  for (const [name, hash] of Object.entries(SITUATIONS)) {
    test(`${view} view, ${name}: no colon, slash or arrow inside a sentence`, async ({ page }) => {
      await page.goto('/' + hash);
      if (view === 'pro') await page.click('#to-pro');
      await expect(page.locator('#headline')).not.toBeEmpty();
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      const text = await page.locator('main').innerText();
      expect(problemsIn(text)).toEqual([]);
    });
  }
}

for (const path of ['method.html', 'sources.html']) {
  test(`${path}: no colon, slash or arrow inside a sentence`, async ({ page }) => {
    await page.goto('/' + path);
    expect(problemsIn(await page.locator('main').innerText(), { reference: true })).toEqual([]);
  });
}
