const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'locale');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));

const langs = ['es', 'ja', 'pt', 'ru', 'zh-CN', 'zh-TW'];

// Flatten nested keys
function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flatten(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

const enFlat = flatten(en);
const enKeys = Object.keys(enFlat);

for (const lang of langs) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, `${lang}.json`), 'utf8'));
  const langFlat = flatten(data);
  const missing = enKeys.filter(k => !(k in langFlat));
  if (missing.length > 0) {
    console.log(`\n=== ${lang} missing ${missing.length} keys ===`);
    for (const k of missing) {
      console.log(`  ${k} = ${JSON.stringify(enFlat[k])}`);
    }
  } else {
    console.log(`\n=== ${lang}: all keys present ===`);
  }
}
