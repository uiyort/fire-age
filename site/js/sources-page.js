// Renders the published data, with status and licence, so every number can be checked.
import DATA from './data-latest.js';

const $ = id => document.getElementById(id);
const STATUS = { official: '官方', carried: '沿用', assumed: '假设' };

const fmt = (v, digits) => Number(v).toLocaleString('en-US', { maximumFractionDigits: digits });
const cell = (field, digits, suffix = '') => `${fmt(field.value, digits)}${suffix} <span class="fine">${STATUS[field.status]} · ${field.observedAt}</span>`;

$('version').textContent = DATA.version;

$('fx').innerHTML = `<thead><tr><th>货币</th><th>每 1 美元</th><th>状态与观测日期</th></tr></thead><tbody>${Object.entries(DATA.fx).map(([cur, f]) =>
  `<tr data-field="fx.${cur}"><td>${cur}</td><td class="num">${fmt(f.value, 4)}</td><td>${STATUS[f.status]} · ${f.observedAt}</td></tr>`).join('')}</tbody>`;

const workers = Object.entries(DATA.countries).filter(([, c]) => c.roles.includes('work'));
$('work').innerHTML = `<thead><tr><th>地区</th><th>最新 CPI 同比</th><th>通胀目标</th><th>10 年期国债</th><th>常规退休</th><th>税费拖累</th></tr></thead><tbody>${workers.map(([code, c]) => `<tr>
  <td>${c.name}</td>
  <td data-field="${code}.cpi">${cell(c.cpi, 2, '%')}</td>
  <td data-field="${code}.target">${fmt(c.target.value, 1)}%</td>
  <td data-field="${code}.y10">${cell(c.y10, 2, '%')}${c.y10.status === 'assumed' ? ' <span class="fine">见下文</span>' : ''}</td>
  <td>${c.pAge.value} 岁</td>
  <td>${fmt(c.drag.value, 2)}%</td></tr>`).join('')}</tbody>`;

$('price').innerHTML = `<thead><tr><th>地区</th><th>价格水平</th><th>状态与 PPP 年份</th><th>可选作</th></tr></thead><tbody>${Object.entries(DATA.countries).map(([code, c]) =>
  `<tr data-field="${code}.priceLevel"><td>${c.name}</td><td class="num">${fmt(c.priceLevel.value, 3)}</td><td>${STATUS[c.priceLevel.status]} · ${c.priceLevel.observedAt}</td><td>${c.roles.includes('work') ? '工作地和退休地' : '仅退休地'}</td></tr>`).join('')}</tbody>`;

const flagged = [...workers.flatMap(([, c]) => [c.cpi, c.y10]), ...Object.values(DATA.fx), ...Object.values(DATA.countries).map(c => c.priceLevel)]
  .filter(f => f.note);
const generic = workers[0][1];
const notes = [...new Set([...flagged.map(f => f.note), generic.target.note, generic.pAge.note, generic.drag.note])];
$('assumed').innerHTML = `<ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>`;

$('sources').innerHTML = DATA.sources.map(s => `<p data-source="${s.id}"><a href="${s.url}" target="_blank" rel="noopener">${s.name}</a><br><span class="fine">${s.license} <a href="${s.termsUrl}" target="_blank" rel="noopener">条款</a></span></p>`).join('');
