// Wealth percentile chart: fan of Monte Carlo outcomes, median, target line, retirement marker, hover readout.
const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });

function niceStep(max, n = 5) {
  const raw = max / n, pw = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pw;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pw;
}

// bands and target are already in the display currency.
export function drawChart(svg, tip, { age, bands, target, retireT, year0, money }) {
  const W = svg.clientWidth || 340, H = svg.clientHeight || 300;
  const m = { l: 48, r: 10, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const Y = bands.length - 1;
  const p75max = Math.max(...bands.map(b => b[3]));
  const marker = target[Math.min(retireT ?? 0, Y)];
  let ymax = Math.max(p75max, marker) * 1.15 || 1;
  const step = niceStep(ymax);
  ymax = Math.ceil(ymax / step) * step;
  const x = t => m.l + iw * t / Y;
  const y = v => m.t + ih * (1 - Math.min(v, ymax * 1.05) / ymax);
  const area = (lo, hi) => {
    let d = '';
    for (let t = 0; t <= Y; t++) d += `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(bands[t][hi]).toFixed(1)}`;
    for (let t = Y; t >= 0; t--) d += `L${x(t).toFixed(1)},${y(bands[t][lo]).toFixed(1)}`;
    return `${d}Z`;
  };
  const line = arr => arr.map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');

  let g = `<defs><clipPath id="plot"><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></clipPath></defs>`;
  for (let v = 0; v <= ymax + 1e-9; v += step) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${compact.format(v)}</text>`;
  }
  const ageStep = Y > 50 ? 10 : 5;
  for (let a = Math.ceil(age / ageStep) * ageStep; a <= age + Y; a += ageStep) {
    g += `<text x="${x(a - age)}" y="${H - 8}" text-anchor="middle">${a}岁</text>`;
  }
  g += '<g clip-path="url(#plot)">';
  g += `<path d="${area(0, 4)}" fill="var(--s1)" fill-opacity=".16"/>`;
  g += `<path d="${area(1, 3)}" fill="var(--s1)" fill-opacity=".22"/>`;
  g += `<path d="${line(target)}" fill="none" stroke="var(--s2)" stroke-width="2" stroke-dasharray="6 4"/>`;
  g += `<path d="${line(bands.map(b => b[2]))}" fill="none" stroke="var(--s1)" stroke-width="2"/>`;
  g += '</g>';
  if (retireT != null) {
    const anchor = retireT > Y * 0.7 ? 'end' : 'start', dx = anchor === 'end' ? -6 : 6;
    g += `<line x1="${x(retireT)}" x2="${x(retireT)}" y1="${m.t}" y2="${m.t + ih}" stroke="var(--ink-2)" stroke-dasharray="2 3"/>`;
    g += `<text x="${x(retireT) + dx}" y="${m.t + 12}" text-anchor="${anchor}">${age + retireT}岁放假</text>`;
  }
  g += `<line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}" stroke="var(--ink-3)"/>`;
  g += `<line id="cross" y1="${m.t}" y2="${m.t + ih}" stroke="var(--ink-2)" visibility="hidden"/>`;
  g += '<circle id="dot" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>';
  g += `<rect id="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = g;

  const cross = svg.querySelector('#cross'), dot = svg.querySelector('#dot'), hit = svg.querySelector('#hit');
  const show = ev => {
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - svg.getBoundingClientRect().left;
    const t = Math.max(0, Math.min(Y, Math.round((px - m.l) / iw * Y)));
    const b = bands[t];
    cross.setAttribute('x1', x(t)); cross.setAttribute('x2', x(t)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(t)); dot.setAttribute('cy', y(b[2])); dot.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="h">${age + t} 岁 · ${year0 + t} 年${retireT != null && t >= retireT ? ' · 放假中' : ''}</div>
      <div class="r"><span>90 分位</span><b>${money(b[4])}</b></div>
      <div class="r"><span>中位数</span><b>${money(b[2])}</b></div>
      <div class="r"><span>10 分位</span><b>${money(b[0])}</b></div>
      <div class="r"><span>所需资产</span><b>${money(target[t])}</b></div>`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${x(t) + 12 + tw > W ? Math.max(x(t) - tw - 12, 0) : x(t) + 12}px`;
    tip.style.top = `${m.t + 6}px`;
  };
  const hide = () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
  };
  hit.addEventListener('mousemove', show);
  hit.addEventListener('touchstart', show, { passive: true });
  hit.addEventListener('touchmove', show, { passive: true });
  hit.addEventListener('mouseleave', hide);
  hit.addEventListener('touchend', hide);
}

const STATE_COLOUR = { work: 'var(--ink-3)', holiday: 'var(--good)', broke: 'var(--bad)' };

// One life drawn in the same colours as its ribbon, which sits on the age axis below it.
// Other lives stay grey; the life being compared against is dashed. Values are in the display currency.
export function drawLivesChart(svg, tip, { age, lives, money }) {
  const W = svg.clientWidth || 340, H = svg.clientHeight || 300;
  const m = { l: 48, r: 10, t: 26, b: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const selected = lives.find(l => l.kind === 'selected');
  const Y = Math.max(...lives.map(l => l.values.length)) - 1;
  const shown = lives.filter(l => l.kind !== 'other');
  const ymaxRaw = Math.max(...shown.flatMap(l => l.values), ...lives.map(l => l.values[0])) * 1.1 || 1;
  const step = niceStep(ymaxRaw);
  const ymax = Math.ceil(ymaxRaw / step) * step;
  const x = t => m.l + iw * t / Y;
  const y = v => m.t + ih * (1 - Math.min(v, ymax) / ymax);
  const line = values => values.map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const axisTop = m.t + ih + 5, axisH = 12;

  let g = `<defs><clipPath id="plot-lives"><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></clipPath></defs>`;
  // Soft bands behind the plot, so the phases read before the line does.
  selected.cells.forEach((cell, t) => {
    if (cell.state === 'work') return;
    const fill = cell.state === 'broke' ? 'var(--bad)' : 'var(--good)';
    g += `<rect x="${x(t).toFixed(1)}" y="${m.t}" width="${(x(t + 1) - x(t)).toFixed(1)}" height="${ih}" fill="${fill}" fill-opacity=".07"/>`;
  });
  for (let v = 0; v <= ymax + 1e-9; v += step) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${compact.format(v)}</text>`;
  }
  g += '<g clip-path="url(#plot-lives)">';
  for (const life of lives.filter(l => l.kind === 'other')) g += `<path d="${line(life.values)}" fill="none" stroke="var(--ink-3)" stroke-opacity=".35" stroke-width="1.5" stroke-linejoin="round"/>`;
  for (const life of lives.filter(l => l.kind === 'compare')) g += `<path class="line-compare" d="${line(life.values)}" fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
  // The selected life, one segment per year, coloured by what that year was.
  selected.cells.forEach((cell, t) => {
    if (t + 1 >= selected.values.length) return;
    g += `<line class="seg-${cell.state}" x1="${x(t).toFixed(1)}" y1="${y(selected.values[t]).toFixed(1)}" x2="${x(t + 1).toFixed(1)}" y2="${y(selected.values[t + 1]).toFixed(1)}" stroke="${STATE_COLOUR[cell.state]}" stroke-width="2.5" stroke-linecap="round"/>`;
  });
  g += '</g>';
  // The ribbon is the axis: same years, same colours, ages below.
  selected.cells.forEach((cell, t) => {
    const width = Math.max(x(t + 1) - x(t) - 1, 1).toFixed(1);
    g += `<rect class="axis-cell ${cell.state}" x="${x(t).toFixed(1)}" y="${axisTop}" width="${width}" height="${axisH}" fill="${STATE_COLOUR[cell.state]}"/>`;
    if (cell.bad) g += `<rect class="axis-bad" x="${x(t).toFixed(1)}" y="${axisTop - 4}" width="${width}" height="3" fill="var(--ink)"/>`;
  });
  const ageStep = Y > 50 ? 10 : 5;
  for (let a = Math.ceil(age / ageStep) * ageStep; a <= age + Y; a += ageStep) {
    g += `<text x="${x(a - age)}" y="${H - 10}" text-anchor="middle">${a}岁</text>`;
  }
  // The holiday year divides the life in two.
  if (selected.retireT !== null && selected.retireT !== undefined) {
    const rx = x(selected.retireT), workYears = selected.retireT, restYears = selected.values.length - 1 - selected.retireT;
    g += `<line id="retire-line" x1="${rx}" x2="${rx}" y1="${m.t - 16}" y2="${axisTop + axisH}" stroke="var(--ink)" stroke-width="2"/>`;
    if (rx > 72) g += `<text x="${rx - 8}" y="${m.t - 6}" text-anchor="end" class="zone-label">上班 ${workYears} 年</text>`;
    if (W - m.r - rx > 116) g += `<text x="${rx + 8}" y="${m.t - 6}" class="zone-label on">${age + selected.retireT} 岁起放假 ${restYears} 年</text>`;
  } else {
    g += `<text x="${m.l}" y="${m.t - 6}" class="zone-label">一直在上班</text>`;
  }
  g += `<line id="lives-cross" y1="${m.t}" y2="${m.t + ih}" stroke="var(--ink-2)" visibility="hidden"/>`;
  g += `<rect id="lives-hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = g;

  const cross = svg.querySelector('#lives-cross'), hit = svg.querySelector('#lives-hit');
  const show = ev => {
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - svg.getBoundingClientRect().left;
    const t = Math.max(0, Math.min(Y, Math.round((px - m.l) / iw * Y)));
    cross.setAttribute('x1', x(t)); cross.setAttribute('x2', x(t)); cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="h">${age + t} 岁</div>${shown.map(l => `<div class="r"><span>${l.label}</span><b>${money(l.values[t])}</b></div>`).join('')}`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${x(t) + 12 + tw > W ? Math.max(x(t) - tw - 12, 0) : x(t) + 12}px`;
    tip.style.top = `${m.t + 6}px`;
  };
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
  hit.addEventListener('mousemove', show);
  hit.addEventListener('touchstart', show, { passive: true });
  hit.addEventListener('touchmove', show, { passive: true });
  hit.addEventListener('mouseleave', hide);
  hit.addEventListener('touchend', hide);
}
