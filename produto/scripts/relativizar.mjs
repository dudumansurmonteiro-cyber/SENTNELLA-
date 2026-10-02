// Torna relativos os caminhos absolutos de um export do Next (ex.: /painel/_next/…)
// nos arquivos HTML, para o site funcionar montado em qualquer caminho — caso do
// visualizador de artifacts, que serve os arquivos sob um prefixo próprio.
// Uso: node scripts/relativizar.mjs <pasta-out> </basePath>
//   ex.: node scripts/relativizar.mjs ../pub/painel /painel

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const [pasta, basePath] = process.argv.slice(2);
if (!pasta || !basePath?.startsWith('/')) {
  console.error('uso: node scripts/relativizar.mjs <pasta-out> </basePath>');
  process.exit(2);
}

function htmls(dir) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...htmls(caminho));
    else if (nome.endsWith('.html')) achados.push(caminho);
  }
  return achados;
}

let alterados = 0;
for (const arquivo of htmls(pasta)) {
  const profundidade = relative(pasta, dirname(arquivo)).split('/').filter(Boolean).length;
  const rel = '../'.repeat(profundidade);
  const original = readFileSync(arquivo, 'utf8');
  // "/painel/x" → "<rel>x" (pega href/src e strings dentro de scripts inline,
  // inclusive escapadas com \" no payload RSC).
  let novo = original.split(`${basePath}/`).join(rel === '' ? './' : rel);
  // "/painel" sozinho (constantes de basePath) → "." relativo ao documento.
  novo = novo.split(`"${basePath}"`).join(`"${rel === '' ? '.' : rel.slice(0, -1)}"`);
  if (novo !== original) {
    writeFileSync(arquivo, novo);
    alterados++;
  }
}
console.log(`relativizar: ${alterados} arquivo(s) HTML ajustado(s) em ${pasta} (base ${basePath})`);
