// Exports the run so a professional can check it in their own tools.
const BOM = '﻿';

const yearly = ({ p, mc, target }) => mc.bands.map((b, t) => ({
  age: p.age + t, p10: b[0], p25: b[1], p50: b[2], p75: b[3], p90: b[4], target: target[t],
}));

export function toCsv(result) {
  const rows = yearly(result);
  const header = 'age,p10,p25,p50,p75,p90,target';
  const body = rows.map(r => [r.age, r.p10, r.p25, r.p50, r.p75, r.p90, r.target].join(','));
  return `${BOM}${[header, ...body].join('\r\n')}\r\n`;
}

export function toJson(result) {
  const { p, mc, retireT, dataVersion } = result;
  return JSON.stringify({
    dataVersion,
    seed: mc.seed,
    paths: mc.paths,
    success: mc.success,
    currency: p.wCur,
    retireYearIndex: retireT,
    assumptions: p,
    yearly: yearly(result),
  }, null, 2);
}
