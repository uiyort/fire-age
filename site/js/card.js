// Shareable cards: what they say (pure) and how they are drawn (canvas, local only, never uploaded).
import { money, toDisplay, wholeMoney, pct } from './views.js';

const BRAND = '放假年龄 / FIRE Age';
const SEARCH_HINT = '搜：放假年龄';
const METHOD_NOTE = '按本工具假设模拟，方法见网页『计算方法』';
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

// The assumptions a number on the card rests on, in three short items. A pension, and self-paid insurance, change the third.
export function assumptionLine({ r, pension, selfPay = 0 }) {
  const left = !(pension > 0) ? '未算养老金 / 社保自缴' : selfPay > 0 ? '含养老金和社保自缴' : '含养老金 · 未算社保自缴';
  return `按今天的钱算 · 实际收益 ${pct(r, 1)}/年 · ${left}`;
}

// One image, shaped like a boarding pass to the holiday. At most one extra line, the most personal available.
// By default it carries no money: amounts and the saved share appear only when the person turns them on, and the
// line with today's age can be turned off, together with everything else that gives the age away.
export function summaryCardSpec({ mode, type, hero, monthlyText, enough, place, fifth, goal, lever, issued = '', years = [], odds = '', privacy = { money: false, now: true }, assumptions = '', search = true, example = false }) {
  const money = Boolean(privacy?.money), showNow = privacy?.now !== false;
  let big, sentence;
  if (mode === 'bwd') {
    big = `${hero.holidayAge} 岁`;
    sentence = !money ? type.blurb : enough ? '现在的存款已经够了' : `每月存 ${monthlyText}，就有八成把握`;
  } else if (!hero.reachable) {
    big = '还在路上';
    sentence = '一步步提前';
  } else {
    big = hero.workYears === 0 ? '现在' : `${hero.holidayAge} 岁`;
    // The line under the age belongs to the type, so two people's cards read differently.
    sentence = type.blurb;
  }
  // The stamp beside the age is the group's seal. A boarding status here read as "already retired", so the seal
  // carries who the person is, not how far the plan has got.
  const boarding = { main: type.group, sub: 'FIRE AGE', ...(GROUP_STAMPS[type.group] ?? GROUP_STAMPS.归园派) };
  const dated = hero.reachable || mode === 'bwd';
  // Under the age, where the person stands today, so the big number is not read as their current age.
  let now = `现在 ${hero.startAge} 岁，`;
  if (mode === 'bwd') now += enough ? '存款已经够了' : `再上 ${hero.workYears} 年班`;
  else if (!hero.reachable) now += '规划期内还到不了';
  else now += hero.workYears === 0 ? '已经可以放假' : `再上 ${hero.workYears} 年班`;
  if (!showNow) now = '';
  const barcode = ['FIRE AGE', ...(dated ? [hero.holidayAge] : [])].join(' · ');
  // The small print of a boarding pass, made from what the card already knows.
  const ticket = {
    flight: dated ? `FA${String(hero.holidayAge).padStart(3, '0')}` : 'FA---',
    issued: issued ? issued.replace('-', '.') : '',
    route: !showNow ? '' : !dated ? `${hero.startAge} → ? → ${hero.endAge}` : hero.workYears === 0 ? `${hero.startAge} → ${hero.endAge}` : `${hero.startAge} → ${hero.holidayAge} → ${hero.endAge}`,
  };
  // The departure field would repeat the big age, so it states the rule that made the letter.
  const departs = !dated ? '规划期内还到不了' : type.axes[0]?.letter === 'E' ? '50 岁前' : '50 岁后';
  let note = null;
  // With money off, a note told in money gives way to the next one.
  if (fifth?.amount && !money) fifth = null;
  const goalText = goal && typeof goal === 'object' ? (money ? goal.label : goal.plain ?? goal.label) : goal;
  if (fifth) {
    // A rewritten life is a changed ticket: the old value is struck out and the new one printed beside it.
    const m = fifth.main.match(/^(.*?)(\S+) → (.+)$/);
    note = { label: '你写的人生', tag: '已改签', main: fifth.main, detail: fifth.detail, change: m ? { prefix: m[1], was: m[2], now: m[3] } : null };
  }
  else if (goalText) note = { label: '小目标达成', main: goalText, detail: '' };
  else if (lever) note = { label: '提前的办法', main: money || !lever.plain ? lever.action : lever.plain, detail: lever.unlockAge ? `就能在 ${lever.unlockAge} 岁放假` : `早 ${trimYears(lever.gain)} 年放假` };
  else if (place) note = { label: '同样的钱', main: `去${place.name}放假`, detail: `早 ${trimYears(place.gain)} 年` };
  return {
    kind: 'summary', size: [1080, 1440], brand: BRAND, searchHint: search ? SEARCH_HINT : '', now, odds,
    eyebrow: `${type.name} · ${type.group}`, hero: big, sentence, stats: [],
    typeName: type.name, emoji: type.emoji, group: type.group,
    // Only the words of each axis: the numbers behind them are on the page.
    fields: type.axes.map(a => ({ label: a.name, letter: a.letter, pole: a.pole })),
    departs,
    // With the age hidden, the route's stop sits at a fixed place: its share of the line would give the work years.
    route: { startAge: hero.startAge, startLabel: showNow ? `${hero.startAge} 岁` : '今天', holidayAge: hero.holidayAge, endAge: hero.endAge, work: hero.workYears, holiday: hero.holidayYears, ...(showNow ? {} : { fixedStop: true }) },
    people: hero.people,
    // Mondays left are the work years in other words, so they go with the age.
    mondays: hero.reachable && showNow ? hero.mondays : null,
    months: hero.months ?? null,
    covered: Boolean(hero.covered),
    note,
    boarding,
    barcode,
    // A bar a year from today gives the age away, so with the age hidden the code is drawn from the pass number.
    lifeBars: showNow ? lifeBars(years, hero.reachable || mode === 'bwd' ? hero.workYears : years.length) : [],
    ticket,
    stubKeys: ['people', ...(showNow ? ['mondays'] : []), 'months', ...(money ? ['fund'] : [])],
    stampLabels: ['10 个平行的你', ...(showNow ? ['还要上的周一'] : []), '攒够的假', ...(money ? ['已攒到'] : [])],
    example,
    ...(money ? { fund: hero.fund?.share ?? 0 } : {}),
    assumptions: assumptions ? `${assumptions}。${METHOD_NOTE}` : '',
  };
}

