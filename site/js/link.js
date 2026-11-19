// Numbers carried in an address fragment, for a worked example a guide or an answer links to: #age=30&income=12000.
// The fragment never reaches the server, so the numbers stay in the browser, as typed ones do. Money is monthly where
// the simple form asks for it monthly, and in the currency of the place it belongs to.
import { defaultState, setField, setRetireCountry, setWorkCountry } from './state.js';

// Fixed order: places first, since choosing a place converts the money already there.
const PLACES = { work: setWorkCountry, retire: setRetireCountry };
const NUMBERS = { age: ['age', 1], assets: ['assets', 1], income: ['income', 12], expense: ['expense', 12], retexp: ['retExp', 12], pension: ['pension', 12], tage: ['tAge', 1] };
const ORDER = ['age', 'assets', 'income', 'expense', 'retexp', 'pension', 'tage', 'mode', 'work', 'retire'];
const MODES = ['fwd', 'bwd'];

// The state a fragment describes, built on the examples, or null when the fragment holds none of these keys.
export function stateFromLink(hash, data) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  if (!ORDER.some(key => params.has(key))) return null;
  let S = defaultState(data);
  for (const [key, set] of Object.entries(PLACES)) {
    if (params.has(key)) S = set(S, params.get(key).toUpperCase(), data);
  }
  for (const [key, [id, months]] of Object.entries(NUMBERS)) {
    const text = params.get(key)?.trim();
    const value = text ? Number(text) : NaN;
    if (Number.isFinite(value)) S = setField(S, id, String(value * months), data);
  }
  if (MODES.includes(params.get('mode'))) S = { ...S, mode: params.get('mode') };
  return S;
}

// The fragment for a set of values, for writing links by hand or from a script.
export function linkHash(values) {
  const unknown = Object.keys(values).filter(key => !ORDER.includes(key));
  if (unknown.length) throw new Error(`Not a link key: ${unknown.join(', ')}`);
  return '#' + ORDER.filter(key => values[key] !== undefined).map(key => `${key}=${encodeURIComponent(values[key])}`).join('&');
}
