// Verifica a Fase 2 de ponta a ponta no servidor REAL (npm run servidor):
// o espaço do devedor construído com NEXT_PUBLIC_MODO=real aceita acordo com
// o custo total à vista e contesta título — e os efeitos persistem no banco
// (conferidos pela API). Uso: node scripts/verificar-real.mjs [url-base]
import { chromium } from 'playwright-core';

const BASE = (process.argv[2] ?? 'http://localhost:3000/').replace(/\/?$/, '/');

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

const confere = (nome, ok, extra = '') => {
  if (ok && !erros.length) console.log(`✓ ${nome}`);
  else {
    problemas++;
    console.log(`✗ ${nome} ${extra}`);
    for (const e of erros.slice(0, 4)) console.log(`   ${e}`);
  }
  erros.length = 0;
};

const json = async (rota) => (await fetch(`${BASE}${rota}`)).json();

// Dois devedores "frescos": com título em cobrança e sem acordo nem contestação.
const mapa = await json('dados/devedores.json');
const frescos = Object.entries(mapa).filter(([, e]) =>
  e.acordos.length === 0 &&
  e.titulosAbertos.length > 0 &&
  e.titulosAbertos.every((t) => t.estado === 'em cobrança'));
confere('há devedores frescos para o teste', frescos.length >= 2, `(${frescos.length})`);
const [tokAcordo] = frescos[0] ?? [];
const [tokContesta] = frescos[1] ?? [];

// ---- acordo com custo total, de verdade -----------------------------------
await pagina.goto(`${BASE}d/?t=${tokAcordo}`, { waitUntil: 'networkidle' });
let txt = await pagina.evaluate(() => document.body.innerText);
confere('espaço do devedor em modo real (sem aviso de demonstração)',
  !txt.includes('nada é registrado de verdade') && !txt.toLowerCase().includes('rating'));

await pagina.click('text=Parcelar (ver opções)');
await pagina.waitForSelector('input[name="acordo"]');
txt = await pagina.evaluate(() => document.body.innerText);
confere('custo total aparece antes do aceite', txt.includes('Custo total:'));

await pagina.check('input[name="acordo"]');
const rotuloBotao = await pagina.textContent('button:has-text("Aceitar:")');
confere('o botão de aceite repete o custo total', /total R\$/.test(rotuloBotao ?? ''));
await pagina.click('button:has-text("Aceitar:")');
await pagina.waitForFunction(() => document.body.innerText.includes('registrado.'), null, { timeout: 15_000 });
txt = await pagina.evaluate(() => document.body.innerText);
confere('confirmação do servidor com o custo total aceito',
  txt.includes('custo total de R$') && txt.includes('exatamente o que você viu'));

const depoisAcordo = await json(`api/devedor/${tokAcordo}`);
confere('acordo persistiu (títulos em acordo + acordo em dia)',
  depoisAcordo.acordos.length === 1 &&
  depoisAcordo.titulosAbertos.every((t) => t.estado === 'acordo'));

// ---- contestação pausa a cobrança ------------------------------------------
await pagina.goto(`${BASE}d/?t=${tokContesta}`, { waitUntil: 'networkidle' });
await pagina.click('text=Não reconheço um débito');
await pagina.fill('textarea', 'Este valor não confere com o contrato que assinei');
await pagina.click('button:has-text("Enviar contestação")');
await pagina.waitForFunction(() => document.body.innerText.includes('registrado.'), null, { timeout: 15_000 });
// O recarregamento do estado chega logo depois da confirmação: espera o chip.
await pagina.waitForFunction(
  () => document.body.innerText.includes('cobrança pausada no título em análise'),
  null, { timeout: 15_000 },
);
txt = await pagina.evaluate(() => document.body.innerText);
confere('contestação confirmada com a pausa explicada',
  txt.includes('entrou em análise') && txt.includes('cobrança pausada no título em análise'));

const depoisContesta = await json(`api/devedor/${tokContesta}`);
confere('contestação persistiu (estado contestado)',
  depoisContesta.titulosAbertos.some((t) => t.estado === 'contestado'));

// ---- portal do credor lê da exportação viva --------------------------------
const exemplos = await json('dados/exemplos.json');
await pagina.goto(`${BASE}c/?t=${exemplos.tokensCredor[0].token}`, { waitUntil: 'networkidle' });
txt = await pagina.evaluate(() => document.body.innerText);
confere('portal do credor no servidor real', txt.includes('Carteira entregue') || txt.includes('Recuperado'));

await browser.close();
console.log(problemas ? `\n${problemas} problema(s).` : '\nFase 2 verificada no servidor real.');
process.exit(problemas ? 1 : 0);
