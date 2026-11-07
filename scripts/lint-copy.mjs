// Flags wording that promises returns or recommends products. Usage: node scripts/lint-copy.mjs <file...>
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BANNED = ['稳赚', '保本', '暴富', '必涨', '无风险收益', '荐股', '买入', '推荐基金'];

export const findBannedCopy = text => BANNED.filter(word => text.includes(word));

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let failed = false;
  for (const file of process.argv.slice(2)) {
    const hits = findBannedCopy(readFileSync(file, 'utf8'));
    if (hits.length) {
      failed = true;
      console.error(`${file}: ${hits.join(', ')}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