// The type alone, with no number on it: for people who would share who they are but not where they stand.
export function typeCardSpec(type, { search = true } = {}) {
  return {
    kind: 'type', size: [1080, 1440], brand: BRAND, searchHint: search ? SEARCH_HINT : '',
    // The emoji sits in the small line: drawn at the size of the name, it crowded the sentence below.
    eyebrow: `${type.emoji} 我的放假类型 · ${type.group}`, hero: type.name, sentence: type.blurb, weakness: type.weakness,
    stats: type.axes.map(axis => ({ label: axis.name, value: axis.pole })),
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
  if (life.outcome === 'working') return { ...base, hero: '还在攒', sentence: '这条人生里还没放假，先看提前的办法', stats: successStat };
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
  const mono = px => `600 ${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  const put = (font, colour, text, x, y, align = 'left') => { ctx.font = font; ctx.fillStyle = colour; ctx.textAlign = align; ctx.fillText(text, x, y); ctx.textAlign = 'left'; };
  ctx.textBaseline = 'alphabetic';

  // The ticket on a dark table, with a deep green top and a cream stub.
  const tx = 44, ty = 44, tw = W - 88, th = H - 88, tear = 860, radius = 36, notch = 30;
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

  // Top: the name people search for, then who holds the pass. "Holiday pass" stays in the stub's small print.
  put(bold(40), CREAM, '放假年龄', left, ty + 78);
  put(bold(28), CREAM_DIM, 'FIRE Age', left + measureAt(bold)('放假年龄', 40) + 16, ty + 78);
  // The holder's name, as on a pass: a small label, then the name. The code is left to the stamp and the four fields.
  put(mono(16), CREAM_DIM, spec.example ? '算例 · 假设人物' : '旅客 PASSENGER', right, ty + 56, 'right');
  // Name and group read as a name and its school: "采菊人 · 归园派".
  const groupText = spec.group ? ` · ${spec.group}` : '';
  const groupW = groupText ? measureAt(bold)(groupText, 30) : 0;
  if (groupText) put(bold(30), CREAM_DIM, groupText, right, ty + 122, 'right');
  const namePx = fitFontSize(measureAt(display), spec.typeName, 300, 60, 40);
  const nameRight = right - groupW;
  put(display(namePx), CREAM, spec.typeName, nameRight, ty + 122, 'right');
  ctx.font = `${Math.round(namePx * 0.85)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(spec.emoji, nameRight - measureAt(display)(spec.typeName, namePx) - 12, ty + 118);
  ctx.textAlign = 'left';

  // The age is the picture.
  const match = spec.hero.match(/^(\d+) 岁$/);
  const heroY = ty + 380;
  if (match) {
    put(display(300), SUN, match[1], left - 8, heroY);
    const numberW = measureAt(display)(match[1], 300);
    put(display(80), CREAM, '岁', left + numberW + 14, heroY);
  } else {
    put(display(fitFontSize(measureAt(display), spec.hero, inner - 400, 190, 80)), SUN, spec.hero, left, heroY - 40);
  }
  if (spec.boarding) drawBoarding(ctx, spec.boarding, right - 170, heroY - 70);
  // Where the person stands today, then the odds the age is counted at. Either can be absent.
  let nowX = left;
  if (spec.now) {
    put(plain(30), CREAM_DIM, spec.now, left, heroY + 56);
    nowX += measureAt(plain)(spec.now, 30);
    if (spec.odds) { put(plain(30), CREAM_DIM, ' · ', nowX, heroY + 56); nowX += measureAt(plain)(' · ', 30); }
  }
  if (spec.odds) put(bold(30), SUN, spec.odds, nowX, heroY + 56);

  const sentencePx = fitFontSize(measureAt(display), spec.sentence, inner, 48, 32);
  put(display(sentencePx), CREAM, spec.sentence, left, heroY + 122);

  // The four axes of the type are the ticket's fields: departure, destination, luggage and fare, in words.
  const fieldTop = heroY + 180, fieldW = inner / spec.fields.length;
  spec.fields.forEach((f, i) => {
    const fx = left + i * fieldW;
    if (i) {
      ctx.strokeStyle = 'rgba(169, 196, 180, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx - 14, fieldTop - 26); ctx.lineTo(fx - 14, fieldTop + 92); ctx.stroke();
    }
    put(plain(22), CREAM_DIM, f.label, fx, fieldTop);
    put(bold(fitFontSize(measureAt(bold), f.pole, fieldW - 28, 40, 26)), SUN, f.pole, fx, fieldTop + 54);
    if (f.value) put(plain(fitFontSize(measureAt(plain), f.value, fieldW - 24, 22, 16)), CREAM_DIM, f.value, fx, fieldTop + 88);
  });

  // The route: today, through work, to the holiday.
  const { startAge, holidayAge, endAge, work, holiday } = spec.route;
  const routeY = tear - 100, total = work + holiday;
  const stopX = left + inner * (spec.route.fixedStop && work && holiday ? 0.3 : work / total);
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
  const labelY = routeY + 50;
  put(plain(26), CREAM_DIM, spec.route.startLabel ?? `${startAge} 岁`, left, labelY);
  put(plain(26), CREAM_DIM, `${endAge} 岁`, right, labelY, 'right');
  void holidayAge;
  // Under the line, between its stops, so it keeps clear of the four fields above.
  if (holiday) put(bold(30), SUN, `放假 ${holiday} 年`, (stopX + right) / 2, labelY, 'center');

  // The stub, laid out like the tear-off part of a boarding pass: a strip of small print, then ruled fields
  // with plain labels, and the barcode at the foot. English stays in the strip, where a real pass prints it.
  const rule = (x1, y1, x2, y2) => { ctx.strokeStyle = STUB_RULE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const label = (text, x, y) => put(plain(20), STUB_MUTED, text, x, y);

  // The strip: what any ticket prints, flight and date.
  const stripY = tear + 48;
  // Like the "登机牌 BOARDING PASS" heading on a real pass: the title in Chinese, then in English.
  put(bold(22), STUB_INK, '放假通行证', left, stripY);
  put(mono(13), STUB_MUTED, 'HOLIDAY PASS', left + measureAt(bold)('放假通行证', 22) + 8, stripY);
  const small = [['航班', 'FLIGHT', spec.ticket?.flight], ['日期', 'DATE', spec.ticket?.issued]].filter(([, , v]) => v);
  let sx = right;
  for (const [cn, en, v] of small.reverse()) {
    put(bold(22), STUB_INK, v, sx, stripY, 'right');
    sx -= measureAt(bold)(v, 22) + 8;
    put(mono(13), STUB_MUTED, `${cn} ${en}`, sx, stripY, 'right');
    sx -= measureAt(mono)(`${cn} ${en}`, 13) + 28;
  }
  const rowB = tear + 70;
  rule(left, rowB, right, rowB);

  // The fields: how many of ten parallel selves have money to the end, Mondays left, months of holiday saved,
  // and, only when money is shown, how much of the holiday fund is saved.
  const colW = inner / spec.stampLabels.length;
  const fieldLabelY = rowB + 32, valueY = rowB + 84;
  spec.stampLabels.forEach((text, i) => {
    if (i) rule(left + colW * i, rowB + 14, left + colW * i, rowB + 114);
    label(text, left + colW * i + (i ? 24 : 0), fieldLabelY);
  });
  if (spec.people === null) {
    put(bold(34), STUB_INK, '还在攒', left, valueY);
  } else {
    // "6/10 to 95" read as the odds of living to 95, so the line says it is the money that lasts.
    put(display(44), STUB_INK, String(spec.people), left, valueY);
    const peopleText = `个，钱够花到 ${spec.route.endAge} 岁`;
    const peopleRoom = colW - measureAt(display)(String(spec.people), 44) - 32;
    put(plain(fitFontSize(measureAt(plain), peopleText, peopleRoom, 20, 14)), STUB_MUTED, peopleText, left + measureAt(display)(String(spec.people), 44) + 8, valueY);
    for (let i = 0; i < 10; i++) drawPerson(ctx, left + i * 19, valueY + 10, 24, i < spec.people ? DEEP : STUB_RULE);
  }
  const colX = key => left + colW * spec.stubKeys.indexOf(key) + 24;
  const mx = colX('mondays');
  if (!spec.stubKeys.includes('mondays')) {
    // Hidden with the age.
  } else if (spec.mondays === null) {
    put(bold(34), STUB_INK, '还没开始数', mx, valueY);
  } else if (spec.mondays) {
    put(display(44), STUB_INK, spec.mondays.toLocaleString('zh-CN'), mx, valueY);
    put(plain(22), STUB_MUTED, '个', mx + measureAt(display)(spec.mondays.toLocaleString('zh-CN'), 44) + 8, valueY);
  } else {
    put(bold(34), STUB_INK, '不用再等', mx, valueY);
  }
  const hx = colX('months');
  // Months of holiday already saved: a fact, with no amount in it.
  if (spec.months === null || spec.months === undefined) {
    put(bold(34), STUB_INK, '—', hx, valueY);
  } else if (spec.covered) {
    put(bold(fitFontSize(measureAt(bold), `够花到 ${spec.route.endAge} 岁`, colW - 40, 34, 22)), STUB_INK, `够花到 ${spec.route.endAge} 岁`, hx, valueY);
  } else {
    const monthsText = spec.months.toLocaleString('zh-CN');
    put(display(44), STUB_INK, monthsText, hx, valueY);
    put(plain(22), STUB_MUTED, '个月', hx + measureAt(display)(monthsText, 44) + 8, valueY);
  }
  if (spec.fund !== undefined) {
    const lx = colX('fund');
    // How much of the holiday fund is saved, as a number and ten dots.
    put(display(44), STUB_INK, `${Math.round(spec.fund * 100)}%`, lx, valueY);
    const fundDots = Math.round(spec.fund * 10), dotGap = Math.min((colW - 38) / 10, 20);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i < fundDots ? SUN : STUB_RULE;
      ctx.beginPath();
      ctx.arc(lx + 6 + i * dotGap, valueY + 24, Math.min(dotGap / 2 - 1, 6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const rowC = rowB + 128;
  rule(left, rowC, right, rowC);

  // Remarks: one line at most, in three weights: a small label, the main line, a quiet detail.
  let noteY = rowC;
  if (spec.note) {
    let labelX = left;
    if (spec.note.tag) labelX += drawTag(ctx, spec.note.tag, left, rowC + 32) + 14;
    label(spec.note.label, labelX, rowC + 32);
    noteY = rowC + 74;
    const ch = spec.note.change;
    let mainW;
    const changeW = ch && (measureAt(bold)(ch.prefix, 36) + measureAt(plain)(ch.was, 30) + 16 + measureAt(bold)(ch.now, 36));
    if (ch && changeW <= inner) {
      // Like a rebooked ticket: the old value struck out in grey, the new one in the stamp's ink.
      put(bold(36), STUB_INK, ch.prefix, left, noteY);
      let x = left + measureAt(bold)(ch.prefix, 36);
      const wasW = measureAt(plain)(ch.was, 30);
      put(plain(30), STUB_MUTED, ch.was, x, noteY);
      ctx.strokeStyle = CHANGE_INK;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 3, noteY - 11); ctx.lineTo(x + wasW + 3, noteY - 11); ctx.stroke();
      x += wasW + 16;
      put(bold(36), CHANGE_INK, ch.now, x, noteY);
      mainW = changeW;
    } else {
      // One line if it fits at a readable size, so the lives keep their room; two lines only when it must.
      // The detail counts too: main and detail on one line leave the lives room enough to read their names.
      const detailRoom = spec.note.detail ? measureAt(plain)(spec.note.detail, 24) + 20 : 0;
      const oneLine = [36, 34, 32, 30, 28, 26].find(px => measureAt(bold)(spec.note.main, px) + detailRoom <= inner)
        ?? [36, 34, 32, 30, 28, 26].find(px => measureAt(bold)(spec.note.main, px) <= inner);
      const { px, lines } = oneLine ? { px: oneLine, lines: [spec.note.main] } : noteLayout(measureAt(bold), spec.note.main, inner, 30, 24);
      lines.forEach((line, i) => put(bold(px), STUB_INK, line, left, noteY + i * px * 1.25));
      noteY += (lines.length - 1) * px * 1.25;
      mainW = measureAt(bold)(lines[lines.length - 1], px);
    }
    if (spec.note.detail) {
      // The detail sits after the main line when it fits, so the lives below keep their room.
      const detailW = measureAt(plain)(spec.note.detail, 24);
      if (mainW + 20 + detailW <= inner) put(plain(24), STUB_MUTED, spec.note.detail, left + mainW + 20, noteY);
      else { noteY += 34; put(plain(24), STUB_MUTED, spec.note.detail, left, noteY); }
    }
    noteY += 22;
    rule(left, noteY, right, noteY);
  }

  // The foot: the search words on the left, the life barcode on the right, ruled off from the lives above.
  const footTop = ty + th - 108;
  rule(left, footTop, right, footTop);

  // The assumptions under every number on the card, in small print above the foot.
  if (spec.assumptions) {
    const lines = wrapText(t => measureAt(plain)(t, 24), spec.assumptions, inner).slice(0, 3);
    const lineH = 34;
    const firstY = footTop - 24 - (lines.length - 1) * lineH;
    if (firstY > noteY + 30) lines.forEach((line, i) => put(plain(24), STUB_MUTED, line, left, firstY + i * lineH));
  }

  // The search words, and what will be found: a web page, no sign-up, nothing to download.
  const hintY = footTop + 52;
  // The search words stay, small; without them the brand takes their place.
  if (spec.searchHint) {
    put(bold(26), DEEP, spec.searchHint, left, hintY);
    put(plain(18), STUB_MUTED, spec.brand, left, hintY + 30);
  } else {
    put(bold(26), DEEP, spec.brand, left, hintY);
  }
  if (spec.barcode) {
    const codeW = 460, codeX = right - codeW, codeTop = footTop + 18, codeH = 46;
    if (spec.lifeBars?.length) {
      // A life barcode: one bar a year. Thin bars are work, thick bars holiday, the height is the median assets;
      // the first holiday year stands full height in gold.
      const barPitch = codeW / spec.lifeBars.length;
      spec.lifeBars.forEach((bar, i) => {
        const w = bar.state === 'work' ? Math.max(barPitch * 0.3, 1.5) : bar.state === 'holiday' ? Math.max(barPitch * 0.62, 2.5) : 1;
        const h = bar.start ? codeH : 10 + bar.h * (codeH - 10);
        ctx.globalAlpha = bar.state === 'broke' ? 0.35 : 1;
        ctx.fillStyle = bar.start ? SUN : STUB_INK;
        ctx.fillRect(codeX + i * barPitch, codeTop + codeH - h, w, h);
      });
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = STUB_INK;
      barcodeBars(spec.barcode, codeW).forEach(([x, w]) => ctx.fillRect(codeX + x, codeTop, w, codeH));
    }
    // The route under the code gives the age away, so it follows the age switch; the letter code is not printed.
    if (spec.ticket?.route) put(mono(15), STUB_MUTED, spec.ticket.route, right, codeTop + codeH + 24, 'right');
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

export function renderCard(spec, canvas) {
  if (spec.kind === 'summary') {
    renderSummary(spec, canvas);
    return;
  }
  renderPage(spec, canvas);
}

// A page of a multi-image note, in the pass card's look: the message on the deep green top, the facts on the
// cream stub below a torn edge, and the same small print on every page so a set reads as one.
function renderPage(spec, canvas) {
  const [W, H] = spec.size;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const measureAt = family => (text, px) => { ctx.font = family(px); return ctx.measureText(text).width; };
  const bold = px => `700 ${px}px ${FONT}`;
  const plain = px => `400 ${px}px ${FONT}`;
  const display = px => `900 ${px}px ${SERIF}`;
  const mono = px => `600 ${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  const put = (font, colour, text, x, y, align = 'left') => { ctx.font = font; ctx.fillStyle = colour; ctx.textAlign = align; ctx.fillText(text, x, y); ctx.textAlign = 'left'; };
  const rule = (x1, y1, x2, y2) => { ctx.strokeStyle = STUB_RULE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  ctx.textBaseline = 'alphabetic';

  const tx = 44, ty = 44, tw = W - 88, th = H - 88, radius = 36, notch = 30;
  const left = tx + 60, right = tx + tw - 60, inner = right - left;

  // The stub's contents decide where the ticket tears: a row of fields, or rows of lines.
  const lines = spec.lines ?? [];
  const row = text => {
    const at = text.indexOf('：');
    return at > 0 && at <= 12 ? { label: text.slice(0, at), value: text.slice(at + 1) } : { text };
  };
  const rows = lines.map(row);
  let linePx = 32;
  const linesHeight = px => rows.reduce((sum, r) => sum + (r.text ? wrapText(t => measureAt(plain)(t, px), r.text, inner).length * px * 1.45 + 26 : px + 40), 0);
  while (linePx > 24 && linesHeight(linePx) > 560) linePx -= 2;
  const contentH = spec.stats.length ? 150 : rows.length ? linesHeight(linePx) + 10 : 0;
  const stripH = 70, footH = 116;
  const tear = Math.min(Math.max(ty + th - stripH - contentH - footH, ty + 600), ty + th - 300);

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

  // Top: the name people search for, then the message, centred in the space the stub leaves.
  put(bold(40), CREAM, '放假年龄', left, ty + 78);
  put(bold(28), CREAM_DIM, 'FIRE Age', left + measureAt(bold)('放假年龄', 40) + 16, ty + 78);
  if (spec.example) put(bold(24), SUN, '算例 · 假设人物', right, ty + 78, 'right');
  const heroPx = fitFontSize(measureAt(display), spec.hero, inner, 240, 64);
  // The sentence shrinks a little rather than leave one or two characters alone on a line.
  let sentencePx = 60, sentenceLines = [];
  for (; spec.sentence && sentencePx >= 44; sentencePx -= 2) {
    sentenceLines = wrapText(t => measureAt(display)(t, sentencePx), spec.sentence, inner);
    if (sentenceLines.length === 1 || [...sentenceLines[sentenceLines.length - 1]].length > 3) break;
  }
  sentencePx = Math.max(sentencePx, 44);
  const eyebrowPx = spec.eyebrow ? fitFontSize(measureAt(bold), spec.eyebrow, inner, 34, 22) : 0;
  // The weakness sits under the sentence in plain type, never smaller than 28px.
  const weakPx = 30;
  const weakLines = spec.weakness ? wrapText(t => measureAt(plain)(t, weakPx), `软肋：${spec.weakness}`, inner) : [];
  const weakH = weakLines.length ? 28 + weakLines.length * weakPx * 1.5 : 0;
  const blockH = (spec.eyebrow ? eyebrowPx + 44 : 0) + heroPx * 0.86 + sentenceLines.length * sentencePx * 1.35 + (sentenceLines.length ? 30 : 0) + weakH;
  const areaTop = ty + 130, areaBottom = tear - 50;
  let y = areaTop + Math.max((areaBottom - areaTop - blockH) / 2, 0);
  if (spec.eyebrow) {
    y += eyebrowPx;
    put(bold(eyebrowPx), SUN, spec.eyebrow, left, y);
    y += 44;
  }
  y += heroPx * 0.86;
  put(display(heroPx), SUN, spec.hero, left - 4, y);
  // Large serif characters reach well below their baseline, so the gap grows with the size.
  y += Math.max(30, heroPx * 0.2);
  for (const line of sentenceLines) {
    y += sentencePx * 1.1;
    put(display(sentencePx), CREAM, line, left, y);
    y += sentencePx * 0.25;
  }
  if (weakLines.length) {
    y += 28;
    for (const line of weakLines) {
      y += weakPx * 1.5;
      put(plain(weakPx), CREAM_DIM, line, left, y);
    }
  }

  // The stub: a title strip, the facts, and the foot.
  const stripY = tear + 48;
  put(bold(22), STUB_INK, '放假通行证', left, stripY);
  put(mono(13), STUB_MUTED, 'HOLIDAY PASS', left + measureAt(bold)('放假通行证', 22) + 8, stripY);
  if (spec.page) put(mono(15), STUB_INK, `NO. ${String(spec.page).padStart(2, '0')}/${String(spec.pages).padStart(2, '0')}`, right, stripY, 'right');
  const bodyTop = tear + stripH;
  rule(left, bodyTop, right, bodyTop);
  const footTop = ty + th - footH;

  if (spec.stats.length) {
    // Fields, as on a ticket: ruled apart, a small label over a bold value.
    const colW = inner / spec.stats.length;
    const statTop = bodyTop + Math.max((footTop - bodyTop - 150) / 2, 0);
    spec.stats.forEach((s, i) => {
      const x = left + colW * i + (i ? 24 : 0);
      if (i) rule(left + colW * i, statTop + 16, left + colW * i, statTop + 134);
      put(plain(fitFontSize(measureAt(plain), s.label, colW - 30, 24, 18)), STUB_MUTED, s.label, x, statTop + 50);
      put(bold(fitFontSize(measureAt(bold), s.value, colW - 30, 52, 24)), STUB_INK, s.value, x, statTop + 112);
    });
  } else if (rows.length) {
    // Lines: "name：value" reads as a ruled table row, anything else as a paragraph.
    let ly = bodyTop + Math.max((footTop - bodyTop - linesHeight(linePx)) / 2, 0);
    rows.forEach((r, i) => {
      if (r.text) {
        const wrapped = wrapText(t => measureAt(plain)(t, linePx), r.text, inner);
        ly += 13;
        for (const line of wrapped) {
          ly += linePx * 1.2;
          put(plain(linePx), STUB_INK, line, left, ly);
          ly += linePx * 0.25;
        }
        ly += 13;
      } else {
        ly += 20 + linePx;
        put(plain(linePx), STUB_MUTED, r.label, left, ly);
        put(bold(linePx), STUB_INK, r.value, right, ly, 'right');
        ly += 20;
      }
      if (i < rows.length - 1) rule(left, ly, right, ly);
    });
  }

  rule(left, footTop, right, footTop);
  put(bold(34), DEEP, spec.searchHint, left, footTop + 66);
  const codeW = 300, codeX = right - codeW, codeTop = footTop + 22, codeH = 40;
  ctx.fillStyle = STUB_INK;
  barcodeBars(`${spec.kind}${spec.page ?? ''}${spec.hero}`, codeW).forEach(([x, w]) => ctx.fillRect(codeX + x, codeTop, w, codeH));
  put(mono(15), STUB_MUTED, 'FIRE AGE · 余生皆假期', right, codeTop + codeH + 26, 'right');
}
