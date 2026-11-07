// Shareable cards: what they say (pure) and how they are drawn (canvas, local only, never uploaded).
import { money, toDisplay, wholeMoney, pct } from './views.js';
import { mondaysIn } from './holiday.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';
const INK = '#14201b', INK_2 = '#48564f', PAPER = '#f4f8f5', ACCENT = '#136f52', RULE = '#cfdcd4';

const trimYears = y => String(Math.round(y * 10) / 10);

export function toCardInput(result) {
  const { mode, p, t, bwd, mc, dispCur } = result;
  const typeName = result.type ? `${result.type.code} ${result.type.name}` : undefined;
  if (mode === 'bwd') {
    return {
      typeName, mondays: mondaysIn(bwd.n), mode, targetAge: p.tAge, enough: bwd.s0 <= 0, success: mc?.success ?? null,
      monthlyText: wholeMoney(toDisplay(Math.max(bwd.s0, 0) / 12, p, dispCur), dispCur),
    };
  }
  return {
    typeName, mondays: t === null ? 0 : mondaysIn(t), mode, age: p.age, years: t, retireAge: t === null ? null : p.age + t, success: t === null ? null : mc?.success ?? null,
    needText: t === null ? '' : money(toDisplay(result.target[t], p, dispCur), dispCur),
  };
}

export function resultCardSpec(input) {
  const base = { kind: 'result', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [], ...(input.typeName ? { eyebrow: input.typeName } : {}) };
  const mondays = input.mondays ? input.mondays.toLocaleString('zh-CN') : null;
  const successStat = input.success === null || input.success === undefined ? [] : [{ label: '计划成功率', value: pct(input.success, 0) }];
  if (input.mode === 'bwd') {
    const sentence = input.enough
      ? `想 ${input.targetAge} 岁放假，现在的存款已经够了`
      : `想 ${input.targetAge} 岁放假，每月需存 ${input.monthlyText}`;
    const lines = mondays ? [`离放假还有 ${mondays} 个周一`] : [];
    return { ...base, hero: `${input.targetAge} 岁`, sentence, lines, stats: successStat };
  }
  if (input.years === null) return { ...base, hero: '还在路上', sentence: '还没到放假那天，用杠杆一步步提前' };
  const stats = [...successStat, { label: '放假所需资产', value: input.needText }];
  if (input.years === 0) return { ...base, hero: '现在', sentence: '从今天起，余生皆假期', stats };
  return {
    ...base, hero: `${input.retireAge} 岁`, sentence: `从 ${input.retireAge} 岁起，余生皆假期`,
    stats: [{ label: '再坚持', value: `${input.years} 年` }, ...stats],
    ...(mondays ? { lines: [`还有 ${mondays} 个周一就放假`] } : {}),
  };
}

export function typeCardSpec(type) {
  return {
    kind: 'type', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT,
    eyebrow: `我的放假类型 ${type.code} · ${type.group}`, hero: `${type.emoji} ${type.name}`, sentence: type.blurb,
    stats: type.axes.map(axis => ({ label: `${axis.name} ${axis.letter}`, value: axis.pole })),
  };
}

export const quizCardSpec = ({ score, total, title }) => ({
  kind: 'quiz', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [],
  eyebrow: '放假实验室', hero: `${score}/${total}`, sentence: `猜中 ${score} 题，我是${title}`,
  lines: ['用自己的数字猜：哪件事最能提前放假？'],
});

const PLACE_LINES = 4;

export function placeCardSpec(rows) {
  const current = rows.find(r => r.current);
  const best = rows[0];
  const base = { kind: 'place', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [], eyebrow: '同样的钱，换个地方放假' };
  const ageText = r => (r.age === null ? '还到不了' : `${r.age} 岁`);
  const top = rows.slice(0, PLACE_LINES);
  const shown = current && !top.includes(current) ? [...top.slice(0, -1), current] : top;
  const lines = [...shown.map(r => `${r.name}：${ageText(r)}`), '按物价水平估算，没算签证、税和医疗。'];
  if (best.age === null) return { ...base, hero: '还在路上', sentence: '先把储蓄变成正数', lines };
  const gain = current?.years == null ? null : current.years - best.years;
  if (gain === null) return { ...base, hero: `${best.age} 岁`, sentence: `选${best.name}才看得到放假那天`, lines };
  if (gain < 0.05) return { ...base, hero: `${current.age} 岁`, sentence: `你选的${current.name}已经是最早的`, lines };
  return { ...base, hero: `早 ${trimYears(gain)} 年`, sentence: `选${best.name}比选${current.name}早放假`, lines };
}

