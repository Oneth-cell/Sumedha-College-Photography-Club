const Database = require("better-sqlite3");

const db = new Database("club.db", { readonly: true });

const columns = db
  .prepare("PRAGMA table_info(audit_logs)")
  .all();

console.log(JSON.stringify(columns, null, 2));

db.close();