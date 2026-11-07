// Turns model results into page text and tables. Strings only, no DOM access.
import { coastNeed, conv, fiNeed, fwdSolve, swrFor, bwdSolve, savingsAt, savingsRate, buildParams } from './engine.js';
import { mondaysIn, workdaysIn } from './holiday.js';

const moneyFormats = {};
export function money(v, cur) {
  if (!Number.isFinite(v)) return '—';
  moneyFormats[cur] ??= new Intl.NumberFormat('zh-CN', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 2 });
  return moneyFormats[cur].format(v);
}

const whole = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
export const wholeMoney = (v, cur) => (cur === 'CNY' ? whole.format(v) : `${cur} ${whole.format(v)}`);
export const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');

export const toDisplay = (v, p, cur) => conv(v, p.wCur, cur, p.fx);

export function headlineText({ mode, p, t, bwd, dual, dispCur }) {
  let say;
  if (mode === 'bwd') {
    const monthly = toDisplay(Math.max(bwd.s0, 0) / 12, p, dispCur);
    say = bwd.s0 <= 0 ? `想 ${p.tAge} 岁放假，现在的存款已经够了。` : `想 ${p.tAge} 岁放假，每月需存 ${wholeMoney(monthly, dispCur)}。`;
  } else if (t === 0) {
    say = '恭喜，现在就可以放假。从今天起，余生皆假期。';
  } else if (t !== null && savingsAt(p, 0) <= 0) {
    say = `目前存不下钱，按现在的节奏要到 ${p.age + t} 岁才能放假。先让收入超过支出，每一步都算数。`;
  } else if (t !== null) {
    say = `你的放假年龄是 ${p.age + t} 岁。再坚持 ${t} 年，从 ${p.age + t} 岁起，余生皆假期。`;
  } else if (savingsAt(p, 0) <= 0) {
    say = '目前存不下钱，所以先从下面的杠杆开始，每一步都算数。';
  } else {
    say = '按现在的节奏还到不了放假那天。先试试下面的杠杆，一步步来。';
  }
  const ageText = a => (a === null ? '还到不了' : `${a} 岁`);
  const note = p.pension > 0
    ? `算上养老金 ${ageText(dual.withPension)} / 不算养老金 ${ageText(dual.withoutPension)}`
    : '填上养老金，看看能提前多少。';
  return { say, note };
}

export function statusPill(success) {
  if (success === null) return '';
  if (success >= 0.9) return '<span class="pill good">✓ 稳健</span>';
  if (success >= 0.75) return '<span class="pill warn">! 偏紧</span>';
  return '<span class="pill bad">✕ 风险高</span>';
}

