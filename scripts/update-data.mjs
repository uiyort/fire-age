// Fetches market data from sources that allow republication and writes a versioned data file.
// Usage: node scripts/update-data.mjs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const lines = text => text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const isoFromParsed = text => { const d = new Date(`${text} UTC`); return d.toISOString().slice(0, 10); };

export function parseEcbFx(xml) {
  const observedAt = xml.match(/time='([^']+)'/)?.[1];
  const rates = {};
  for (const m of xml.matchAll(/currency='([A-Z]{3})'\s+rate='([\d.]+)'/g)) rates[m[1]] = parseFloat(m[2]);
  return { observedAt, rates };
}

export function crossToUsd({ observedAt, rates }) {
  const usdPerEur = rates.USD;
  const out = { EUR: 1 / usdPerEur };
  for (const [cur, perEur] of Object.entries(rates)) if (cur !== 'USD') out[cur] = perEur / usdPerEur;
  return { observedAt, rates: out };
}

export function parseBisCpi(csv) {
  const [header, ...rows] = lines(csv).map(l => l.split(','));
  const iArea = header.indexOf('REF_AREA'), iTime = header.indexOf('TIME_PERIOD'), iValue = header.indexOf('OBS_VALUE');
  const out = {};
  for (const row of rows) {
    const value = num(row[iValue]);
    if (value === null) continue;
    const area = row[iArea], observedAt = row[iTime];
    if (!out[area] || observedAt > out[area].observedAt) out[area] = { value, observedAt };
  }
  return out;
}

export function parseTreasury10y(csv) {
  const [header, first] = lines(csv);
  const col = header.split(',').findIndex(h => h.replaceAll('"', '') === '10 Yr');
  const cells = first.split(',');
  const [m, d, y] = cells[0].split('/');
  return { value: num(cells[col]), observedAt: `${y}-${m}-${d}` };
}

export function parseEcbIrs(csv) {
  const [header, row] = lines(csv).map(l => l.split(','));
  return { value: num(row[header.indexOf('OBS_VALUE')]), observedAt: row[header.indexOf('TIME_PERIOD')] };
}

export function parseBoe(csv) {
  const rows = lines(csv).slice(1).map(l => l.split(',')).filter(r => num(r[1]) !== null);
  const [date, value] = rows[rows.length - 1];
  return { value: num(value), observedAt: isoFromParsed(date) };
}

