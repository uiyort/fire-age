// Shareable cards: what they say (pure) and how they are drawn (canvas, local only, never uploaded).
import { money, toDisplay, wholeMoney, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';
const INK = '#14201b', INK_2 = '#48564f', PAPER = '#f4f8f5', ACCENT = '#136f52', RULE = '#cfdcd4';

const trimYears = y => String(Math.round(y * 10) / 10);

// Each type group stamps its passes its own way: a round seal, a square seal, a passport oval, a ticket punch.
const GROUP_STAMPS = {
  归园派: { shape: 'circle', ink: '#ff9a7a' },
  主场派: { shape: 'square', ink: '#f3e6c4' },
  漫游派: { shape: 'oval', ink: '#8fd0ff' },
  环球派: { shape: 'ticket', ink: '#d9a8ff' },
};

// One image, shaped like a boarding pass to the holiday. At most one extra line, the most personal available.
export function summaryCardSpec({ mode, type, hero, ribbons = [], monthlyText, enough, place, fifth, goal, lever, lit = { done: 0, total: 0 }, issued = '', years = [] }) {
  let big, sentence;
  if (mode === 'bwd') {
    big = `${hero.holidayAge} 岁`;
    sentence = enough ? '现在的存款已经够了' : `每月存 ${monthlyText} 就能到`;
  } else if (!hero.reachable) {
    big = '还在路上';
    sentence = '用杠杆一步步提前';
  } else {
    big = hero.workYears === 0 ? '现在' : `${hero.holidayAge} 岁`;
    // The line under the age belongs to the type, so two people's cards read differently.
    sentence = type.blurb;
  }
  // The stamp over the age, as at a gate: boarded, departed, waiting for a seat, or still boarding.
  let boarding = { main: '已登机', sub: 'BOARDED' };
  if (mode === 'bwd') { if (!enough) boarding = { main: '待登机', sub: 'BOARDING' }; }
  else if (!hero.reachable) boarding = { main: '候补中', sub: 'STANDBY' };
  else if (hero.workYears === 0) boarding = { main: '已起飞', sub: 'DEPARTED' };
  boarding = { ...boarding, code: type.code, ...(GROUP_STAMPS[type.group] ?? GROUP_STAMPS.归园派) };
  const dated = hero.reachable || mode === 'bwd';
  const barcode = ['FIRE AGE', type.code, ...(dated ? [hero.holidayAge] : [])].join(' · ');
  // The small print of a boarding pass, made from what the card already knows.
  const ticket = {
    flight: dated ? `FA${String(hero.holidayAge).padStart(3, '0')}` : 'FA---',
    cabin: type.axes[2]?.letter === 'F' ? '商务舱' : '经济舱',
    issued: issued ? issued.replace('-', '.') : '',
    route: dated ? `${hero.startAge} → ${hero.holidayAge} → ${hero.endAge}` : `${hero.startAge} → ? → ${hero.endAge}`,
  };
  // The departure field would repeat the big age, so it says how long the wait is instead.
  const departs = !dated ? null : hero.workYears === 0 ? '现在就走' : `再上 ${hero.workYears} 年班`;
  let note = null;
  if (fifth) {
    // A rewritten life is a changed ticket: the old value is struck out and the new one printed beside it.
    const m = fifth.main.match(/^(.*?)(\S+) → (.+)$/);
    note = { label: '你写的人生', tag: '已改签', main: fifth.main, detail: fifth.detail, change: m ? { prefix: m[1], was: m[2], now: m[3] } : null };
  }
  else if (goal) note = { label: '小目标达成', main: goal, detail: '' };
  else if (lever) note = { label: '你的杠杆', main: lever.action, detail: lever.unlockAge ? `就能在 ${lever.unlockAge} 岁放假` : `早 ${trimYears(lever.gain)} 年放假` };
  else if (place) note = { label: '同样的钱', main: `去${place.name}放假`, detail: `早 ${trimYears(place.gain)} 年` };
  return {
    kind: 'summary', size: [1080, 1440], brand: BRAND, searchHint: SEARCH_HINT,
    eyebrow: `${type.code} ${type.name}`, hero: big, sentence, stats: [],
    code: type.code, typeName: type.name, emoji: type.emoji, group: type.group,
    fields: type.axes.map((a, i) => ({ label: a.name, letter: a.letter, pole: a.pole, value: i === 0 && departs ? departs : a.value })),
    route: { startAge: hero.startAge, holidayAge: hero.holidayAge, endAge: hero.endAge, work: hero.workYears, holiday: hero.holidayYears },
    people: hero.people,
    mondays: hero.reachable ? hero.mondays : null,
    note,
    // A written life is shown beside only the life it rewrote: one before, one after.
    ribbons: ribbons.some(r => r.fifth) ? ribbons.filter(r => r.base || r.fifth) : ribbons,
    lit,
    boarding,
    barcode,
    lifeBars: lifeBars(years, hero.reachable || mode === 'bwd' ? hero.workYears : years.length),
    ticket,
    stampLabels: [`撑到 ${hero.endAge} 岁`, '还要上的周一', '点亮参数'],
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
const CHANGE_INK = '#c2412b';
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

  // Top: the pass itself, and who holds it.
  put(bold(30), CREAM_DIM, '放假通行证  HOLIDAY PASS', left, ty + 74);
  const namePx = fitFontSize(measureAt(display), spec.typeName, 300, 64, 40);
  put(display(namePx), CREAM, spec.typeName, right, ty + 156, 'right');
  ctx.font = `${Math.round(namePx * 0.9)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(spec.emoji, right - measureAt(display)(spec.typeName, namePx) - 14, ty + 152);
  ctx.textAlign = 'left';
  put(plain(28), CREAM_DIM, `${spec.group} · ${spec.code}`, right, ty + 200, 'right');

  // The age is the picture.
  const match = spec.hero.match(/^(\d+) 岁$/);
  const heroY = ty + 400;
  if (match) {
    put(display(330), SUN, match[1], left - 8, heroY);
    const numberW = measureAt(display)(match[1], 330);
    put(display(84), CREAM, '岁', left + numberW + 14, heroY);
  } else {
    put(display(fitFontSize(measureAt(display), spec.hero, inner - 400, 190, 80)), SUN, spec.hero, left, heroY - 40);
  }
  if (spec.boarding) drawBoarding(ctx, spec.boarding, right - 170, heroY - 55);

  const sentencePx = fitFontSize(measureAt(display), spec.sentence, inner, 50, 32);
  put(display(sentencePx), CREAM, spec.sentence, left, heroY + 92);

  // The four letters of the type are the ticket's fields: departure, destination, luggage and fare.
  const fieldTop = heroY + 150, fieldW = inner / spec.fields.length;
  spec.fields.forEach((f, i) => {
    const fx = left + i * fieldW;
    if (i) {
      ctx.strokeStyle = 'rgba(169, 196, 180, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx - 14, fieldTop - 26); ctx.lineTo(fx - 14, fieldTop + 92); ctx.stroke();
    }
    put(plain(22), CREAM_DIM, f.label, fx, fieldTop);
    put(display(48), SUN, f.letter, fx, fieldTop + 54);
    put(bold(fitFontSize(measureAt(bold), f.pole, fieldW - 70, 32, 24)), CREAM, f.pole, fx + measureAt(display)(f.letter, 48) + 10, fieldTop + 52);
    put(plain(fitFontSize(measureAt(plain), f.value, fieldW - 24, 22, 16)), CREAM_DIM, f.value, fx, fieldTop + 88);
  });

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
  // The big age already names the stop, and the departure field the work years: the route only adds the holiday's length.
  const labelY = routeY + 54;
  put(plain(26), CREAM_DIM, `${startAge} 岁`, left, labelY);
  put(plain(26), CREAM_DIM, `${endAge} 岁`, right, labelY, 'right');
  void holidayAge;
  if (holiday) put(bold(30), SUN, `放假 ${holiday} 年`, (stopX + right) / 2, routeY - 30, 'center');

  // The stub: three stamps.
  const stubTop = tear + 44, colW = inner / 3;
  spec.stampLabels.forEach((text, i) => put(plain(22), STUB_MUTED, text, left + colW * i, stubTop + 20));
  const stampBase = stubTop + 74;
  if (spec.people === null) {
    put(bold(34), STUB_INK, '还在攒', left, stampBase);
  } else {
    put(display(48), STUB_INK, `${spec.people}/10`, left, stampBase);
    for (let i = 0; i < 10; i++) drawPerson(ctx, left + i * 20, stampBase + 12, 26, i < spec.people ? DEEP : STUB_RULE);
  }
  if (spec.mondays === null) {
    put(bold(34), STUB_INK, '还没开始数', left + colW, stampBase);
  } else if (spec.mondays) {
    put(display(48), STUB_INK, spec.mondays.toLocaleString('zh-CN'), left + colW, stampBase);
    put(plain(22), STUB_MUTED, '个', left + colW + measureAt(display)(spec.mondays.toLocaleString('zh-CN'), 48) + 8, stampBase);
  } else {
    put(bold(34), STUB_INK, '不用再等', left + colW, stampBase);
  }
  put(display(48), STUB_INK, `${spec.lit.done}/${spec.lit.total}`, left + colW * 2, stampBase);
  const dots = Math.max(spec.lit.total, 1), dotGap = Math.min((colW - 14) / dots, 20);
  for (let i = 0; i < spec.lit.total; i++) {
    ctx.fillStyle = i < spec.lit.done ? SUN : STUB_RULE;
    ctx.beginPath();
    ctx.arc(left + colW * 2 + 6 + i * dotGap, stampBase + 26, Math.min(dotGap / 2 - 1, 6), 0, Math.PI * 2);
    ctx.fill();
  }

  // One line at most, then the lives as a barcode.
  // The note reads in three weights: a small label, the main line, a quiet detail.
  let noteY = stampBase + 108;
  if (spec.note) {
    let labelX = left;
    if (spec.note.tag) labelX += drawTag(ctx, spec.note.tag, left, stampBase + 90) + 14;
    put(plain(24), STUB_MUTED, spec.note.label, labelX, stampBase + 90);
    noteY = stampBase + 136;
    const ch = spec.note.change;
    let mainW;
    const changeW = ch && (measureAt(bold)(ch.prefix, 40) + measureAt(plain)(ch.was, 34) + 16 + measureAt(bold)(ch.now, 40));
    if (ch && changeW <= inner) {
      // Like a rebooked ticket: the old value struck out in grey, the new one in the stamp's ink.
      put(bold(40), STUB_INK, ch.prefix, left, noteY);
      let x = left + measureAt(bold)(ch.prefix, 40);
      const wasW = measureAt(plain)(ch.was, 34);
      put(plain(34), STUB_MUTED, ch.was, x, noteY);
      ctx.strokeStyle = CHANGE_INK;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 3, noteY - 12); ctx.lineTo(x + wasW + 3, noteY - 12); ctx.stroke();
      x += wasW + 16;
      put(bold(40), CHANGE_INK, ch.now, x, noteY);
      mainW = changeW;
    } else {
      const { px, lines } = noteLayout(measureAt(bold), spec.note.main, inner, 40, 28);
      lines.forEach((line, i) => put(bold(px), STUB_INK, line, left, noteY + i * px * 1.25));
      noteY += (lines.length - 1) * px * 1.25;
      mainW = measureAt(bold)(lines[lines.length - 1], px);
    }
    if (spec.note.detail) {
      // The detail sits after the main line when it fits, so the lives below keep their room.
      const detailW = measureAt(plain)(spec.note.detail, 26);
      if (mainW + 24 + detailW <= inner) put(plain(26), STUB_MUTED, spec.note.detail, left + mainW + 24, noteY);
      else { noteY += 38; put(plain(26), STUB_MUTED, spec.note.detail, left, noteY); }
    }
  }
  // The lives as thin lines on one age scale: one run per stretch, the person's own row in full colour.
  const hintY = ty + th - 44;
  const barsBottom = hintY - 116;
  const rows = spec.ribbons.length;
  // Each row gets the same pitch; the line and its name both fit inside it.
  const pitch = rows ? Math.min((barsBottom - noteY - 30) / rows, 40) : 0;
  const barH = Math.min(Math.max(pitch * 0.32, 5), 12), gap = pitch - barH;
  const maxCells = Math.max(1, ...spec.ribbons.map(r => r.cells.length));
  const labelW = 128, barLeft = left + labelW;
  const cellW = (inner - labelW) / maxCells;
  const labelPx = Math.min(Math.max(Math.floor(pitch - 6), 14), 22);
  const picked = spec.ribbons.some(r => r.fifth);
  spec.ribbons.forEach((ribbon, row) => {
    const y = barsBottom - (rows - row) * (barH + gap) + gap;
    put(ribbon.fifth ? bold(labelPx) : plain(labelPx), ribbon.fifth ? DEEP : STUB_MUTED, ribbon.label, left, y + barH / 2 + labelPx * 0.36);
    ctx.globalAlpha = picked && !ribbon.fifth ? 0.5 : 1;
    runsOf(ribbon.cells).forEach(({ state, from, to }) => {
      pill(ctx, barLeft + from * cellW, y, Math.max((to - from) * cellW - 4, 2), barH, CELL_COLORS[state]);
    });
    ctx.globalAlpha = 1;
  });
  put(bold(34), DEEP, spec.searchHint, left, hintY);
  // The foot of a boarding pass: flight, cabin and date in small print, the barcode, and the route under it.
  if (spec.barcode) {
    const mono = px => `600 ${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    const codeW = 420, codeX = right - codeW;
    const small = [['航班 FLIGHT', spec.ticket?.flight], ['舱位 CLASS', spec.ticket?.cabin], ['日期 DATE', spec.ticket?.issued]].filter(([, v]) => v);
    const cellW = codeW / Math.max(small.length, 1);
    small.forEach(([k, v], i) => {
      put(mono(14), STUB_MUTED, k, codeX + i * cellW, hintY - 84);
      put(bold(22), STUB_INK, v, codeX + i * cellW, hintY - 58);
    });
    const codeTop = hintY - 44, codeH = 34;
    if (spec.lifeBars?.length) {
      // A life barcode: one bar a year. Thin bars are work, thick bars holiday, the height is the median assets;
      // the first holiday year stands full height in gold.
      const pitch = codeW / spec.lifeBars.length;
      spec.lifeBars.forEach((bar, i) => {
        const w = bar.state === 'work' ? Math.max(pitch * 0.3, 1.5) : bar.state === 'holiday' ? Math.max(pitch * 0.62, 2.5) : 1;
        const h = bar.start ? codeH : 8 + bar.h * (codeH - 8);
        ctx.globalAlpha = bar.state === 'broke' ? 0.35 : 1;
        ctx.fillStyle = bar.start ? SUN : STUB_INK;
        ctx.fillRect(codeX + i * pitch, codeTop + codeH - h, w, h);
      });
      ctx.globalAlpha = 1;
      put(mono(15), STUB_MUTED, `${spec.code} · ${spec.ticket?.route ?? ''} · 一道一年，高低是资产`, right, hintY + 14, 'right');
    } else {
      ctx.fillStyle = STUB_INK;
      barcodeBars(spec.barcode, codeW).forEach(([x, w]) => ctx.fillRect(codeX + x, codeTop, w, codeH));
      put(mono(16), STUB_MUTED, `${spec.code} · ${spec.ticket?.route ?? ''}`, right, hintY + 14, 'right');
    }
  } else {
    put(plain(26), STUB_MUTED, spec.brand, right, hintY, 'right');
  }
}

// A small outlined tag in the change ink, its baseline on y; returns its width.
function drawTag(ctx, text, x, y) {
  ctx.font = `700 20px ${FONT}`;
  const w = ctx.measureText(text).width + 20, h = 30;
  ctx.strokeStyle = CHANGE_INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y - 22, w, h, 6); else ctx.rect(x, y - 22, w, h);
  ctx.stroke();
  ctx.fillStyle = CHANGE_INK;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 10, y);
  return w;
}

