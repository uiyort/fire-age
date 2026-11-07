// Exports the run so a professional can check it in their own tools.
const BOM = '﻿';

const yearly = ({ p, mc, target }, scale = 1) => mc.bands.map((b, t) => ({
  age: p.age + t, p10: b[0] * scale, p25: b[1] * scale, p50: b[2] * scale, p75: b[3] * scale, p90: b[4] * scale, target: target[t] * scale,
}));

const requiredSavings = ({ mode, bwd }) => (mode === 'bwd' ? Math.max(bwd.s0, 0) : null);

function assumptionRows(p) {
  const rows = [];
  for (const [key, value] of Object.entries(p)) {
    if (key === 'fx') for (const [cur, rate] of Object.entries(value)) rows.push(`# fx.${cur},${rate}`);
    else rows.push(`# ${key},${value}`);
  }
  return rows;
}

// Yearly rows use the currency on screen. Assumptions are in the work and retirement currencies, as entered.
export function toCsv(result) {
  const { p, mc, retireT, dataVersion, mode } = result;
  const cur = result.dispCur ?? p.wCur;
  const scale = cur === p.wCur ? 1 : p.fx[cur] / p.fx[p.wCur];
  const meta = [
    `# currency,${cur}`, `# dataVersion,${dataVersion}`, `# seed,${mc.seed}`, `# paths,${mc.paths}`, `# success,${mc.success}`,
    `# mode,${mode}`, `# retireYearIndex,${retireT}`,
    ...(mode === 'bwd' ? [`# requiredSavings,${requiredSavings(result)}`] : []),
    ...assumptionRows(p),
  ];
  const header = 'age,p10,p25,p50,p75,p90,target';
  const body = yearly(result, scale).map(r => [r.age, r.p10, r.p25, r.p50, r.p75, r.p90, r.target].join(','));
  return `${BOM}${[...meta, header, ...body].join('\r\n')}\r\n`;
}

export function toJson(result) {
  const { p, mc, retireT, dataVersion } = result;
  return JSON.stringify({
    dataVersion,
    seed: mc.seed,
    paths: mc.paths,
    success: mc.success,
    mode: result.mode,
    requiredSavings: requiredSavings(result),
    currency: p.wCur,
    displayCurrency: result.dispCur ?? p.wCur,
    retireYearIndex: retireT,
    assumptions: p,
    yearly: yearly(result),
  }, null, 2);
}
