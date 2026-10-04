// Verifica o painel v3 montado sob prefixo aninhado (como no visualizador
// de artifacts): cada página carrega dados reais, sem erro de console nem
// requisição falhada; a troca de escritório muda marca e números.
import { chromium } from 'playwright-core';

// Uso: node scripts/verificar-painel.mjs [url-base-do-painel]
const BASE = process.argv[2] ?? 'http://localhost:4321/demo/v3/painel/';
const paginas = [
  { rota: '', espera: ['Visão geral da operação', 'Recuperado no mês', 'Pendências do advogado'] },
  { rota: 'carteiras/', espera: ['Carteiras', 'Honorários do mês', 'honorários'] },
  { rota: 'devedores/', espera: ['Devedores', 'devedores'] },
  { rota: 'eficiencia/', espera: ['Eficiência', 'Por canal', 'E+0'] },
  { rota: 'hoje/', espera: ['Fila do dia', 'Para o advogado assinar', 'autorizar título a título'] },
  { rota: 'config/', espera: ['Plano e cobrança', 'Marca (white label)', 'devedor'] },
  { rota: 'console/', espera: ['Fila de exceções', 'Outros escritórios'] },
  { rota: 'console/ligacoes/', espera: ['Ligações do dia'] },
  { rota: 'console/coordenacao/', espera: ['Coordenação', 'Carga por pessoa'] },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pagina = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let problemas = 0;
const erros = [];
// Fontes do Google falham no Chromium do ambiente de verificação (TLS do
// proxy); no navegador real carregam — não contam como erro.
const ignorar = (t) => t.includes('fonts.googleapis.com') || t.includes('fonts.gstatic.com') || t.includes('ERR_CERT_AUTHORITY_INVALID') || t.includes('favicon.ico') || t.includes('status of 404');
pagina.on('console', (m) => m.type() === 'error' && !ignorar(m.text()) && erros.push(`console: ${m.text()}`));
pagina.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
pagina.on('requestfailed', (r) => !ignorar(r.url()) && erros.push(`reqfailed: ${r.url()}`));
pagina.on('response', (r) => r.status() >= 400 && !ignorar(r.url()) && erros.push(`http ${r.status()}: ${r.url()}`));

for (const { rota, espera } of paginas) {
  erros.length = 0;
  await pagina.goto(BASE + rota, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(400);
  const texto = await pagina.evaluate(() => document.body.innerText);
  const faltando = espera.filter((e) => !e.split('|').some((alt) => texto.includes(alt)));
  const carregando = texto.includes('Carregando os dados');
  if (faltando.length || erros.length || carregando) {
    problemas++;
    console.log(`✗ ${rota || '(raiz)'}${carregando ? ' AINDA CARREGANDO' : ''}`);
    for (const f of faltando) console.log(`   falta: ${f}`);
    for (const e of erros.slice(0, 5)) console.log(`   ${e}`);
  } else {
    console.log(`✓ ${rota || '(raiz)'}`);
  }
}

// Carteira expandida mostra alçada e encargos.
await pagina.goto(`${BASE}carteiras/`, { waitUntil: 'networkidle' });
await pagina.click('table button');
await pagina.waitForTimeout(200);
const cartTxt = await pagina.evaluate(() => document.body.innerText);
const cartOk = cartTxt.includes('Alçada da IA') && (cartTxt.includes('multa') || cartTxt.includes('sem encargos'));
console.log(cartOk ? '✓ carteira expande com alçada e encargos' : '✗ expansão da carteira');
if (!cartOk) problemas++;

// Ficha de um devedor real (pega o primeiro link da lista).
await pagina.goto(`${BASE}devedores/`, { waitUntil: 'networkidle' });
const href = await pagina.getAttribute('table a', 'href');
erros.length = 0;
await pagina.goto(new URL(href, `${BASE}devedores/`).href, { waitUntil: 'networkidle' });
const fichaTxt = await pagina.evaluate(() => document.body.innerText);
const fichaOk = fichaTxt.includes('pontos — interno') && fichaTxt.includes('Títulos (');
console.log(fichaOk && !erros.length ? '✓ devedores/ficha/?d=…' : `✗ ficha (${erros[0] ?? 'texto ausente'})`);
if (!fichaOk || erros.length) problemas++;

// Trilha expandida: abre o primeiro título da ficha.
await pagina.click('table button');
await pagina.waitForTimeout(200);
const trilhaTxt = await pagina.evaluate(() => document.body.innerText);
const trilhaOk = trilhaTxt.includes('Trilha de contatos');
console.log(trilhaOk ? '✓ trilha do título expande' : '✗ trilha não abre');
if (!trilhaOk) problemas++;

// Troca de escritório: marca e cor mudam.
await pagina.goto(BASE, { waitUntil: 'networkidle' });
const nome1 = await pagina.evaluate(() => document.querySelector('header .fonte-titulo')?.textContent?.trim());
await pagina.selectOption('header select', 'e2');
await pagina.waitForTimeout(1800);
const nome2 = await pagina.evaluate(() => document.querySelector('header .fonte-titulo')?.textContent?.trim());
const cor = await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
const trocaOk = nome1 !== nome2 && cor.toLowerCase() === '#6b2430';
console.log(trocaOk ? `✓ troca de escritório (${nome2?.slice(0, 28)}…, tema ${cor})` : `✗ troca: ${nome1} → ${nome2}, cor ${cor}`);
if (!trocaOk) problemas++;

// Console com escritório ativo colorido.
await pagina.goto(`${BASE}console/`, { waitUntil: 'networkidle' });
const consoleTxt = await pagina.evaluate(() => document.body.innerText);
const faixaOk = consoleTxt.includes('toda conversa sai em nome deste escritório');
console.log(faixaOk ? '✓ faixa do escritório ativo no console' : '✗ faixa do console ausente');
if (!faixaOk) problemas++;

await browser.close();
console.log(problemas === 0 ? 'TUDO OK' : `${problemas} problema(s)`);
process.exit(problemas === 0 ? 0 : 1);