export function parseMofJp(csv) {
  const all = lines(csv);
  const col = all.find(l => l.startsWith('Date,')).split(',').indexOf('10Y');
  const rows = all.filter(l => /^\d{4}\/\d/.test(l)).map(l => l.split(','));
  const row = rows[rows.length - 1];
  const [y, m, d] = row[0].split('/');
  return { value: num(row[col]), observedAt: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` };
}

export function parseRba(csv) {
  const all = lines(csv);
  const col = all.find(l => l.startsWith('Title,')).split(',').findIndex(h => /10 year bond/i.test(h));
  const rows = all.filter(l => /^\d{2}-[A-Za-z]{3}-\d{4},/.test(l)).map(l => l.split(',')).filter(r => num(r[col]) !== null);
  const row = rows[rows.length - 1];
  return { value: num(row[col]), observedAt: isoFromParsed(row[0].replaceAll('-', ' ')) };
}

export function parseBoc(csv) {
  const rows = lines(csv).filter(l => /^"\d{4}-\d{2}-\d{2}",/.test(l)).map(l => l.replaceAll('"', '').split(','));
  const [observedAt, value] = rows[rows.length - 1];
  return { value: num(value), observedAt };
}

const ISO3_TO_2 = { CHN: 'CN', USA: 'US', DEU: 'DE', GBR: 'GB', JPN: 'JP', HKG: 'HK', SGP: 'SG', MYS: 'MY', THA: 'TH', AUS: 'AU', CAN: 'CA' };

export function parseWorldBank(text) {
  const out = {};
  for (const row of JSON.parse(text)[1] ?? []) {
    if (row.value === null) continue;
    const code = ISO3_TO_2[row.countryiso3code];
    if (code && !out[code]) out[code] = { value: row.value, observedAt: row.date };
  }
  return out;
}

export const priceLevel = (ppp, fx) => ppp / fx;

const RATE_JUMP_POINTS = 2;
const LEVEL_JUMP_RATIO = 0.2;

// Combines a fresh observation with the previous field. A missing or implausible observation keeps the old value.
export function mergeField(previous, fetched, { now, kind = 'level', meta = {} }) {
  const usable = fetched && Number.isFinite(fetched.value);
  if (!usable && !previous) throw new Error(`No value for ${meta.sourceId ?? 'field'} on first run`);
  const carried = note => ({ ...previous, ...meta, status: 'carried', note, carriedSince: previous.carriedSince ?? now });
  if (!usable) return carried('本期未取到新数据，沿用上一期。');
  if (previous && previous.status !== 'assumed') {
    if (kind === 'rate' && Math.abs(fetched.value - previous.value) > RATE_JUMP_POINTS) {
      return carried(`新值 ${fetched.value} 与上一期相比跳变超过 2 个百分点，已沿用上一期。`);
    }
    if (kind === 'level' && Math.abs(fetched.value / previous.value - 1) > LEVEL_JUMP_RATIO) {
      return carried(`新值 ${fetched.value} 与上一期相比跳变超过 20%，已沿用上一期。`);
    }
  }
  const { note: _dropped, carriedSince: _recovered, ...base } = previous ?? {};
  return { ...base, ...meta, value: fetched.value, observedAt: fetched.observedAt, fetchedAt: now, status: 'official' };
}

const MAX_CARRIED_SHARE = 0.5;
const MAX_CARRIED_DAYS = 92;

// Stops the job before anything is published, so a broad outage or a stuck field reaches the author by email.
export function assertFresh(fields, now) {
  const live = fields.filter(([, f]) => f.status !== 'assumed');
  const carried = live.filter(([, f]) => f.status === 'carried');
  if (live.length && carried.length / live.length > MAX_CARRIED_SHARE) {
    throw new Error(`${carried.length} of ${live.length} sources failed, refusing to publish a new version`);
  }
  const stale = carried.filter(([, f]) => (Date.parse(now) - Date.parse(f.carriedSince ?? f.fetchedAt)) / 864e5 > MAX_CARRIED_DAYS);
  if (stale.length) throw new Error(`stale for over ${MAX_CARRIED_DAYS} days: ${stale.map(([name]) => name).join(', ')}`);
}

const BOND_SOURCES = {
  US: { sourceId: 'ustreasury', parse: parseTreasury10y, url: y => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv` },
  DE: { sourceId: 'ecb', parse: parseEcbIrs, url: () => 'https://data-api.ecb.europa.eu/service/data/IRS/M.DE.L.L40.CI.0000.EUR.N.Z?lastNObservations=1&format=csvdata' },
  UK: { sourceId: 'boe', parse: parseBoe, url: () => {
    const from = new Date(Date.now() - 45 * 864e5).toUTCString().split(' ');
    return `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=${from[1]}/${from[2]}/${from[3]}&Dateto=now&SeriesCodes=IUDMNPY&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`;
  } },
  JP: { sourceId: 'mofjp', parse: parseMofJp, url: () => 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv' },
  AU: { sourceId: 'rba', parse: parseRba, url: () => 'https://www.rba.gov.au/statistics/tables/csv/f2-data.csv' },
  CA: { sourceId: 'boc', parse: parseBoc, url: () => 'https://www.bankofcanada.ca/valet/observations/BD.CDN.10YR.DQ.YLD/csv?recent=5' },
};

async function fetchText(url, { timeoutMs = 45000, tries = 3 } = {}) {
  let lastError;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'fire-age-data-update' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function attempt(label, work) {
  try {
    return await work();
  } catch (error) {
    console.warn(`WARN ${label}: ${error.message}`);
    return null;
  }
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const assumptions = JSON.parse(readFileSync(`${root}data/assumptions.json`, 'utf8'));
  const latestPath = `${root}site/js/data-latest.js`;
  const previous = existsSync(latestPath) ? (await import(pathToFileURL(latestPath).href)).default : null;
  const now = new Date().toISOString().slice(0, 10);
  const version = now.slice(0, 7);
  const sourceUrl = id => assumptions.sources.find(s => s.id === id).url;

  const assumed = (value, note, observedAt = version) => ({
    value, sourceId: 'assumption', url: 'method.html', observedAt, fetchedAt: now, status: 'assumed', note,
  });

  const fxRaw = await attempt('ECB FX', async () => crossToUsd(parseEcbFx(await fetchText('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'))));
  const fx = {};
  for (const cur of new Set(Object.values(assumptions.countries).map(c => c.cur))) {
    if (cur === 'USD') continue;
    const fresh = fxRaw?.rates[cur] ? { value: fxRaw.rates[cur], observedAt: fxRaw.observedAt } : null;
    fx[cur] = mergeField(previous?.fx[cur], fresh, { now, meta: { sourceId: 'ecb', url: sourceUrl('ecb') } });
  }
  const fxOf = cur => (cur === 'USD' ? 1 : fx[cur].value);

  const bisAreas = Object.values(assumptions.countries).map(c => c.bis).filter(Boolean).join('+');
  const cpi = await attempt('BIS CPI', async () => parseBisCpi(await fetchText(
    `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_LONG_CPI/1.0/M.${bisAreas}.771?lastNObservations=1&format=csv`)));

  const wbCodes = Object.values(assumptions.countries).map(c => c.wb).join(';');
  const ppp = await attempt('World Bank PPP', async () => parseWorldBank(await fetchText(
    `https://api.worldbank.org/v2/country/${wbCodes}/indicator/PA.NUS.PRVT.PP?format=json&mrnev=1&per_page=50`, { timeoutMs: 90000 })));

  const year = now.slice(0, 4);
  const countries = {};
  for (const [code, c] of Object.entries(assumptions.countries)) {
    const old = previous?.countries[code];
    const freshPpp = ppp?.[c.wb] ? { value: priceLevel(ppp[c.wb].value, fxOf(c.cur)), observedAt: ppp[c.wb].observedAt } : null;
    const out = {
      name: c.name, cur: c.cur, roles: c.roles,
      priceLevel: mergeField(old?.priceLevel, freshPpp, { now, meta: { sourceId: 'worldbank', url: sourceUrl('worldbank') } }),
    };
    if (c.roles.includes('work')) {
      out.cpi = mergeField(old?.cpi, cpi?.[c.bis] ?? null, { now, kind: 'rate', meta: { sourceId: 'bis', url: sourceUrl('bis') } });
      out.target = assumed(c.target, assumptions.notes.target);
      out.pAge = assumed(c.pAge, assumptions.notes.pAge);
      out.drag = assumed(c.drag, assumptions.notes.drag);
      if (c.y10Assumed) {
        out.y10 = assumed(c.y10Assumed.value, c.y10Assumed.note, c.y10Assumed.observedAt);
      } else {
        const src = BOND_SOURCES[code];
        const fresh = await attempt(`10y ${code}`, async () => src.parse(await fetchText(src.url(year))));
        out.y10 = mergeField(old?.y10, fresh, { now, kind: 'rate', meta: { sourceId: src.sourceId, url: sourceUrl(src.sourceId) } });
      }
    }
    countries[code] = out;
  }

  const all = [...Object.entries(fx).map(([k, f]) => [`fx.${k}`, f]),
    ...Object.entries(countries).flatMap(([k, c]) => ['priceLevel', 'cpi', 'y10'].filter(f => c[f]).map(f => [`${k}.${f}`, c[f]]))];
  assertFresh(all, now);

  const data = { version, generatedAt: new Date().toISOString(), fx, countries, sources: assumptions.sources };
  const json = JSON.stringify(data, null, 2);
  mkdirSync(`${root}site/data`, { recursive: true });
  writeFileSync(`${root}site/data/${version}.json`, `${json}\n`);
  writeFileSync(latestPath, `// Generated by scripts/update-data.mjs. Do not edit.\nexport default ${json};\n`);

  console.log(`Wrote data version ${version}`);
  for (const [name, f] of all) if (f.status !== 'official') console.log(`${f.status.toUpperCase()} ${name} = ${f.value}: ${f.note}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => { console.error(error); process.exit(1); });
}
