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

test('the one card opens beside its button, stays open and follows the numbers', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  await expect(page.locator('#share-section #share-panel')).toBeVisible();
  await expect(page.locator('#share-panel')).toBeInViewport();
  await expect(page.locator('#share-close')).toHaveCount(0);
  const before = await page.locator('#share-img').getAttribute('src');
  await page.fill('#s-assets', '900000');
  await expect(page.locator('#share-panel')).toBeVisible();
  await expect.poll(() => page.locator('#share-img').getAttribute('src')).not.toBe(before);
});

test('once the card is made, its button gives way to two matching next steps', async ({ page }) => {
  await page.goto('/');
  await page.click('#share-btn');
  await expect(page.locator('#share-btn')).toBeHidden();
  const save = await page.locator('#share-save').boundingBox();
  const pro = await page.locator('#pro-enter').boundingBox();
  expect(Math.abs(save.height - pro.height)).toBeLessThan(1);
  expect(Math.abs(save.width - pro.width)).toBeLessThan(2);
  await expect(page.locator('#share-section h2')).toHaveText('你的放假卡');
});

test('on a phone the card has a save button that hands the picture to the phone', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__saved = files[0].name; };
  });
  await page.goto('/');
  await page.click('#share-btn');
  await expect(page.locator('#share-save')).toBeVisible();
  await expect(page.locator('#share-save')).toHaveText('保存图片');
  await page.click('#share-save');
  await expect.poll(() => page.evaluate(() => window.__saved)).toBe('fire-age.png');
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
  await expect(page.locator('#lab-clear')).toHaveCount(0);
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

test('the questions finish with a summary, and one answer can be changed from it', async ({ page }) => {
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
  await expect(page.locator('#lab-clear')).toHaveCount(0);
});

test('working backward, the written life takes the holiday at the age asked for', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-bwd');
  await page.fill('#s-tage', '45');
  await page.waitForTimeout(400);
  await answer(page);
  const work = await page.locator('#lives .life').first().locator('.r-work').count();
  expect(work).toBe(15);
  await expect(page.locator('#lives .life.fifth .r-work')).toHaveCount(work);
});

test('no two drawn lives share a name, and the hardest is marked', async ({ page }) => {
  await page.goto('/');
  const names = await page.locator('#lives .life .life-name').allInnerTexts();
  expect(new Set(names).size).toBe(names.length);
  await expect(page.locator('#lives .life', { hasText: '最难' })).toHaveCount(1);
});

async function crowdServer(page) {
  const posted = [];
  await page.route('**/api/views', async route => {
    if (route.request().method() === 'POST') {
      posted.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    }
    const counts = Object.fromEntries(['market', 'crash', 'nerve', 'prices', 'rates', 'wages'].map(id => [id, [20, 50, 30]]));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 100, counts }) });
  });
  return posted;
}

async function finishViews(page) {
  const box = page.locator('#scenario');
  while (await box.locator('[data-scn]').count()) {
    if (!(await box.locator('#scn-next').count())) await answer(page);
    await box.locator('#scn-next').click();
  }
  return box;
}

test('the questions say up front that finished answers are counted anonymously', async ({ page }) => {
  const posted = await crowdServer(page);
  await page.goto('/');
  await expect(page.locator('#scenario-sub')).toContainText('匿名计入');
  await answer(page);
  expect(posted).toHaveLength(0);
});

test('finished answers are counted at once, compared with everyone, and counted only once', async ({ page }) => {
  const posted = await crowdServer(page);
  await page.goto('/');
  let box = await finishViews(page);
  await expect(box.locator('.crowd-share').first()).toContainText('20% 也这么看');
  await expect(box).toContainText('100 人');
  await expect(box).toContainText('不记录');
  await expect(box.locator('#crowd-join')).toHaveCount(0);
  expect(posted).toHaveLength(1);
  expect(Object.keys(posted[0])).toEqual(['a']);
  await page.reload();
  box = await finishViews(page);
  await expect(box.locator('.crowd-share').first()).toBeVisible();
  expect(posted).toHaveLength(1);
});

test('when the count cannot be reached, it can be tried again', async ({ page }) => {
  let fail = true;
  await page.route('**/api/views', route => (fail ? route.fulfill({ status: 503 }) : route.fulfill({ status: route.request().method() === 'POST' ? 204 : 200, contentType: 'application/json', body: JSON.stringify({ total: 3, counts: {} }) })));
  await page.goto('/');
  const box = await finishViews(page);
  await expect(box).toContainText('稍后');
  fail = false;
  await box.locator('#crowd-join').click();
  await expect(box).toContainText('3 人');
});

test('working backward, a shorter plan in the written life does not break the section', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.click('#to-bwd');
  await page.fill('#s-tage', '80');
  await page.waitForTimeout(400);
  const details = page.locator('#cards details[data-id="life"]');
  await details.locator('summary').click();
  await details.locator('input[type=range]').fill('79');
  await expect(page.locator('#lives .life.fifth')).toHaveCount(1);
  await expect(page.locator('#scenario [data-scn]')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('working backward, the type and the saving sliders follow the asked-for age', async ({ page }) => {
  await page.goto('/');
  await page.click('#to-bwd');
  await page.fill('#s-tage', '45');
  await page.waitForTimeout(400);
  await expect(page.locator('#type-section')).toContainText('45 岁放假');
  const details = page.locator('#cards details[data-id="income"]');
  await details.locator('summary').click();
  await expect(details.locator('output')).toContainText('只是试算');
  await details.locator('input[type=range]').fill(await details.locator('input[type=range]').getAttribute('max'));
  await expect(page.locator('#lives .life.fifth')).toHaveCount(0);
});

test('broken stored answers are dropped instead of breaking the section', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fire-age-views-v1', JSON.stringify({ market: 9, crash: 1, gone: 1, nerve: 'x' })));
  await page.goto('/');
  await expect(page.locator('#scenario [data-scn]')).toHaveCount(3);
  await expect(page.locator('#lives .life.fifth')).toHaveCount(1);
});

test('finishing twice while the first count is still on its way counts once', async ({ page }) => {
  const posted = [];
  await page.route('**/api/views', async route => {
    if (route.request().method() === 'POST') {
      posted.push(1);
      await new Promise(r => setTimeout(r, 800));
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 1, counts: {} }) });
  });
  await page.goto('/');
  const box = await finishViews(page);
  await box.locator('[data-scn-goto]').last().click();
  await box.locator('#scn-next').click();
  await expect(box).toContainText('1 人');
  expect(posted).toHaveLength(1);
});

test('every life row names its holiday luck', async ({ page }) => {
  await page.goto('/');
  for (const row of await page.locator('#lives .life').all()) {
    await expect(row.locator('.life-sub')).toContainText('整个假期');
    await expect(row.locator('.life-sub')).toContainText('大跌');
  }
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
