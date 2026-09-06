/** Dumps the legacy install.sql schema: table → columns (name: type). */
const fs = require("fs");

const sql = fs.readFileSync(process.argv[2] ?? "../../Academy-LMS/uploads/install.sql", "utf8");
const lines = sql.split("\n");
const tables = {};
let current = null;
for (const line of lines) {
  const cm = line.match(/^CREATE TABLE `(\w+)` \(/);
  if (cm) {
    current = cm[1];
    tables[current] = [];
    continue;
  }
  if (current) {
    if (/^\)\s*ENGINE/.test(line)) {
      current = null;
      continue;
    }
    const col = line.match(/^\s*`(\w+)` (\w+)/);
    if (col) tables[current].push(col[1] + ": " + col[2]);
  }
}

console.log("tables:", Object.keys(tables).length);
const interesting = process.argv[3]
  ? process.argv[3].split(",")
  : ["users", "course", "lesson", "question", "enrol", "payment", "section"];
for (const t of interesting) {
  console.log("\n[" + t + "] " + (tables[t] || []).length + " cols");
  console.log("  " + (tables[t] || []).join("\n  "));
}
fs.writeFileSync("scripts/migrate/legacy-schema.json", JSON.stringify(tables, null, 2));
console.log("\nsaved → scripts/migrate/legacy-schema.json");
