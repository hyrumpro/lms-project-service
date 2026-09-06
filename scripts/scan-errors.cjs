// Extract Base UI error definitions from the ESM source (dev builds have full messages)
const fs = require('fs'), path = require('path');
const root = 'node_modules/@base-ui/react';
const errors = {};
function walk(dir, cb) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, cb);
    else if (fp.endsWith('.js')) cb(fp, fs.readFileSync(fp, 'utf8'));
  }
}
walk(root, (fp, c) => {
  // dev error pattern: (0,/* @__PURE__ */external_"X")... or `Error: \`...\`` with code assignment
  const re = /(\d{1,3})\s*:\s*[`"']([^`"']{15,220})[`"']/g;
  let m;
  if (c.includes('errorCode') || c.includes('error #') || /incrementFetchCount|errorCode/.test(c)) {
    while ((m = re.exec(c))) {
      const code = Number(m[1]);
      if (code >= 1 && code <= 99 && !errors[code]) errors[code] = { msg: m[2], file: fp.split('node_modules')[1] };
    }
  }
});
const wanted = [31, 30, 32];
for (const code of wanted) if (errors[code]) console.log('#' + code, '→', errors[code].msg, '\n   in', errors[code].file);
if (!errors[31]) console.log('code 31 not found via regex; files with "Base UI error":');
