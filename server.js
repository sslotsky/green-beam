const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
};

// --- Config ---
const MAX_DATA_LENGTH = 8192; // ~500+ notes
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per window
const EXPIRY_DAYS = 90;

// --- Songs DB ---
const dbDir = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(dbDir, 'songs.db'));
db.exec(`CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  last_accessed INTEGER DEFAULT (unixepoch())
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_data ON songs(data)`);

// Migrate: add columns if missing
for (const col of ['name TEXT DEFAULT \'\'', 'instrument TEXT DEFAULT \'\'']) {
  try { db.exec(`ALTER TABLE songs ADD COLUMN ${col}`); } catch {}
}

// Migrate from old shortlinks.db if it exists
const oldDbPath = path.join(dbDir, 'shortlinks.db');
if (fs.existsSync(oldDbPath)) {
  const oldDb = new Database(oldDbPath);
  const rows = oldDb.prepare('SELECT code, hash FROM links').all();
  const insert = db.prepare('INSERT OR IGNORE INTO songs (id, data) VALUES (?, ?)');
  for (const row of rows) insert.run(row.code, row.hash);
  oldDb.close();
  fs.unlinkSync(oldDbPath);
  console.log(`Migrated ${rows.length} songs from shortlinks.db`);
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateId(len = 6) {
  let id = '';
  for (let i = 0; i < len; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)];
  return id;
}

const insertStmt = db.prepare('INSERT INTO songs (id, data, name, instrument) VALUES (?, ?, ?, ?)');
const findByData = db.prepare('SELECT id FROM songs WHERE data = ?');
const findById = db.prepare('SELECT data, name, instrument FROM songs WHERE id = ?');
const touchStmt = db.prepare('UPDATE songs SET last_accessed = unixepoch() WHERE id = ?');
const expireStmt = db.prepare('DELETE FROM songs WHERE last_accessed < unixepoch() - ?');
const recentStmt = db.prepare('SELECT id, name, created_at FROM songs WHERE name != \'\' ORDER BY created_at DESC LIMIT 20');

function saveSong(data, name, instrument) {
  const existing = findByData.get(data);
  if (existing) return existing.id;
  let id;
  do { id = generateId(); } while (findById.get(id));
  insertStmt.run(id, data, name, instrument);
  return id;
}

// --- Rate limiting ---
const rateLimits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateLimits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { windowStart: now, count: 0 };
    rateLimits.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) rateLimits.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

// --- Expire old songs periodically (every hour) ---
function expireOldSongs() {
  const deleted = expireStmt.run(EXPIRY_DAYS * 86400);
  if (deleted.changes > 0) console.log(`Expired ${deleted.changes} old songs`);
}
expireOldSongs();
setInterval(expireOldSongs, 3600_000);

// --- HTTP Server ---
function getClientIp(req) {
  return req.headers['fly-client-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

const server = http.createServer((req, res) => {
  // POST /songs — save a song
  if (req.method === 'POST' && req.url === '/songs') {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests. Try again in a minute.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_DATA_LENGTH + 100) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Recording too large' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const { data, name, instrument } = JSON.parse(body);
        if (!data || typeof data !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'data required' }));
          return;
        }
        if (data.length > MAX_DATA_LENGTH) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Recording too large' }));
          return;
        }
        const songName = typeof name === 'string' ? name.slice(0, 100) : '';
        const songInstrument = typeof instrument === 'string' ? instrument.slice(0, 100) : '';
        const id = saveSong(data, songName, songInstrument);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  // GET /songs/recent — community songs
  if (req.method === 'GET' && req.url === '/songs/recent') {
    const rows = recentStmt.all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // GET /songs/:id/data — fetch song data as JSON
  const dataMatch = req.url.match(/^\/songs\/([A-Za-z0-9]+)\/data$/);
  if (dataMatch) {
    const row = findById.get(dataMatch[1]);
    if (row) {
      touchStmt.run(dataMatch[1]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: row.data, name: row.name, instrument: row.instrument }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    }
    return;
  }

  // GET /songs/:id or /s/:id — redirect to song
  const songMatch = req.url.match(/^\/(?:songs|s)\/([A-Za-z0-9]+)$/);
  if (songMatch) {
    const row = findById.get(songMatch[1]);
    if (row) {
      touchStmt.run(songMatch[1]);
      const nameParam = row.name ? `&name=${encodeURIComponent(row.name)}` : '';
      const instrParam = row.instrument ? `&instrument=${encodeURIComponent(row.instrument)}` : '';
      res.writeHead(302, { Location: `/#${row.data}${nameParam}${instrParam}` });
      res.end();
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // Static files
  const filePath = req.url === '/' ? '/canvas.html' : req.url;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);

  if (!MIME_TYPES[ext] || !fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const content = fs.readFileSync(fullPath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] });
  res.end(content);
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
