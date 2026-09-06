// Find where "Base UI error" strings are constructed
const fs = require('fs'), path = require('path');
const root = 'node_modules/@base-ui/react';
function walk(dir, cb) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, cb);
    else if (fp.endsWith('.js')) cb(fp, fs.readFileSync(fp, 'utf8'));
  }
}
walk(root, (fp, c) => {
  const i = c.indexOf('Base UI error');
  if (i !== -1) {
    console.log('== ' + fp.split('node_modules')[1]);
    console.log(c.slice(Math.max(0, i - 300), i + 100).replace(/\n/g, ' '));
  }
});
