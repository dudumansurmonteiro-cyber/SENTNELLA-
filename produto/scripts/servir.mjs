// Servidor estático mínimo para verificar os exports (uso interno de build).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [dir, porta] = [process.argv[2], Number(process.argv[3] ?? 4310)];
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.txt': 'text/plain', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    let arquivo = normalize(join(dir, caminho));
    let corpo;
    try {
      corpo = await readFile(arquivo);
    } catch {
      arquivo = normalize(join(dir, caminho, 'index.html'));
      corpo = await readFile(arquivo);
    }
    res.writeHead(200, { 'content-type': tipos[extname(arquivo)] ?? 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
  }
}).listen(porta, () => console.log(`servindo ${dir} em http://localhost:${porta}`));
