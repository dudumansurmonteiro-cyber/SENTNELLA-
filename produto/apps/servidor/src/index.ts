// Servidor da Fase 2 (v3): serve o painel e os portais construídos em modo
// real, regenera os JSONs white label a partir do BANCO (a mesma exportação
// do CLI, com cache curto) e expõe a API persistente do espaço do devedor —
// acordo com custo total antes do aceite, contestação que pausa a régua,
// pagamento informado, preferências de canal e atendimento humano — além da
// rota de leitura do portal do credor. Tudo com trilha de auditoria.
//
// Uso: npm run operacao (constrói e sobe) ou npm run servidor (só sobe).
// Porta 3000; PORTA=... muda.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportarParaApps } from '@sentinella/motor';
import { rotasDevedor } from './portal-api';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PORTA = Number(process.env.PORTA ?? 3000);
const saidaPortal = join(raiz, 'apps', 'portal', 'out');
const saidaPainel = join(raiz, 'apps', 'painel', 'out');
const dirDados = join(raiz, 'apps', 'servidor', 'dados');

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

// Os JSONs das superfícies saem do banco pela MESMA exportação do CLI, com
// cache curto; qualquer ação do devedor invalida, então o painel e o portal
// do credor acompanham a operação quase em tempo real.
const EXPORT_TTL_MS = 60_000;
let exportadoEm = 0;
let exportando: Promise<void> | null = null;
export const invalidarExportacao = () => { exportadoEm = 0; };
async function garantirExportacao(): Promise<void> {
  if (Date.now() - exportadoEm < EXPORT_TTL_MS) return;
  exportando ??= exportarParaApps(raiz)
    .then(() => { exportadoEm = Date.now(); })
    .finally(() => { exportando = null; });
  await exportando;
}

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
    // ---- API do espaço do devedor (persistente, sobre o banco) -----------
    const rotaDevedor = caminho.match(/^\/api\/devedor\/([a-z0-9]{6,40})(?:\/([a-z-]+))?$/);
    if (rotaDevedor) {
      const corpo = req.method === 'POST' ? await corpoJson(req) : {};
      const resposta = await rotasDevedor(
        rotaDevedor[1], rotaDevedor[2] ?? '', req.method ?? 'GET', corpo,
      );
      responderJson(res, resposta.status, resposta.corpo);
      if (req.method === 'POST') invalidarExportacao(); // superfícies refletem na hora
      return;
    }

    // ---- portal do credor: leitura, sempre da exportação viva ------------
    const rotaCredor = caminho.match(/^\/api\/credor\/([a-z0-9]{6,40})$/);
    if (rotaCredor) {
      await garantirExportacao();
      const mapa = JSON.parse(await readFile(join(dirDados, 'credores.json'), 'utf8'));
      const entrada = mapa[rotaCredor[1]];
      if (entrada) return responderJson(res, 200, entrada);
      return responderJson(res, 404, { erro: 'link não encontrado ou expirado' });
    }

    // ---- JSONs das superfícies, regenerados do banco ----------------------
    const dadosVivos = caminho.match(/^\/(?:painel\/)?dados\/([a-z0-9]+)\.json$/);
    if (dadosVivos) {
      await garantirExportacao();
      const arquivo = join(dirDados, `${dadosVivos[1]}.json`);
      if (await stat(arquivo).catch(() => null))
        return responderJson(res, 200, await readFile(arquivo, 'utf8'));
      return responderJson(res, 404, { erro: 'não há dados exportados com esse nome' });
    }

    // ---- estático: painel em /painel, portais na raiz ---------------------
    if (caminho === '/painel' || caminho.startsWith('/painel/')) {
      const relativo = caminho.slice('/painel'.length) || '/';
      if (await servirEstatico(res, saidaPainel, relativo)) return;
    } else if (await servirEstatico(res, saidaPortal, caminho)) {
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado. Construa as interfaces com: npm run build:real');
  } catch (erro) {
    console.error(erro);
    responderJson(res, 500, { erro: 'erro interno' });
  }
});

servidor.listen(PORTA, () => {
  console.log(`Sentinella (Fase 2, v3) em http://localhost:${PORTA}`);
  console.log(`  painel do escritório:  http://localhost:${PORTA}/painel/`);
  console.log(`  espaço do devedor:     http://localhost:${PORTA}/d/?t=<token>`);
  console.log(`  portal do credor:      http://localhost:${PORTA}/c/?t=<token>`);
  console.log(`  API:                   http://localhost:${PORTA}/api/devedor/<token>`);
});
