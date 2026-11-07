// Tests whether a site opens from mainland China using public Globalping probes.
// Usage: node scripts/check-cn.mjs <host>
import { pathToFileURL } from 'node:url';

const LIMIT_MS = 3000;
const PROBES = 10;

export function summarizeProbes(results) {
  const timed = results.map(r => r.result);
  const ok = timed.filter(r => r.status === 'finished' && r.statusCode >= 200 && r.statusCode < 400 && r.timings.total <= LIMIT_MS);
  const sorted = timed.map(r => r.timings?.total ?? Infinity).sort((a, b) => a - b);
  return {
    pass: results.length > 0 && ok.length > results.length / 2,
    okRate: results.length ? ok.length / results.length : 0,
    medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
  };
}

async function measure(host) {
  const created = await fetch('https://api.globalping.io/v1/measurements', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'http', target: host, locations: [{ country: 'CN' }], limit: PROBES, measurementOptions: { protocol: 'HTTPS', request: { method: 'GET', path: '/' } } }),
  });
  if (!created.ok) throw new Error(`Globalping refused the request: HTTP ${created.status}`);
  const { id } = await created.json();
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const report = await (await fetch(`https://api.globalping.io/v1/measurements/${id}`)).json();
    if (report.status !== 'in-progress') return report.results;
  }
  throw new Error('Globalping did not finish in time');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const host = process.argv[2];
  if (!host) {
    console.error('Usage: node scripts/check-cn.mjs <host>');
    process.exit(2);
  }
  const results = await measure(host);
  for (const r of results) {
    console.log(`${r.probe.city} · ${r.probe.network}: ${r.result.status} ${r.result.statusCode ?? ''} ${r.result.timings?.total ?? '?'}ms`);
  }
  const { pass, okRate, medianMs } = summarizeProbes(results);
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${Math.round(okRate * 100)}% of probes opened within ${LIMIT_MS}ms, median ${medianMs}ms`);
  console.log('Most probes sit in data centres, so real phone networks will usually be slower. This cannot detect WeChat link blocking.');
  process.exit(pass ? 0 : 1);
}
