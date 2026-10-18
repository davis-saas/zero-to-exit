// Tiny static server for local play: node tools/serve.js [port]
var http = require('http'), fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var port = Number(process.env.PORT) || Number(process.argv[2]) || 8765;
var types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
function handler(req, res) {
  var p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  var file = path.join(root, path.normalize(p));
  if (file.indexOf(root) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}
// Listen on both loopback addresses so "localhost" works whether it resolves to IPv4 or IPv6.
http.createServer(handler).listen(port, '127.0.0.1', function () { console.log('Zero to Exit on http://localhost:' + port); });
http.createServer(handler).listen(port, '::1').on('error', function () {});
