# Deployment

This guide is for the project's author. The first section is a one-off that only the author can do, because it needs personal accounts and payment. Everything after that can be done by Claude with the tokens below, or by running the listed commands.

## What the author does once

1. **Create a GitHub account**, if you do not have one.
2. **Create a Cloudflare account** at dash.cloudflare.com.
3. **Buy the domain.** In Cloudflare, open Domain Registration, then Register Domains. Search for a name and check the price at checkout. The estimate for a `.com` is ¥70–80 per year. Add a payment method and enable auto-renew, because links already posted will break if the domain lapses.
4. **Create a Cloudflare API token** with these permissions: Account, Cloudflare Pages, Edit; Account, Workers Scripts, Edit; Account, Account Analytics, Read. Keep the token secret and pass it through an environment variable, never in chat logs or the repository.
5. **Note your Cloudflare account ID**, shown on the account overview page.

## Deploy

1. Create a public GitHub repository and push `main`:
   ```bash
   gh repo create fire-age --public --source . --push
   ```
2. Create the Pages project and connect it to the repository in the Cloudflare dashboard: Workers & Pages, Create, Pages, Connect to Git. Leave the build command empty and set the output directory to `site`.
3. In the project's settings, bind the Analytics Engine dataset: variable `EVENTS`, dataset `fire_age_events`. `wrangler.toml` already declares this.
4. Add the custom domain in the project's Custom domains tab.
5. Add the live address to `README.md` and `README.en.md`.

## Check access from mainland China (before posting anything)

```bash
node scripts/check-cn.mjs your-domain.example
```

It passes when more than half of the probes open the site within 3 seconds. Do not start posting if it fails.

Known limits of this check:

- Most probes sit in data centres, so real phone networks will usually be slower.
- It cannot detect whether WeChat, Xiaohongshu or Bilibili block the link inside their own browsers. In-app testing was deliberately left out because it is manual. The first signs of a problem will be comments saying the link will not open, or visits that fall away after a post gets attention.

## What runs on its own

| What | When | If it fails |
|---|---|---|
| Market data update (`.github/workflows/update-data.yml`) | 16th of each month | One source failing keeps its last value, flagged on the sources page. If more than half fail, or one field stays on an old value for over 92 days, the job stops, nothing is published, and GitHub emails you |
| Site deployment | On every push to `main` | Cloudflare keeps the previous version live |

The China and Hong Kong 10-year yields are fixed assumptions that do not update. See [data-sources.md](data-sources.md).

## Traffic numbers

```bash
CF_ACCOUNT_ID=... CF_API_TOKEN=... node scripts/stats.mjs
```

The token also needs Account Analytics read permission. To tell channels apart, add `?ch=<name>` to links you post, such as `?ch=douban1`. Channel names may use lowercase letters, digits, `_` and `-`, up to 24 characters.

## If mainland access is not good enough

ICP filing and moving to mainland hosting is the fallback. It is outside this phase because it is manual, and it has known costs:

- Many provinces require the domain to be unreachable during review, which takes about 1 to 3 weeks.
- A finance-themed site may be asked to change its name or description, or be rejected. Describe it as an education and calculation tool.
- A personal filing generally does not allow commercial activity, so charging users would need a company.
- Exact materials and identity requirements come from the cloud provider and the local regulator.

Analytics would also need replacing, because `functions/api/e.js` runs on Cloudflare.
