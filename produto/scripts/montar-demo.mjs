// Monta a pasta de publicação da demonstração (hub + painel + portal), do
// jeito que o visualizador de artifacts serve: builds com basePath, caminhos
// de assets relativizados e o hub estático na raiz.
// Uso: node scripts/montar-demo.mjs [pasta-destino]   (padrão: pub/)

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = resolve(process.argv[2] ?? join(raiz, 'pub'));

const roda = (cmd, cwd = raiz) => execSync(cmd, { cwd, stdio: 'inherit' });

console.log('— seed (gera os dados dos apps)');
roda('npx tsx packages/dados/src/seed.ts');

for (const app of ['painel', 'portal']) {
  console.log(`— build ${app} (basePath /${app})`);
  roda(`NEXT_PUBLIC_BASE_PATH=/${app} npx next build`, join(raiz, 'apps', app));
}

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(join(raiz, 'demo', 'index.html'), join(destino, 'index.html'));
for (const app of ['painel', 'portal']) {
  cpSync(join(raiz, 'apps', app, 'out'), join(destino, app), { recursive: true });
  roda(`node scripts/relativizar.mjs ${join(destino, app)} /${app}`);
}

// O serviço de artifacts recusa arquivos com U+FFFD literal (o polyfills do
// Next usa o caractere em strings de detecção): troca pelo escape �,
// equivalente dentro de string de JS.
function sanearFFFD(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) sanearFFFD(caminho);
    else if (nome.endsWith('.js')) {
      const texto = readFileSync(caminho, 'utf8');
      if (texto.includes('�')) {
        writeFileSync(caminho, texto.replaceAll('�', '\\ufffd'));
        console.log(`— U+FFFD escapado em ${caminho.slice(destino.length + 1)}`);
      }
    }
  }
}
sanearFFFD(destino);

console.log(`\nPublicação pronta em ${destino}`);
console.log('Verificação: node scripts/servir.mjs <destino> 4321 e rode');
console.log('  node scripts/verificar-painel.mjs http://localhost:4321/painel/');
console.log('  node scripts/verificar-portal.mjs http://localhost:4321/portal/');
