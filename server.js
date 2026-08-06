const http = require('http'), fs = require('fs'), path = require('path');
const dir = __dirname;

http.createServer((req, res) => {
  let file = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end(e.message); return; }
    const m = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png'};
    res.writeHead(200, {'Content-Type': m[path.extname(file)]||'text/plain','Cache-Control':'no-cache'});
    res.end(d);
  });
}).listen(9999, () => console.log('http://localhost:9999'));
