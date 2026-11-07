// Shareable cards: what they say (pure) and how they are drawn (canvas, local only, never uploaded).
import { money, toDisplay, wholeMoney, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';
const INK = '#14201b', INK_2 = '#48564f', PAPER = '#f4f8f5', ACCENT = '#136f52', RULE = '#cfdcd4';

const trimYears = y => String(Math.round(y * 10) / 10);

// One image, shaped like a boarding pass to the holiday. At most one extra line, the most personal available.
export function summaryCardSpec({ mode, type, hero, ribbons = [], monthlyText, enough, place, fifth, goal, lit = { done: 0, total: 0 } }) {
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
  let note = '';
  if (fifth) note = `等你来写：${fifth}`;
  else if (place) note = `同样的钱去${place.name}，早 ${trimYears(place.gain)} 年`;
  else if (goal) note = `小目标达成：${goal}`;
  return {
    kind: 'summary', size: [1080, 1440], brand: BRAND, searchHint: SEARCH_HINT,
    eyebrow: `${type.code} ${type.name}`, hero: big, sentence, stats: [],
    code: type.code, typeName: type.name, emoji: type.emoji, group: type.group,
    route: { startAge: hero.startAge, holidayAge: hero.holidayAge, endAge: hero.endAge, work: hero.workYears, holiday: hero.holidayYears },
    people: hero.people,
    mondays: hero.reachable ? hero.mondays : null,
    lit,
    note,
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
// One short line at full size, or up to two lines, shrinking no smaller than minPx.
export function noteLayout(measure, text, maxWidth, startPx = 34, minPx = 22) {
  for (let px = startPx; px >= minPx; px -= 2) {
    const lines = wrapText(t => measure(t, px), text, maxWidth);
    if (lines.length <= 2) return { px, lines };
  }
  return { px: minPx, lines: wrapText(t => measure(t, minPx), text, maxWidth).slice(0, 2) };
}

export function fitLines(measure, paragraphs, maxWidth, available, startPx = 42, minPx = 26) {
  const heightAt = px => paragraphs.reduce((sum, text) => sum + LINE_GAP + wrapText(t => measure(t, px), text, maxWidth).length * px * LINE_HEIGHT, 0);
  let px = startPx;
  while (px > minPx && heightAt(px) > available) px -= 2;
  return px;
}

const DEEP = '#0d4a38', DEEP_2 = '#0a3a2c', CREAM = '#f6f1e3', CREAM_DIM = '#a9c4b4', SUN = '#f2b544';
const STUB_INK = '#14201b', STUB_MUTED = '#6a7871', STUB_RULE = '#d9d3c1';
const CELL_COLORS = { work: '#c9c4b4', holiday: '#1d7a3a', broke: '#c0352f' };

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, h, colour) {
  const unit = h / 28;
  ctx.fillStyle = colour;
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
  const measureAt = family => (text, px) => { ctx.font = family(px); return ctx.measureText(text).width; };
  const bold = px => `700 ${px}px ${FONT}`;
  const plain = px => `400 ${px}px ${FONT}`;
  const display = px => `900 ${px}px ${SERIF}`;
  const put = (font, colour, text, x, y, align = 'left') => { ctx.font = font; ctx.fillStyle = colour; ctx.textAlign = align; ctx.fillText(text, x, y); ctx.textAlign = 'left'; };
  ctx.textBaseline = 'alphabetic';

  // The ticket on a dark table, with a deep green top and a cream stub.
  const tx = 44, ty = 44, tw = W - 88, th = H - 88, tear = 884, radius = 36, notch = 30;
  ctx.fillStyle = DEEP_2;
  ctx.fillRect(0, 0, W, H);
  roundedRect(ctx, tx, ty, tw, th, radius);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = DEEP;
  ctx.fillRect(tx, ty, tw, tear - ty);
  ctx.fillStyle = CREAM;
  ctx.fillRect(tx, tear, tw, ty + th - tear);
  ctx.restore();
  ctx.fillStyle = DEEP_2;
  for (const cx of [tx, tx + tw]) { ctx.beginPath(); ctx.arc(cx, tear, notch, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = CREAM_DIM;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 14]);
  ctx.beginPath(); ctx.moveTo(tx + notch + 16, tear); ctx.lineTo(tx + tw - notch - 16, tear); ctx.stroke();
  ctx.setLineDash([]);

  const left = tx + 60, right = tx + tw - 60, inner = right - left;

  // Top: the pass itself.
  put(bold(30), CREAM_DIM, '放假通行证  HOLIDAY PASS', left, ty + 74);
  put(bold(46), CREAM, spec.code.split('').join(' '), right, ty + 76, 'right');

  // The age is the picture.
  const match = spec.hero.match(/^(\d+) 岁$/);
  const heroY = ty + 400;
  if (match) {
    put(display(330), SUN, match[1], left - 8, heroY);
    const numberW = measureAt(display)(match[1], 330);
    put(display(84), CREAM, '岁', left + numberW + 14, heroY);
  } else {
    put(display(fitFontSize(measureAt(display), spec.hero, inner - 240, 190, 80)), SUN, spec.hero, left, heroY - 40);
  }

  // The type, like a stamp in the corner.
  const stampX = right - 110, stampY = ty + 240;
  ctx.strokeStyle = CREAM_DIM;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(stampX, stampY, 104, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '96px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = CREAM;
  ctx.fillText(spec.emoji, stampX, stampY + 34);
  ctx.textAlign = 'left';
  put(display(fitFontSize(measureAt(display), spec.typeName, 280, 46, 28)), CREAM, spec.typeName, stampX, stampY + 150, 'center');
  put(plain(28), CREAM_DIM, spec.group, stampX, stampY + 190, 'center');

  const sentencePx = fitFontSize(measureAt(display), spec.sentence, inner, 58, 34);
  put(display(sentencePx), CREAM, spec.sentence, left, heroY + 96);

  // The route: today, through work, to the holiday.
  const { startAge, holidayAge, endAge, work, holiday } = spec.route;
  const routeY = tear - 116, total = work + holiday;
  const stopX = left + inner * work / total;
  ctx.lineCap = 'round';
  if (work) {
    ctx.strokeStyle = CREAM_DIM;
    ctx.lineWidth = 8;
    ctx.setLineDash([2, 18]);
    ctx.beginPath(); ctx.moveTo(left, routeY); ctx.lineTo(stopX, routeY); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (holiday) {
    ctx.strokeStyle = SUN;
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(stopX, routeY); ctx.lineTo(right, routeY); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  const stop = (x, colour) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, routeY, 15, 0, Math.PI * 2); ctx.fill(); };
  stop(left, CREAM);
  if (holiday && work) stop(stopX, SUN);
  stop(right, holiday ? SUN : CREAM_DIM);
  const labelY = routeY + 58;
  put(bold(32), CREAM, `${startAge} 岁`, left, labelY);
  put(bold(32), CREAM, `${endAge} 岁`, right, labelY, 'right');
  if (holiday && work) {
    const midX = Math.min(Math.max(stopX, left + 170), right - 190);
    put(bold(32), SUN, `${holidayAge} 岁`, midX, labelY, 'center');
  }
  const legX = work ? left : stopX;
  if (work && stopX - left > 150) put(plain(28), CREAM_DIM, `上班 ${work} 年`, left + (stopX - left) / 2, routeY - 28, 'center');
  if (holiday) put(bold(30), SUN, `放假 ${holiday} 年`, (stopX + right) / 2, routeY - 30, 'center');
  void legX;

  // The stub: three stamps.
  const stubTop = tear + 44, colW = inner / 3;
  const label = (text, i) => put(plain(26), STUB_MUTED, text, left + colW * i, stubTop + 24);
  label('平行的你', 0);
  label('还有周一', 1);
  label('点亮参数', 2);
  const stampBase = stubTop + 92;
  if (spec.people === null) {
    put(bold(40), STUB_INK, '还在攒', left, stampBase);
  } else {
    put(display(64), STUB_INK, `${spec.people}/10`, left, stampBase);
    for (let i = 0; i < 10; i++) drawPerson(ctx, left + i * 25, stampBase + 16, 34, i < spec.people ? DEEP : STUB_RULE);
  }
  if (spec.mondays === null) {
    put(bold(40), STUB_INK, '还没开始数', left + colW, stampBase);
  } else if (spec.mondays) {
    put(display(64), STUB_INK, spec.mondays.toLocaleString('zh-CN'), left + colW, stampBase);
    put(plain(26), STUB_MUTED, '个', left + colW + measureAt(display)(spec.mondays.toLocaleString('zh-CN'), 64) + 10, stampBase);
  } else {
    put(bold(40), STUB_INK, '不用再等', left + colW, stampBase);
  }
  put(display(64), STUB_INK, `${spec.lit.done}/${spec.lit.total}`, left + colW * 2, stampBase);
  const dots = Math.max(spec.lit.total, 1), dotGap = Math.min((colW - 14) / dots, 26);
  for (let i = 0; i < spec.lit.total; i++) {
    ctx.fillStyle = i < spec.lit.done ? SUN : STUB_RULE;
    ctx.beginPath();
    ctx.arc(left + colW * 2 + 8 + i * dotGap, stampBase + 32, Math.min(dotGap / 2 - 1, 8), 0, Math.PI * 2);
    ctx.fill();
  }

  // One line at most, then the lives as a barcode.
  let noteY = stampBase + 108;
  if (spec.note) {
    const { px, lines } = noteLayout(measureAt(bold), spec.note, inner);
    lines.forEach((line, i) => put(bold(px), STUB_INK, line, left, noteY + i * px * 1.3));
    noteY += (lines.length - 1) * px * 1.3;
  }
  const hintY = ty + th - 44;
  const barsBottom = hintY - 54;
  const rows = spec.ribbons.length;
  const gap = 5, barH = rows ? Math.min((barsBottom - noteY - 18 - gap * (rows - 1)) / rows, 22) : 0;
  const maxCells = Math.max(1, ...spec.ribbons.map(r => r.cells.length));
  const cellW = inner / maxCells;
  spec.ribbons.forEach((ribbon, row) => {
    const y = barsBottom - (rows - row) * (barH + gap) + gap;
    ribbon.cells.forEach((state, i) => {
      ctx.fillStyle = CELL_COLORS[state];
      ctx.fillRect(left + i * cellW, y, Math.max(cellW - 2, 1), barH);
    });
  });
  put(bold(36), DEEP, spec.searchHint, left, hintY);
  put(plain(26), STUB_MUTED, spec.brand, right, hintY, 'right');
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
