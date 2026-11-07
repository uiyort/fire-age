// Sends anonymous event counts to the site's own endpoint. Never blocks or breaks the page.
const ENDPOINT = '/api/e';
const CHANNEL = /^[a-z0-9_-]{1,24}$/;

export function channelFromUrl(href) {
  try {
    const channel = new URL(href).searchParams.get('ch');
    return channel && CHANNEL.test(channel) ? channel : 'direct';
  } catch {
    return 'direct';
  }
}

let context = { channel: 'direct', version: '' };

export function initAnalytics(href, version) {
  context = { channel: channelFromUrl(href), version };
}

export function track(name) {
  try {
    navigator.sendBeacon(ENDPOINT, JSON.stringify({ e: name, c: context.channel, v: context.version }));
  } catch {
    // Counting is optional; ignore any failure.
  }
}
