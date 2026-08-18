const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'locale');
for (const l of ['en', 'es', 'ja', 'pt', 'ru', 'zh-CN', 'zh-TW']) {
  const p = path.join(dir, l + '.json');
  const raw = fs.readFileSync(p, 'utf8');
  const round = JSON.stringify(JSON.parse(raw), null, 2) + '\n';
  console.log(l, raw === round ? 'identical' : 'DIFFERS');
}
