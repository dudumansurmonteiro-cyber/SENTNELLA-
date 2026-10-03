// Linha de comando do motor v3. Uso, a partir de produto/:
//   npm run gerar:planilhas            → planilhas-modelo/ e dados-exemplo/
//   npm run importar -- ca1 devedores.csv titulos.csv
//   npm run baixa -- ca1 pagamentos.csv
//   npm run regua:tick                 → um tick de hoje (ou -- --hoje=AAAA-MM-DD)
//   npm run assinar                    → advogado assina as notificações preparadas
//   npm run autorizar                  → escritório autoriza negativação/protesto
//   npm run regua:simular              → 90 dias com o motor real + comportamento
//   npm run rating:recalcular
//   npm run exportar:demo              → JSON para painel e portais

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { db } from '@sentinella/db';
import { executarTick, formatarResumoTick, assinarNotificacoes, autorizarMedidas } from './tick';
import { importarDevedores, importarTitulos, formatarRelatorio } from './importar';
import { importarPagamentos } from './baixa';
import { simular } from './simular';
import { gerarPlanilhas, SEMENTE_PADRAO } from './gerar-planilhas';
import { recalcularRating } from './rating';
import { exportarParaApps } from './exportar';
import { garantirCadastro, ADVOGADA_DEMO } from './escritorios';
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
      console.log(
        `Planilhas modelo em planilhas-modelo/ e dados de exemplo em dados-exemplo/ (período ${r.inicio} a ${r.hoje}).`,
      );
      break;
    }
    case 'importar': {
      const [carteiraId, arquivoDevedores, arquivoTitulos] = posicionais;
      if (!carteiraId || (!arquivoDevedores && !arquivoTitulos)) {
        console.error('uso: importar <carteiraId> [devedores.csv] [titulos.csv]');
        process.exit(2);
      }
      await garantirCadastro(hojeReal());
      if (arquivoDevedores)
        console.log(formatarRelatorio(await importarDevedores(carteiraId, join(process.cwd(), arquivoDevedores))));
      if (arquivoTitulos)
        console.log(formatarRelatorio(await importarTitulos(carteiraId, join(process.cwd(), arquivoTitulos), hojeReal())));
      break;
    }
    case 'baixa': {
      const [carteiraId, arquivo] = posicionais;
      if (!carteiraId || !arquivo) {
        console.error('uso: baixa <carteiraId> <pagamentos.csv>');
        process.exit(2);
      }
      const { relatorio, baixa } = await importarPagamentos(carteiraId, join(process.cwd(), arquivo));
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
    case 'assinar': {
      const escritorios = await db.escritorio.findMany({ orderBy: { id: 'asc' } });
      for (const e of escritorios) {
        const n = await assinarNotificacoes(e.id, argumento('hoje') ?? hojeReal(), ADVOGADA_DEMO);
        console.log(`${e.id}: ${n} notificação(ões) assinada(s) por ${ADVOGADA_DEMO} e enviada(s).`);
      }
      break;
    }
    case 'autorizar': {
      const escritorios = await db.escritorio.findMany({ orderBy: { id: 'asc' } });
      for (const e of escritorios) {
        const r = await autorizarMedidas(e.id, argumento('hoje') ?? hojeReal(), ADVOGADA_DEMO);
        console.log(`${e.id}: ${r.autorizadas} medida(s) autorizada(s), ${r.barradas} barrada(s) pelos gates.`);
      }
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
          `${est.contestacoes} contestações · ${est.pagamentos} pagamentos · ` +
          `${est.bloqueios} travas de conformidade`,
      );
      break;
    }
    case 'rating': {
      const escritorios = await db.escritorio.findMany({ orderBy: { id: 'asc' } });
      for (const e of escritorios) {
        const r = await recalcularRating(e.id, hojeReal());
        const dist = Object.entries(r.distribuicao).map(([l, n]) => `${l}:${n}`).join(' ');
        console.log(`${e.id} (${e.plano}): ${r.devedores} devedores · ${dist} · ${r.mudaramDeLetra} mudaram de letra`);
      }
      break;
    }
    case 'exportar': {
      const r = await exportarParaApps(raizProduto);
      console.log(
        `Exportado: ${r.escritorios} escritório(s) · ${r.titulos} títulos · ${r.acessosPortal} acessos de portal.`,
      );
      break;
    }
    case 'limpar': {
      // Zera as tabelas de negócio (ordem respeita as chaves estrangeiras).
      await db.registroAuditoria.deleteMany();
      await db.mensagem.deleteMany();
      await db.pagamentoInformado.deleteMany();
      await db.promessa.deleteMany();
      await db.documentoTitulo.deleteMany();
      await db.documentoJuridico.deleteMany();
      await db.acordoTitulo.deleteMany();
      await db.acordo.deleteMany();
      await db.excecao.deleteMany();
      await db.acaoCobranca.deleteMany();
      await db.titulo.deleteMany();
      await db.devedor.deleteMany();
      await db.carteira.deleteMany();
      await db.credor.deleteMany();
      await db.usuarioEscritorio.deleteMany();
      await db.escritorio.deleteMany();
      console.log('Banco limpo.');
      break;
    }
    default:
      console.error(
        'comandos: gerar-planilhas · importar · baixa · tick · assinar · autorizar · simular · rating · exportar · limpar',
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
