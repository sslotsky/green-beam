const fs = require('fs');
const path = require('path');

function tableExists(db, name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function columnExists(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER DEFAULT (unixepoch())
  )`);

  // Bootstrap: if songs table already exists but no versions are tracked,
  // mark migrations as applied based on current schema state
  if (tableExists(db, 'songs')) {
    const count = db.prepare('SELECT COUNT(*) as n FROM schema_version').get().n;
    if (count === 0) {
      const bootstrap = [
        [1, '001_create_songs.sql'],
        columnExists(db, 'songs', 'name') && [2, '002_add_name.sql'],
        columnExists(db, 'songs', 'instrument') && [3, '003_add_instrument.sql'],
      ].filter(Boolean);

      const insert = db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)');
      for (const [version, name] of bootstrap) {
        insert.run(version, name);
      }
      if (bootstrap.length > 0) {
        console.log(`Bootstrapped schema_version with ${bootstrap.length} existing migrations`);
      }
    }
  }

  // Run pending migrations
  const applied = new Set(
    db.prepare('SELECT version FROM schema_version').all().map(r => r.version)
  );

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration ${file}`);
    db.exec(sql);
    db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(version, file);
  }
}

module.exports = { migrate };
