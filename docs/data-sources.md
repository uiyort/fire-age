# Data sources

`scripts/update-data.mjs` fetches every automatic field. A scheduled workflow runs it on the 16th of each month. The authoritative list, with licence text, is `data/assumptions.json`, and it is rendered on `site/sources.html`.

| Field | Source | Terms |
|---|---|---|
| Exchange rates | ECB euro reference rates, crossed into units per USD | Free reuse with attribution; changes must be stated |
| Price level | World Bank `PA.NUS.PRVT.PP` ÷ current market rate | CC BY 4.0 |
| CPI | BIS `WS_LONG_CPI`, year on year | Usable in products with no extra charge to users; cite BIS |
| China 10y | OECD financial market statistics, long-term interest rate `CHN.M.IRLT`, monthly, one to two months behind | CC BY 4.0, cite the OECD |
| US 10y | US Treasury daily par yield curve | US government work, public domain |
| Germany 10y | ECB `IRS` dataset | As ECB above |
| UK 10y | Bank of England `IUDMNPY` | Open Government Licence |
| Japan 10y | Ministry of Finance JGB interest rate | Public Data License 1.0 |
| Australia 10y | RBA table F2 | Commercial use allowed; no implied endorsement |
| Canada 10y | Bank of Canada Valet API | Free reuse with attribution |

## Fixed assumptions

| Field | Value | Reason |
|---|---|---|
| Hong Kong 10y | 3.7% | HKMA's 10-year benchmark fields are currently empty and no other republishable automatic source was found |
| Inflation target, retirement age, drag | per country | This tool's assumptions, listed in `data/assumptions.json` |

Fixed assumptions do not update automatically. The China figure used to be one of them, because ChinaMoney's terms forbid republication; it now comes from the OECD's monthly series, which is licensed CC BY 4.0. The OECD does not publish a Hong Kong series.

## Sources rejected

| Source | Reason |
|---|---|
| FRED | Terms limit use to personal and non-commercial, and prohibit reproduction and archiving |
| ChinaMoney | Republication requires written authorisation |
| ADB AsianBondsOnline | Republication requires written consent |
| Trading Economics, Investing.com | Commercial aggregators |

## Country coverage

Bond yields only feed the work country's return assumption. A retirement country needs only an exchange rate and a price level. Singapore, Malaysia and Thailand therefore appear as retirement destinations only. Taiwan is excluded because it has no automatic exchange rate, price level or CPI source.

## Safeguards

A failed fetch keeps the previous value and marks it `carried`. A jump of more than 2 percentage points for a rate, or more than 20% for a level, also keeps the previous value and records why. If the tests fail after an update, nothing is committed and the site keeps the last good version.

## If the tool ever charges users

Recheck the BIS terms, which allow inclusion only where there is no additional charge to users. The Bank of Canada terms also require telling buyers the data is free on its site.