const tile = (k, v, n = '') => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="n">${n}</div></div>`;

export function tilesHtml({ mode, p, t, bwd, mc, dispCur }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const rate = savingsRate(p);
  const success = mc?.success ?? null;
  const parts = [];
  const yearsLeft = mode === 'bwd' ? bwd.n : t;
  if (yearsLeft) parts.push(tile('离放假还有', `${mondaysIn(yearsLeft).toLocaleString('zh-CN')} 个周一`, `约 ${workdaysIn(yearsLeft).toLocaleString('zh-CN')} 个工作日（按每年 250 天）`));
  if (mode === 'bwd') {
    parts.push(tile(`${p.tAge} 岁所需资产`, D(bwd.need), `提取率 ${pct(swrFor(p, p.life - p.tAge))}`));
    parts.push(tile('当前计划在那时有', D(bwd.An), bwd.An >= bwd.need ? '已经够了' : `还差 ${D(bwd.need - bwd.An)}`));
  } else if (t !== null) {
    parts.push(tile('放假所需资产', D(fiNeed(p, t)), `提取率 ${pct(swrFor(p, p.life - p.age - t))}，放假 ${p.life - p.age - t} 年`));
  } else {
    parts.push(tile('今天放假所需资产', D(fiNeed(p, 0)), `每年花 ${money(p.retExp, p.rCur)}`));
  }
  if (success !== null) parts.push(tile('计划成功率', pct(success, 0), `${statusPill(success)} 资产撑到 ${p.life} 岁的概率`));
  parts.push(tile('储蓄率', rate === null || rate <= 0 ? '—' : pct(rate, 0), rate !== null && rate > 0 ? `每年存 ${D(p.income - p.expense)}` : '目前存不下钱'));
  return parts.join('');
}

export function solvesHtml({ p, bwd, dispCur }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const rate = savingsRate(p);
  const needRate = p.income > 0 ? bwd.s0 / p.income : NaN;
  const rNote = bwd.reqR === Infinity ? '只靠收益补不上，需要别的杠杆'
    : bwd.reqR === -Infinity ? '收益很低也够了' : `当前假设 ${pct(p.r, 2)}，储蓄不变`;
  const reqR = bwd.reqR === Infinity ? '> 30%' : bwd.reqR === -Infinity ? '< −10%' : pct(bwd.reqR, 2);
  const rows = [
    ['多存：第一年需存', bwd.s0 <= 0 ? '不用再存' : `${D(bwd.s0)}/年`,
      bwd.s0 <= 0 ? '现有资产靠复利就能达到' : `约 ${D(bwd.s0 / 12)}/月，储蓄率 ${pct(needRate, 0)}（现在 ${rate === null || rate <= 0 ? '—' : pct(rate, 0)}）`],
    ['多赚：需要的实际年化收益', reqR, rNote],
    ['少花：退休后每年最多花', `${money(bwd.maxE, p.rCur)}/年`, `约 ${money(bwd.maxE / 12, p.rCur)}/月，现在设的是 ${money(p.retExp, p.rCur)}`],
    ['本金：今天需要有', D(bwd.reqA0), bwd.reqA0 <= p.assets ? '你已经有了' : `比现在多 ${D(bwd.reqA0 - p.assets)}`],
  ];
  return rows.map(([q, v, n]) => `<div class="solve"><div class="q">${q}</div><div class="v">${v}</div><div class="n">${n}</div></div>`).join('');
}

const yearsText = y => `${y.toFixed(1)} 年`;

// Levers that map to a measurable goal: id -> [goal parameter, target for this person].
export function goalFor(id, p) {
  if (id === 'saveRate') {
    const rate = savingsRate(p);
    return rate === null || rate < 0 || rate + 0.05 > 1 ? null : ['saveRate', rate + 0.05];
  }
  if (id === 'spend') return ['expense', p.expense * 0.9];
  if (id === 'fee') return ['drag', Math.max(p.drag - 0.5, 0)];
  return null;
}

export function leversHtml(levers, p) {
  const intro = '<h2>你的最大杠杆</h2><p class="sub">对你来说，下面这几件事最能让放假提前。</p>';
  const gap = p.expense - p.income;
  if (!levers.length && gap >= 0) {
    const detail = gap > 0 ? `现在每年还差 ${money(gap, p.wCur)}。` : '现在收入刚好等于支出，多存一点就能启动。';
    return `${intro}<p class="fine">第一步是让收入超过支出。${detail}储蓄变成正数后，这里会告诉你哪一步最有效。</p>`;
  }
  if (!levers.length) return `${intro}<p class="fine">现在的设定下，单改一项还看不出变化。试着先调整收入和支出。</p>`;
  const items = levers.map(l => {
    const gain = l.unlocks ? `能在 ${Math.round(p.age + l.afterYears)} 岁放假` : `提前 ${yearsText(l.gainYears)} · 少上 ${mondaysIn(l.gainYears).toLocaleString('zh-CN')} 个周一`;
    const goal = goalFor(l.id, p);
    const button = goal ? `<button type="button" class="ghost" data-goal="${l.id}">定为小目标</button>` : '';
    return `<li class="lever"><span class="lab">${l.label}</span><span class="gain">${gain}</span>${button}</li>`;
  }).join('');
  return `${intro}<ul class="lever-list">${items}</ul>`;
}

export function goalHtml(goal, cmp) {
  const delta = cmp.yearsDelta;
  let change = '放假年龄还没有变化，慢慢来。';
  if (delta !== null && delta > 0.05) change = `和定目标时相比，放假提前了 ${yearsText(delta)}。`;
  if (delta !== null && delta < -0.05) change = `和定目标时相比，放假推后了 ${yearsText(-delta)}，再调整一下。`;
  const state = cmp.achieved ? '<span class="pill good">✓ 已达成</span>' : '<span class="pill warn">… 进行中</span>';
  return `<h2>我的小目标</h2>
    <div class="goal-row"><b>${goal.label}</b>${state}${cmp.achieved ? '<button type="button" class="ghost" id="goal-card">生成达成卡</button>' : ''}<button type="button" class="ghost" id="goal-clear">清除</button></div>
    <p class="sub">${change}</p>`;
}

export function impactSentence({ stepLabel, gainYears, note = '' }) {
  if (gainYears === null) return stepLabel;
  if (Math.abs(gainYears) < 0.05) return `${stepLabel}，放假年龄基本不变。${note}`;
  const change = gainYears > 0 ? `放假提前 ${yearsText(gainYears)}` : `放假推后 ${yearsText(-gainYears)}`;
  return `${stepLabel}，${change}。${note}`;
}

export function cardBody(param, impact) {
  const ref = param.range
    ? `${param.range.text} <a href="${param.range.sourceUrl}" target="_blank" rel="noopener">出处</a>`
    : param.noRangeReason;
  return `<p>${param.what}</p><p class="imp">${impactSentence(impact)}</p><p>${param.improve}</p><p class="ref">参考：${ref}</p>`;
}

export function pctTableHtml({ p, mc, target, dispCur }) {
  const M = v => money(toDisplay(v, p, dispCur), dispCur);
  const head = '<thead><tr><th>年龄</th><th class="num">10 分位</th><th class="num">中位数</th><th class="num">90 分位</th><th class="num">所需资产</th></tr></thead><tbody>';
  const rows = mc.bands.map((b, t) => (t % 5 && t !== mc.bands.length - 1 ? ''
    : `<tr><td>${p.age + t}</td><td class="num">${M(b[0])}</td><td class="num">${M(b[2])}</td><td class="num">${M(b[4])}</td><td class="num">${M(target[t])}</td></tr>`)).join('');
  return `${head}${rows}</tbody>`;
}

export function variantsHtml({ p, dispCur }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const coast = coastNeed(p);
  const rows = [
    ['Lean FIRE', '支出 × 0.7，精简生活', p.retExp * 0.7],
    ['标准 FIRE', '按你填写的退休支出', p.retExp],
    ['Fat FIRE', '支出 × 1.5，宽裕生活', p.retExp * 1.5],
    ['Barista FIRE', '兼职收入覆盖 40% 支出', p.retExp * 0.6],
  ];
  let h = '<thead><tr><th>类型</th><th>含义</th><th class="num">年支出</th><th class="num">今天所需资产</th><th class="num">放假年龄</th></tr></thead><tbody>';
  for (const [name, desc, E] of rows) {
    const t = fwdSolve(p, { E });
    h += `<tr><td><b>${name}</b></td><td>${desc}</td><td class="num">${money(E, p.rCur)}</td><td class="num">${D(fiNeed(p, 0, E))}</td><td class="num">${t === null ? '—' : `${p.age + t} 岁`}</td></tr>`;
  }
  const coastDone = p.assets >= coast;
  h += `<tr><td><b>Coast FIRE</b></td><td>此后不再储蓄，靠复利在 ${p.pAge} 岁达到标准 FIRE</td><td class="num">${money(p.retExp, p.rCur)}</td><td class="num">${D(coast)}</td><td class="num">${coastDone ? '已达成' : `还差 ${D(coast - p.assets)}`}</td></tr>`;
  return `${h}</tbody>`;
}

export function heatHtml({ p, dispCur }) {
  const sav0 = p.income - p.expense;
  if (sav0 <= 0) return '<p class="fine">目前存不下钱，先把储蓄变成正数，这张表才有意义。</p>';
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const rOff = [-0.02, -0.01, 0, 0.01, 0.02];
  const sMul = [0.6, 0.8, 1, 1.2, 1.4, 1.6];
  const cells = rOff.map(dr => sMul.map(mul => {
    const q = buildParams({ ...p, income: sav0 * mul + p.expense }, p.fx);
    const t = fwdSolve(q, { r: p.r + dr });
    return t === null ? null : p.age + t;
  }));
  const vals = cells.flat().filter(v => v !== null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  let h = `<table class="heat"><thead><tr><th class="num">收益 \\ 年储蓄</th>${sMul.map(m => `<th class="num">${D(sav0 * m)}</th>`).join('')}</tr></thead><tbody>`;
  rOff.forEach((dr, i) => {
    h += `<tr><th class="num">${pct(p.r + dr, 1)}</th>`;
    sMul.forEach((mul, j) => {
      const v = cells[i][j];
      const share = v === null ? 0 : hi === lo ? 30 : Math.round(8 + 44 * (hi - v) / (hi - lo));
      const base = dr === 0 && mul === 1 ? ' base' : '';
      h += `<td class="num${base}" style="background:color-mix(in oklab, var(--s1) ${share}%, var(--surface))">${v === null ? '—' : v}</td>`;
    });
    h += '</tr>';
  });
  return `${h}</tbody></table>`;
}

export function typeHtml(type, lever) {
  const next = lever ? `<p class="next">下一步：${lever.label}，${lever.unlocks ? '就能看到放假那天' : `提前 ${yearsText(lever.gainYears)}`}。</p>` : '';
  return `<div class="type-head"><span class="type-name">${type.name}</span><span class="type-en">${type.en}</span><span class="pill">${type.group}</span></div>
    <p class="type-blurb">${type.blurb}</p><p class="why">依据：${type.why}</p>${next}`;
}

export const allTypesHtml = types => `<summary>全部 ${types.length} 种类型和判定规则</summary><ul class="type-list">${types
  .map(t => `<li><b>${t.name}</b> <span class="type-en">${t.en}</span>：${t.rule}</li>`).join('')}</ul><p class="fine">从上到下依次判定：假期中、破土、滑行、候鸟、松鼠、极简、海景、雪球、长跑，先符合哪一条就是哪一型。</p>`;

export function placesHtml(rows) {
  const longest = Math.max(...rows.map(r => r.years ?? 0), 1);
  return rows.map(r => {
    const width = r.years === null ? 0 : Math.max(r.years / longest * 100, 1);
    const age = r.age === null ? '还到不了' : `${r.age} 岁`;
    const tag = r.current ? '<span class="pill">当前</span>' : '';
    const spend = `每年花 ${money(r.retExp, r.cur)}`;
    return `<div class="place${r.current ? ' current' : ''}"><div class="place-top"><span class="place-name">${r.name}${tag}</span><b class="place-age">${age}</b></div>
      <div class="place-bar" aria-hidden="true"><i style="width:${width.toFixed(1)}%"></i></div><div class="place-note">${spend}</div></div>`;
  }).join('');
}

const signedPct = v => {
  const whole = Math.round(v * 100);
  return whole === 0 ? '0%' : `${whole > 0 ? '+' : '−'}${Math.abs(whole)}%`;
};

function sparkline(path, maxAssets) {
  const W = 120, H = 44, last = path.years.length - 1;
  const x = i => (last ? i / last * W : 0);
  const y = v => H - 2 - (maxAssets > 0 ? Math.min(v / maxAssets, 1) : 0) * (H - 4);
  const points = path.years.map((d, i) => `${x(i).toFixed(1)},${y(d.assets).toFixed(1)}`).join(' ');
  const marker = path.retireT === null ? '' : `<line class="spark-mark" x1="${x(path.retireT).toFixed(1)}" x2="${x(path.retireT).toFixed(1)}" y1="0" y2="${H}"/>`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${marker}<polyline points="${points}"/></svg>`;
}

