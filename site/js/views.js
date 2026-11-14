// Turns model results into page text and tables. Strings only, no DOM access.
import { DEFAULT_PATHS, DEFAULT_SEED, coastNeed, conv, bwdSolve, firstDraw, fwdSolve, savingsAt, savingsRate, buildParams } from './engine.js';
import { AXES, GROUPS, TYPES, holidayYearsOf, lifeName, lifeRibbon, mondaysIn, oddsBand, oddsText, peopleOf } from './holiday.js';
import { needLine, oddsSolve, oddsYears } from './odds.js';
import { MIN_SHOWN, SCENARIOS, answerValues, scenarioOptions } from './scenario.js';
import { impactOf, lifeChoices, tryParam } from './levers.js';
import { FIELD_LABEL, LIMITS, itemsYearly, num, problems, splitOn } from './state.js';

const moneyFormats = {};
export function money(v, cur) {
  if (!Number.isFinite(v)) return '—';
  moneyFormats[cur] ??= new Intl.NumberFormat('zh-CN', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 2 });
  return moneyFormats[cur].format(v);
}

// Amounts a person compares at a glance, to three figures: ¥240万 rather than ¥239.75万.
const roughFormats = {};
export function roughMoney(v, cur) {
  if (!Number.isFinite(v)) return '—';
  roughFormats[cur] ??= new Intl.NumberFormat('zh-CN', { style: 'currency', currency: cur, notation: 'compact', maximumSignificantDigits: 3 });
  return roughFormats[cur].format(v);
}

const whole = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
export const wholeMoney = (v, cur) => (cur === 'CNY' ? `¥${whole.format(v)}` : `${cur} ${whole.format(v)}`);
// A percentage with a true minus sign, and never −0.0%.
export const pct = (v, d = 1) => {
  if (!Number.isFinite(v)) return '—';
  const t = (v * 100).toFixed(d);
  return `${/^-0(.0+)?$/.test(t) ? t.slice(1) : t.replace('-', '−')}%`;
};

export const toDisplay = (v, p, cur) => conv(v, p.wCur, cur, p.fx);

function proHeadline({ mode, p, t, odds, dispCur }) {
  if (mode === 'bwd') {
    const first = toDisplay(odds.s0, p, dispCur);
    const now = `当前计划成功率 ${pct(odds.success, 0)}。`;
    return odds.enough ? `目标 ${p.tAge} 岁：现有资产已有八成把握。${now}` : `目标 ${p.tAge} 岁：八成把握需第一年储蓄 ${wholeMoney(first, dispCur)}。${now}`;
  }
  if (t === 0) return '已达到财务独立（八成把握）。';
  if (t === null) return '规划期内达不到八成把握。';
  return `财务独立年龄 ${p.age + t} 岁（第 ${t} 年，八成把握）。`;
}

// What to do when the odds for a chosen age are short of 8 in 10: the saving that reaches it, or the age that does.
function toEight(p, odds, eightAge, dispCur) {
  const ways = [];
  if (!odds.enough) ways.push(`每月需存 ${wholeMoney(toDisplay(odds.s0 / 12, p, dispCur), dispCur)}`);
  if (eightAge !== null && eightAge > p.tAge) ways.push(`等到 ${eightAge} 岁`);
  return ways.length ? `要有八成把握，${ways.join('，或者')}。` : '';
}

const THIN = '钱够花的把握不到一半：晚几年放，或者放假后留一点收入。';

// The slogan is only for odds of 8 in 10 or better, judged on the success rate itself.
export function headlineText({ mode, p, t, odds = null, eightAge = null, dual, dispCur, view = 'simple' }) {
  let say;
  if (view === 'pro') {
    say = proHeadline({ mode, p, t, odds, dispCur });
  } else if (mode === 'bwd') {
    const band = oddsBand(odds.success);
    const lead = `想 ${p.tAge} 岁放假：按现在的计划，`;
    if (band === 'sure') say = `${lead}有 ${oddsText(odds.success)}。从 ${p.tAge} 岁起，余生皆假期。`;
    else if (band === 'hedge') say = `${lead}有 ${oddsText(odds.success)}，可以放，但要带着后手放。${toEight(p, odds, eightAge, dispCur)}`;
    else say = `${lead}${odds.success < 0.1 ? '' : '只有 '}${oddsText(odds.success)}。${THIN}${toEight(p, odds, eightAge, dispCur)}`;
  } else if (t === 0) {
    say = '恭喜，现在就可以放假，八成把握。从今天起，余生皆假期。';
  } else if (t !== null && savingsAt(p, 0) <= 0) {
    say = `目前存不下钱，按现在的节奏要到 ${p.age + t} 岁才有八成把握放假。先让收入超过支出，每一步都算数。`;
  } else if (t !== null) {
    say = `你的放假年龄是 ${p.age + t} 岁。八成把握：再坚持 ${t} 年，从 ${p.age + t} 岁起，余生皆假期。`;
  } else if (savingsAt(p, 0) <= 0) {
    say = '目前存不下钱，所以先从下面提前的办法开始，每一步都算数。';
  } else {
    say = '按现在的节奏，规划期内还到不了八成把握。先试试下面提前的办法，一步步来。';
  }
  return { say, note: pensionNote(p, dual) };
}

// A pension starts late, so for an early holiday it often moves the date by months, not years.
function pensionNote(p, { withPension: w, withoutPension: wo, gain }) {
  if (!(p.pension > 0)) return '填上养老金，看看能提前多少。';
  if (w === null && wo !== null) return `算上养老金和社保自缴，反而到不了八成把握；不算养老金 ${wo} 岁。`;
  if (w === null) return '算上养老金也还到不了八成把握。';
  if (wo === null) return `算上养老金 ${w} 岁放假；不算养老金还到不了。`;
  if (w === p.age && wo === p.age) return '现在就能放假，养老金是额外的保障。';
  if (w > wo) return `算上养老金 ${w} 岁，比不算养老金的 ${wo} 岁还晚：放假后自缴的社保，比养老金帮上的忙还多。`;
  const months = Math.round((gain ?? 0) * 12);
  if (months >= 12) return `算上养老金 ${w} 岁 / 不算养老金 ${wo} 岁`;
  if (months < 1) return `养老金 ${p.pAge} 岁才开始领，对 ${w} 岁放假几乎没有影响。`;
  return `养老金 ${p.pAge} 岁才开始领，只让放假提前 ${months} 个月。`;
}

// The estimate under the pension field: the statutory age, the two parts and their sum, and the settings this tool made.
// result comes from estimateFromForm (null until a birth month and a base are filled in).
// held: the pension field above still holds an earlier figure. problem: B15 (fewer years than already paid), drawn with
// its exit above the use button.
export function pensionEstimateHtml(result, { used = false, held = false, problem = null } = {}) {
  if (!result) return '<p class="fine">填上出生年月和当地的计发基数，这里就会出现估算。</p>';
  const { st, est, years, claimAge } = result;
  const age = `${st.years} 岁${st.months > 0 ? ` ${st.months} 个月` : ''}`;
  const money = v => wholeMoney(Number.isFinite(v) ? v : 0, 'CNY');
  const stop = problem ? `${fieldLineHtml(problem)}<div class="fixes">${fixesHtml(problem.fixes)}</div>` : '';
  const body = est.eligible
    ? `<div class="pen-sum"><span>基础养老金 <b>${money(est.basic)}</b>/月</span><span>个人账户养老金 <b>${money(est.personal)}</b>/月</span><span>合计 <b>${money(est.monthly)}</b>/月</span></div>
       <p class="fine">按累计缴费 ${years} 年算，今天的钱。法定领取年龄 ${age}，模型里按 ${claimAge} 岁开始领。</p>
       ${stop}${used ? '<p class="fine pen-used">已填进上面的养老金和领取年龄。</p>' : '<button type="button" class="primary" data-pen-use>用这个结果</button>'}`
    : `<p class="pen-short">累计缴费不满 ${est.minYears ?? '最低'} 年，不能按月领取${held ? '。上面的养老金还是之前填的，要按 0 算请清空它。' : '，这里按 0 算。'}</p>
       <p class="fine">法定领取年龄 ${age}。</p>${stop}`;
  return `${body}<div class="pen-set"><b>本工具设定</b><ul>
    <li>计发基数按今天的钱算，只跟物价涨；个人账户记账利率与通胀持平。</li>
    <li>累计缴费年限默认“已缴年数 + 距领取的年数”，可以改。</li>
    <li>领取年龄不是整岁时，向上取整岁放进模型，计发月数按已满的整岁查表。</li></ul></div>`;
}

export function statusPill(success) {
  if (success === null) return '';
  if (success >= 0.9) return '<span class="pill good">✓ 稳健</span>';
  if (success >= 0.75) return '<span class="pill warn">! 偏紧</span>';
  return '<span class="pill bad">✕ 风险高</span>';
}

