// Simulação de 90 dias com o MOTOR REAL de ponta a ponta (Fase 2): gera as
// planilhas por carteira, importa semana a semana como um escritório faria,
// roda o tick dia a dia e aplica um modelo determinístico de comportamento
// dos devedores — respostas, acordos com custo total aceito, contestações
// que pausam, pedidos de não contato, promessas em ligação e pagamentos na
// conta do credor (baixa semanal). O advogado fictício assina notificações e
// autoriza medidas em dias fixos, como numa semana real de escritório.

import { db, auditar } from '@sentinella/db';
import { criarRnd, chance, inteiro, escolha } from '@sentinella/dados';
import { addDias, difDias, deIso, paraIso } from './datas';
import { gerarPlanilhas, DIAS_DE_SIMULACAO, SEMENTE_PADRAO, type PerfilDevedor } from './gerar-planilhas';
import { garantirCadastro, CARTEIRAS_DEMO, ADVOGADA_DEMO, ESCRITORIO_DEMO } from './escritorios';
import { slaDoPlano } from './equipe';
import { importarDevedores, importarTitulos } from './importar';
import { executarTick, assinarNotificacoes, autorizarMedidas } from './tick';
import { aplicarPagamentos, type Pagamento } from './baixa';
import { aceitarAcordo } from './acordos';
import { recalcularRating } from './rating';

export interface EstatisticasSimulacao {
  dias: number;
  mensagens: number;
  respostas: number;
  ligacoes: number;
  promessas: number;
  acordos: number;
  contestacoes: number;
  pagamentos: number;
  bloqueios: number;
}

