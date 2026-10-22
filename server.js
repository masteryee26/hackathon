const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const filePath = req.url === '/' ? HTML_FILE : path.join(__dirname, req.url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Default fallback to index.html for single-page app routes
      fs.readFile(HTML_FILE, (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server Error loading MedCloak application.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallbackData);
      });
      return;
    }

    let contentType = 'text/html; charset=utf-8';
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.svg') contentType = 'image/svg+xml';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MedCloak Mission Control Server is LIVE!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📡 Network: http://127.0.0.1:${PORT}`);
  console.log(`==================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`Port ${PORT} in use, attempting ${nextPort}...`);
    server.listen(nextPort, '0.0.0.0');
  } else {
    console.error('Server error:', err);
  }
});
