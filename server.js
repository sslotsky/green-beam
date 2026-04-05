const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
};

// --- Config ---
const MAX_HASH_LENGTH = 8192; // ~500+ notes
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per window
const EXPIRY_DAYS = 90;

// --- URL Shortener DB ---
const dbDir = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(dbDir, 'shortlinks.db'));
db.exec(`CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  last_accessed INTEGER DEFAULT (unixepoch())
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_hash ON links(hash)`);

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

const insertStmt = db.prepare('INSERT INTO links (code, hash) VALUES (?, ?)');
const findByHash = db.prepare('SELECT code FROM links WHERE hash = ?');
const findByCode = db.prepare('SELECT hash FROM links WHERE code = ?');
const touchStmt = db.prepare('UPDATE links SET last_accessed = unixepoch() WHERE code = ?');
const expireStmt = db.prepare('DELETE FROM links WHERE last_accessed < unixepoch() - ?');

function shorten(hash) {
  const existing = findByHash.get(hash);
  if (existing) return existing.code;
  let code;
  do { code = generateCode(); } while (findByCode.get(code));
  insertStmt.run(code, hash);
  return code;
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

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) rateLimits.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

// --- Expire old links periodically (every hour) ---
function expireOldLinks() {
  const deleted = expireStmt.run(EXPIRY_DAYS * 86400);
  if (deleted.changes > 0) console.log(`Expired ${deleted.changes} old links`);
}
expireOldLinks();
setInterval(expireOldLinks, 3600_000);

// --- HTTP Server ---
function getClientIp(req) {
  return req.headers['fly-client-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

const server = http.createServer((req, res) => {
  // POST /s — create short link
  if (req.method === 'POST' && req.url === '/s') {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests. Try again in a minute.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_HASH_LENGTH + 100) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Recording too large' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const { hash } = JSON.parse(body);
        if (!hash || typeof hash !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'hash required' }));
          return;
        }
        if (hash.length > MAX_HASH_LENGTH) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Recording too large' }));
          return;
        }
        const code = shorten(hash);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  // GET /s/:code — redirect to full URL
  const shortMatch = req.url.match(/^\/s\/([A-Za-z0-9]+)$/);
  if (shortMatch) {
    const row = findByCode.get(shortMatch[1]);
    if (row) {
      touchStmt.run(shortMatch[1]);
      res.writeHead(302, { Location: `/#${row.hash}` });
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