export async function simular(
  raizProduto: string,
  semente = SEMENTE_PADRAO,
): Promise<EstatisticasSimulacao> {
  const rnd = criarRnd(semente + 7);
  const plan = gerarPlanilhas(raizProduto, semente);
  const { inicio } = plan;
  const est: EstatisticasSimulacao = {
    dias: DIAS_DE_SIMULACAO, mensagens: 0, respostas: 0, ligacoes: 0,
    promessas: 0, acordos: 0, contestacoes: 0, pagamentos: 0, bloqueios: 0,
  };

  await garantirCadastro(inicio);
  const escritorioId = ESCRITORIO_DEMO.id;
  const slaMin = slaDoPlano(ESCRITORIO_DEMO.plano); // exceções com o SLA do plano
  const perfilPorDocumento = new Map(Object.entries(plan.perfis));
  const perfilDoDevedor = async (devedorId: string): Promise<PerfilDevedor> => {
    const d = await db.devedor.findUnique({ where: { id: devedorId }, select: { documento: true } });
    return (d && perfilPorDocumento.get(d.documento)) ?? { pontual: 0.5, respondeH: 12 };
  };

  const pagamentosPendentes = new Map<string, Pagamento[]>(); // por carteira

  for (let dia = 0; dia < DIAS_DE_SIMULACAO; dia++) {
    const hoje = addDias(inicio, dia);

    // Semana nova: o escritório importa a leva da semana (devedores na 1ª).
    if (dia % 7 === 0) {
      const semana = dia / 7;
      for (const carteira of CARTEIRAS_DEMO) {
        const arquivos = plan.porCarteira[carteira.id];
        if (!arquivos) continue;
        if (semana === 0) await importarDevedores(carteira.id, arquivos.devedores);
        const alvo = arquivos.titulosPorSemana.find((a) =>
          a.endsWith(`titulos-semana-${String(semana + 1).padStart(2, '0')}.csv`));
        if (alvo) await importarTitulos(carteira.id, alvo, hoje);
      }
    }

    const resumo = await executarTick({ hoje, apenasEscritorios: [escritorioId] });
    est.mensagens += resumo.mensagensEnviadas + resumo.previasEnviadas;
    est.bloqueios += resumo.bloqueiosConformidade + resumo.mensagensBloqueadas;

    // ---- comportamento: respostas às mensagens de hoje ----------------------
    const enviadasHoje = await db.mensagem.findMany({
      where: {
        escritorioId, de: { in: ['IA', 'sistema'] },
        em: { gte: deIso(hoje), lt: deIso(addDias(hoje, 1)) },
      },
      include: { devedor: true },
    });
    const jaReagiu = new Set<string>();
    for (const mensagem of enviadasHoje) {
      if (jaReagiu.has(mensagem.devedorId)) continue;
      const perfil = await perfilDoDevedor(mensagem.devedorId);
      if (perfil.respondeH == null || !chance(rnd, 0.3)) continue;
      jaReagiu.add(mensagem.devedorId);
      est.respostas++;
      await db.mensagem.create({
        data: {
          escritorioId, devedorId: mensagem.devedorId, tituloId: mensagem.tituloId,
          canal: mensagem.canal, de: 'devedor',
          texto: escolha(rnd, [
            'Oi, recebi sim. Vou ver isso.',
            'Pode me mandar as opções de parcelamento?',
            'Estou organizando o pagamento, me dá uns dias.',
            'Quem está falando? De onde vocês são?',
          ]),
          marcaAtiva: mensagem.marcaAtiva,
          em: new Date(new Date(mensagem.em).getTime() + perfil.respondeH * 3_600_000),
        },
      });

      const titulosAbertos = await db.titulo.findMany({
        where: { devedorId: mensagem.devedorId, estado: 'em cobrança' },
      });
      if (!titulosAbertos.length) continue;

      // Contestação (~2,5% das respostas): pausa na hora e abre exceção.
      if (chance(rnd, 0.025)) {
        const titulo = escolha(rnd, titulosAbertos);
        await db.titulo.update({
          where: { id: titulo.id },
          data: { estado: 'contestado', contestadoEm: new Date(`${hoje}T13:00:00Z`), contestacaoMotivo: 'devedor não reconhece o débito' },
        });
        await db.excecao.create({
          data: {
            escritorioId, devedorId: mensagem.devedorId, tituloId: titulo.id,
            motivo: 'Título contestado — cobrança pausada até resposta do escritório',
            slaMin, valorEnvolvidoCentavos: titulo.valorCentavos,
          },
        });
        await auditar(escritorioId, 'titulo', titulo.id, 'em cobrança', 'contestado', 'devedor', 'contestação pelo espaço do devedor');
        est.contestacoes++;
        continue;
      }

      // Pedido de não contato por canal (~1,5% das respostas).
      if (chance(rnd, 0.015)) {
        const devedor = mensagem.devedor;
        const bloqueados = new Set([...(devedor.canaisBloqueados as string[]), mensagem.canal]);
        await db.devedor.update({
          where: { id: devedor.id },
          data: { canaisBloqueados: [...bloqueados] },
        });
        await db.excecao.create({
          data: {
            escritorioId, devedorId: devedor.id, tituloId: titulosAbertos[0].id,
            motivo: `Devedor pediu para não ser contatado por ${mensagem.canal}`,
            slaMin, valorEnvolvidoCentavos: titulosAbertos[0].valorCentavos,
          },
        });
        continue;
      }

      // Acordo no espaço do devedor (~9% das respostas a proposta).
      if (chance(rnd, 0.09)) {
        const carteira = await db.carteira.findUnique({ where: { id: titulosAbertos[0].carteiraId } });
        if (carteira) {
          const r = await aceitarAcordo({
            devedorId: mensagem.devedorId,
            titulos: titulosAbertos.filter((t) => t.carteiraId === carteira.id),
            parcelas: inteiro(rnd, 2, carteira.parcelasMax),
            origem: 'portal',
            hoje,
          });
          if (!('erro' in r)) est.acordos++;
        }
      }
    }

    // ---- ligações do dia: atendidas/não, promessas --------------------------
    const ligacoes = await db.acaoCobranca.findMany({
      where: { escritorioId, canal: 'ligação', estado: 'em andamento', dataProgramada: { lte: deIso(hoje) } },
      include: { titulo: true },
    });
    for (const ligacao of ligacoes) {
      est.ligacoes++;
      const perfil = await perfilDoDevedor(ligacao.devedorId);
      const atendeu = perfil.respondeH != null && chance(rnd, 0.62);
      if (!atendeu) {
        await db.acaoCobranca.update({
          where: { id: ligacao.id },
          data: { estado: 'não atendida', resultado: 'não atendida — reprogramada', executadaEm: new Date(`${hoje}T15:00:00Z`) },
        });
        continue;
      }
      const promete = chance(rnd, 0.55);
      await db.acaoCobranca.update({
        where: { id: ligacao.id },
        data: {
          estado: 'finalizada',
          resultado: promete ? 'atendida — promessa de pagamento' : 'atendida',
          executadaEm: new Date(`${hoje}T15:00:00Z`),
        },
      });
      if (promete && ligacao.titulo.estado === 'em cobrança') {
        await db.promessa.create({
          data: {
            escritorioId, devedorId: ligacao.devedorId, tituloId: ligacao.tituloId,
            para: deIso(addDias(hoje, inteiro(rnd, 3, 10))), origem: 'ligação',
          },
        });
        est.promessas++;
      }
    }

    // ---- contestações respondidas pelo escritório (5–12 dias depois) --------
    const contestadosAntigos = await db.titulo.findMany({
      where: { escritorioId, estado: 'contestado', contestadoEm: { lte: deIso(addDias(hoje, -5)) } },
    });
    for (const titulo of contestadosAntigos) {
      if (!chance(rnd, 0.25)) continue; // o escritório responde ao longo dos dias
      const procede = chance(rnd, 0.3);
      if (procede) {
        await db.titulo.update({ where: { id: titulo.id }, data: { estado: 'cancelado' } });
        await auditar(escritorioId, 'titulo', titulo.id, 'contestado', 'cancelado', 'escritório', 'contestação procedente');
      } else {
        await db.titulo.update({
          where: { id: titulo.id },
          data: { estado: 'em cobrança', contestadoEm: null, contestacaoMotivo: null },
        });
        await auditar(escritorioId, 'titulo', titulo.id, 'contestado', 'em cobrança', 'escritório', 'contestação respondida — cobrança retomada');
      }
      await db.excecao.updateMany({
        where: { tituloId: titulo.id, estado: 'aberta' },
        data: { estado: 'resolvida', resolucao: procede ? 'débito cancelado pelo escritório' : 'esclarecido com o devedor; cobrança retomada' },
      });
    }

    // ---- pagamentos do dia (caem na conta do credor; baixa semanal) ---------
    const abertos = await db.titulo.findMany({
      where: { escritorioId, estado: { in: ['em cobrança', 'acordo'] } },
      select: { id: true, numero: true, carteiraId: true, devedorId: true, entradaCarteira: true, estado: true },
    });
    for (const titulo of abertos) {
      const perfil = await perfilDoDevedor(titulo.devedorId);
      const diasNaCasa = difDias(hoje, paraIso(titulo.entradaCarteira));
      if (diasNaCasa < 1) continue;
      const base = titulo.estado === 'acordo' ? 0.012 : 0.004;
      const probabilidade = base + perfil.pontual * (titulo.estado === 'acordo' ? 0.03 : 0.012);
      if (!chance(rnd, probabilidade)) continue;
      const lista = pagamentosPendentes.get(titulo.carteiraId) ?? [];
      lista.push({ numeroTitulo: titulo.numero, dataIso: hoje, valorCentavos: null });
      pagamentosPendentes.set(titulo.carteiraId, lista);
    }
    if (dia % 7 === 6 || dia === DIAS_DE_SIMULACAO - 1) {
      for (const [carteiraId, lista] of pagamentosPendentes) {
        if (!lista.length) continue;
        const r = await aplicarPagamentos(carteiraId, lista);
        est.pagamentos += r.baixados;
        pagamentosPendentes.set(carteiraId, []);
      }
    }

    // ---- a advogada do escritório trabalha em dias fixos ---------------------
    if (dia % 3 === 2) await assinarNotificacoes(escritorioId, hoje, ADVOGADA_DEMO);
    if (dia % 7 === 4) await autorizarMedidas(escritorioId, hoje, ADVOGADA_DEMO);
  }

  await recalcularRating(escritorioId, addDias(inicio, DIAS_DE_SIMULACAO - 1));
  return est;
}
