// A small target the person sets for themselves, compared against their numbers on the next visit.
import { savingsRate } from './engine.js';
import { ODDS, oddsYears } from './odds.js';

const STORAGE_KEY = 'fire-age-goal-v1';

const KINDS = {
  saveRate: { read: p => savingsRate(p) ?? 0, met: (now, target) => now >= target, label: t => `储蓄率到 ${Math.round(t * 100)}%` },
  expense: { read: p => p.expense, met: (now, target) => now <= target, label: t => `年支出降到 ${Math.round(t).toLocaleString('zh-CN')}` },
  drag: { read: p => p.drag, met: (now, target) => now <= target, label: t => `税费拖累降到 ${t.toFixed(1)}%` },
};

export function makeGoal(paramId, target, p, now) {
  return { paramId, target, label: KINDS[paramId].label(target), years: oddsYears(p), odds: ODDS, createdAt: now, cur: p.wCur };
}

// A goal's amounts and years only compare within the currency and country it was set in.
export const goalApplies = (goal, p) => goal.cur === undefined || goal.cur === p.wCur;

export function compareVisit(goal, p, now) {
  const kind = KINDS[goal.paramId];
  const current = kind.read(p);
  const years = oddsYears(p);
  return {
    current,
    achieved: kind.met(current, goal.target),
    yearsDelta: goal.years === null || years === null ? null : goal.years - years,
    checkedAt: now,
  };
}

export function loadGoal(storage) {
  try {
    const goal = JSON.parse(storage.getItem(STORAGE_KEY));
    // A goal saved before the holiday age was counted by the odds measured its years another way, so it is dropped.
    return goal && KINDS[goal.paramId] && goal.odds === ODDS ? goal : null;
  } catch {
    return null;
  }
}

export function saveGoal(goal, storage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(goal));
  } catch {
    // Goals are a convenience; the calculator works without them.
  }
}

export function clearGoal(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
