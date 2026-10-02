// Linha de comando do motor (Fase 2). Uso, a partir de produto/:
//   npm run gerar:planilhas            → planilhas-modelo/ e dados-exemplo/
//   npm run importar -- c1 lojistas.csv titulos.csv
//   npm run baixa -- c1 pagamentos.csv
//   npm run regua:tick                 → um tick de hoje (ou -- --hoje=AAAA-MM-DD)
//   npm run regua:simular              → 90 dias com o motor real + comportamento
//   npm run rating:recalcular
//   npm run exportar:demo              → JSON para painel e portal

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { db } from '@sentinella/db';
import { executarTick, formatarResumoTick } from './tick';
import { importarLojistas, importarTitulos, formatarRelatorio } from './importar';
import { importarPagamentos } from './baixa';
import { simular } from './simular';
import { gerarPlanilhas, SEMENTE_PADRAO } from './gerar-planilhas';
import { recalcularRating } from './rating';
import { exportarParaApps } from './exportar';
import { cadastrarClientesDemo } from './clientes';
import { hojeReal } from './datas';

const raizProduto = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

async function principal() {
  const comando = process.argv[2];
  const posicionais = process.argv.slice(3).filter((a) => !a.startsWith('--'));

  switch (comando) {
    case 'gerar-planilhas': {
      const r = gerarPlanilhas(raizProduto, Number(argumento('semente') ?? SEMENTE_PADRAO));
      console.log(`Planilhas modelo em planilhas-modelo/ e dados de exemplo em dados-exemplo/ (período ${r.inicio} a ${r.hoje}).`);
      break;
    }
    case 'importar': {
      const [clienteId, arquivoLojistas, arquivoTitulos] = posicionais;
      if (!clienteId || (!arquivoLojistas && !arquivoTitulos)) {
        console.error('uso: importar <clienteId> [lojistas.csv] [titulos.csv]');
        process.exit(2);
      }
      await cadastrarClientesDemo();
      if (arquivoLojistas)
        console.log(formatarRelatorio(await importarLojistas(clienteId, join(process.cwd(), arquivoLojistas))));
      if (arquivoTitulos)
        console.log(formatarRelatorio(await importarTitulos(clienteId, join(process.cwd(), arquivoTitulos))));
      break;
    }
    case 'baixa': {
      const [clienteId, arquivo] = posicionais;
      if (!clienteId || !arquivo) {
        console.error('uso: baixa <clienteId> <pagamentos.csv>');
        process.exit(2);
      }
      const { relatorio, baixa } = await importarPagamentos(clienteId, join(process.cwd(), arquivo));
      console.log(formatarRelatorio(relatorio));
      console.log(
        `baixa: ${baixa.baixados} título(s) pago(s) · ${baixa.acoesCanceladas} ação(ões) cancelada(s) · ` +
          `${baixa.promessasCumpridas} promessa(s) cumprida(s) · ${baixa.promessasFalhas} não cumprida(s)`,
      );
      break;
    }
    case 'tick': {
      const resumo = await executarTick({ hoje: argumento('hoje') ?? hojeReal() });
      console.log(formatarResumoTick(resumo));
      break;
    }
    case 'simular': {
      const semente = Number(argumento('semente') ?? SEMENTE_PADRAO);
      const inicioEm = Date.now();
      const est = await simular(raizProduto, semente);
      console.log(
        `Simulação concluída em ${Math.round((Date.now() - inicioEm) / 1000)}s: ` +
          `${est.dias} dias · ${est.mensagens} mensagens · ${est.respostas} respostas · ` +
          `${est.ligacoes} ligações · ${est.promessas} promessas · ${est.acordos} acordos · ` +
          `${est.excecoes} exceções · ${est.pagamentos} pagamentos · ${est.bloqueadas} bloqueadas na conferência`,
      );
      break;
    }
    case 'rating': {
      const clientes = await db.cliente.findMany({ orderBy: { id: 'asc' } });
      for (const c of clientes) {
        const r = await recalcularRating(c.id, hojeReal());
        const dist = Object.entries(r.distribuicao).map(([l, n]) => `${l}:${n}`).join(' ');
        console.log(`${c.id} (${c.plano}): ${r.lojistas} lojistas · ${dist} · ${r.mudaramDeLetra} mudaram de letra`);
      }
      break;
    }
    case 'exportar': {
      const r = await exportarParaApps(raizProduto);
      console.log(`Exportado: ${r.clientes} clientes · ${r.titulos} títulos · ${r.acessosPortal} acessos de portal.`);
      break;
    }
    case 'limpar': {
      // Zera as tabelas de negócio (ordem respeita as chaves estrangeiras).
      await db.registroAuditoria.deleteMany();
      await db.mensagem.deleteMany();
      await db.pagamentoInformado.deleteMany();
      await db.promessa.deleteMany();
      await db.autorizacao.deleteMany();
      await db.acordoTitulo.deleteMany();
      await db.acordo.deleteMany();
      await db.excecao.deleteMany();
      await db.acaoCobranca.deleteMany();
      await db.titulo.deleteMany();
      await db.lojista.deleteMany();
      await db.cliente.deleteMany();
      console.log('Banco limpo.');
      break;
    }
    default:
      console.error(
        'comandos: gerar-planilhas · importar · baixa · tick · simular · rating · exportar · limpar',
      );
      process.exit(2);
  }
}

principal()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
