const fs = require('fs');
const path = require('path');
const { Hono } = require('hono');
const { html, raw } = require('hono/html');
const { serve } = require('@hono/node-server');
const Database = require('better-sqlite3');
const { migrate } = require('./migrate.js');
const { generateOgImage } = require('./og.js');

// --- Config ---
const MAX_DATA_LENGTH = 8192;
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;
const EXPIRY_DAYS = 90;

// --- Songs DB ---
const dbDir = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(dbDir, 'songs.db'));
migrate(db);

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

// Decode binary event data (mirrors client-side sharing.js)
function decodeEvents(base64url) {
  try {
    const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(padded, 'base64');
    if (buf[0] !== 1) return [];
    const events = [];
    for (let i = 1; i + 4 <= buf.length; i += 4) {
      const type = (buf[i] >> 7) === 1 ? 'on' : 'off';
      const midi = buf[i] & 0x7F;
      const time = (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];
      events.push({ type, midi, time });
    }
    return events;
  } catch { return []; }
}

// GET /songs/:id/og.png — dynamic OG image
app.get('/songs/:id/og.png', async (c) => {
  const row = findById.get(c.req.param('id'));
  if (!row) return c.notFound();
  const songTitle = row.name || 'Shared Song';
  const events = decodeEvents(row.data);
  const png = await generateOgImage(songTitle, row.instrument, events);
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
});

// GET /songs/:id or /s/:id — serve app with OG tags
const baseHtml = fs.readFileSync(path.join(__dirname, 'canvas.html'), 'utf-8');

function songPage(row, url, id) {
  const songTitle = row.name || 'Shared Song';
  const instrument = row.instrument ? row.instrument.replace(/_/g, ' ') : 'piano';
  const description = `Listen to "${songTitle}" played on ${instrument} — made with Lumitone`;
  const nameParam = row.name ? `&name=${encodeURIComponent(row.name)}` : '';
  const instrParam = row.instrument ? `&instrument=${encodeURIComponent(row.instrument)}` : '';
  const hash = `${row.data}${nameParam}${instrParam}`;
  const ogImageUrl = new URL(`/songs/${id}/og.png`, url).href;

  const ogTags = html`
    <meta property="og:title" content="${songTitle} — Lumitone" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="music.song" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${songTitle} — Lumitone" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImageUrl}" />
  `;
  const hashScript = `<script>if(!location.hash)location.hash=${JSON.stringify(hash)};</script>`;

  return baseHtml
    .replace('</head>', `${ogTags}</head>`)
    .replace('</body>', `${hashScript}</body>`);
}

function serveSongPage(c) {
  const id = c.req.param('id');
  const row = findById.get(id);
  if (!row) return c.notFound();
  touchStmt.run(id);
  return c.html(songPage(row, c.req.url, id));
}

app.get('/songs/:id', serveSongPage);
app.get('/s/:id', serveSongPage);

// Static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const STATIC_ALIASES = { '/': '/canvas.html' };
const crypto = require('crypto');

// Pre-compute ETags at startup
const etagCache = {};
function getEtag(filePath) {
  if (!etagCache[filePath]) {
    const content = fs.readFileSync(filePath);
    etagCache[filePath] = { content, etag: `"${crypto.createHash('md5').update(content).digest('hex')}"` };
  }
  return etagCache[filePath];
}

app.get('/*', (c) => {
  const urlPath = STATIC_ALIASES[c.req.path] || c.req.path;
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext];

  if (!mimeType || !fs.existsSync(filePath)) return c.notFound();

  const { content, etag } = getEtag(filePath);

  if (c.req.header('if-none-match') === etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(content, {
    headers: { 'Content-Type': mimeType, 'Cache-Control': 'no-cache', 'ETag': etag },
  });
});

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Server running at http://localhost:3000');
});
