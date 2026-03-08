const fs = require('fs');
const bg48 = fs.readFileSync('gemini-watermark-remover/assets/bg_48.png').toString('base64');
const bg96 = fs.readFileSync('gemini-watermark-remover/assets/bg_96.png').toString('base64');

const content = `export const bg48Base64 = 'data:image/png;base64,${bg48}';\nexport const bg96Base64 = 'data:image/png;base64,${bg96}';\n`;

fs.writeFileSync('src/entrypoints/main-world/gemini/watermark-assets.ts', content);
console.log('Done!');
