// Servidor da Fase 2: serve o painel e o portal construídos em modo real e
// expõe a API do portal do lojista sobre o banco — acordo, 2ª via, pagamento
// informado, contestação e "falar com uma pessoa", tudo persistente e com
// trilha de auditoria (§7.3 e §8). Os JSONs do painel saem do banco a cada
// requisição (com cache curto), então o painel acompanha a operação.
//
// Uso: npm run servidor (porta 3000; PORTA=... muda).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarIndice, montarCliente, montarPortal } from '@sentinella/motor';
import { rotasPortal } from './portal-api';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PORTA = Number(process.env.PORTA ?? 3000);
const saidaPortal = join(raiz, 'apps', 'portal', 'out');
const saidaPainel = join(raiz, 'apps', 'painel', 'out');

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// Cache curto dos JSONs montados do banco.
const cache = new Map<string, { em: number; corpo: string }>();
const CACHE_MS = 30_000;
async function jsonDoBanco(chave: string, montar: () => Promise<unknown>): Promise<string> {
  const pronto = cache.get(chave);
  if (pronto && Date.now() - pronto.em < CACHE_MS) return pronto.corpo;
  const corpo = JSON.stringify(await montar());
  cache.set(chave, { em: Date.now(), corpo });
  return corpo;
}
export const limparCache = () => cache.clear();

function responderJson(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(typeof corpo === 'string' ? corpo : JSON.stringify(corpo));
}

async function servirEstatico(res: ServerResponse, base: string, caminho: string): Promise<boolean> {
  let alvo = normalize(join(base, caminho));
  if (!alvo.startsWith(base)) return false;
  try {
    let info = await stat(alvo).catch(() => null);
    if (info?.isDirectory()) {
      alvo = join(alvo, 'index.html');
      info = await stat(alvo).catch(() => null);
    }
    if (!info) {
      const comHtml = `${alvo}.html`;
      if (await stat(comHtml).catch(() => null)) alvo = comHtml;
      else return false;
    }
    const corpo = await readFile(alvo);
    res.writeHead(200, { 'content-type': TIPOS[extname(alvo)] ?? 'application/octet-stream' });
    res.end(corpo);
    return true;
  } catch {
    return false;
  }
}

async function corpoJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const pedacos: Buffer[] = [];
  for await (const pedaco of req) pedacos.push(pedaco as Buffer);
  if (!pedacos.length) return {};
  try {
    return JSON.parse(Buffer.concat(pedacos).toString('utf8'));
  } catch {
    return {};
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`);
  const caminho = decodeURIComponent(url.pathname);

  try {
    // ---- API do portal do lojista -----------------------------------------
    if (caminho.startsWith('/api/portal/')) {
      const partes = caminho.split('/').filter(Boolean); // api, portal, token, ação?
      const token = partes[2] ?? '';
      const acao = partes[3] ?? '';
      const corpo = req.method === 'POST' ? await corpoJson(req) : {};
      const resposta = await rotasPortal(token, acao, req.method ?? 'GET', corpo, url.searchParams);
      if (resposta.tipo === 'html') {
        res.writeHead(resposta.status, { 'content-type': 'text/html; charset=utf-8' });
        res.end(resposta.corpo);
      } else {
        responderJson(res, resposta.status, resposta.corpo);
      }
      if (req.method === 'POST') limparCache(); // o painel deve refletir na hora
      return;
    }

    // ---- JSONs do painel e do portal, direto do banco ---------------------
    const dadosVivos = caminho.match(/^\/(?:painel\/)?dados\/([a-z0-9]+)\.json$/);
    if (dadosVivos) {
      const nome = dadosVivos[1];
      if (nome === 'indice') return responderJson(res, 200, await jsonDoBanco('indice', () => montarIndice()));
      if (nome === 'portal')
        return responderJson(res, 200, await jsonDoBanco('portal', async () => (await montarPortal()).portal));
      if (nome === 'exemplos')
        return responderJson(res, 200, await jsonDoBanco('exemplos', async () => {
          const indice = await montarIndice();
          return { hoje: indice.hoje, tokensExemplo: indice.tokensExemplo };
        }));
      const cliente = await jsonDoBanco(`cliente:${nome}`, () => montarCliente(nome));
      if (cliente !== 'null') return responderJson(res, 200, cliente);
      return responderJson(res, 404, { erro: 'cliente não encontrado' });
    }

    // ---- estático: painel em /painel, portal na raiz ----------------------
    if (caminho === '/painel' || caminho.startsWith('/painel/')) {
      const relativo = caminho.slice('/painel'.length) || '/';
      if (await servirEstatico(res, saidaPainel, relativo)) return;
    } else if (await servirEstatico(res, saidaPortal, caminho)) {
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(
      'Não encontrado. Construa as interfaces com: npm run build:real (painel e portal em modo real).',
    );
  } catch (erro) {
    console.error(erro);
    responderJson(res, 500, { erro: 'erro interno' });
  }
});

servidor.listen(PORTA, () => {
  console.log(`Sentinella (Fase 2) em http://localhost:${PORTA}`);
  console.log(`  portal do lojista:  http://localhost:${PORTA}/`);
  console.log(`  painel do cliente:  http://localhost:${PORTA}/painel/`);
  console.log(`  API do portal:      http://localhost:${PORTA}/api/portal/<token>`);
});
