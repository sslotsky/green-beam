const fs = require('fs');
const path = require('path');
const { Hono } = require('hono');
const { html, raw } = require('hono/html');
const { serve } = require('@hono/node-server');
const Database = require('better-sqlite3');

// --- Config ---
const MAX_DATA_LENGTH = 8192;
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;
const EXPIRY_DAYS = 90;

// --- Songs DB ---
const dbDir = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(dbDir, 'songs.db'));
db.exec(`CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  last_accessed INTEGER DEFAULT (unixepoch()),
  name TEXT DEFAULT '',
  instrument TEXT DEFAULT ''
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_data ON songs(data)`);

// Migrate: add columns if missing
for (const col of ["name TEXT DEFAULT ''", "instrument TEXT DEFAULT ''"]) {
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
const recentStmt = db.prepare("SELECT id, name, created_at FROM songs WHERE name != '' ORDER BY created_at DESC LIMIT 20");

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

// --- Expire old songs periodically ---
function expireOldSongs() {
  const deleted = expireStmt.run(EXPIRY_DAYS * 86400);
  if (deleted.changes > 0) console.log(`Expired ${deleted.changes} old songs`);
}
expireOldSongs();
setInterval(expireOldSongs, 3600_000);

// --- App ---
const app = new Hono();

function getClientIp(c) {
  return c.req.header('fly-client-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
}

// POST /songs
app.post('/songs', async (c) => {
  const ip = getClientIp(c);
  if (isRateLimited(ip)) {
    return c.json({ error: 'Too many requests. Try again in a minute.' }, 429);
  }

  const body = await c.req.json();
  const { data, name, instrument } = body;

  if (!data || typeof data !== 'string') {
    return c.json({ error: 'data required' }, 400);
  }
  if (data.length > MAX_DATA_LENGTH) {
    return c.json({ error: 'Recording too large' }, 413);
  }

  const songName = typeof name === 'string' ? name.slice(0, 100) : '';
  const songInstrument = typeof instrument === 'string' ? instrument.slice(0, 100) : '';
  const id = saveSong(data, songName, songInstrument);
  return c.json({ id });
});

// GET /songs/recent
app.get('/songs/recent', (c) => {
  return c.json(recentStmt.all());
});

// GET /songs/:id/data
app.get('/songs/:id/data', (c) => {
  const row = findById.get(c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  touchStmt.run(c.req.param('id'));
  return c.json({ data: row.data, name: row.name, instrument: row.instrument });
});

// GET /songs/:id or /s/:id — serve app with OG tags
const baseHtml = fs.readFileSync(path.join(__dirname, 'canvas.html'), 'utf-8');

function songPage(row, url) {
  const songTitle = row.name || 'Shared Song';
  const instrument = row.instrument ? row.instrument.replace(/_/g, ' ') : 'piano';
  const description = `Listen to "${songTitle}" played on ${instrument} — made with Lumitone`;
  const nameParam = row.name ? `&name=${encodeURIComponent(row.name)}` : '';
  const instrParam = row.instrument ? `&instrument=${encodeURIComponent(row.instrument)}` : '';
  const hash = `${row.data}${nameParam}${instrParam}`;

  const ogTags = html`
    <meta property="og:title" content="${songTitle} — Lumitone" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="music.song" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${songTitle} — Lumitone" />
    <meta name="twitter:description" content="${description}" />
  `;
  const hashScript = html`<script>if(!location.hash)location.hash=${JSON.stringify(hash)};</script>`;

  return baseHtml
    .replace('</head>', `${ogTags}</head>`)
    .replace('</body>', `${hashScript}</body>`);
}

function serveSongPage(c) {
  const row = findById.get(c.req.param('id'));
  if (!row) return c.notFound();
  touchStmt.run(c.req.param('id'));
  return c.html(songPage(row, c.req.url));
}

app.get('/songs/:id', serveSongPage);
app.get('/s/:id', serveSongPage);

// Static files
app.get('/', (c) => {
  const html = fs.readFileSync(path.join(__dirname, 'canvas.html'), 'utf-8');
  return c.html(html);
});

app.get('/js/*', (c) => {
  const filePath = path.join(__dirname, c.req.path);
  if (!fs.existsSync(filePath)) return c.notFound();
  const content = fs.readFileSync(filePath, 'utf-8');
  return new Response(content, { headers: { 'Content-Type': 'application/javascript' } });
});

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Server running at http://localhost:3000');
});
