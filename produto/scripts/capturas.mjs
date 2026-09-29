// Capturas de verificação (Chromium via playwright-core).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const destino = process.argv[2] ?? '/tmp/capturas';
mkdirSync(destino, { recursive: true });

const alvos = [
  { url: 'http://localhost:4310/', nome: 'painel-visao', w: 1280, h: 900 },
  { url: 'http://localhost:4310/devedores/', nome: 'painel-devedores', w: 1280, h: 900 },
  { url: 'http://localhost:4310/devedores/ficha/?l=l101', nome: 'painel-ficha', w: 1280, h: 900 },
  { url: 'http://localhost:4310/eficiencia/', nome: 'painel-eficiencia', w: 1280, h: 900 },
  { url: 'http://localhost:4310/hoje/', nome: 'painel-hoje', w: 1280, h: 900 },
  { url: 'http://localhost:4310/config/', nome: 'painel-config', w: 1280, h: 900 },
  { url: 'http://localhost:4310/console/', nome: 'console-fila', w: 1280, h: 900 },
  { url: 'http://localhost:4310/console/atender/?e=e1&c=c1', nome: 'console-atender', w: 1280, h: 900 },
  { url: 'http://localhost:4310/console/coordenacao/', nome: 'console-coordenacao', w: 1280, h: 900 },
  { url: 'http://localhost:4310/', nome: 'painel-visao-escuro', w: 1280, h: 900, escuro: true },
  { url: 'http://localhost:4310/', nome: 'painel-visao-360', w: 360, h: 780 },
  { url: 'http://localhost:4311/', nome: 'portal-home', w: 390, h: 820 },
  { url: 'http://localhost:4311/l/?t=pyp4r33mjc', nome: 'portal-lojista', w: 390, h: 1400 },
  { url: 'http://localhost:4311/l/?t=pyp4r33mjc', nome: 'portal-lojista-escuro', w: 390, h: 1100, escuro: true },
];

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const a of alvos) {
  const ctx = await navegador.newContext({
    viewport: { width: a.w, height: a.h },
    colorScheme: a.escuro ? 'dark' : 'light',
  });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e)));
  await pagina.goto(a.url, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(700);
  await pagina.screenshot({ path: `${destino}/${a.nome}.png` });
  if (erros.length) console.log(`ERROS em ${a.nome}:`, erros.slice(0, 3));
  await ctx.close();
}
await navegador.close();
console.log('capturas em', destino);
