// Shareable cards: what they say (pure) and how they are drawn (canvas, local only, never uploaded).
import { money, toDisplay, wholeMoney, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';
const INK = '#14201b', INK_2 = '#48564f', PAPER = '#f4f8f5', ACCENT = '#136f52', RULE = '#cfdcd4';

const trimYears = y => String(Math.round(y * 10) / 10);

// One image that gathers the whole result. Only what the person has actually done appears on it.
export function summaryCardSpec({ mode, type, hero, ribbons = [], monthlyText, enough, place, fifth, quiz, goal }) {
  let big, sentence;
  if (mode === 'bwd') {
    big = `${hero.holidayAge} 岁`;
    sentence = enough ? `想 ${hero.holidayAge} 岁放假，现在的存款已经够了` : `想 ${hero.holidayAge} 岁放假，每月需存 ${monthlyText}`;
  } else if (!hero.reachable) {
    big = '还在路上';
    sentence = '还没到放假那天，用杠杆一步步提前';
  } else if (hero.workYears === 0) {
    big = '现在';
    sentence = '从今天起，余生皆假期';
  } else {
    big = `${hero.holidayAge} 岁`;
    sentence = `从 ${hero.holidayAge} 岁起，余生皆假期`;
  }
  const lines = [];
  if (hero.mondays) lines.push(`还有 ${hero.mondays.toLocaleString('zh-CN')} 个周一就放假`);
  if (place) lines.push(`同样的钱去${place.name}，早 ${trimYears(place.gain)} 年`);
  if (fifth) lines.push(`第五条人生：${fifth}`);
  if (quiz) lines.push(`放假实验室猜对 ${quiz.score}/${quiz.total}：${quiz.title}`);
  if (goal) lines.push(`小目标达成：${goal}`);
  return {
    kind: 'summary', size: [1080, 1440], brand: BRAND, searchHint: SEARCH_HINT,
    eyebrow: `${type.emoji} ${type.code} ${type.name} · ${type.group}`,
    hero: big, sentence, lines, stats: [],
    lifeBar: { work: hero.workYears, holiday: hero.holidayYears, startAge: hero.startAge, endAge: hero.endAge },
    people: hero.people,
    peopleText: hero.people === null ? '' : `10 个平行的你，约 ${hero.people} 个的钱够花到 ${hero.endAge} 岁`,
    ribbons,
  };
}

export function typeCardSpec(type) {
  return {
    kind: 'type', size: [1080, 1080], brand: BRAND, searchHint: SEARCH_HINT,
    eyebrow: `我的放假类型 ${type.code} · ${type.group}`, hero: `${type.emoji} ${type.name}`, sentence: type.blurb,
    stats: type.axes.map(axis => ({ label: `${axis.name} ${axis.letter}`, value: axis.pole })),
  };
}

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

const HOLIDAY_GREEN = '#1d7a3a', WORK_GREY = '#c4d0c9', BROKE_RED = '#c0352f';
const CELL_COLORS = { work: WORK_GREY, holiday: HOLIDAY_GREEN, broke: BROKE_RED };

function drawPerson(ctx, x, y, size, on) {
  const unit = size / 28;
  ctx.fillStyle = on ? ACCENT : RULE;
  ctx.beginPath();
  ctx.arc(x + 10 * unit, y + 6 * unit, 5 * unit, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 2 * unit, y + 27 * unit);
  ctx.quadraticCurveTo(x + 2 * unit, y + 14 * unit, x + 10 * unit, y + 14 * unit);
  ctx.quadraticCurveTo(x + 18 * unit, y + 14 * unit, x + 18 * unit, y + 27 * unit);
  ctx.closePath();
  ctx.fill();
}

function renderSummary(spec, canvas) {
  const [W, H] = spec.size;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const margin = 80, inner = W - margin * 2;
  const measureAt = family => (text, px) => { ctx.font = family(px); return ctx.measureText(text).width; };
  const bold = px => `700 ${px}px ${FONT}`;
  const plain = px => `400 ${px}px ${FONT}`;
  const display = px => `900 ${px}px ${SERIF}`;
  const put = (font, color, text, x, y) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(text, x, y); };

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 16);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  put(bold(36), INK_2, spec.brand, margin, 96);
  put(bold(fitFontSize(measureAt(bold), spec.eyebrow, inner, 44, 26)), ACCENT, spec.eyebrow, margin, 166);

  const heroPx = fitFontSize(measureAt(display), spec.hero, inner, 190, 48);
  put(display(heroPx), ACCENT, spec.hero, margin, 180 + heroPx);
  let y = 180 + heroPx + 84;
  const sentencePx = fitFontSize(measureAt(display), spec.sentence, inner, 56, 34);
  put(display(sentencePx), INK, spec.sentence, margin, y);
  y += 52;

  // Life bar: the conclusion, drawn.
  const { work, holiday, startAge, endAge } = spec.lifeBar;
  const barH = 44, workW = inner * work / (work + holiday);
  ctx.fillStyle = WORK_GREY;
  ctx.fillRect(margin, y, workW, barH);
  ctx.fillStyle = HOLIDAY_GREEN;
  ctx.fillRect(margin + workW, y, inner - workW, barH);
  y += barH + 40;
  put(plain(30), INK_2, `${startAge} 岁`, margin, y);
  const label = holiday ? (work ? `上班 ${work} 年，放假 ${holiday} 年` : `放假 ${holiday} 年`) : `上班 ${work} 年`;
  ctx.textAlign = 'center';
  put(bold(34), INK, label, W / 2, y);
  ctx.textAlign = 'right';
  put(plain(30), INK_2, `${endAge} 岁`, W - margin, y);
  ctx.textAlign = 'left';
  y += 34;

  if (spec.people !== null) {
    const size = 60, gap = 16;
    for (let i = 0; i < 10; i++) drawPerson(ctx, margin + i * (size * 20 / 28 + gap), y, size, i < spec.people);
    y += size + 44;
    put(bold(fitFontSize(measureAt(bold), spec.peopleText, inner, 34, 24)), INK, spec.peopleText, margin, y);
    y += 20;
  }

  const ribbonTop = H - 96 - 44 - spec.ribbons.length * 46;
  const linePx = fitLines(measureAt(plain), spec.lines, inner, ribbonTop - y - 16, 36, 24);
  for (const paragraph of spec.lines) {
    y += LINE_GAP;
    for (const line of wrapText(t => measureAt(plain)(t, linePx), paragraph, inner)) {
      y += linePx;
      put(plain(linePx), INK_2, line, margin, y);
      y += linePx * (LINE_HEIGHT - 1);
    }
  }

  // Ribbons: each drawn life as a strip of years.
  let ry = ribbonTop;
  const nameW = 200;
  const maxCells = Math.max(1, ...spec.ribbons.map(r => r.cells.length));
  for (const ribbon of spec.ribbons) {
    put(plain(fitFontSize(measureAt(plain), ribbon.label, nameW - 12, 28, 18)), INK_2, ribbon.label, margin, ry + 26);
    const cell = (inner - nameW) / maxCells;
    ribbon.cells.forEach((state, i) => {
      ctx.fillStyle = CELL_COLORS[state];
      ctx.fillRect(margin + nameW + i * cell, ry, Math.max(cell - 1, 1), 32);
    });
    ry += 46;
  }
  put(bold(36), ACCENT, spec.searchHint, margin, H - 60);
}

export function renderCard(spec, canvas) {
  if (spec.kind === 'summary') {
    renderSummary(spec, canvas);
    return;
  }
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
