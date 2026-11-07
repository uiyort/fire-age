// Prints event counts by channel for the last 30 days.
// Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node scripts/stats.mjs
const { CF_ACCOUNT_ID: account, CF_API_TOKEN: token } = process.env;
if (!account || !token) {
  console.error('Set CF_ACCOUNT_ID and CF_API_TOKEN.');
  process.exit(1);
}

const query = `
  SELECT blob1 AS event, blob2 AS channel, SUM(_sample_interval) AS count
  FROM fire_age_events
  WHERE timestamp > NOW() - INTERVAL '30' DAY
  GROUP BY event, channel
  ORDER BY event, count DESC
  FORMAT JSON`;

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
  body: query,
});
if (!res.ok) {
  console.error(`Query failed: HTTP ${res.status}\n${await res.text()}`);
  process.exit(1);
}
const { data } = await res.json();
console.table(data);