const endingText = (story, D) => {
  if (story.outcome === 'working') return ['还在攒', `到 ${story.endAge} 岁有 ${D(story.endAssets)}`];
  if (story.outcome === 'ruined') return [`${story.ruinAge} 岁花完`, `${story.retireAge} 岁放假`];
  return [`撑到 ${story.endAge} 岁`, `还剩 ${D(story.endAssets)}`];
};

export function livesHtml(lives, stories, selected, { p, dispCur }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const maxAssets = Math.max(...lives.flatMap(l => l.years.map(y => y.assets)), 1);
  return lives.map((life, i) => {
    const [head, sub] = endingText(stories[i], D);
    return `<button type="button" class="life" data-life="${i}" aria-pressed="${i === selected}">${sparkline(life, maxAssets)}<span class="life-head">${head}</span><span class="life-sub">${sub}</span></button>`;
  }).join('');
}

export function livesSummary(stories, mc) {
  const retired = stories.filter(s => s.outcome !== 'working');
  if (!retired.length) return '这几条人生里都还没到放假那天。先用上面的杠杆，再回来抽一次。';
  const lasted = retired.filter(s => s.outcome === 'lasted').length;
  const share = mc?.success == null ? '' : ` ${mc.paths.toLocaleString('en-US')} 条人生的统计成功率是 ${pct(mc.success, 0)}。`;
  return `这 ${retired.length} 条人生里，${lasted} 条的钱撑到了最后。${share}`;
}