// The outline of a stamp, centred on 0,0: a round seal, a square seal, a passport oval or a punched ticket.
function stampPath(ctx, shape, inset) {
  ctx.beginPath();
  if (shape === 'circle') { ctx.arc(0, 0, 100 - inset, 0, Math.PI * 2); return; }
  if (shape === 'oval') { ctx.ellipse(0, 0, 160 - inset, 92 - inset, 0, 0, Math.PI * 2); return; }
  const w = (shape === 'square' ? 196 : 300) - inset * 2, h = (shape === 'square' ? 196 : 150) - inset * 2;
  if (shape === 'square') { ctx.rect(-w / 2, -h / 2, w, h); return; }
  // A ticket: rectangle with a bite out of each corner.
  const r = 18 - inset / 2, x = -w / 2, y = -h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arc(x + w, y, r, Math.PI, Math.PI / 2, true);
  ctx.lineTo(x + w, y + h - r); ctx.arc(x + w, y + h, r, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(x + r, y + h); ctx.arc(x, y + h, r, 0, -Math.PI / 2, true);
  ctx.lineTo(x, y + r); ctx.arc(x, y, r, Math.PI / 2, 0, true);
  ctx.closePath();
}

const STAMP_TILT = { circle: -0.12, square: 0.08, oval: -0.2, ticket: -0.15 };

// A rubber stamp in the type group's shape and ink: the type code on top, the word, and its English under it.
function drawBoarding(ctx, { main, sub, code = '', shape = 'ticket', ink = '#ff8a6b' }, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(STAMP_TILT[shape] ?? -0.15);
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  stampPath(ctx, shape, 0);
  ctx.stroke();
  ctx.lineWidth = 2;
  stampPath(ctx, shape, 11);
  ctx.stroke();
  if (code) {
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = `800 20px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.fillText(code.split('').join(' '), 0, shape === 'circle' || shape === 'square' ? -42 : -46);
  }
  const compact = shape === 'circle' || shape === 'square';
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = `900 ${compact ? 50 : 56}px ${SERIF}`;
  ctx.fillText(main, 0, compact ? 22 : 20);
  ctx.font = `800 ${compact ? 17 : 22}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillText(compact ? sub : sub.split('').join(' '), 0, compact ? 50 : 52);
  ctx.restore();
  ctx.textAlign = 'left';
}

// One bar per year of the plan: its state, and its height as a share of the largest assets on the way.
export function lifeBars(years, workYears) {
  const top = Math.max(...years, 0);
  const firstHoliday = years.findIndex((a, t) => t >= workYears && a > 0);
  return years.map((assets, t) => ({
    state: t < workYears ? 'work' : assets > 0 ? 'holiday' : 'broke',
    h: top > 0 ? Math.round(assets / top * 1000) / 1000 : 0,
    ...(t === firstHoliday ? { start: true } : {}),
  }));
}

// Bars from the pass number, so the same pass always draws the same code: [x, width] pairs.
export function barcodeBars(text, width) {
  let seed = 2166136261;
  for (const ch of text) seed = Math.imul(seed ^ ch.codePointAt(0), 16777619) >>> 0;
  const next = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed = (seed ^ (seed >>> 13)) >>> 0; return seed % 4; };
  const bars = [];
  let x = 0;
  while (true) {
    const w = 2 + next(), gap = 2 + next();
    if (x + w > width) break;
    bars.push([x, w]);
    x += w + gap;
  }
  return bars;
}

// Consecutive cells of one state, as one stretch each.
function runsOf(cells) {
  const runs = [];
  cells.forEach((state, i) => {
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.to = i + 1;
    else runs.push({ state, from: i, to: i + 1 });
  });
  return runs;
}

function pill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  if (typeof ctx.roundRect !== 'function') { ctx.fillRect(x, y, w, h); return; }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(h / 2, w / 2));
  ctx.fill();
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
