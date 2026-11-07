# FIRE Age (放假年龄)

A financial independence and early retirement calculator that teaches as you use it. It works out the age at which your "holiday" can begin, explains each parameter, and shows what would bring that age forward the most. The interface is in Chinese.

[中文](README.md)

Live site: to be added at launch

## What it does

- **Forward:** at your current pace, the age you can stop working.
- **Backward:** to stop at a chosen age, how much more to save, earn or cut, or how much capital you need today.
- **Cross-border retirement:** save in one place and retire in another, with spending estimated from price levels.
- **Two views:** a simple view with 7 questions, and a professional view exposing every assumption, which opens once you have generated a card. Formulas, data sources and source code are never locked.
- **Verifiable:** formulas, data sources and licence terms are public, the random seed is fixed so results reproduce, and you can export CSV and JSON.

There is no sign-up and no personal data collection. Your numbers stay in your own browser, and share cards are generated locally.

## Run locally

Requires Node 24. The site has no runtime dependencies and no build step.

```bash
npm install             # test tooling only
npm run serve           # http://localhost:4173
npm test                # unit tests
npx playwright install chromium
npm run e2e             # browser tests
```

## Layout

| Path | Contents |
|---|---|
| `site/` | The website; this directory is what gets deployed |
| `site/js/engine.js` | Financial model (pure functions) |
| `site/data/` | Archive of each market data version |
| `functions/api/e.js` | Anonymous event counter |
| `functions/api/views.js`, `db/views.sql` | Anonymous totals of the views on the years ahead, counted only when a visitor chooses to |
| `scripts/update-data.mjs` | Fetches and generates market data, automatically each month |
| `scripts/check-cn.mjs` | Tests access speed from mainland China |
| `data/assumptions.json` | This tool's fixed assumptions and source list |
| `docs/` | Method, data sources, deployment and content guides |

## Reproducing a result

Export JSON from the professional view. It contains every assumption, the seed, the path count and the data version. See [docs/method.md](docs/method.md) for the formulas and [docs/data-sources.md](docs/data-sources.md) for the sources. If you find an error, please open an issue.

## Disclaimer

For education and estimation only. This is not investment advice. Results depend on assumptions, and the success rate is a simulation, not a forecast.

## Licence

[AGPL-3.0](LICENSE). Market data remains the property of its providers. Their terms are listed on the site's data sources page.
