// Anonymous event counter. Stores the event name, channel and data version only: no IP, user agent, cookie or input value.
export const EVENTS = new Set(['visit', 'calc_done', 'mode_switch', 'card_open', 'card_generate', 'export_data', 'life_draw', 'views_done', 'pro_unlock']);

const CHANNEL = /^[a-z0-9_-]{1,24}$/;
const VERSION = /^\d{4}-\d{2}$/;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || !EVENTS.has(body.e)) return new Response(null, { status: 400 });
  const channel = CHANNEL.test(body.c) ? body.c : 'direct';
  const version = VERSION.test(body.v) ? body.v : '';
  env.EVENTS?.writeDataPoint({ blobs: [body.e, channel, version], indexes: [body.e] });
  return new Response(null, { status: 204 });
}
