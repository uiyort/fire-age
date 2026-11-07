// Content studio page: edit personas, generate decks, copy the data bundle.
import DATA from './data-latest.js';
import { renderCard } from './card.js';
import { buildDeck, exportBundle, personaResult } from './studio.js';

const $ = id => document.getElementById(id);

async function loadPersonas() {
  const res = await fetch('personas.json');
  $('personas').value = await res.text();
}

function deckHtml(result, images) {
  const items = images.map((png, i) => `<a href="${png}" download="${result.label}-${i + 1}.png"><img src="${png}" alt="${result.label} 第 ${i + 1} 张"></a>`).join('');
  return `<section class="card deck"><h2>${result.label}</h2><div class="deck-row">${items}</div></section>`;
}

function generate() {
  $('studio-error').textContent = '';
  let personas;
  try {
    personas = JSON.parse($('personas').value);
  } catch (error) {
    $('studio-error').textContent = `人物参数不是有效的 JSON：${error.message}`;
    return;
  }
  try {
    const results = personas.map(p => personaResult(p, DATA));
    const canvas = document.createElement('canvas');
    $('decks').innerHTML = results.map(r => deckHtml(r, buildDeck(r).map(spec => {
      renderCard(spec, canvas);
      return canvas.toDataURL('image/png');
    }))).join('');
    $('bundle').textContent = exportBundle(results, DATA.version);
  } catch (error) {
    $('studio-error').textContent = `无法生成：${error.message}。请检查国家代码和数字。`;
  }
}

async function copyBundle() {
  try {
    await navigator.clipboard.writeText($('bundle').textContent);
    $('copy-status').textContent = '已复制';
  } catch {
    $('copy-status').textContent = '复制失败，请手动选中下方内容';
  }
}

$('generate').addEventListener('click', generate);
$('copy-bundle').addEventListener('click', copyBundle);
loadPersonas();
