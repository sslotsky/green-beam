const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
};

// --- URL Shortener DB ---
const dbDir = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(dbDir, 'shortlinks.db'));
db.exec(`CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
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

function shorten(hash) {
  const existing = findByHash.get(hash);
  if (existing) return existing.code;
  let code;
  do { code = generateCode(); } while (findByCode.get(code));
  insertStmt.run(code, hash);
  return code;
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  // POST /s — create short link
  if (req.method === 'POST' && req.url === '/s') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { hash } = JSON.parse(body);
        if (!hash || typeof hash !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'hash required' }));
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
