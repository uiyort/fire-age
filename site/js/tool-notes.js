// 本工具设定: every assumption the tool makes is a button that opens its explanation (app.js shows it in #tool-pop).
// The explanations follow docs/copy-framework.md: what the number is, why it is set so, and whether it can be changed.
const escapeAttr = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pctText = (v, d = 0) => `${Number(v.toFixed(d))}%`;

export const TOOL_LABEL = '本工具设定';

export const toolTag = why => `<button type="button" class="tool" data-why="${escapeAttr(why)}" aria-expanded="false" aria-controls="tool-pop">${TOOL_LABEL}</button>`;

export const WHY = {
  growth: g => `收入每年比物价多涨 ${pctText(g, 1)}，代表随资历增长的实际加薪。所有金额都按今天的钱算，支出不变就是生活水平保持现在的样子，多出来的收入都存下来。觉得收入不会再涨，可以在专业模式把「收入实际增长」改成 0。`,
  // The form field is drawn once, so its explanation names the default rather than the value typed.
  growthField: () => '收入每年比物价多涨多少，代表随资历增长的实际加薪，默认 2% 是本工具的假设。所有金额都按今天的钱算，支出不变就是生活水平保持现在的样子。觉得收入不会再涨，就改成 0。',
  income: g => `收入每年按实际增长 ${pctText(g, 1)} 复利增长，也就是比物价多涨这么多。金额都按今天的钱算。`,
  expense: () => '支出按今天的钱保持不变，只跟着物价涨，生活水平和现在一样。',
  kids: age => `孩子的花销算到最小的孩子 ${age} 岁。这是本工具的设定，不是官方规定，也不假设读不读研。`,
  floor: () => '每年存下的钱在年末存入。存款用完后按 0 算，不借钱。',
  median: age => `2,000 种年景里排在正中间的那一种，到 ${age} 岁时攒到的钱。一半的年景比它多，一半比它少。`,
  ret: p => `扣掉通胀后的平均年收益。股票占 ${pctText(p.w * 100)}，按每年 ${pctText(p.eqReal, 1)} 算；债券占 ${pctText((1 - p.w) * 100)}，按当地十年期国债收益率减长期通胀，约 ${pctText(p.bondReal * 100, 2)}；再减 ${pctText(p.drag, 1)} 的税费。股票收益、股债比例和税费是本工具的假设，专业模式都可以改。`,
  legend: () => '标着「本工具设定」的数字是本工具的假设，不是官方数据，点开能看到每一项的说明。所有金额都按今天的钱算，收益都扣掉了通胀。',
  sim: (paths, seed) => `模拟 ${paths.toLocaleString('en-US')} 种年景，随机种子固定为 ${seed}，同样的输入每次得到同样的结果。八成把握指至少 ${Math.ceil(paths * 0.8).toLocaleString('en-US')} 种年景的钱够花到规划年龄。这是本工具的设定，不是预测。`,
  low: share => `放假后的花销低于现在的 ${pctText(share * 100)} 时，页面会提醒你核对。这条提醒线是本工具设定的，只提醒，不影响计算。`,
  pension: () => '计发基数按今天的钱算，只跟物价涨；个人账户的记账利率和通胀持平。累计缴费年限默认是已缴年数加上距领取的年数，可以改。领取年龄不是整岁时，向上取整岁放进模型，计发月数按已满的整岁查表。',
};
