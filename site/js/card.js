// Shareable cards: what they say (pure) and how they are drawn (canvas, local only, never uploaded).
import { money, toDisplay, wholeMoney, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';
const INK = '#14201b', INK_2 = '#48564f', PAPER = '#f4f8f5', ACCENT = '#136f52', RULE = '#cfdcd4';

const trimYears = y => String(Math.round(y * 10) / 10);

export function toCardInput(result) {
  const { mode, p, t, bwd, mc, dispCur } = result;
  if (mode === 'bwd') {
    return {
      mode, targetAge: p.tAge, enough: bwd.s0 <= 0, success: mc?.success ?? null,
      monthlyText: wholeMoney(toDisplay(Math.max(bwd.s0, 0) / 12, p, dispCur), dispCur),
    };
  }
  return {
    mode, age: p.age, years: t, retireAge: t === null ? null : p.age + t, success: t === null ? null : mc?.success ?? null,
    needText: t === null ? '' : money(toDisplay(result.target[t], p, dispCur), dispCur),
  };
}

export function resultCardSpec(input) {
  const base = { kind: 'result', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [] };
  const successStat = input.success === null || input.success === undefined ? [] : [{ label: '计划成功率', value: pct(input.success, 0) }];
  if (input.mode === 'bwd') {
    const sentence = input.enough
      ? `想 ${input.targetAge} 岁放假，现在的存款已经够了`
      : `想 ${input.targetAge} 岁放假，每月需存 ${input.monthlyText}`;
    return { ...base, hero: `${input.targetAge} 岁`, sentence, stats: successStat, comment: `${sentence}。你的放假年龄是多少？` };
  }
  if (input.years === null) {
    return {
      ...base, hero: '还在路上', sentence: '还没到放假那天，用杠杆一步步提前',
      comment: '我还在努力凑放假年龄，正在用杠杆一点点提前。你的呢？',
    };
  }
  const stats = [...successStat, { label: '放假所需资产', value: input.needText }];
  if (input.years === 0) {
    return { ...base, hero: '现在', sentence: '从今天起，余生皆假期', stats, comment: '我的放假年龄就是现在。你的呢？' };
  }
  const successText = successStat.length ? `，成功率 ${successStat[0].value}` : '';
  return {
    ...base, hero: `${input.retireAge} 岁`, sentence: `从 ${input.retireAge} 岁起，余生皆假期`,
    stats: [{ label: '再坚持', value: `${input.years} 年` }, ...stats],
    comment: `我的放假年龄是 ${input.retireAge} 岁${successText}。你的呢？`,
  };
}

export function goalCardSpec(goal, comparison) {
  const gained = comparison.yearsDelta !== null && comparison.yearsDelta > 0.05;
  const sentence = gained ? `${goal.label}，放假年龄提前了 ${trimYears(comparison.yearsDelta)} 年` : `${goal.label}，小目标达成`;
  return {
    kind: 'goal', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [],
    hero: gained ? `提前 ${trimYears(comparison.yearsDelta)} 年` : '达成',
    sentence,
    comment: `我的小目标达成了：${sentence}。你的放假年龄是多少？`,
  };
}

export function fitFontSize(measure, text, maxWidth, startPx, minPx) {
  let px = startPx;
  while (px > minPx && measure(text, px) > maxWidth) px -= 2;
  return Math.max(px, minPx);
}

export function wrapText(measure, text, maxWidth) {
  const out = [];
  let line = '';
  for (const ch of text) {
    if (line && measure(line + ch) > maxWidth) {
      out.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) out.push(line);
  return out;
}

export function renderCard(spec, canvas) {
  const [W, H] = spec.size;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const margin = 80, inner = W - margin * 2;
  const measureAt = family => (text, px) => { ctx.font = family(px); return ctx.measureText(text).width; };
  const bold = px => `700 ${px}px ${FONT}`;
  const plain = px => `400 ${px}px ${FONT}`;
  const display = px => `900 ${px}px ${SERIF}`;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 16);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = INK_2;
  ctx.font = bold(fitFontSize(measureAt(bold), spec.brand, inner, 40, 24));
  ctx.fillText(spec.brand, margin, 110);

  if (spec.eyebrow) {
    ctx.fillStyle = ACCENT;
    ctx.font = bold(fitFontSize(measureAt(bold), spec.eyebrow, inner, 40, 24));
    ctx.fillText(spec.eyebrow, margin, 190);
  }

  const heroPx = fitFontSize(measureAt(display), spec.hero, inner, Math.round(H * 0.2), 48);
  const heroY = spec.eyebrow ? 190 + heroPx * 1.05 : Math.round(H * 0.16) + heroPx;
  ctx.fillStyle = ACCENT;
  ctx.font = display(heroPx);
  ctx.fillText(spec.hero, margin, heroY);

  const sentencePx = 60;
  let y = heroY + 110;
  ctx.fillStyle = INK;
  for (const line of wrapText(t => measureAt(display)(t, sentencePx), spec.sentence, inner)) {
    ctx.font = display(sentencePx);
    ctx.fillText(line, margin, y);
    y += sentencePx * 1.35;
  }

  for (const paragraph of spec.lines ?? []) {
    y += 16;
    ctx.fillStyle = INK_2;
    for (const line of wrapText(t => measureAt(plain)(t, 42), paragraph, inner)) {
      ctx.font = plain(42);
      ctx.fillText(line, margin, y);
      y += 42 * 1.45;
    }
  }

  const footerY = H - 90;
  if (spec.stats.length) {
    const statY = footerY - 190;
    const colW = inner / spec.stats.length;
    ctx.fillStyle = RULE;
    ctx.fillRect(margin, statY - 60, inner, 2);
    spec.stats.forEach((s, i) => {
      const x = margin + colW * i;
      ctx.fillStyle = INK_2;
      ctx.font = plain(fitFontSize(measureAt(plain), s.label, colW - 20, 34, 20));
      ctx.fillText(s.label, x, statY);
      ctx.fillStyle = INK;
      ctx.font = bold(fitFontSize(measureAt(bold), s.value, colW - 20, 60, 22));
      ctx.fillText(s.value, x, statY + 76);
    });
  }
  ctx.fillStyle = ACCENT;
  ctx.font = bold(36);
  ctx.fillText(spec.searchHint, margin, footerY);
}

export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(fallbackEl);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return 'selected';
  }
}
