// Learning-card copy for each input. Explains principles only; never names a product or suggests an allocation.
const MORNINGSTAR = 'https://www.morningstar.com/retirement/whats-safe-retirement-withdrawal-rate-2026';
const UBS = 'https://www.ubs.com/global/en/media/display-page-ndp/en-20260303-global-investment-returns-yearbook-2026.html';
const SOURCES_PAGE = 'sources.html';
const PERSONAL = '因人而异，没有通用标准。';
const TOOL_ASSUMPTION = '这是本工具的假设，不是权威统计，可以按自己的判断修改。';

export const PARAMS = [
  { id: 'age', name: '年龄', what: '你现在多大。年龄越小，复利的时间越长。',
    improve: '年龄改变不了，但越早开始，同样的储蓄能滚得越大。', noRangeReason: PERSONAL },
  { id: 'assets', name: '可投资资产', what: '现在就能拿去投资的钱，比如存款、基金、股票。自住房一般不算，因为它不产生可以花的现金。',
    improve: '先把账户盘点清楚，再把长期闲置的钱纳入长期规划。', noRangeReason: PERSONAL },
  { id: 'income', name: '税后收入', what: '到手的收入。它和支出的差额决定你每年能存多少。',
    improve: '提升收入通常比压缩支出的空间更大，比如技能升级、换更好的工作机会。', noRangeReason: PERSONAL },
  { id: 'expense', name: '当前支出', what: '现在一年实际花多少。它影响两件事：每年能存多少，以及退休后需要多少。',
    improve: '先记一个月的账，优先看房租、交通、保险、订阅这类固定支出，砍一次长期有效。', noRangeReason: PERSONAL },
  { id: 'growth', name: '收入实际增长', what: '扣掉通胀后，收入每年多涨多少。工作前期通常更快，后期会放缓。',
    improve: '不要按最好的年份估算。保守一点，结果更可靠。', noRangeReason: PERSONAL },
  { id: 'retExp', name: '退休后支出', what: '放假以后一年想花多少，按今天的钱算。这是决定目标资产最大的一个数字。',
    improve: '分清必要支出和想要的支出，再按计划生活的地方实际估算，别忘了医疗和保险。', noRangeReason: PERSONAL },
  { id: 'life', name: '规划到多少岁', what: '资产要撑到的年龄。放假越早、活得越久，钱要撑得越久。',
    improve: '宁可规划得长一些。多留几年的余量，比晚年钱不够好得多。', noRangeReason: '常见做法是规划到 90–100 岁，本工具默认 95 岁，这是假设。' },
  { id: 'pension', name: '养老金', what: '到领取年龄后每年能领到的钱。它能减少你要靠投资覆盖的部分。',
    improve: '查一下自己的累计缴费年限和预估待遇。提前离职可能减少缴费年限，要一起考虑。', noRangeReason: '取决于个人缴费年限和基数，所以不提供默认值。' },
  { id: 'pAge', name: '领取年龄', what: '从几岁开始领养老金。在那之前的支出全部要靠自己的资产。',
    improve: '放假越早，这段自己扛的时间越长，要单独留出这部分钱。', noRangeReason: '按当地常规退休年龄取整，具体以当地制度为准。' },
  { id: 'eq', name: '股票占比', what: '资产里放在股票的比例。比例越高，长期预期收益越高，但中途波动也越大。',
    improve: '这是收益和波动之间的取舍，没有对所有人都对的答案。试着改一下，同时看放假年龄和成功率怎么变。', noRangeReason: '因风险承受能力而异，本工具不给比例建议。' },
  { id: 'eqReal', name: '股票实际收益', what: '扣掉通胀后，股票每年的复合收益假设。本工具默认 5%。',
    improve: '不要用牛市的收益做长期假设。费用和税会直接从收益里扣除，记得算进税费拖累。',
    range: { text: '美国 1900–2025 年实际年化约 6.6%，但美国是幸存者，多数国家更低。', sourceUrl: UBS } },
  { id: 'bondY', name: '10 年期国债收益率', what: '当地 10 年期国债的收益率，用来估算债券部分的回报。',
    improve: '国债收益率高低不由个人决定。收益率低的地方，要靠更高的储蓄率来弥补。',
    range: { text: '各国最新值见数据来源页。', sourceUrl: SOURCES_PAGE } },
  { id: 'infl', name: '长期通胀', what: '物价每年涨多少。本工具取最新通胀和央行目标的中间值。',
    improve: '本工具的金额都按今天的购买力计算，通胀主要影响债券的实际收益。',
    range: { text: '各国最新通胀和目标见数据来源页。', sourceUrl: SOURCES_PAGE } },
  { id: 'drag', name: '税费拖累', what: '管理费、交易费和投资税每年吃掉多少收益。看起来很小，几十年复利下来差别很大。',
    improve: '留意持有产品的总费率，善用当地合法的税收优惠账户。', noRangeReason: TOOL_ASSUMPTION },
  { id: 'fxDrift', name: '退休地货币升值', what: '如果在一国攒钱、去另一国退休，退休地货币每年相对升值多少。默认 0，表示汇率长期跟着物价走。',
    improve: '跨国退休要试试正值，看看退休地货币升值时计划还撑不撑得住。', noRangeReason: TOOL_ASSUMPTION },
  { id: 'swr', name: '安全提取率', what: '退休第一年从资产里取多少比例，之后随通胀调整。提取率越低，需要的本金越多，也越安全。',
    improve: '放假越早，退休期越长，提取率要越低。开支能灵活调整的人可以承受更高一些的提取率。',
    range: { text: '30 年退休期、90% 成功率约 3.9%（Morningstar 2026）。更长的退休期由本工具下调，属于经验假设。', sourceUrl: MORNINGSTAR } },
  { id: 'sigEq', name: '股票波动率', what: '股票每年收益上下波动的幅度。它不改变预期收益，但影响运气差时计划能否撑住。',
    improve: '波动本身无法消除。可以试着调高一点，看看计划的成功率是否还能接受。', noRangeReason: TOOL_ASSUMPTION },
  { id: 'sigBd', name: '债券波动率', what: '债券每年收益上下波动的幅度，通常比股票小得多。',
    improve: '可以试着调高一点，看看计划的成功率是否还能接受。', noRangeReason: TOOL_ASSUMPTION },
  { id: 'rho', name: '股债相关性', what: '股票和债券是否同涨同跌。相关性越低，组合整体波动越小。',
    improve: '这是一个很难预测的假设。试几个不同的值，看结果是否敏感。', noRangeReason: TOOL_ASSUMPTION },
];

export const PARAM_GROUPS = [
  { name: '攒钱这一段', ids: ['assets', 'income', 'expense', 'growth'] },
  { name: '放假这一段', ids: ['age', 'retExp', 'life', 'pension', 'pAge', 'swr'] },
  { name: '市场假设', ids: ['eq', 'eqReal', 'bondY', 'infl', 'drag', 'fxDrift'] },
  { name: '风险假设', ids: ['sigEq', 'sigBd', 'rho'] },
];
