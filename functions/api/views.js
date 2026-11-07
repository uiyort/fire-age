// Anonymous totals of the views on the years ahead. Stores only how many people chose each option:
// no IP, user agent, cookie, time of answer, or any other input. Needs the D1 binding VIEWS (see docs/deploy.md).
export const QUESTIONS = ['market', 'crash', 'nerve', 'prices', 'rates', 'wages'];
const OPTIONS = 3;
const TOTAL = '_total';

const UPSERT = 'INSERT INTO views (question, option, n) VALUES (?, ?, 1) ON CONFLICT (question, option) DO UPDATE SET n = n + 1';

const valid = a => a && typeof a === 'object' && !Array.isArray(a)
  && Object.keys(a).length === QUESTIONS.length
  && QUESTIONS.every(id => Number.isInteger(a[id]) && a[id] >= 0 && a[id] < OPTIONS);

const MAX_BODY = 512;

// Only this site's page may post: a JSON content type forces a browser preflight that this function never answers,
// and an Origin or Sec-Fetch-Site header from elsewhere is refused outright.
function refusal(request) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return 415;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return 403;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return 403;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return 413;
  return 0;
}

export async function onRequestPost({ request, env }) {
  const status = refusal(request);
  if (status) return new Response(null, { status });
  if (!env.VIEWS) return new Response(null, { status: 503 });
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || !valid(body.a)) return new Response(null, { status: 400 });
  const statement = env.VIEWS.prepare(UPSERT);
  await env.VIEWS.batch([statement.bind(TOTAL, 0), ...QUESTIONS.map(id => statement.bind(id, body.a[id]))]);
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ env }) {
  if (!env.VIEWS) return new Response(null, { status: 503 });
  const { results } = await env.VIEWS.prepare('SELECT question, option, n FROM views').all();
  const counts = Object.fromEntries(QUESTIONS.map(id => [id, Array(OPTIONS).fill(0)]));
  let total = 0;
  for (const { question, option, n } of results) {
    if (question === TOTAL) total = n;
    else if (counts[question] && option >= 0 && option < OPTIONS) counts[question][option] = n;
  }
  return new Response(JSON.stringify({ total, counts }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