export function storyHtml(story, { p, dispCur }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const events = [];
  if (story.worst && story.worst.ret < 0) events.push([story.worst.age, `最难的一年：组合收益 ${signedPct(story.worst.ret)}，资产从 ${D(story.worst.before)} 变成 ${D(story.worst.after)}。`]);
  if (story.best) events.push([story.best.age, `最好的一年：组合收益 ${signedPct(story.best.ret)}。`]);
  if (story.retireAge !== null) {
    const gap = story.retireNeed > 0 ? story.retireAssets / story.retireNeed - 1 : 0;
    const versus = Math.abs(gap) < 0.005 ? '和放假线差不多' : gap > 0 ? `比放假线多 ${(gap * 100).toFixed(0)}%` : `比放假线少 ${(-gap * 100).toFixed(0)}%`;
    events.push([story.retireAge, `按计划放假，手上有 ${D(story.retireAssets)}，${versus}。`]);
  }
  if (story.outcome === 'ruined') events.push([story.ruinAge, '积蓄花完了。现实里可以减支或兼职，这里按固定支出计算。']);
  if (story.outcome === 'lasted') events.push([story.endAge, `走到规划终点，还剩 ${D(story.endAssets)}。`]);
  if (story.outcome === 'working') events.push([story.endAge, `一直在积累，到这时有 ${D(story.endAssets)}。`]);
  events.sort((a, b) => a[0] - b[0]);
  const items = events.map(([age, text]) => `<li><b>${age} 岁</b><span>${text}</span></li>`).join('');
  const sequence = story.firstFive === null ? ''
    : `<p class="fine">放假后头 5 年，这条人生的年化收益是 ${signedPct(story.firstFive)}${story.firstFive < p.r ? `，低于长期假设的 ${pct(p.r, 1)}。刚放假就遇到坏年份最伤，这叫序列风险。` : '。'}</p>`;
  return `<ol class="story-list">${items}</ol>${sequence}`;
}

export { bwdSolve };
