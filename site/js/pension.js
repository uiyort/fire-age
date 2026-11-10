// China basic-pension rules (enterprise employees). Pure functions, no DOM.
// Sources are listed in docs/data-sources.md ("China basic pension rules").

// Gradual retirement-age delay: NPC Standing Committee decision of 2024-09-13
// (in force 2025-01-01) and the State Council measures annexed to it.
// http://www.npc.gov.cn/npc/c2/kgfb/202409/t20240913_439534.html
// https://www.gov.cn/yaowen/liebiao/202409/content_6974294.htm
const KINDS = {
  m: { baseAge: 60, startYear: 1965, step: 4, cap: 36 },
  f55: { baseAge: 55, startYear: 1970, step: 4, cap: 36 },
  f50: { baseAge: 50, startYear: 1975, step: 2, cap: 60 },
};

export function statutoryAge({ birthYear, birthMonth, kind } = {}) {
  const k = KINDS[kind];
  if (!k || !Number.isFinite(birthYear) || !Number.isFinite(birthMonth) || birthMonth < 1 || birthMonth > 12) return null;
  const since = (birthYear - k.startYear) * 12 + birthMonth; // 1 = the start month itself
  const delay = since < 1 ? 0 : Math.min(k.cap, Math.ceil(since / k.step));
  const total = k.baseAge * 12 + delay;
  const years = Math.floor(total / 12);
  const months = total % 12;
  const claimYear = birthYear + Math.floor((birthMonth - 1 + total) / 12);
  return { years, months, claimYear };
}

// Minimum contribution years: 15 until 2029; from 2030 +6 months a year to 20 in 2039.
// Same decision's annexed schedule (2030: 15 years 6 months ... 2039: 20 years).
export function minContribYears(claimYear) {
  if (claimYear < 2030) return 15;
  return Math.min(20, 15 + (claimYear - 2029) * 0.5);
}

// Personal-account payout months by retirement age: annex to State Council
// Decision Guo Fa [2005] No. 38 (2005-12-03), https://www.gov.cn/gongbao/content/2006/content_169950.htm
// (table is an image there; values cross-checked against provincial copies, e.g. Chongqing HRSS attachment).
export const PAYOUT_MONTHS = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
  50: 195, 51: 190, 52: 185, 53: 180, 54: 175, 55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
  60: 139, 61: 132, 62: 125, 63: 117, 64: 109, 65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56,
};

export function payoutMonths(age) {
  if (typeof age !== 'number' || !Number.isFinite(age)) return null;
  const a = Math.min(70, Math.max(40, Math.floor(age)));
  return PAYOUT_MONTHS[a];
}

// Payout months are looked up by completed whole years; a part year rounds up in this tool's model.
export function claimAgeWhole({ years, months }) {
  return months > 0 ? years + 1 : years;
}

// Estimate in today's money. base = social average wage (editable), index = personal wage index.
export function estimatePension({ base, index, years, paidYears, account, claimAge, claimYear } = {}) {
  const minYears = Number.isFinite(claimYear) ? minContribYears(claimYear) : null;
  const none = { eligible: false, basic: 0, personal: 0, monthly: 0, minYears };
  if (![base, index, years, claimAge, claimYear].every(Number.isFinite)) return none;
  const months = payoutMonths(claimAge);
  const y = Math.max(years, 0);
  const paid = Number.isFinite(paidYears) ? paidYears : 0;
  const eligible = y >= minYears;
  const basic = base * (1 + index) / 2 * y * 0.01;
  const future = base * index * 0.08 * 12 * Math.max(y - paid, 0);
  const personal = ((Number.isFinite(account) ? account : 0) + future) / months;
  return { eligible, basic, personal, monthly: eligible ? basic + personal : 0, minYears };
}

// The estimate a form asks for: null until a birth month and a base are filled in. years left blank defaults to
// the years already paid plus the whole years still to go before the statutory age (this tool's setting).
export function estimateFromForm(pen, nowYear) {
  const m = /^(\d{4})-(\d{2})$/.exec(pen?.birth ?? '');
  if (!m || !(pen.base > 0)) return null;
  const st = statutoryAge({ birthYear: Number(m[1]), birthMonth: Number(m[2]), kind: pen.kind });
  if (!st) return null;
  const claimAge = claimAgeWhole(st);
  const paid = pen.paidYears > 0 ? pen.paidYears : 0;
  const defaultYears = Math.max(paid + (st.claimYear - nowYear), 0);
  const years = pen.years === null || pen.years === undefined ? defaultYears : pen.years;
  const index = Number.isFinite(pen.index) ? pen.index : 1;
  const est = estimatePension({ base: pen.base, index, years, paidYears: paid, account: pen.account ?? 0, claimAge, claimYear: st.claimYear });
  return { st, claimAge, years, defaultYears, est, selfPay: selfPayDefault(pen.base) };
}

// Default self-paid monthly contribution for flexible workers: 20% of the 60% floor of the base.
// Rate: Guo Fa [2005] No. 38 art. 3; the 60% floor and the base vary by locality. Editable default only.
export function selfPayDefault(base) {
  return base * 0.6 * 0.2;
}
