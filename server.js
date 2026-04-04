const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
};

const server = http.createServer((req, res) => {
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
