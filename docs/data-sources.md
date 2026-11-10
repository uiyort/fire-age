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

## China basic pension rules

Used by `site/js/pension.js`. Checked on 2026-11-10. Tables of numbers live in the code (`PAYOUT_MONTHS`), not here.

| Rule | Source | Body and date | Figure |
|---|---|---|---|
| Gradual delay of the statutory retirement age | Decision on implementing gradual delay of the statutory retirement age, with the State Council measures annexed: <http://www.npc.gov.cn/npc/c2/kgfb/202409/t20240913_439534.html>, <https://www.gov.cn/yaowen/liebiao/202409/content_6974294.htm> | NPC Standing Committee, adopted 2024-09-13, in force 2025-01-01 | From 2025-01-01, men and women originally retiring at 55: 1 month of delay per 4 months, up to 63 and 58. Women originally retiring at 50: 1 month per 2 months, up to 55 |
| Minimum contribution years | Same decision, measure 2 | Same | From 2030-01-01 rises from 15 years by 6 months a year to 20 years (2030: 15.5 ... 2039: 20) |
| Personal-account payout months | Annex of State Council Decision Guo Fa [2005] No. 38: <https://www.gov.cn/gongbao/content/2006/content_169950.htm> | State Council, 2005-12-03 | Age 60: 139, 61: 132, 62: 125, 63: 117 (full table in code) |
| Self-paid contribution of flexible workers | Same Guo Fa [2005] No. 38, art. 3 | Same | Rate 20%, of which 8% goes to the personal account |

Notes and caveats:

- The delay rule is applied as: months of delay = min(cap, ceil(k / step)), where k counts months from the start birth month (1965-01 for men, 1970-01 for women at 55, 1975-01 for women at 50), caps 36, 36 and 60 months. The official comparison tables are images on the government sites. The formula was checked against transcribed rows of those tables (1965-01 men: 60 years 1 month; 1971-01 men: 61 years 7 months, 19 months delay; 1974-01 men: 62 years 4 months; 1976-09 men: 63 years; 1975-01 and 1975-03 women at 50: 50 years 1 and 2 months), not against the images themselves.
- The payout-months table is an image on gov.cn. The values were taken from provincial copies of the same table (Chongqing HRSS attachments, Shenzhen reprints) and agree with each other from age 40 to 70. One source, a CAS docx, shows age 47 as 207; Chongqing and the other copies show 208, which is used here.
- Self-paid contribution default: the national rule is the 20% rate on a base chosen between about 60% and 300% of the previous year's local average wage. The 60% floor and the base are set by each province (see, for example, the Henan, Sichuan and Fujian human-resources pages), and the national text of Guo Fa [2005] No. 38 itself does not state 60%. The tool uses 60% x 20% of the user's base only as an editable default, labelled as this tool's setting.
- Basic-pension formula (basic = base x (1 + index) / 2 x years x 1%; personal = account / payout months) is from Guo Fa [2005] No. 38 art. 6. The assumptions about the base, the account interest and the contribution years are this tool's settings.
