// Turns model results into page text and tables. Strings only, no DOM access.
import { coastNeed, conv, fiNeed, fwdSolve, swrFor, bwdSolve, savingsAt, savingsRate, buildParams } from './engine.js';
import { AXES, GROUPS, TYPES, holidayYearsOf, lifeName, lifeRibbon, mondaysIn } from './holiday.js';
import { MIN_SHOWN, SCENARIOS, answerValues, scenarioOptions } from './scenario.js';
import { impactOf, lifeChoices, tryParam } from './levers.js';

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

function proHeadline({ mode, p, t, bwd, dispCur }) {
  if (mode === 'bwd') {
    const first = toDisplay(Math.max(bwd.s0, 0), p, dispCur);
    return bwd.s0 <= 0 ? `目标 ${p.tAge} 岁：现有资产已足够。` : `目标 ${p.tAge} 岁：第一年需储蓄 ${wholeMoney(first, dispCur)}。`;
  }
  if (t === 0) return '已达到财务独立。';
  if (t === null) return '规划期内未达到财务独立。';
  return `财务独立年龄 ${p.age + t} 岁（第 ${t} 年）。`;
}

export function headlineText({ mode, p, t, bwd, dual, dispCur, view = 'simple' }) {
  let say;
  if (view === 'pro') {
    say = proHeadline({ mode, p, t, bwd, dispCur });
  } else if (mode === 'bwd') {
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

export const fasterLead = levers => {
  const top = levers[0];
  if (!top) return '先让收入超过支出，这里才会有答案。';
  return top.unlocks ? `最有效的一步：${top.label}，就能看到放假那天。` : `最有效的一步：${top.label}，提前 ${yearsText(top.gainYears)}。`;
};

export function leversHtml(levers, p, { pro = false } = {}) {
  const intro = '<h2>你的最大杠杆</h2>';
  const gap = p.expense - p.income;
  if (!levers.length && gap >= 0) {
    const detail = gap > 0 ? `现在每年还差 ${money(gap, p.wCur)}。` : '现在收入刚好等于支出，多存一点就能启动。';
    return `${intro}<p class="fine">第一步是让收入超过支出。${detail}储蓄变成正数后，这里会告诉你哪一步最有效。</p>`;
  }
  if (!levers.length) return `${intro}<p class="fine">现在的设定下，单改一项还看不出变化。试着先调整收入和支出。</p>`;
  const items = levers.map(l => {
    const gain = l.unlocks ? `能在 ${Math.round(p.age + l.afterYears)} 岁放假` : pro ? `提前 ${yearsText(l.gainYears)}` : `提前 ${yearsText(l.gainYears)} · 少上 ${mondaysIn(l.gainYears).toLocaleString('zh-CN')} 个周一`;
    const goal = pro ? null : goalFor(l.id, p);
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
    <div class="goal-row"><b>${goal.label}</b>${state}<button type="button" class="ghost" id="goal-clear">清除</button></div>
    <p class="sub">${change}</p>`;
}

export function impactSentence({ stepLabel, gainYears, note = '' }) {
  if (gainYears === null) return stepLabel;
  if (Math.abs(gainYears) < 0.05) return `${stepLabel}，放假年龄基本不变。${note}`;
  const change = gainYears > 0 ? `放假提前 ${yearsText(gainYears)}` : `放假推后 ${yearsText(-gainYears)}`;
  return `${stepLabel}，${change}。${note}`;
}

export const tryValueText = (value, unit, p) => {
  if (unit === 'work') return money(value, p.wCur);
  if (unit === 'retire') return money(value, p.rCur);
  return unit ? `${value} ${unit}` : String(value);
};

export function tryHtml(id, range, current = range.value, { mode = 'fwd' } = {}) {
  const fixed = mode === 'bwd' && !lifeChoices('bwd').includes(id) && lifeChoices('fwd').includes(id);
  const hint = fixed ? '按想几岁放假反推时，存多少由目标决定，这一项只是试算。'
    : lifeChoices(mode).includes(id) ? '拖动后写进“等你来写”，不改你的计划。' : '这一项不由你决定，只是试算。';
  return `<div class="try"><label class="try-lab">拖一拖试试 <input type="range" data-try="${id}" min="${range.min}" max="${range.max}" step="${range.step}" value="${current}"></label><output>${hint}</output></div>`;
}

export function trySentence(p, id, value, range) {
  const before = tryParam(p, id, range.value), after = tryParam(p, id, value);
  const age = a => (a === null ? '还到不了' : `${a} 岁`);
  const odds = after.success === null || before.success === null ? '' : `，成功率 ${pct(before.success, 0)} → ${pct(after.success, 0)}`;
  const held = id === 'expense' ? '（退休支出不变）' : '';
  return `${tryValueText(value, range.unit, p)}${held}：放假年龄 ${age(before.age)} → ${age(after.age)}${odds}`;
}

const effectText = gain => {
  if (Math.abs(gain) < 0.05) return '放假年龄基本不变';
  return gain > 0 ? `提前 ${yearsText(gain)}` : `推后 ${yearsText(-gain)}`;
};

function teaching(param) {
  const ref = param.range ? `${param.range.text} <a href="${param.range.sourceUrl}" target="_blank" rel="noopener">出处</a>` : param.noRangeReason;
  return `<p class="scn-what">${param.what}</p><p class="scn-ref">参考：${ref}</p>`;
}

// What other people think: finished answers are counted anonymously, once per browser, then compared with everyone's.
function crowdHtml(crowd) {
  const privacy = '你的回答已匿名计入：只记录这 6 个选项，不记录 IP、设备、时间或你填的其它数字。每个浏览器只计一次，之后改答案不会再计。';
  if (crowd.status === 'error') return `<div class="crowd"><p class="fine">暂时连不上大家的统计，稍后再试。</p><button type="button" class="ghost" id="crowd-join">再试一次</button></div>`;
  if (crowd.status === 'shown') {
    const more = crowd.total < MIN_SHOWN ? `，满 ${MIN_SHOWN} 人后显示比例` : '';
    return `<div class="crowd"><p class="fine">已有 ${crowd.total.toLocaleString('zh-CN')} 人回答${more}。${crowd.sent ? privacy : ''}</p></div>`;
  }
  return '<div class="crowd"><p class="fine">正在汇总大家的判断……</p></div>';
}

const crowdShare = (crowd, id, chosen) => {
  if (crowd.status !== 'shown' || crowd.total < MIN_SHOWN || !crowd.counts?.[id]) return '';
  return `<span class="crowd-share">${Math.round(crowd.counts[id][chosen] / crowd.total * 100)}% 也这么看</span>`;
};

export function scenarioHtml({ index, answers, base, effect, params, crowd = { status: 'idle' } }) {
  const total = SCENARIOS.length;
  if (index >= total) {
    const rows = SCENARIOS.map((s, i) => (answers[s.id] === undefined ? ''
      : `<li><button type="button" class="scn-goto" data-scn-goto="${i}"><span>${params[s.param].name}</span><b>${scenarioOptions(s, base)[answers[s.id]].label}</b>${crowdShare(crowd, s.id, answers[s.id])}</button></li>`)).join('');
    return `<p class="scn-done">这是你对未来年景的判断，点一项可以改。</p><ul class="scn-summary">${rows}</ul>${crowdHtml(crowd)}<p class="fine">打开专业模式后，可以一键带入这些假设。</p>`;
  }
  const scenario = SCENARIOS[index];
  const chosen = answers[scenario.id];
  const options = scenarioOptions(scenario, base).map((o, i) => `<button type="button" class="scn-option" data-scn="${i}" aria-pressed="${chosen === i}">${o.label}</button>`).join('');
  const reveal = chosen === undefined ? '' : `<div class="scn-reveal">${effect ? `<p class="scn-effect">${effect}</p>` : ''}<p class="scn-insight">${scenario.insight}</p>${teaching(params[scenario.param])}<button type="button" class="ghost" id="scn-next">${index === total - 1 ? '看我的判断' : '下一题'}</button></div>`;
  return `<p class="quiz-count">第 ${index + 1} / ${total} 题</p><p class="quiz-q">${scenario.question}</p><div class="scn-options">${options}</div>${reveal}`;
}

// What the simple view collected: answers about the years ahead and slider choices, carried over on request.
export function viewsBannerHtml(answers, base, params, applied, sliders = []) {
  const values = answerValues(answers, base);
  const views = SCENARIOS.filter(s => values[s.param] !== undefined).map(s => `<li><span>${params[s.param].name}</span><b>${scenarioOptions(s, base)[answers[s.id]].label}</b></li>`);
  const chosen = sliders.map(s => `<li><span>${s.name}</span><b>${s.text}</b></li>`);
  if (!views.length && !chosen.length) return '';
  const action = applied ? '<span class="pill">已带入假设</span>' : '<button type="button" class="ghost" id="views-apply">带入假设</button>';
  return `<h2>你在简单模式里的判断</h2><p class="sub">来自年景题和"等你来写"的滑杆，带入后可以继续手动调整。</p><ul class="scn-summary">${[...views, ...chosen].join('')}</ul><div class="goal-row">${action}</div>`;
}

export function cardBody(param, impact, tryBlock = '') {
  const ref = param.range
    ? `${param.range.text} <a href="${param.range.sourceUrl}" target="_blank" rel="noopener">出处</a>`
    : param.noRangeReason;
  return `<p>${param.what}</p><p class="imp">${impactSentence(impact)}</p>${tryBlock}<p>${param.improve}</p><p class="ref">参考：${ref}</p>`;
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
  const axes = type.axes.map(axis => {
    const poles = Object.entries(axis.poles).map(([letter, label]) => `<span class="pole${letter === axis.letter ? ' on' : ''}">${letter} ${label}</span>`).join('');
    return `<div class="axis"><span class="axis-name">${axis.name}</span><span class="poles">${poles}</span><span class="axis-value">${axis.value}</span></div>`;
  }).join('');
  return `<div class="type-head"><span class="type-emoji" aria-hidden="true">${type.emoji}</span><div class="type-title"><div class="type-code">${type.code}</div><div class="type-name">${type.name}</div></div><div class="type-tags"><span class="pill">${type.group}</span><span class="pill">${type.status.name}</span></div></div>
    <p class="type-blurb">${type.blurb}</p><div class="axes">${axes}</div><p class="why">${type.status.why}</p>${next}`;
}

export function allTypesHtml() {
  const rules = AXES.map(a => `<li><b>${a.name}</b>：${a.rule}</li>`).join('');
  const groups = GROUPS.map(g => {
    const cells = TYPES.filter(t => t.group === g.name).map(t => `<div class="type-cell" data-code="${t.code}"><span class="type-emoji" aria-hidden="true">${t.emoji}</span><div><b>${t.name}</b> <span class="type-en">${t.code}</span><p>${t.blurb}</p></div></div>`).join('');
    return `<h3>${g.name} <span class="type-en">${g.blurb}</span></h3><div class="type-grid">${cells}</div>`;
  }).join('');
  return `<summary>全部 ${TYPES.length} 种类型和判定规则</summary><ul class="type-list">${rules}</ul>${groups}`;
}

const PLACES_SHOWN = 5;

export function placesHtml(rows, { all = false } = {}) {
  const longest = Math.max(...rows.map(r => r.years ?? 0), 1);
  const row = r => {
    const width = r.years === null ? 0 : Math.max(r.years / longest * 100, 1);
    const age = r.age === null ? '还到不了' : `${r.age} 岁`;
    const tag = r.current ? '<span class="pill">当前</span>' : '';
    const spend = `每年花 ${money(r.retExp, r.cur)}`;
    return `<div class="place${r.current ? ' current' : ''}"><div class="place-top"><span class="place-name">${r.name}${tag}</span><b class="place-age">${age}</b></div>
      <div class="place-bar" aria-hidden="true"><i style="width:${width.toFixed(1)}%"></i></div><div class="place-note">${spend}</div></div>`;
  };
  if (all) return rows.map(row).join('');
  const shown = rows.filter((r, i) => i < PLACES_SHOWN || r.current);
  const rest = rows.filter(r => !shown.includes(r));
  const more = rest.length ? `<details class="places-more"><summary>看其余 ${rest.length} 个地方</summary>${rest.map(row).join('')}</details>` : '';
  return shown.map(row).join('') + more;
}

export const signedPct = v => {
  const whole = Math.round(v * 100);
  return whole === 0 ? '0%' : `${whole > 0 ? '+' : '−'}${Math.abs(whole)}%`;
};

// Every ribbon uses the same scale, so a year sits at the same place in each life.
export function ribbonSvg(path, maxCells) {
  const cells = lifeRibbon(path);
  const rects = cells.map((c, i) => `<rect class="r-${c.state}" x="${i * 10}" y="4" width="9" height="16"/>${c.bad ? `<rect class="r-bad" x="${i * 10}" y="0" width="9" height="3"/>` : ''}`).join('');
  return `<svg class="ribbon" viewBox="0 0 ${maxCells * 10} 20" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}

const endingText = (story, D) => {
  if (story.outcome === 'working') return `还在攒，${story.endAge} 岁有 ${D(story.endAssets)}`;
  if (story.outcome === 'ruined') return `${story.ruinAge} 岁花完`;
  return `撑到 ${story.endAge} 岁，还剩 ${D(story.endAssets)}`;
};

// What sets one draw of years apart from another: the first holiday years, the whole holiday, and the hard falls.
// Rates are coloured against the plan the row belongs to, compared as shown (whole percent).
function lifeRow(path, story, index, selected, D, { fifth = false, maxCells, p, name: given, hardest = false }) {
  const expected = Math.round(p.r * 100);
  const rate = r => {
    if (r === null || r === undefined) return '<b>—</b>';
    const whole = Math.round(r * 100);
    return `<b class="${whole < 0 ? 'bad' : whole >= expected ? 'good' : ''}">${signedPct(r)}/年</b>`;
  };
  const luck = story.outcome === 'working' ? ['一直在上班'] : [`放假头 5 年 ${rate(story.firstFive)}`, `整个假期 ${rate(story.holidayReturn)}`];
  const facts = [...luck, `大跌 ${story.badYears} 次`];
  const name = fifth ? '等你来写' : given ?? lifeName(story);
  const tag = hardest ? '<span class="pill bad life-tag">最难</span>' : '';
  return `<button type="button" class="life${fifth ? ' fifth' : ''}" data-life="${index}" aria-pressed="${index === selected}"><span class="life-top"><span><span class="life-name">${name}</span>${tag}</span><span class="life-end">${endingText(story, D)}</span></span>${ribbonSvg(path, maxCells)}<span class="life-sub">${facts.join(' · ')}</span></button>`;
}

export function livesHtml(lives, stories, selected, { p, dispCur, fifth = null, names = [], hardest = null }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const maxCells = Math.max(...[...lives, ...(fifth ? [fifth.path] : [])].map(l => l.years.length - 1));
  const rows = lives.map((life, i) => lifeRow(life, stories[i], i, selected, D, { maxCells, p, name: names[i], hardest: i === hardest })).join('');
  const last = fifth
    ? lifeRow(fifth.path, fifth.story, lives.length, selected, D, { fifth: true, maxCells, p: fifth.plan ?? p })
    : '<div class="life-empty" id="life-fifth-empty"><b>等你来写</b>说说你对未来年景的判断，它会用这四条里最难的那段日子，按你的判断重走一遍。</div>';
  return rows + last;
}

// The written life for the card: one short main line and a quiet detail, or nothing when nothing changed.
export function fifthBrief(base, fifth, D = wan) {
  if (fifth.outcome === 'working') return { main: `到 ${fifth.endAge} 岁也放不了假`, detail: '' };
  const end = fifth.outcome === 'ruined' ? `${fifth.ruinAge} 岁花完` : `钱撑到 ${fifth.endAge} 岁`;
  if (base.outcome === 'working') return { main: `${fifth.retireAge} 岁就能放假`, detail: end };
  const before = holidayYearsOf(base), after = holidayYearsOf(fifth), diff = base.retireAge - fifth.retireAge;
  if (!diff && before === after && base.outcome === fifth.outcome) {
    const moved = base.outcome === 'lasted' && Math.abs(fifth.endAssets - base.endAssets) > Math.max(Math.abs(base.endAssets), 1) * 0.01;
    return moved ? { main: `最后剩下 ${D(base.endAssets)} → ${D(fifth.endAssets)}`, detail: `钱都撑到 ${fifth.endAge} 岁` } : null;
  }
  const when = diff ? [`${diff > 0 ? '早' : '晚'} ${Math.abs(diff)} 年放假`] : [];
  return { main: `有钱花的假期 ${before} → ${after} 年`, detail: [...when, end].join(' · ') };
}

export function fifthCompareHtml(base, fifth, baseName = lifeName(base), D = wan) {
  const why = base.outcome === 'ruined' ? '钱最早花完' : '剩得最少';
  return `<p class="fifth-compare">虚线是最难的「${baseName}」（${why}）。${fifthSentence(base, fifth, D)}。</p>`;
}

// Years after the money runs out are not a holiday, so the change is counted in holiday years that still have money.
const wan = v => `${Math.round(v / 1e4)}万`;

export const fifthSentence = (base, fifth, D = wan) => {
  if (fifth.outcome === 'working') return `同样的年景，到 ${fifth.endAge} 岁也放不了假`;
  const end = fifth.outcome === 'ruined' ? `${fifth.ruinAge} 岁花完` : `钱撑到 ${fifth.endAge} 岁`;
  if (base.outcome === 'working') return `同样的年景，原来放不了假，现在 ${fifth.retireAge} 岁放假，${end}`;
  const before = holidayYearsOf(base), after = holidayYearsOf(fifth), diff = base.retireAge - fifth.retireAge;
  if (!diff && before === after && base.outcome === fifth.outcome) {
    const moved = base.outcome === 'lasted' && Math.abs(fifth.endAssets - base.endAssets) > Math.max(Math.abs(base.endAssets), 1) * 0.01;
    return moved ? `同样的年景，钱都撑到 ${fifth.endAge} 岁，最后剩下的从 ${D(base.endAssets)} 变成 ${D(fifth.endAssets)}` : '同样的年景，结局没有变，换个选择再试试';
  }
  const years = before === after ? `有钱花的假期还是 ${after} 年` : `有钱花的假期从 ${before} 年变成 ${after} 年`;
  const when = diff ? [`${diff > 0 ? '早' : '晚'} ${Math.abs(diff)} 年放假`] : [];
  return `同样的年景，${years}：${[...when, end].join('，')}`;
};

export function labChangesHtml(labels) {
  if (!labels.length) return '';
  return `<div class="life-changes"><span>已写入：${labels.join('、')}</span></div>`;
}

export function stickyHtml(h, { p, dispCur, success, pro }) {
  if (pro) {
    const age = h.reachable ? `财务独立 ${h.holidayAge} 岁` : '规划期内未达到';
    const odds = success === null || success === undefined ? '' : `<span>成功率 ${pct(success, 0)}</span>`;
    return `<b class="sticky-age">${age}</b><span>所需 ${money(toDisplay(h.fund.need, p, dispCur), dispCur)}</span>${odds}<span class="sticky-more">实际收益 ${pct(p.r, 2)}</span>`;
  }
  if (!h.reachable) return '<b class="sticky-age">还在路上</b><span>先把杠杆用起来</span>';
  const age = h.workYears === 0 ? '现在就能放假' : `${h.holidayAge} 岁放假`;
  const bar = `<span class="sticky-bar-mini" aria-hidden="true"><i style="width:${(h.workYears / (h.workYears + h.holidayYears) * 100).toFixed(1)}%"></i></span>`;
  const odds = h.people === null ? '' : `<span>${h.people}/10 撑到 ${h.endAge} 岁</span>`;
  const work = h.workYears ? `<span class="sticky-more">再上 ${h.workYears} 年班</span>` : '';
  return `<b class="sticky-age">${age}</b>${bar}${work}${odds}`;
}

export function sensitivityHtml(p, params) {
  const valueOf = id => {
    const v = p[id];
    if (['assets', 'income', 'expense'].includes(id)) return money(v, p.wCur);
    if (['retExp', 'pension'].includes(id)) return money(v, p.rCur);
    return String(v);
  };
  const rows = params.map(param => {
    const impact = impactOf(p, param.id);
    const cells = impact.gainYears === null
      ? `<td colspan="2">${impact.stepLabel}</td>`
      : `<td>${impact.stepLabel}${impact.note ? `<span class="sens-note">${impact.note}</span>` : ''}</td><td class="num">${effectText(impact.gainYears)}</td>`;
    return `<tr><td>${param.name}</td><td class="num">${valueOf(param.id)}</td>${cells}</tr>`;
  }).join('');
  return `<thead><tr><th>参数</th><th class="num">当前值</th><th>变动</th><th class="num">对放假年龄</th></tr></thead><tbody>${rows}</tbody>`;
}

export function heroHtml(h, { p, dispCur }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const total = h.workYears + h.holidayYears;
  const share = v => (v / total * 100).toFixed(1);
  let big;
  if (!h.reachable) big = '<span class="hero-line">还没看到放假那天，先把杠杆用起来</span>';
  else if (h.workYears === 0) big = `<span class="hero-rest">现在就能放假 <b>${h.holidayYears}</b> 年</span>`;
  else big = `<span class="hero-work">再上 <b>${h.workYears}</b> 年班</span><span class="hero-arrow">→</span><span class="hero-rest">放假 <b>${h.holidayYears}</b> 年</span>`;
  const work = h.workYears ? `<i class="work" style="width:${share(h.workYears)}%"></i>` : '';
  const rest = h.holidayYears ? `<i class="rest" style="width:${share(h.holidayYears)}%"></i>` : '';
  const mid = h.reachable && h.workYears ? `<span>${h.holidayAge} 岁放假</span>` : '';
  const mondays = h.mondays ? `<p class="hero-mondays">还有 <b>${h.mondays.toLocaleString('zh-CN')}</b> 个周一</p>` : '';
  const people = h.people === null ? '' : `<div class="people" role="img" aria-label="10 个平行的你，约 ${h.people} 个的钱够花到 ${h.endAge} 岁"><div class="people-row">${Array.from({ length: 10 }, (_, i) => personSvg(i < h.people)).join('')}</div><p>10 个平行的你，约 <b>${h.people}</b> 个的钱够花到 ${h.endAge} 岁</p></div>`;
  const fundPct = Math.round(h.fund.share * 100);
  return `<div class="hero-big">${big}</div>
    <div class="lifebar" role="img" aria-label="人生进度：上班 ${h.workYears} 年，放假 ${h.holidayYears} 年">${work}${rest}</div>
    <div class="lifebar-ticks"><span>${h.startAge} 岁 · 今天</span>${mid}<span>${h.endAge} 岁</span></div>
    ${mondays}${people}
    <div class="fund"><div class="fund-bar" role="img" aria-label="放假资金已攒到 ${fundPct}%"><i style="width:${fundPct}%"></i></div><p>放假资金攒到 <b>${fundPct}%</b>（${D(h.fund.have)} / ${D(h.fund.need)}）</p></div>`;
}

function personSvg(on) {
  return `<svg class="person${on ? ' on' : ''}" viewBox="0 0 20 28" aria-hidden="true"><circle cx="10" cy="6" r="5"/><path d="M2 27c0-9 3-13 8-13s8 4 8 13z"/></svg>`;
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
  const spending = p.flexCut > 0 ? `这里大跌后少花 ${p.flexCut}%，其余年份照常花` : '这里按固定支出计算';
  if (story.outcome === 'ruined') events.push([story.ruinAge, `积蓄花完了。现实里可以减支或兼职，${spending}。`]);
  if (story.outcome === 'lasted') events.push([story.endAge, `走到规划终点，还剩 ${D(story.endAssets)}。`]);
  if (story.outcome === 'working') events.push([story.endAge, `一直在积累，到这时有 ${D(story.endAssets)}。`]);
  events.sort((a, b) => a[0] - b[0]);
  const items = events.map(([age, text]) => `<li><b>${age} 岁</b><span>${text}</span></li>`).join('');
  const sequence = story.firstFive === null ? ''
    : `<p class="fine">放假后头 5 年，这条人生的年化收益是 ${signedPct(story.firstFive)}${story.firstFive < p.r ? `，低于长期假设的 ${pct(p.r, 1)}。刚放假就遇到坏年份最伤，这叫序列风险。` : '。'}</p>`;
  return `<ol class="story-list">${items}</ol>${sequence}`;
}

export { bwdSolve };
