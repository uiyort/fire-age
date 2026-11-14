// Draws the 1200×630 preview image that link previews show (site/og.png). Run by hand after a change of name or slogan:
// node scripts/og-image.mjs
import { chromium } from '@playwright/test';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; background: #136f52; color: #f6f1e3; font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif; }
  .box { box-sizing: border-box; height: 100%; padding: 84px 96px; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { font-family: "SimSun", "Songti SC", "Noto Serif CJK SC", serif; font-size: 112px; font-weight: 700; letter-spacing: 6px; line-height: 1; }
  .brand span { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: 48px; letter-spacing: 1px; opacity: .7; margin-left: 20px; }
  .q { font-size: 56px; font-weight: 700; margin-top: 40px; }
  .points { font-size: 32px; opacity: .85; }
  .foot { display: flex; justify-content: space-between; align-items: end; font-size: 30px; opacity: .75; }
</style></head><body><div class="box">
  <div><div class="brand">放假年龄<span>FIRE Age</span></div><div class="q">你几岁能开始放假？</div></div>
  <div class="foot"><div class="points">财务自由 · 提前退休计算器<br>免费 · 不用注册 · 公式公开</div><div>fire-age.com</div></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: 'site/og.png' });
await browser.close();
console.log('site/og.png written');
