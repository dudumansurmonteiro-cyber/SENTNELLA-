// Verifica os portais v3 montados sob prefixo aninhado: home com exemplos,
// espaço do devedor (marca do escritório, custo total antes do aceite,
// contestação pausa, sem rating) e portal do credor (relatório).
// Uso: node scripts/verificar-portal.mjs [url-base-do-portal]
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://localhost:4321/demo/v3/portal/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pagina = await browser.newPage({ viewport: { width: 390, height: 840 } });

let problemas = 0;
const erros = [];
const ignorar = (t) =>
  t.includes('fonts.googleapis.com') || t.includes('fonts.gstatic.com') ||
  t.includes('ERR_CERT_AUTHORITY_INVALID') || t.includes('favicon.ico') || t.includes('status of 404');
pagina.on('console', (m) => m.type() === 'error' && !ignorar(m.text()) && erros.push(`console: ${m.text()}`));
pagina.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
pagina.on('requestfailed', (r) => !ignorar(r.url()) && erros.push(`reqfailed: ${r.url()}`));
pagina.on('response', (r) => r.status() >= 400 && !ignorar(r.url()) && erros.push(`http ${r.status()}: ${r.url()}`));

const confere = (nome, ok, extra = '') => {
  if (ok && !erros.length) console.log(`✓ ${nome}`);
  else {
    problemas++;
    console.log(`✗ ${nome} ${extra}`);
    for (const e of erros.slice(0, 4)) console.log(`   ${e}`);
  }
  erros.length = 0;
};

// Home com os dois grupos de exemplos.
await pagina.goto(BASE, { waitUntil: 'networkidle' });
let txt = await pagina.evaluate(() => document.body.innerText);
confere('home', txt.includes('Entrar como devedor') && txt.includes('Entrar como credor'));

// Espaço do devedor: segue o primeiro exemplo.
await pagina.goto(BASE, { waitUntil: 'networkidle' });
erros.length = 0;
const linkDev = await pagina.getAttribute('.cartao a', 'href');
await pagina.goto(new URL(linkDev, BASE).href, { waitUntil: 'networkidle' });
txt = await pagina.evaluate(() => document.body.innerText);
confere(
  'devedor: carrega com a marca do escritório',
  txt.includes('Olá,') && txt.includes('Total em aberto hoje') && /OAB/.test(txt),
);
const corTema = await pagina.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
confere('devedor: tema do escritório aplicado', /^#(24466E|6B2430|463B6B|9FBEE8|E2A3AD|BCAFE6)$/i.test(corTema), corTema);
confere('devedor: rating NUNCA aparece', !/rating|Rating/.test(txt));

// Custo total antes do aceite.
await pagina.click('text=Parcelar (ver opções)');
await pagina.waitForTimeout(250);
txt = await pagina.evaluate(() => document.body.innerText);
confere('devedor: custo total antes do aceite', txt.includes('Custo total:'));
const btnAceitar = await pagina.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Escolha uma opção'))?.disabled);
confere('devedor: aceite só depois de escolher (botão desabilitado)', btnAceitar === true);
await pagina.click('input[type=radio] >> nth=0');
await pagina.waitForTimeout(150);
const rotuloAceite = await pagina.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Aceitar:'))?.textContent ?? '');
confere('devedor: botão de aceite mostra total', rotuloAceite.includes('total'));

// Contestação pausa.
await pagina.click('text=Não reconheço um débito');
await pagina.waitForTimeout(200);
txt = await pagina.evaluate(() => document.body.innerText);
confere('devedor: contestação explica a pausa', txt.includes('pausa'));

// Portal do credor: segue o primeiro exemplo de credor.
await pagina.setViewportSize({ width: 1180, height: 900 });
await pagina.goto(BASE, { waitUntil: 'networkidle' });
const linkCred = await pagina.getAttribute('.cartao:nth-of-type(2) a', 'href');
erros.length = 0;
await pagina.goto(new URL(linkCred, BASE).href, { waitUntil: 'networkidle' });
txt = await pagina.evaluate(() => document.body.innerText);
confere(
  'credor: relatório com carteiras e etapas',
  txt.includes('portal do credor') && txt.includes('Eficiência por etapa') &&
    txt.includes('Entregue ao escritório') && txt.includes('Imprimir relatório mensal'),
);
confere('credor: rating médio visível (permitido ao credor)', txt.includes('médio'));

// Rodapé "operada por Sentinella" some no plano Max (e2).
const exemplos = await (await fetch(`${BASE}dados/exemplos.json`)).json();
const devedores = await (await fetch(`${BASE}dados/devedores.json`)).json();
const tokenMax = exemplos.tokensDevedor.find((t) => t.escritorio.includes('Serra'))?.token;
const tokenComum = exemplos.tokensDevedor.find((t) => !t.escritorio.includes('Serra'))?.token;
await pagina.goto(`${BASE}d/?t=${tokenMax}`, { waitUntil: 'networkidle' });
const txtMax = await pagina.evaluate(() => document.body.innerText);
await pagina.goto(`${BASE}d/?t=${tokenComum}`, { waitUntil: 'networkidle' });
const txtComum = await pagina.evaluate(() => document.body.innerText);
erros.length = 0;
confere(
  'white label: "operada por Sentinella" some no Max e aparece nos demais',
  !txtMax.includes('operada por Sentinella') && txtComum.includes('operada por Sentinella'),
);

// Nenhuma entrada do portal do devedor carrega rating por engano.
const comRating = Object.values(devedores).some((e) => JSON.stringify(e).toLowerCase().includes('rating'));
confere('dados do devedor sem rating no JSON', !comRating);

await browser.close();
console.log(problemas === 0 ? 'TUDO OK' : `${problemas} problema(s)`);
process.exit(problemas === 0 ? 0 : 1);