const tile = (k, v, n = '') => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="n">${n}</div></div>`;

// The withdrawal rate the holiday line implies, next to the published one it no longer depends on. Its numerator is
// what the first holiday year takes from savings, the denominator of "≈ 年支出 × N 倍" too (spec §9.2).
function swrCompare(p, line, t) {
  return line > 0 ? `本工具在你的假设下反推的提取率是 ${pct(firstDraw(p, t) / line, 1)}；Morningstar 30 年九成把握是 3.9%` : '';
}

export function tilesHtml({ mode, p, t, bwd, mc, dispCur, target = needLine(p) }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const rate = savingsRate(p);
  const success = mc?.success ?? null;
  const parts = [];
  if (mode === 'bwd') {
    const line = target[bwd.n];
    parts.push(tile(`${p.tAge} 岁的放假线`, D(line), `八成把握所需。${swrCompare(p, line, bwd.n)}`));
    parts.push(tile('当前计划在那时有（中位数）', D(bwd.An), bwd.An >= line ? '已经够了' : `还差 ${D(line - bwd.An)}`));
  } else if (t !== null) {
    parts.push(tile('放假线（八成把握）', D(target[t]), `放假 ${p.life - p.age - t} 年。${swrCompare(p, target[t], t)}`));
  } else {
    parts.push(tile('今天的放假线', D(target[0]), `每年花 ${money(p.retExp, p.rCur)}`));
  }
  if (success !== null) parts.push(tile('计划成功率', `${pct(success, 0)}<small>（${peopleOf(success) === 0 ? '不到 1 成' : `${peopleOf(success)} 成`}）</small>`, `${statusPill(success)} 资产撑到 ${p.life} 岁的概率，按本工具假设模拟`));
  parts.push(tile('储蓄率', rate === null || rate <= 0 ? '—' : pct(rate, 0), rate !== null && rate > 0 ? `每年存 ${D(p.income - p.expense)}` : '目前存不下钱'));
  return parts.join('');
}

const FIXED = '按固定收益算，约五成把握';

export function solvesHtml({ p, bwd, odds, dispCur }) {
  const D = v => roughMoney(toDisplay(v, p, dispCur), dispCur);
  const R = v => roughMoney(v, p.rCur);
  const rate = savingsRate(p);
  const needRate = p.income > 0 ? odds.s0 / p.income : NaN;
  // Saving more than is earned, or spending next to nothing, is not a path: say so instead of printing the number.
  const saveAlone = odds.enough || (needRate > 0 && needRate <= 1);
  const spendAlone = bwd.maxE >= Math.max(p.retExp * 0.1, 1);
  const rNote = bwd.reqR === Infinity ? '只靠收益补不上，需要别的办法'
    : bwd.reqR === -Infinity ? '收益很低也够了' : `当前假设 ${pct(p.r, 2)}，储蓄不变`;
  const reqR = bwd.reqR === Infinity ? '> 30%' : bwd.reqR === -Infinity ? '< −10%' : pct(bwd.reqR, 2);
  const rows = [
    ['多存：第一年需存（八成把握）', odds.enough ? '不用再存' : saveAlone ? `${D(odds.s0)}/年` : '只靠多存做不到',
      odds.enough ? '现有资产靠复利就能达到' : saveAlone ? `约 ${D(odds.s0 / 12)}/月，储蓄率 ${pct(needRate, 0)}（现在 ${rate === null || rate <= 0 ? '—' : pct(rate, 0)}）`
        : `要存下的比${p.income > 0 ? '收入' : '现在'}还多，换一条路，或者几条一起走。`],
    ['多赚：需要的实际年化收益', reqR, `${rNote}。${FIXED}`],
    ['少花：退休后每年最多花', spendAlone ? `${R(bwd.maxE)}/年` : '只靠少花做不到', `${spendAlone ? `约 ${R(bwd.maxE / 12)}/月，` : ''}现在设的是 ${R(p.retExp)}/年。${FIXED}`],
    ['本金：今天需要有', D(bwd.reqA0), `${bwd.reqA0 <= p.assets ? '你已经有了' : `比现在多 ${D(bwd.reqA0 - p.assets)}`}。${FIXED}`],
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

export const fasterLead = (levers, { reached = false } = {}) => {
  if (reached) return '已经到了，不用再提前。';
  const top = levers[0];
  if (!top) return '先让收入超过支出，这里才会有答案。';
  return top.unlocks ? `最有效的一步：${top.label}，就能看到放假那天。` : `最有效的一步：${top.label}，提前 ${yearsText(top.gainYears)}。`;
};

// The small step comes first in the simple view: an amount this month, counted in Mondays, not years.
function smallHtml(small, p, dispCur) {
  if (!small) return '';
  const gain = small.unlocks ? `能在 ${Math.round(p.age + small.afterYears)} 岁放假` : `少上 ${mondaysIn(small.gainYears).toLocaleString('zh-CN')} 个周一`;
  return `<li class="lever small"><span class="lab">每月多存 ${wholeMoney(toDisplay(small.amount, p, dispCur), dispCur)}</span><span class="gain">${gain}</span></li>`;
}

export function leversHtml(levers, p, { pro = false, small = null, dispCur = p.wCur, reached = false } = {}) {
  const intro = '<h2>提前的办法</h2>';
  if (reached) return `${intro}<p class="fine">现在就有八成把握放假，不用再提前。想多留余量，可以展开下面的平行人生看看坏年景。</p>`;
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
  return `${intro}<ul class="lever-list">${pro ? '' : smallHtml(small, p, dispCur)}${items}</ul>`;
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

export function impactSentence({ stepLabel, gainYears, note = '', reach = null }) {
  if (reach === 'unlocks') return `${stepLabel}，就能看到放假那天。${note}`;
  if (reach === 'none') return `${stepLabel}，还是到不了放假。${note}`;
  if (gainYears === null) return stepLabel;
  if (Math.abs(gainYears) < 0.05) return `${stepLabel}，放假年龄基本不变。${note}`;
  const change = gainYears > 0 ? `放假提前 ${yearsText(gainYears)}` : `放假推后 ${yearsText(-gainYears)}`;
  return `${stepLabel}，${change}。${note}`;
}

const MONTHLY_FLOWS = ['income', 'expense', 'retExp', 'pension'];
export const tryValueText = (value, unit, p, id = '') => {
  const cur = unit === 'work' ? p.wCur : unit === 'retire' ? p.rCur : null;
  if (cur && MONTHLY_FLOWS.includes(id)) return `${roughMoney(value / 12, cur)}/月`;
  if (cur) return roughMoney(value, cur);
  return unit ? `${value} ${unit}` : String(value);
};

export function tryHtml(id, range, current = range.value, { mode = 'fwd', p = null } = {}) {
  const fixed = mode === 'bwd' && !lifeChoices('bwd').includes(id) && lifeChoices('fwd').includes(id);
  const writes = lifeChoices(mode).includes(id);
  let hint = fixed ? '按想几岁放假反推时，存多少由目标决定，这一项只是试算。' : writes ? '' : '这一项不由你决定，只是试算。';
  // Sliders that write the last life always show a number: where it stands, or what moving it changed.
  if (writes && p) hint = current === range.value ? tryNow(p, id, range) : trySentence(p, id, current, range);
  const moved = Number(current) !== Number(range.value);
  return `<div class="try"><label class="try-lab">拖一拖试试 <span class="try-track${moved ? ' moved' : ''}" style="${trackStyle(range, current)}"><input type="range" data-try="${id}" min="${range.min}" max="${range.max}" step="${range.step}" value="${current}"><i class="try-span" aria-hidden="true"></i><i class="try-was" aria-hidden="true"></i></span></label><output>${hint}</output></div>`;
}

// Track positions as fractions: the starting value, and the stretch between it and the current one.
export function trackStyle(range, value) {
  const span = range.max - range.min || 1;
  const at = v => Math.min(Math.max((Number(v) - range.min) / span, 0), 1);
  const round = x => Number(x.toFixed(4));
  const was = at(range.value), now = at(value);
  return `--was:${round(was)};--lo:${round(Math.min(was, now))};--len:${round(Math.abs(now - was))}`;
}

function tryNow(p, id, range) {
  const { age } = tryParam(p, id, range.value);
  return `现在 ${tryValueText(range.value, range.unit, p, id)}：${age === null ? '还到不了放假' : `${age} 岁放假`}`;
}

export function trySentence(p, id, value, range) {
  const before = tryParam(p, id, range.value), after = tryParam(p, id, value);
  const age = a => (a === null ? '到不了' : String(a));
  const odds = after.success === null || before.success === null ? '' : `，成功率 ${pct(before.success, 0)} → ${pct(after.success, 0)}`;
  const held = id === 'expense' ? '（退休支出不变）' : '';
  return `${tryValueText(range.value, range.unit, p, id)} → ${tryValueText(value, range.unit, p, id)}${held}：放假 ${age(before.age)} → ${age(after.age)} 岁${odds}`;
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

// Shares count only the people who answered that question, so a question added later starts from its own answers.
const crowdShare = (crowd, id, chosen) => {
  const counts = crowd.counts?.[id];
  const answered = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  if (crowd.status !== 'shown' || answered < MIN_SHOWN) return '';
  return `<span class="crowd-share">${Math.round(counts[chosen] / answered * 100)}% 也这么看</span>`;
};

export function scenarioHtml({ index, answers, base, effect, params, crowd = { status: 'idle' } }) {
  const total = SCENARIOS.length;
  if (index >= total) {
    const rows = SCENARIOS.map((s, i) => (answers[s.id] === undefined ? ''
      : `<li><button type="button" class="scn-goto" data-scn-goto="${i}"><span>${params[s.param].name}</span><b>${scenarioOptions(s, base)[answers[s.id]].label}</b>${crowdShare(crowd, s.id, answers[s.id])}</button></li>`)).join('');
    return `<p class="scn-done">这是你对未来年景的判断和现在的股票占比，点一项可以改。</p><ul class="scn-summary">${rows}</ul>${crowdHtml(crowd)}<p class="fine">打开专业模式后，可以一键带入这些假设。</p>`;
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

// impact null (the result is stopped): the card says what the number is, without anything worked out from it.
export function cardBody(param, impact, tryBlock = '') {
  const ref = param.range
    ? `${param.range.text} <a href="${param.range.sourceUrl}" target="_blank" rel="noopener">出处</a>`
    : param.noRangeReason;
  return `<p>${param.what}</p>${impact === null ? '' : `<p class="imp">${impactSentence(impact)}</p>`}${tryBlock}<p>${param.improve}</p><p class="ref">参考：${ref}</p>`;
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
    const q = { ...p, retExp: E };
    const t = oddsSolve(q);
    h += `<tr><td><b>${name}</b></td><td>${desc}</td><td class="num">${money(E, p.rCur)}</td><td class="num">${D(needLine(q)[0])}</td><td class="num">${t === null ? '—' : `${p.age + t} 岁`}</td></tr>`;
  }
  const coastDone = p.assets >= coast;
  h += `<tr><td><b>Coast FIRE</b></td><td>此后不再储蓄，靠复利在 ${p.pAge} 岁达到标准 FIRE</td><td class="num">${money(p.retExp, p.rCur)}</td><td class="num">${D(coast)}</td><td class="num">${coastDone ? '已达成' : `还差 ${D(coast - p.assets)}`}</td></tr>`;
  return `${h}</tbody><tfoot><tr><td colspan="5" class="fine">英文圈的 Lean / Fat 多按绝对金额分；本工具的轻装 / 宽裕按“和现在比”来分。</td></tr></tfoot>`;
}

export function heatHtml({ p, dispCur }) {
  const sav0 = p.income - p.expense;
  if (sav0 <= 0) return '<p class="fine">目前存不下钱，先把储蓄变成正数，这张表才有意义。</p>';
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const rOff = [-0.02, -0.01, 0, 0.01, 0.02];
  const sMul = [0.6, 0.8, 1, 1.2, 1.4, 1.6];
  const cells = rOff.map(dr => sMul.map(mul => {
    const q = buildParams({ ...p, income: sav0 * mul + p.expense }, p.fx);
    const t = oddsSolve({ ...q, r: p.r + dr });
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
    const poles = Object.entries(axis.poles).map(([letter, label]) => `<span class="pole${letter === axis.letter ? ' on' : ''}">${label}</span>`).join('');
    return `<div class="axis"><span class="axis-name">${axis.name}</span><span class="poles">${poles}</span><span class="axis-value">${axis.value}</span></div>`;
  }).join('');
  return `<div class="type-head"><span class="type-emoji" aria-hidden="true">${type.emoji}</span><div class="type-title"><div class="type-name">${type.name} · ${type.group}</div></div><div class="type-tags"><span class="pill">${type.status.name}</span></div></div>
    <p class="type-blurb">${type.blurb}</p><p class="type-weak">软肋：${type.weakness}</p><div class="axes">${axes}</div><p class="why">${type.status.why}</p>${next}`;
}

export function allTypesHtml() {
  const rules = AXES.map(a => `<li><b>${a.name}</b>：${a.rule}</li>`).join('');
  const groups = GROUPS.map(g => {
    const cells = TYPES.filter(t => t.group === g.name).map(t => `<div class="type-cell" data-code="${t.code}"><span class="type-emoji" aria-hidden="true">${t.emoji}</span><div><b>${t.name}</b><p>${t.blurb}</p></div></div>`).join('');
    return `<h3>${g.name} <span class="type-en">${g.blurb}</span></h3><div class="type-grid">${cells}</div>`;
  }).join('');
  return `<summary>全部 ${TYPES.length} 种类型和判定规则</summary><ul class="type-list">${rules}</ul>${groups}`;
}

const PLACES_SHOWN = 5;

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// One sentence for the town the person typed; empty until both the name and the spend are there.
export function townHtml(town, plan, p) {
  if (!town?.name || !(town.monthly > 0)) return '';
  const where = `在${escapeHtml(town.name)}每月花 ${wholeMoney(town.monthly, p.rCur)}`;
  // A spend below the mortgage and children's costs cannot hold them, so no age is given.
  if (plan.ignored) return `<p class="town-line">${where}：比月供和孩子的花销还少。把月供和孩子算进这里的花销，再看几岁能放假。</p>`;
  if (plan.age === null) return `<p class="town-line">${where}：按这个花销还到不了。</p>`;
  const years = Math.round(Math.abs(plan.gain) * 10) / 10;
  const move = plan.gain === null || years === 0 ? '' : plan.gain > 0 ? `，早 ${years} 年` : `，晚 ${years} 年`;
  return `<p class="town-line">${where}：${plan.age} 岁放假${move}（八成把握）。</p>`;
}

// The tag under the big age: the items that are counted, without an amount (the amount after they end is on the
// → rows under retirement spending). Empty when nothing is counted.
export function lifeTagText(rows) {
  const counted = rows.filter(r => (r.key === 'mortgage' || r.key === 'kids') && r.status === null);
  const parts = counted.map(r => (r.key === 'mortgage' ? `房贷到 ${r.end}` : `孩子到 ${r.end} 岁`));
  return parts.length ? `已算：${parts.join('、')} ›` : '';
}

// What counting the end of the items changes; told only inside the fold, never beside the big age.
export function lifeGainText(gain) {
  if (!gain) return '';
  if (gain.unreachableWithout) return '不算到期的话，按现在的计划到不了。';
  return gain.years >= 1 ? `算上到期，比不算早 ${gain.years} 年放假。` : '算上到期，放假年龄没变。';
}

// The title of the folded section carries its number: how much earlier the earliest place is than the current one.
export function placesTitle(rows) {
  const best = rows[0], here = rows.find(r => r.current);
  const gain = best && here && best.years !== null && here.years !== null ? here.years - best.years : 0;
  // Ages on the page are whole years, so the gain is too; the visa and insurance caveat sits in the notes inside.
  const years = Math.round(gain);
  return years >= 1 ? `换个地方放假：最多早 ${years} 年` : '换个地方放假';
}

export function placesHtml(rows, { all = false, home = 'CN' } = {}) {
  const longest = Math.max(...rows.map(r => r.years ?? 0), 1);
  const row = r => {
    const width = r.years === null ? 0 : Math.max(r.years / longest * 100, 1);
    const age = r.age === null ? '还到不了' : `${r.age} 岁`;
    const abroad = !r.current && r.code !== home ? '<span class="tag">未含签证 · 医保 · 回国机票</span>' : '';
    const tag = r.current ? '<span class="pill">当前</span>' : abroad;
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
    return moved ? { main: `最后剩下 ${D(base.endAssets)} → ${D(fifth.endAssets)}`, detail: `钱都撑到 ${fifth.endAge} 岁`, amount: true } : null;
  }
  const when = diff ? [`${diff > 0 ? '早' : '晚'} ${Math.abs(diff)} 年放假`] : [];
  return { main: `有钱花的假期 ${before} → ${after} 年`, detail: [...when, end].join(' · ') };
}

// The written life's own odds, and what its stock share costs in a bad year. It is a choice, not an improvement.
// Forward, the measure is the age itself; backward, the age is fixed and the odds move.
export function fifthOddsHtml(f) {
  if (!f) return '';
  const known = v => v !== null && v !== undefined;
  let when;
  if (f.mode === 'bwd') {
    const odds = known(f.success) ? oddsText(f.success) : '';
    const before = known(f.baseSuccess) ? oddsText(f.baseSuccess) : '';
    const was = before && before !== odds ? `（原来${/^\d/.test(before) ? ' ' : ''}${before}）` : '';
    when = odds ? `${f.age} 岁放假，${odds}${was}` : `${f.age} 岁放假`;
  } else if (f.age === null) {
    when = '规划期内到不了八成把握';
  } else {
    const was = !known(f.baseAge) ? '' : f.baseAge === f.age ? '，和原来一样' : `（原来 ${f.baseAge} 岁）`;
    when = `八成把握的放假年龄是 ${f.age} 岁${was}`;
  }
  const drop = Number.isFinite(f.worstYear) ? `20 年一遇的坏年份，这个配置约跌 ${Math.round(-f.worstYear * 100)}%。` : '';
  return `<p class="fifth-odds">按你的判断重算：${when}。上面那条是最难的一种年景。${drop}这是你选的配置下的结果，不代表更好。</p>`;
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

// The line under a split spending: what the locked total adds up from (monthly; the professional view's yearly total
// is the parts × 12), and the way back to the one total typed before the split. before is that total, yearly.
// The operators are not read out; the sum says in words what it adds up.
const SPLIT_KEYS = ['split.rent', 'split.food', 'split.other'];
const OP = op => `<span aria-hidden="true">${op}</span>`;
export function splitLineHtml(row, { view, wCur }) {
  if (!row) return '';
  const simple = view !== 'pro';
  const values = row.parts.map(v => v ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  const parts = values.map(num).join(` ${OP('+')} `);
  const sum = simple ? `${OP('=')} ${parts}` : `(${parts}) ${OP('×')} 12`;
  const named = values.map((v, i) => `${FIELD_LABEL.simple[SPLIT_KEYS[i]]} ${num(v)}`).join('，');
  const label = simple ? `三项合计 ${num(total)}：${named}` : `三项合计每月 ${num(total)} × 12 = ${num(total * 12)}：${named}`;
  const back = row.before === null || row.before === undefined ? '' : ` ${wholeMoney(row.before / (simple ? 12 : 1), wCur)}`;
  return `<span class="split-sum" role="group" aria-label="${label}">${sum}</span><button type="button" class="link" data-unsplit>只填总数${back}</button>`;
}

// ---- The lines under the fields: what a number holds, why it is stopped, and what is left once the items end.

// A relation as one line of text: the names and amounts on the left, then the operator and the other side. An item
// that has ended is struck through with its fact (HTML, read as 已结束，不计入). A year (left item flagged year: true)
// is written without grouping, on both sides.
const plainYear = v => (v < 0 ? `−${Math.abs(v)}` : String(v));
export function relText(rel) {
  if (rel.ended) return `<span aria-label="已结束，不计入">└ 其中<s>${rel.label} ${num(rel.value)}${rel.unit ?? ''}</s> ${rel.fact}</span>`;
  const { sub, left, op, right } = rel;
  const fmt = left.length === 1 && left[0].year ? plainYear : num;
  const sum = left.reduce((total, x) => total + x.value, 0);
  const lhs = `${left.map(x => x.label).join(' + ')} ${fmt(sum)}${left[0].unit ?? ''}`;
  const rhs = !op ? '' : right.range ? ` ${op} ${right.range[0]}–${right.range[1]}`
    : ` ${op} ${right.label ? `${right.label} ` : ''}${fmt(right.value)}${right.unit ?? ''}`;
  return `${sub ? '└ 其中' : ''}${lhs}${rhs}`;
}

// A live relation in HTML: < and > escaped, the └ not read out (其中 is).
const liveHtml = rel => relText(rel).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/^└ /, `${OP('└')} `);
const X = '<span class="x" aria-label="拦住">✕</span>';
const WARN = '<span aria-label="提示">!</span>';
const NONE = '<span aria-label="没有数">—</span>';
const TOOL_TAG = '<span class="tool">本工具设定</span>';

// A range rule, drawn under its own field; the field points at it with aria-describedby.
export const fieldLineHtml = q => `<p class="row bad" id="rel-${q.field}">${liveHtml(q.rel)} ${X}</p>`;

// The exit buttons. data-fix carries only the action (set, focus, clear, reset, unsplit); the text is the button's.
export function fixesHtml(fixes = []) {
  return fixes.map(({ text, aria, ...act }) => {
    const data = JSON.stringify(act).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
    return `<button type="button" class="ghost fix" data-fix='${data}'${aria ? ` aria-label="${aria}"` : ''}>${text}</button>`;
  }).join('');
}

// The lines under monthly spending (at 'expense') or retirement spending (at 'retExp'), from storyRows and the
// problems to show (a stop not yet shown draws its item plainly, not red). Under spending: the split's sum (its
// before is the stored yearly total, as splitLineHtml takes it), the items it holds (counted, ended, or the stopped
// relation), and the orange line when spending is above income. Under retirement spending: the items again, and one
// → row per end age still to come, with what is left from then on. note: the professional view's own line for this
// field (proLinesHtml), after the items under spending, first under retirement spending.
export function fieldLinesHtml({ rows, list, at, view, wCur, rCur, note = '' }) {
  const pro = view === 'pro';
  const unit = pro ? '/年' : '';
  const stop = list.find(q => q.kind === 'block' && q.rel?.sub && q.at === at);
  const item = r => {
    if (r.status === 'ended') return `<p class="row ended">${relText({ ...r.rel, value: r.value ?? r.rel.value, unit })}</p>`;
    // A half-filled group (A5) adds no line; a range rule is drawn under its own field.
    if (r.status === 'blank' || (r.status === 'block' && !r.rel?.sub)) return '';
    if (r.status === 'block' && stop) return `<p class="row bad" id="rel-${stop.field}">${liveHtml(stop.rel)} ${X}</p>`;
    if (r.status === 'block') return `<p class="row">${liveHtml({ ...r.rel, op: null })}</p>`;
    const [name, end] = r.label.split(' → ');
    const amount = r.value === null ? NONE : `${num(r.value)}${unit}`;
    return `<p class="row">${OP('└')} 其中${name} ${amount}${end ? ` ${OP('→')} ${end}` : ''}${r.tag ? ` ${TOOL_TAG}` : ''}</p>`;
  };
  const items = rows.filter(r => r.op === '└' && r.under === at).map(item);
  if (at === 'expense') {
    const split = rows.find(r => r.key === 'split');
    const sum = split ? `<p class="split-line" id="split-line-${pro ? 'p' : 's'}">${splitLineHtml(split, { view, wCur })}</p>` : '';
    const b14 = list.find(q => q.rule === 'B14');
    const save = b14 ? `<p class="row warn">${WARN} ${liveHtml(b14.rel)}${b14.note ? ` · ${b14.note}` : ''}</p>` : '';
    const a11 = list.find(q => q.rule === 'A11');
    const spare = a11 ? `<p class="row warn">${OP('└')} ${a11.note} ${WARN}</p>` : '';
    return sum + items.join('') + spare + note + save;
  }
  const today = rows.find(r => r.key === 'expense')?.value;
  const after = rows.filter(r => r.key.startsWith('after:')).map(r => {
    const money = r.value === null ? NONE : wholeMoney(r.value, rCur);
    const low = pro && today !== null && today !== undefined ? ` &lt; 现在 ${wholeMoney(today, wCur)} × ${num(LIMITS.low * 100)}% ${TOOL_TAG}` : '';
    const amount = r.status === 'flag' && r.value !== null ? `<span class="warn">${WARN} ${money}</span>${low}` : money;
    return `<p class="row after"><span>${OP('→')} ${r.ages[0]} 岁起</span> <span class="amt">${amount}</span></p>`;
  });
  return note + items.join('') + after.join('');
}

// The red chip on a stopped result: a blank first (nothing can be worked out without it), else a block.
export function chipText(list) {
  const blanks = list.filter(q => q.kind === 'blank');
  const stops = blanks.length ? blanks : list.filter(q => q.kind === 'block');
  if (!stops.length) return '';
  const word = blanks.length ? '待填' : '拦住';
  return stops.length === 1 ? `${word}：${stops[0].chip} ›` : `${word} ${stops.length} 处 ›`;
}

const NO_RESULT = '<span aria-label="暂无结果">—</span>';
// The ledger's switch at the end of the fund line: ▸ closed, ▾ open (spec §7.1).
export const ledgerToggleHtml = (open = false) => `<button type="button" class="ledger-toggle" aria-expanded="${open}" aria-controls="ledger">怎么算的 <span aria-hidden="true">${open ? '▾' : '▸'}</span></button>`;
// The big age and the fund while the result is stopped; the ledger still opens.
export const heldHeroHtml = (open = false) => `<div class="hero-big">${NO_RESULT} 岁放假</div><div class="fund"><p>放假资金 — ${ledgerToggleHtml(open)}</p></div>`;
// The headline while the result is stopped; the simple view has only the big age.
export const heldHeadHtml = view => (view === 'pro' ? `<p class="say">财务独立 ${NO_RESULT} 岁</p>` : '');

// ---- The ledger behind the fund line (spec §7): ① saving, ② after the holiday, ③ the 2,000 years, every number from
// storyRows (① ②) and the odds (③). Two columns, label | number. Rows with a field go back to it. While the result is
// held the rows stop at the first blocked or blank one; what follows is a fixed line each, with no number.
// state: 'ok' | 'held' | 'unreachable' | 'now'. The professional ledger (spec §7.3) speaks in years and adds the rows
// only it has: the real payment, the floor, the cut after a fall, the drift, the formulas of ③.
const METHOD = { now: 'accumulate', after: 'need-line', odds: 'odds' };
const methodLink = id => `<a href="method.html#${id}">计算方法 ›</a>`;
// The spaces between the cells are for reading the text as text (a copy, a screen reader); the layout ignores them.
const lgRow = (label, n = '', cls = '') => `<div class="lg-row${cls ? ` ${cls}` : ''}"><span class="lg-l">${label}</span> <span class="lg-n">${n}</span></div>`;
const lgOp = op => `<span class="lg-op" aria-hidden="true">${op ?? ''}</span> `;
const fieldLink = (field, text) => (field ? `<button type="button" class="link" data-field="${field}">${text}</button>` : text);
const agesText = ages => {
  const [a, b] = ages ?? [];
  if (a === null || a === undefined) return '';
  return `<span class="lg-age">${b === null || b === undefined ? `${a} 起` : a === b ? `${a}` : `${a}–${b}`}</span> `;
};
const GO = '<span aria-hidden="true">›</span>';
const struckHtml = names => `<s aria-label="已结束，不计入">${names.join('、')}</s>`;
const dotsHtml = count => {
  const on = Math.floor(count * 10 / 2000);
  return `<span class="dots" aria-hidden="true">${'●'.repeat(on)}${'○'.repeat(10 - on)}</span>`;
};
const chengText = share => (peopleOf(share) === 0 ? '不到 1 成' : `${peopleOf(share)} 成`);
const isSet = v => v !== null && v !== undefined;
// The professional ③ inputs: a stop in one of them stops the ledger at the r row (spec §7.4).
const THIRD_FIELDS = ['eq', 'eqReal', 'bondY', 'infl', 'drag', 'sigEq', 'sigBd', 'rho', 'swr'];
const PATHS_TEXT = DEFAULT_PATHS.toLocaleString('en-US');
const PRO_THIRD = `③ ${PATHS_TEXT} 条路径 · 种子 ${DEFAULT_SEED}`;

export function ledgerHtml({ rows, list = [], odds = [], plan = null, state = 'ok', view = 'simple', mode = 'fwd', p = null, dispCur, rCur = null, mc = null, bwdOdds = null }) {
  const pro = view === 'pro';
  const labels = FIELD_LABEL[pro ? 'pro' : 'simple'];
  const wCur = p ? p.wCur : dispCur;
  const retCur = p ? p.rCur : rCur ?? dispCur;
  const curOf = r => (r.cur === 'retire' ? retCur : wCur);
  const signed = (v, c) => (v === null || v === undefined ? NONE : v < 0 ? `−${wholeMoney(-v, c)}` : wholeMoney(v, c));
  const flagged = amount => `<span class="warn"><span aria-label="提示">!</span> ${amount}</span>`;
  const held = state === 'held';
  // A percentage below zero is written with U+2212, as every number on the page is.
  const spct = (v, d) => pct(v, d).replace('-', '−');

  // A stopped or blank row: the very relation drawn under the field, or its label and 待填.
  const stopRow = r => {
    const sub = r.op === '└' || r.rel?.sub;
    if (r.status === 'blank') {
      const label = r.op === '└' ? `${OP('└')} 其中${r.label ?? ''}` : r.label ?? labels[r.field] ?? '';
      return lgRow(`${sub ? '' : lgOp(r.op)}${fieldLink(r.field, label)}`, `待填 ${GO}`, `${sub ? 'sub ' : ''}bad go`);
    }
    // The relation stands alone: an operator before "每月支出 −500 < 0" would be read into it.
    const text = r.rel ? liveHtml(r.rel) : r.label ?? labels[r.field] ?? '';
    return lgRow(`${sub ? '' : lgOp()}${fieldLink(r.field, text)}`, `${X} ${GO}`, `${sub ? 'sub ' : ''}bad go`);
  };
  const simpleRow = r => {
    if (r.value === 0 && r.key !== 'pension') return '';
    const c = curOf(r);
    switch (r.key) {
      case 'have': return lgRow(`${lgOp()}${fieldLink(r.field, r.label)}`, r.value === null ? NONE : r.value < 0 ? `−${roughMoney(-r.value, c)}` : roughMoney(r.value, c));
      case 'income':
      case 'expense': return lgRow(`${lgOp(r.op)}${fieldLink(r.field, r.label)}`, r.value === null ? NONE : `${signed(r.value, c)}/月`);
      case 'split': return lgRow(fieldLink(r.field, `${OP('=')} ${r.parts.map(v => num(v ?? 0)).join(` ${OP('+')} `)}`), '', 'sub');
      case 'mortgage':
      case 'kids': {
        if (r.status === 'ended') return lgRow(relText({ ...r.rel, value: r.value ?? r.rel.value }), '', 'sub ended');
        const end = r.key === 'kids' ? `${r.end} 岁` : r.end;
        return lgRow(fieldLink(r.field, `${OP('└')} 其中${r.label} ${r.value === null ? NONE : num(r.value)} ${OP('→')} ${end}`), '', 'sub');
      }
      case 'save': {
        const amount = signed(r.value, c);
        return lgRow(`${lgOp('=')}<b>${r.label}</b>`, r.status === 'flag' ? flagged(amount) : `<b>${amount}</b>`, 'sum');
      }
      case 'growth': return lgRow(`${lgOp()}${r.label} ${TOOL_TAG}`);
      // Below zero it is written with U+2212 and the orange ! of the 每月存下 row.
      case 'saveLate': return lgRow(`${lgOp()}${r.label.replace(/^→ /, `${OP('→')} `)}`, r.value < 0 ? flagged(signed(r.value, c)) : signed(r.value, c));
      case 'retExp': {
        const est = r.status === 'est' ? '<span class="est" aria-label="估算">≈</span> ' : '';
        return lgRow(`${lgOp()}${agesText(r.ages)}${fieldLink(r.field, r.label)}${r.struck ? ` ${struckHtml(r.struck)}` : ''}`, r.value === null ? NONE : `${est}${wholeMoney(r.value, c)}`);
      }
      case 'self': return lgRow(`${lgOp()}${agesText(r.ages)}${fieldLink(r.field, r.label)}`, r.value === null ? NONE : `+${wholeMoney(r.value, c)}`);
      case 'pension': return r.value === null
        ? lgRow(`${lgOp()}${agesText(r.ages)}${fieldLink(r.field, r.label)}`, `${NONE} ${GO}`, 'go')
        : lgRow(`${lgOp()}${agesText(r.ages)}${fieldLink(r.field, r.label)}`, signed(r.value, c));
      default:
        if (r.key.startsWith('after:')) {
          const amount = r.value === null ? NONE : signed(r.value, c);
          return lgRow(`${lgOp()}${agesText(r.ages)}${struckHtml(r.struck)}`, r.status === 'flag' && r.value !== null ? flagged(amount) : amount);
        }
        return '';
    }
  };
  // The professional rows: yearly amounts in full, the tool's settings tagged, the rows only this view has.
  const savingFlag = rows.find(r => r.key === 'save')?.status === 'flag';
  // A long linked label (class lnk) sits beside its age and wraps inside itself at 390 px, not under them.
  const proRow = r => {
    if (r.value === 0 && !['pension', 'flexCut', 'fxDrift'].includes(r.key)) return '';
    const c = curOf(r);
    const tag = r.tag ? ` ${TOOL_TAG}` : '';
    switch (r.key) {
      case 'have': return lgRow(`${lgOp()}${fieldLink(r.field, r.label)}`, signed(r.value, c));
      // 税后年收入 · 实际增长 +2%/年: each part goes back to its own field.
      case 'income': {
        const [name, growth] = r.label.split(' · ');
        return lgRow(`${lgOp(r.op)}${fieldLink(r.field, name)} · ${fieldLink('growth', growth)}${tag}`, signed(r.value, c));
      }
      case 'expense': return lgRow(`${lgOp(r.op)}${fieldLink(r.field, r.label)}${tag}`, signed(r.value, c));
      case 'split': return lgRow(fieldLink(r.field, `(${r.parts.map(v => num(v ?? 0)).join(` ${OP('+')} `)}) ${OP('×')} 12`), '', 'sub');
      case 'mortgage':
      case 'kids': {
        if (r.status === 'ended') return lgRow(relText({ ...r.rel, value: r.value ?? r.rel.value, unit: '/年' }), '', 'sub ended');
        // The children's label carries its own end (→ 22 岁（按最小的）); the mortgage's is its year.
        const [name, end = r.end] = r.label.split(' → ');
        return lgRow(fieldLink(r.field, `${OP('└')} 其中${name} ${r.value === null ? NONE : `${num(r.value)}/年`} ${OP('→')} ${end}`) + tag, '', 'sub');
      }
      case 'mortgageReal': return lgRow(r.label, `t = ${Math.max(plan.t - 1, 0)} 时 ${wholeMoney(r.value, c)}`, 'sub');
      case 'save': {
        const pair = r.values ? r.values.map(num).join(` ${OP('→')} `) : signed(r.value, c);
        const label = r.values ? `${r.label} t0 ${OP('→')} t${plan.t - 1}` : r.label;
        return lgRow(`${lgOp('=')}<b>${label}</b>`, r.status === 'flag' ? flagged(pair) : `<b>${pair}</b>`, 'sum');
      }
      case 'floor': return lgRow(`${lgOp()}${r.label}${tag}${savingFlag ? ` ${flagged('存款用完后按 0 算')}` : ''}`);
      case 'retExp': {
        const est = r.status === 'est' ? '<span class="est" aria-label="估算">≈</span> ' : '';
        return lgRow(`${lgOp()}${agesText(r.ages)}${fieldLink(r.field, r.label)}${r.struck ? ` ${struckHtml(r.struck)}` : ''}`, r.value === null ? NONE : `${est}${wholeMoney(r.value, c)}`);
      }
      case 'retReal': return lgRow(r.label, wholeMoney(r.value, c), 'sub');
      // Self-pay with no amount still says until when it would run: → 63.
      case 'self': {
        const ages = r.value === null && isSet(r.ages?.[1]) ? `<span class="lg-age">${OP('→')} ${r.ages[1]}</span> ` : agesText(r.ages);
        return lgRow(`${lgOp()}${ages}${fieldLink(r.field, r.label)}`, r.value === null ? NONE : `+${wholeMoney(r.value, c)}`, 'lnk');
      }
      case 'pension': {
        const label = `${lgOp()}${agesText(r.ages)}${fieldLink(r.field, r.label)}`;
        if (r.value === null) return lgRow(label, `${NONE} ${GO}`, 'go lnk');
        return lgRow(label, r.status === 'flag' ? flagged(signed(r.value, c)) : signed(r.value, c), 'lnk');
      }
      case 'flexCut': return lgRow(`${lgOp()}${fieldLink(r.field, r.label)}`, r.value === null ? NONE : `${num(r.value)}%`, 'lnk');
      case 'fxDrift': return lgRow(`${lgOp()}${fieldLink(r.field, r.label)}`, r.value === null ? `${NONE} 同币种` : `${num(r.value)}%`, 'lnk');
      case 'cross': return lgRow(`${lgOp()}<span class="est" aria-label="估算">≈</span>${r.label.replace(/^≈/, '')}`);
      default: return simpleRow(r);
    }
  };
  const rowHtml = r => {
    if (r.status === 'block' || r.status === 'blank') return stopRow(r);
    return pro ? proRow(r) : simpleRow(r);
  };
  // The rows the ledger draws: not the other view's, not the → rows folded into the first ② row (they are for the
  // line under the field), not the └ rows under retirement spending (the field line's), not ⇒ and its N.
  const shown = r => r.views !== (pro ? 'simple' : 'pro') && !r.folded && !r.key.startsWith('ret:') && r.key !== 'need' && r.key !== 'times';
  const head = (title, right = '') => lgRow(`<b>${title}</b>`, right, 'head');
  const sec = (body, cls = '') => `<div class="lg-sec${cls ? ` ${cls}` : ''}">${body}</div>`;
  const more = id => `<div class="lg-more">${methodLink(id)}</div>`;
  const foot = id => (pro
    ? `<div class="lg-foot"><span>${TOOL_TAG} · 按今天的钱 · 实际收益</span> ${methodLink(id)}</div>`
    : `<div class="lg-foot"><span><span class="est">≈</span> 估算 · 按今天的钱</span> ${methodLink(id)}</div>`);
  const none = (label, op) => lgRow(`${lgOp(op)}${label}`, NONE, 'wait');
  const saveLabel = pro ? '年储蓄' : '每月存下';
  const afterRight = pro ? '年初取出' : '每月花';

  if (held) {
    // Only the stops the page shows (list) stop the ledger; a stop still being typed is drawn as a plain row.
    const live = new Set(list.filter(q => q.kind === 'block' || q.kind === 'blank').map(q => q.id));
    const isStopped = r => r.status === 'block' || r.status === 'blank';
    rows = rows.map(r => (isStopped(r) && r.stop && !live.has(r.stop) ? { ...r, status: null } : r));
    let cut = rows.findIndex(isStopped);
    let drawn = cut < 0 ? [] : rows.slice(0, cut + 1);
    if (cut < 0) {
      const q = list.find(x => x.kind === 'blank') ?? list.find(x => x.kind === 'block');
      const stopped = q ? { key: 'stop', section: 'now', status: q.kind, rel: q.rel, field: q.field, label: labels[q.field] ?? q.field, op: null } : null;
      // A ③ input (the professional view's assumptions): ① and ② as they are, the line waits, ③ stops at the r row.
      if (pro && stopped && THIRD_FIELDS.includes(q.field)) {
        const all = s => rows.filter(r => r.section === s && shown(r)).map(rowHtml).join('');
        const needLabel = rows.find(r => r.key === 'need')?.label ?? '';
        return sec(head('① 攒钱') + all('now')) + sec(head('② 放假以后', afterRight) + all('after') + none(needLabel, '⇒'))
          + sec(head(PRO_THIRD, TOOL_TAG) + stopRow(stopped) + none('③ 放假年龄', '⇒')) + foot(METHOD.odds);
      }
      // A stop on a field with no row of its own (the age, say) stands first, in its own words.
      drawn = stopped ? [stopped] : [];
      cut = 0;
    }
    const at = drawn.length ? drawn[drawn.length - 1].section : 'now';
    const draw = s => drawn.filter(r => r.section === s && shown(r)).map(rowHtml).join('');
    const first = sec(head('① 攒钱') + draw('now') + (at === 'now' ? none(saveLabel, '=') : ''));
    const second = at === 'after' ? sec(head('② 放假以后', afterRight) + draw('after')) : '';
    return first + second + sec(none(pro ? '放假线' : '② 要有', '⇒') + none('③ 放假年龄', '⇒'), 'wait') + foot(METHOD[at]);
  }

  const { t } = plan;
  const age = p.age, holiday = p.age + t;
  const now = state === 'now';
  const unreachable = state === 'unreachable';
  const bwd = mode === 'bwd';
  // ② in age order: a row that starts at or before the holiday (the pension, when the holiday comes later) starts at it.
  // The professional rows with no age follow: the real payment its first row, the cut, the drift and the estimate last.
  const fromHoliday = r => (r.section === 'after' && r.ages && r.ages[0] !== null && r.ages[0] !== undefined && r.ages[0] < holiday
    ? { ...r, ages: [holiday, r.ages[1] !== null && r.ages[1] !== undefined && r.ages[1] < holiday ? holiday : r.ages[1]] } : r);
  // Self-pay with no amount is drawn as → 63, so it sorts at the claim age.
  const startOf = r => (r.key === 'self' && r.value === null && isSet(r.ages?.[1]) ? r.ages[1]
    : r.ages && isSet(r.ages[0]) ? r.ages[0] : r.ages || r.key === 'retReal' ? holiday : Infinity);
  const draw = s => rows.filter(r => r.section === s && shown(r)).map(fromHoliday)
    .map((r, i) => [r, i]).sort(([a, i], [b, j]) => (s === 'after' ? startOf(a) - startOf(b) : 0) || i - j).map(([r]) => r)
    .map(rowHtml).join('');
  const span = pro ? `t = 0…${t - 1}` : `${age} ${OP('→')} ${holiday} 岁`;
  const first = now
    ? sec(head('① 攒钱', '不用再攒'))
    : sec(head('① 攒钱', span) + draw('now') + more(METHOD.now));
  const needRow = rows.find(r => r.key === 'need');
  const times = rows.find(r => r.key === 'times')?.value;
  const noLine = unreachable || !needRow || needRow.value === null;
  let line = '';
  if (!noLine && pro) {
    // The implied rate: what the first holiday year takes from savings, over the line (spec §9.2), the N 倍's denominator.
    line = lgRow(`${lgOp('⇒')}<b>${needRow.label}</b>`, `<b>${wholeMoney(needRow.value, wCur)}</b>`, 'sum')
      + `<p class="lg-note">${times ? `≈ 年支出 × ${times} 倍 · ` : ''}反推提取率 ${pct(firstDraw(p, t) / needRow.value, 1)} · 对照 3.9%</p>`;
  } else if (!noLine) {
    line = lgRow(`${lgOp('⇒')}<b>${needRow.label}</b>`, `<b>${roughMoney(needRow.value, wCur)}</b>`, 'sum')
      + `<p class="lg-note">${times ? `≈ 年支出 × ${times} 倍 · ` : ''}八成年景够花到 ${p.life} 岁</p>`;
  }
  const second = sec(head(unreachable ? `② 如果 ${holiday} 岁放假` : '② 放假以后', afterRight) + draw('after') + line + more(METHOD.after));
  // ③: the years round the holiday; one year when it is today, out of reach, or chosen (working backward).
  const one = now || unreachable || bwd;
  const years = one ? odds.filter(o => o.t === t) : odds;
  const yearLabel = o => (now && o.t === 0 ? '今天' : bwd ? `${o.age} 岁（你定的）` : `${o.age} 岁`);
  const pick = o => o.t === t && !unreachable && !bwd;
  const oddsRows = years.map(o => (pro
    ? lgRow(`${lgOp()}<span class="lg-year">${yearLabel(o)}</span> ${o.count.toLocaleString('en-US')} / ${PATHS_TEXT}`, pct(o.share, 1), pick(o) ? 'pick' : '')
    : lgRow(`${lgOp()}<span class="lg-year">${yearLabel(o)}</span> ${dotsHtml(o.count)}`, chengText(o.share), pick(o) ? 'pick' : ''))).join('');
  let after = '';
  if (unreachable) after = lgRow(`${lgOp()}规划期内到不了八成`);
  // Working backward with savings already enough, the card's words, not a saving of ¥0.
  else if (bwd && bwdOdds && pro) after = lgRow(`${lgOp('⇒')}${bwdOdds.enough ? '现在的存款已经够了' : `要 80%：第一年储蓄 ${wholeMoney(bwdOdds.s0, wCur)}`}`, '', 'sum');
  else if (bwd && bwdOdds) after = lgRow(`${lgOp('⇒')}${bwdOdds.enough ? '现在的存款已经够了' : `要八成：第一年每月存 ${wholeMoney(bwdOdds.s0 / 12, wCur)}`}`, '', 'sum');
  else if (!now) after = lgRow(`${lgOp('⇒')}<b>${pro ? '第一个到 80%' : '第一个到八成'}</b>`, `<b>${holiday} 岁</b>`, 'sum');
  if (!pro) return first + second + sec(head('③ 2,000 种年景', `平均每年 ${pct(p.r, 1)} ${TOOL_TAG}`) + oddsRows + after) + foot(METHOD.odds);

  // The professional ③: the return and the spread as the engine forms them, the counts, the year picked, the
  // interpolated years with the median at the holiday, and the fixed-return age for comparison.
  const b13 = list.find(q => q.rule === 'B13');
  const rText = `r = ${num(p.eq)}% × ${num(p.eqReal)}% + ${num(100 - p.eq)}% × (${num(p.bondY)}% − ${num(p.infl)}%) − ${num(p.drag)}%`;
  const rRow = lgRow(`${lgOp()}${rText}${b13 ? ` ${flagged(b13.note)}` : ''}`, spct(p.r, 2));
  const sRow = lgRow(`${lgOp()}σ（股 ${num(p.sigEq * 100)}% · 债 ${num(p.sigBd * 100)}% · ρ ${num(p.rho)}）`, pct(p.sigma, 1));
  const median = mc?.bands?.[t] ? wholeMoney(mc.bands[t][2], wCur) : NONE;
  const lerp = state === 'ok' && !bwd && t > 0 ? oddsYears(p) : null;
  const medianRow = unreachable ? '' : lgRow(`${lgOp()}${lerp === null ? '' : `插值 ${lerp.toFixed(1)} 年 · `}${holiday} 岁中位资产`, median);
  const fixed = fwdSolve(p);
  const fixedRow = lgRow(`${lgOp()}按固定收益算（约五成）`, fixed === null ? NONE : `${p.age + fixed} 岁`);
  return first + second + sec(head(PRO_THIRD, TOOL_TAG) + rRow + sRow + oddsRows + after + medianRow + fixedRow) + foot(METHOD.odds);
}

// The professional fund line, the ledger closed (spec §7.1): the line and the odds; held, no number; out of reach, the
// headline's words.
export function proLedgerRowHtml({ held = false, need = null, success = null, cur = 'CNY', open = false } = {}) {
  let text;
  if (held) text = `放假线 ${NO_RESULT}`;
  else if (need === null) text = '规划期内未达到';
  else text = `放假线 ${wholeMoney(need, cur)}${success === null ? '' : ` · ${pct(success, 1)}`}`;
  return `<p>${text} ${ledgerToggleHtml(open)}</p>`;
}

// One retirement-currency unit in the work currency, as printed: two decimals from 0.1, else three significant digits
// (1 JPY = 0.00667 USD, never 0.00). The ≈ line divides by this same printed value.
function rateText(p) {
  const value = p.fx[p.wCur] / p.fx[p.rCur];
  return value >= 0.1 ? value.toFixed(2) : value.toPrecision(3);
}

// The professional view's own lines in the form (spec §8.3, §10.3), keyed by where they go: the exchange rate under
// the region, the mortgage's nominal note under spending, the cross-country estimate under 年支出, the pension cap
// (and B12) under the pension, and each B11 flag under its own field.
export function proLinesHtml({ S, p, data, list = [], rows = [] }) {
  const out = { region: '', expense: '', retExp: '', pension: '' };
  const wCur = p.wCur, rCur = p.rCur;
  const rate = rateText(p);
  if (wCur !== rCur) out.region = `<p class="row">汇率 1 ${rCur} = ${rate} ${wCur}</p>`;
  // A mortgage counted: its row under spending, plain or in a relation (A2, A3), not ended, not waiting or out of range.
  const m = rows.find(r => r.key === 'mortgage');
  const counted = rows.some(r => r.key === 'items') || (m && (m.status === null || (m.status === 'block' && m.rel?.sub)));
  if (counted) out.expense = `<p class="row">月供按名义值 · 实际 × (1 + ${num(p.infl)}%)^−t</p>`;
  // The same sum estimateRetireSpend works out, in its order: the rest at local prices, the items at the market rate.
  if (S.workC !== S.retC && !S.touched?.retExp && isSet(S.expense)) {
    const ratio = data.countries[S.retC].priceLevel.value / data.countries[S.workC].priceLevel.value;
    const items = itemsYearly(S);
    const tail = `× 物价比 ${ratio.toFixed(2)} ÷ 汇率 ${rate}`;
    const est = '<span class="est" aria-label="估算">≈</span>';
    out.retExp = items > 0
      ? `<p class="row">${est} (${num(S.expense)} − 月供和孩子 ${num(items)}) ${tail} + 月供和孩子 ${num(items)} ÷ 汇率 ${rate}</p>`
      : `<p class="row">${est} ${num(S.expense)} ${tail}</p>`;
  }
  const b12 = list.find(q => q.rule === 'B12');
  out.pension = `<p class="row">养老金上限 = 年支出</p>${b12 ? `<p class="row warn">${WARN} ${liveHtml(b12.rel)} · ${b12.note}</p>` : ''}`;
  for (const q of list) if (q.rule === 'B11') out[q.field] = `<p class="row warn">${WARN} ${q.note}</p>`;
  return out;
}

export function stickyHtml(h, { p, dispCur, success, pro, chip = '' }) {
  if (chip) return `<b class="sticky-age">${pro ? `财务独立 ${NO_RESULT} 岁` : `${NO_RESULT} 岁放假`}</b><button type="button" class="chip" data-chip>${chip}</button>`;
  if (pro) {
    const age = h.reachable ? `财务独立 ${h.holidayAge} 岁` : '规划期内未达到';
    const odds = success === null || success === undefined ? '' : `<span>成功率 ${pct(success, 0)}</span>`;
    return `<b class="sticky-age">${age}</b><span>放假线 ${money(toDisplay(h.fund.need, p, dispCur), dispCur)}</span>${odds}<span class="sticky-more">实际收益 ${pct(p.r, 2)}</span>`;
  }
  if (!h.reachable) return '<b class="sticky-age">还在路上</b><span>先看提前的办法</span>';
  const age = h.workYears === 0 ? '现在就能放假' : `${h.holidayAge} 岁放假`;
  const bar = `<span class="sticky-bar-mini" aria-hidden="true"><i style="width:${(h.workYears / (h.workYears + h.holidayYears) * 100).toFixed(1)}%"></i></span>`;
  const odds = h.people === null || !h.label ? '' : `<span>${h.label}</span>`;
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

export function heroHtml(h, { p, dispCur, open = false }) {
  const D = v => money(toDisplay(v, p, dispCur), dispCur);
  const total = h.workYears + h.holidayYears;
  const share = v => (v / total * 100).toFixed(1);
  let big;
  // Out of reach, the headline above already says so; the hero starts with what is true today.
  if (!h.reachable) big = '';
  else if (h.workYears === 0) big = `<span class="hero-rest">现在就能放假 <b>${h.holidayYears}</b> 年</span>`;
  else big = `<span class="hero-work">再上 <b>${h.workYears}</b> 年班</span><span class="hero-arrow">→</span><span class="hero-rest">放假 <b>${h.holidayYears}</b> 年</span>`;
  const work = h.workYears ? `<i class="work" style="width:${share(h.workYears)}%"></i>` : '';
  const rest = h.holidayYears ? `<i class="rest" style="width:${share(h.holidayYears)}%"></i>` : '';
  const mid = h.reachable && h.workYears ? `<span>${h.holidayAge} 岁放假</span>` : '';
  const mondays = h.mondays ? `<p class="hero-mondays">还有 <b>${h.mondays.toLocaleString('zh-CN')}</b> 个周一</p>` : '';
  const people = h.people === null ? '' : `<div class="people" role="img" aria-label="10 个平行的你，${h.people} 个的钱够花到 ${h.endAge} 岁"><div class="people-row">${Array.from({ length: 10 }, (_, i) => personSvg(i < h.people)).join('')}</div><p>10 个平行的你，<b>${h.people}</b> 个的钱够花到 ${h.endAge} 岁</p></div>`;
  const fundPct = Math.round(h.fund.share * 100);
  const lasted = h.success === null || h.success === undefined ? '' : `${Math.round(h.success * 2000).toLocaleString('en-US')} 次`;
  const why = `<p>按本工具假设模拟 2,000 次，${lasted ? `其中 ${lasted}` : '至少 1,600 次'}的钱够花到 ${h.endAge} 岁。</p>`;
  const r = h.ruler;
  // Forward, the ruler carries the odds and their explanation; backward there is no ruler, so the odds stand alone.
  const ruler = h.reachable && r && r.eight !== null
    ? `<details class="hero-ruler"><summary aria-label="把握尺">把握：${[['五成', r.five], ['八成', r.eight], ['九成', r.nine]].map(([k, v]) => `<span class="step${k === '八成' ? ' on' : ''}">${k} ${v === null ? '到不了' : `${v} 岁`}</span>`).join('')}<span class="odds-q" aria-label="八成把握是什么意思">?</span></summary>${why.replace('<p>', '<p>八成把握：')}</details>`
    : '';
  const sure = !ruler && h.reachable && h.label ? `<details class="hero-odds"><summary><b>${h.label}</b><span class="odds-q" aria-label="是什么意思">?</span></summary>${why}</details>` : '';
  const next = h.next && h.months > 0 ? `，再存 ${D(h.next.gap)}，就攒够${h.next.months === 12 ? '一整年' : ` ${h.next.months / 12} 年`}的假` : '';
  // Under a year the count is in months; after that in years, the unit the next step is told in.
  const span = m => (m < 12 ? `<b>${m}</b> 个月` : `<b>${Math.floor(m / 12)}</b> 年${m % 12 ? ` <b>${m % 12}</b> 个月` : ''}`);
  let months = '';
  if (h.covered) months = `<p class="hero-months">攒下的钱，不算收益也够花到 ${h.endAge} 岁。</p>`;
  else if (h.months === 0 && h.next) months = `<p class="hero-months">还没开始攒假：存下 ${D(h.next.gap)}，就攒够一整年的假。</p>`;
  else if (h.months !== null) months = `<p class="hero-months">你已经攒够了 ${span(h.months)}的假${next}。</p>`;
  const R = v => roughMoney(toDisplay(v, p, dispCur), dispCur);
  // The fund line is the ledger closed; out of reach there is no line to measure against.
  const fund = h.reachable
    ? `<div class="fund-bar" role="img" aria-label="放假资金已攒到 ${fundPct}%"><i style="width:${fundPct}%"></i></div><p>放假资金：已有 ${R(h.fund.have)} / 需要 ${R(h.fund.need)}（<b>${fundPct}%</b>） ${ledgerToggleHtml(open)}</p>`
    : `<p>放假资金：按现在的节奏到不了 ${ledgerToggleHtml(open)}</p>`;
  return `${big ? `<div class="hero-big">${big}</div>` : ''}${sure}${ruler}${months}
    <div class="lifebar" role="img" aria-label="人生进度：上班 ${h.workYears} 年，放假 ${h.holidayYears} 年">${work}${rest}</div>
    <div class="lifebar-ticks"><span>${h.startAge} 岁 · 今天</span>${mid}<span>${h.endAge} 岁</span></div>
    ${mondays}${people}
    <div class="fund">${fund}</div>`;
}

function personSvg(on) {
  return `<svg class="person${on ? ' on' : ''}" viewBox="0 0 20 28" aria-hidden="true"><circle cx="10" cy="6" r="5"/><path d="M2 27c0-9 3-13 8-13s8 4 8 13z"/></svg>`;
}

export function livesSummary(stories, mc, life = 95) {
  if (stories.every(s => s.outcome === 'working')) return '这几条人生都还没到放假那天。先用上面提前的办法，再回来看。';
  const n = mc?.success == null ? null : peopleOf(mc.success);
  const share = n === null ? '' : `全部模拟里，${n === 0 ? '不到 1 成' : `${n} 成`}的钱够花到 ${life} 岁。`;
  return `这几条人生是从全部 ${(mc?.paths ?? 2000).toLocaleString('en-US')} 次模拟里挑出来讲故事的：最难的、偏难的、中间的、顺的。${share}`;
}

export function storyHtml(story, { p, dispCur }) {
  const D = v => roughMoney(toDisplay(v, p, dispCur), dispCur);
  const events = [];
  if (story.worst && story.worst.ret < 0 && story.worst.before > 0) events.push([story.worst.age, `最难的一年：组合收益 ${signedPct(story.worst.ret)}，资产从 ${D(story.worst.before)} 变成 ${D(story.worst.after)}。`]);
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

// The state at the right of a form group's header: ✕ N for the stops shown in it, else 示例, ＋ for an empty optional
// group, 默认 / 已改 N for the assumptions; the two assumption groups also say which data month they stand on.
// Words read out instead of a mark. Inside a button an aria-label on a plain span is not read, so the header of a
// sidebar row says them as visually hidden text.
const SR = text => `<span class="sr">${text}</span>`;
// mark: inside a sidebar row's header, which is itself a button, the ＋ is a mark, not a button of its own; there the
// data month is in the 地区与币种 row's summary instead (spec §6.3), so month: false leaves it out.
export function groupStatusHtml(st, { version, mark = false, month = true }) {
  const stops = st.blank + st.block;
  const data = st.changed === null || !month ? '' : ` <span class="grp-data">${version} 数据</span>`;
  if (stops > 0) {
    const parts = [st.block ? `拦住 ${st.block} 处` : '', st.blank ? `待填 ${st.blank} 处` : ''].filter(Boolean).join('，');
    if (mark) return `<span class="grp-x" aria-hidden="true">✕ ${stops}</span>${SR(parts)}${data}`;
    return `<span class="grp-x" aria-label="${parts}">✕ ${stops}</span>${data}`;
  }
  if (st.example) return '示例';
  if (st.empty) return mark ? `<span class="grp-plus" aria-hidden="true">＋</span>${SR('可以不填')}` : '<button type="button" class="grp-plus" aria-label="可以不填，点此填写">＋</button>';
  if (st.changed !== null) return `${st.changed === 0 ? '默认' : `已改 ${st.changed}`}${data}`;
  return '';
}

// ---- The sidebar at 1024 px and wider (spec §6.3): each row's name, its one-line summary while closed, and the
// result card at the bottom.

// The fields each derived figure is worked out from. A stop (blank or block) on any of them leaves the figure
// unworked: it reads — rather than a number from a value the page has refused.
const DERIVED_FROM = {
  r: ['eq', 'eqReal', 'bondY', 'infl', 'drag'],
  sigma: ['eq', 'sigEq', 'sigBd', 'rho'],
  bondReal: ['bondY', 'infl'],
};
export function derivedStops(list) {
  const stopped = keys => list.some(q => (q.kind === 'blank' || q.kind === 'block') && keys.includes(q.field));
  return Object.fromEntries(Object.entries(DERIVED_FROM).map(([k, keys]) => [k, stopped(keys)]));
}

// The stock and bond shares of the mix note: — while the share is stopped, never a number from the refused value.
export const mixShares = (eq, stopped) => (stopped ? { stock: '—', bond: '—' } : { stock: num(eq), bond: num(100 - eq) });

const SIDE_NAME = {
  simple: { tage: '想几岁放假', now: '现在', spend: '每月支出', where: '在哪里', pension: '养老金', retire: '退休后每月想花' },
  pro: { region: '地区与币种', now: '现在', spend: '当前年支出', retire: '退休后', returns: '收益假设', risk: '风险假设', sim: '模拟' },
};
// The row's name; the spending row carries its total, with = while it is the sum of the split.
export function sideHeadName(row, S) {
  const pro = S.view === 'pro';
  const name = SIDE_NAME[pro ? 'pro' : 'simple'][row];
  if (row !== 'spend') return name;
  const total = isSet(S.expense) ? num(pro ? Math.round(S.expense) : Math.round(S.expense / 12)) : '—';
  return `${name} ${splitOn(S) ? '= ' : ''}${total}`;
}

const SIDE_EST = `<span class="est" aria-hidden="true">≈</span>${SR('估算')} `;
const SIDE_WARN = `<span class="warn" aria-hidden="true">!</span>${SR('提示')}`;
const SIDE_NONE = `<span aria-hidden="true">—</span>${SR('没有数')}`;
// No number, said in words: in the sidebar headers and the professional derived returns.
export const SIDE_NO_RESULT = `<span aria-hidden="true">—</span>${SR('暂无结果')}`;
// An amount that may be negative: the sign as U+2212 in front of the currency, with an orange ! before it.
const signedMoney = (v, fmt) => (v < 0 ? `${SIDE_WARN} −${fmt(-v)}` : fmt(v));
const orNone = (v, fmt) => (isSet(v) ? fmt(v) : SIDE_NONE);

// The closed row's summary, from the numbers as typed and the rows under the fields (spec §6.3 tables).
export function sideSummary(row, { S, p, rows, data }) {
  const pro = S.view === 'pro';
  const wCur = p.wCur, rCur = p.rCur;
  // 万 figures to three digits; below ¥10,000 the whole amount, grouped.
  const W = v => wholeMoney(v, wCur), R = v => (Math.abs(v) < 10000 ? wholeMoney : roughMoney)(v, wCur);
  // The ledger's own rows, stopped where the ledger stops: a figure after a stopped row reads —, never a number from
  // a value the page has refused.
  const isStop = r => r.status === 'block' || r.status === 'blank';
  const noRowStop = problems(S, data).some(q => (q.kind === 'blank' || q.kind === 'block') && ['age', 'growth'].includes(q.field));
  const after = key => {
    const at = rows.findIndex(r => r.key === key);
    return at >= 0 && (noRowStop || rows.slice(0, at).some(isStop));
  };
  const save = after('save') ? null : rows.find(r => r.key === 'save')?.value ?? null;
  const pAge = S.pAge ?? S.lastValid?.pAge;
  const retRow = rows.find(r => r.key === 'retExp');
  const retStopped = after('retExp');
  const est = S.touched?.retExp ? '' : SIDE_EST;
  if (row === 'tage') return `${orNone(S.tAge, num)} 岁`;
  if (row === 'now') {
    const age = `${orNone(S.age, num)} 岁 · ${orNone(S.assets, R)}`;
    if (pro) return `${age} · ${orNone(S.income, R)}/年 · 涨 ${num(p.growth)}%/年 · 存 ${orNone(save, v => signedMoney(v, R))}/年`;
    return `${age} · 到手 ${orNone(S.income, v => R(v / 12))}/月 · 存下 ${orNone(save, v => signedMoney(v, W))}/月`;
  }
  if (row === 'spend') {
    // The items still in today's spending; one that has ended is no longer part of it.
    const items = rows.filter(r => r.under === 'expense' && r.op === '└' && r.status !== 'ended' && isSet(r.value));
    const label = r => (r.key === 'items' ? '月供和孩子' : r.label.split(' → ')[0]);
    return items.length ? `其中${items.map(r => `${label(r)} ${num(r.value)}${pro ? '/年' : ''}`).join(' · ')}` : '';
  }
  if (row === 'where') return `${data.countries[S.workC].name} → ${data.countries[S.retC].name}`;
  if (row === 'pension') return S.pension > 0 ? `${wholeMoney(Math.round(S.pension / 12), rCur)}/月 · ${pAge} 岁起` : SIDE_NONE;
  if (row === 'retire') {
    const typed = retStopped ? null : retRow?.typed;
    if (pro) {
      const pension = S.pension > 0 ? ` · 养老金 ${pAge} 岁起` : '';
      return `${retStopped ? '' : est}${orNone(typed, v => wholeMoney(v, rCur))}/年 · 到 ${orNone(S.life, num)}${pension}`;
    }
    const later = retStopped ? '' : rows.filter(r => r.key.startsWith('after:') && !r.folded)
      .map(r => ` → ${r.ages[0]} 岁起 ${orNone(r.value, v => wholeMoney(v, rCur))}`).join('');
    return `${retStopped ? '' : est}${orNone(typed, num)}${later}`;
  }
  if (row === 'region') {
    const rate = wCur === rCur ? '' : ` · 1 ${rCur} = ${rateText(p)} ${wCur}`;
    return `${S.workC} → ${S.retC}${rate} · <span class="grp-data">${data.version} 数据</span>`;
  }
  if (row === 'returns') {
    const r = derivedStops(problems(S, data)).r ? SIDE_NO_RESULT : pct(p.r, 1);
    return `股 ${num(p.eq)}% · 实际 ${pct(p.eqReal / 100, 1)} · 通胀 ${pct(p.infl / 100, 1)} → r ${r}`;
  }
  if (row === 'risk') return `σ ${num(p.sigEq)}/${num(p.sigBd)} · ρ ${num(p.rho)} · 一年跌 ≥ 15% 后少花 ${num(p.flexCut)}%`;
  if (row === 'sim') return `八成 · ${DEFAULT_PATHS.toLocaleString('en-US')} 次 · 种子 ${DEFAULT_SEED}`;
  return '';
}

const HOW = '<button type="button" class="link" data-how>怎么算的 ›</button>';
// The result card at the bottom of the sidebar (spec §6.3): the age, the odds and the way to the ledger; held, no age
// and the chip. The simple view says X 成, never a percentage.
export function sideCardHtml(h, { view, mode, success, chip = '', p = null }) {
  const pro = view === 'pro';
  if (chip) return `<p class="side-line"><b class="side-age">${NO_RESULT} 岁</b><button type="button" class="chip" data-chip>${chip}</button></p>`;
  const line = parts => `<p class="side-line">${parts.filter(Boolean).join(' · ')} · ${HOW}</p>`;
  const odds = success === null || success === undefined ? '' : pro ? pct(success, 1) : oddsText(success);
  if (!h.reachable) return line([`<b class="side-age">${pro ? '规划期内未达到' : '还在路上'}</b>`]);
  if (mode === 'bwd') return line([`<b class="side-age">${pro ? '目标' : '想'} ${p?.tAge ?? h.holidayAge} 岁</b>`, odds]);
  if (pro) return line([`<b class="side-age">财务独立 ${h.holidayAge} 岁</b>`, odds]);
  const age = h.workYears === 0 ? '现在就能放假' : `${h.holidayAge} 岁放假`;
  const bar = `<span class="sticky-bar-mini" aria-hidden="true"><i style="width:${(h.workYears / (h.workYears + h.holidayYears) * 100).toFixed(1)}%"></i></span>`;
  return `<p class="side-line"><b class="side-age">${age}</b>${bar}</p><p class="side-line">${h.label ? `<span>${h.label}</span> · ` : ''}${HOW}</p>`;
}