export const toLifeCardInput = (story, result) => ({
  ...story,
  endText: money(toDisplay(story.endAssets, result.p, result.dispCur), result.dispCur),
  success: result.mc?.success ?? null,
  paths: result.mc?.paths ?? 0,
});

export function lifeCardSpec(life) {
  const base = { kind: 'life', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [], eyebrow: '我抽到的一条人生' };
  const successStat = life.success === null ? [] : [{ label: '计划成功率', value: pct(life.success, 0) }];
  if (life.outcome === 'working') return { ...base, hero: '还在攒', sentence: '这条人生里还没放假，先把杠杆用起来', stats: successStat };
  const stats = [{ label: '放假年龄', value: `${life.retireAge} 岁` }, ...successStat];
  if (life.outcome === 'ruined') return { ...base, hero: `${life.ruinAge} 岁花完`, sentence: '放假后钱没撑住，这个计划还要调整', stats };
  const hit = life.worst && life.worst.ret < 0;
  const sentence = hit ? `${life.worst.age} 岁那年亏了 ${Math.round(-life.worst.ret * 100)}%，还是撑住了` : '一路没有亏损的年份，运气不错';
  return { ...base, hero: `撑到 ${life.endAge} 岁`, sentence, stats: [...stats, { label: '最后还剩', value: life.endText }] };
}

export function goalCardSpec(goal, comparison) {
  const gained = comparison.yearsDelta !== null && comparison.yearsDelta > 0.05;
  const sentence = gained ? `${goal.label}，放假年龄提前了 ${trimYears(comparison.yearsDelta)} 年` : `${goal.label}，小目标达成`;
  return {
    kind: 'goal', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT, stats: [],
    hero: gained ? `提前 ${trimYears(comparison.yearsDelta)} 年` : '达成',
    sentence,
  };
}

export function fitFontSize(measure, text, maxWidth, startPx, minPx) {
  let px = startPx;
  while (px > minPx && measure(text, px) > maxWidth) px -= 2;
  return Math.max(px, minPx);
}

const NO_LINE_START = '。，、；：？！）》”’%';

export function wrapText(measure, text, maxWidth) {
  const out = [];
  let line = '';
  for (const ch of text) {
    if (line && measure(line + ch) > maxWidth) {
      // Closing punctuation may not start a line, so it takes the previous character down with it.
      const chars = [...line];
      const carry = NO_LINE_START.includes(ch) && chars.length > 1 ? chars.pop() : '';
      out.push(chars.join(''));
      line = carry + ch;
    } else {
      line += ch;
    }
  }
  if (line) out.push(line);
  return out;
}

const LINE_GAP = 16;
const LINE_HEIGHT = 1.45;

// The largest font size at which the extra lines fit the space above the footer.
export function fitLines(measure, paragraphs, maxWidth, available, startPx = 42, minPx = 26) {
  const heightAt = px => paragraphs.reduce((sum, text) => sum + LINE_GAP + wrapText(t => measure(t, px), text, maxWidth).length * px * LINE_HEIGHT, 0);
  let px = startPx;
  while (px > minPx && heightAt(px) > available) px -= 2;
  return px;
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

  const footerY = H - 90;
  const statY = footerY - 190;
  const lines = spec.lines ?? [];
  const linePx = fitLines(measureAt(plain), lines, inner, (spec.stats.length ? statY - 90 : footerY - 40) - y);
  for (const paragraph of lines) {
    y += LINE_GAP;
    ctx.fillStyle = INK_2;
    for (const line of wrapText(t => measureAt(plain)(t, linePx), paragraph, inner)) {
      ctx.font = plain(linePx);
      ctx.fillText(line, margin, y);
      y += linePx * LINE_HEIGHT;
    }
  }

  if (spec.stats.length) {
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
