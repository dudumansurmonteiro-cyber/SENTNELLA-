// Exportação do banco para os JSONs que o painel e os portais da Fase 1
// consomem (DadosEscritorio e afins, em @sentinella/dados) — é assim que a
// demonstração publicada passa a nascer do MOTOR REAL. Valores no banco são
// centavos; nas superfícies, reais. Saída: apps/servidor/dados/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@sentinella/db';
import type {
  AcaoCobranca, Acordo as AcordoDb, Carteira as CarteiraDb, Credor as CredorDb,
  Devedor as DevedorDb, DocumentoJuridico as DocDb, Escritorio as EscritorioDb,
  Excecao as ExcecaoDb, Mensagem as MensagemDb, Promessa as PromessaDb, Titulo as TituloDb,
} from '@sentinella/db';
import {
  FAIXAS_ENTRADA, FAIXAS_CASA, faixaDoAtraso, faixaDaCasa, FATOR_REGULARIZACAO,
} from '@sentinella/dados';
import type {
  AgregadosCarteira, DadosEscritorio, EficienciaCanal, EficienciaEtapa, Letra,
} from '@sentinella/dados';
import { addDias, difDias, paraIso } from './datas';
import { calcularEncargos } from './mensagens';
import { carteiraParaPlano } from './passos';
import { calcularSimulacoes } from './acordos';
import { ANALISTAS } from './equipe';

const reais = (centavos: number) => Math.round(centavos) / 100;
const CANAL_CURTO: Record<string, string> = {
  WhatsApp: 'w', SMS: 's', 'e-mail': 'm', carta: 'c', 'ligação': 'l', portal: 'p',
};

interface Contexto {
  hoje: string;
  escritorio: EscritorioDb & { usuarios: { nome: string; papel: string; oab: string | null }[] };
  credores: CredorDb[];
  carteiras: CarteiraDb[];
  devedores: DevedorDb[];
  titulos: TituloDb[];
  acoes: AcaoCobranca[];
  mensagens: MensagemDb[];
  excecoes: ExcecaoDb[];
  acordos: (AcordoDb & { titulos: { tituloId: string }[] })[];
  documentos: (DocDb & { titulos: { tituloId: string }[] })[];
  promessas: PromessaDb[];
}

function codigoDaAcao(
  a: AcaoCobranca,
  titulo: TituloDb,
  respostasPorDevedorDia: Set<string>,
): string {
  const dataIso = paraIso(a.dataProgramada);
  if (a.estado === 'bloqueada') return 'blq';
  if (a.canal === 'ligação') {
    if (a.estado === 'não atendida') return 'na';
    if ((a.resultado ?? '').includes('promessa')) return 'atp';
    return 'at';
  }
  if (a.tipo === 'comunicação prévia') return 'prev';
  if (a.tipo === 'notificação') return a.estado === 'finalizada' ? 'notif' : 'pend';
  if (a.tipo === 'negativação') {
    if (a.estado === 'pendente') return 'aut';
    return titulo.estado === 'protestado' ? 'prot' : 'neg';
  }
  if (a.tipo === 'judicial') return 'dos';
  if (titulo.pagoEm && Math.abs(difDias(paraIso(titulo.pagoEm), dataIso)) <= 2) return 'pg48';
  if (respostasPorDevedorDia.has(`${a.devedorId}|${dataIso}`)) return 'resp';
  return 'ent';
}

function montarTrilha(ctx: Contexto, titulo: TituloDb, respostas: Set<string>): string[] {
  const doTitulo = ctx.acoes
    .filter((a) => a.tituloId === titulo.id && !['agendada', 'cancelada'].includes(a.estado))
    .sort((a, b) => a.dataProgramada.getTime() - b.dataProgramada.getTime());
  const trilha = doTitulo.map((a) => {
    const dias = Math.max(0, difDias(ctx.hoje, paraIso(a.dataProgramada)));
    return `${a.etapa}|${dias}|${CANAL_CURTO[a.canal] ?? 'm'}|${codigoDaAcao(a, titulo, respostas)}`;
  });
  if (titulo.contestadoEm) {
    trilha.push(`E+0|${Math.max(0, difDias(ctx.hoje, paraIso(titulo.contestadoEm)))}|p|ctt`);
  }
  const acordo = ctx.acordos.find((ac) => ac.titulos.some((t) => t.tituloId === titulo.id));
  if (acordo) {
    trilha.push(`E+2|${Math.max(0, difDias(ctx.hoje, acordo.criadoEm.toISOString().slice(0, 10)))}|p|acc`);
  }
  return trilha;
}

function etapaAtual(titulo: TituloDb, trilha: string[]): string {
  if (titulo.estado === 'pago') return 'quitado';
  if (titulo.estado === 'contestado') return 'contestado · cobrança pausada';
  if (titulo.estado === 'acordo') return 'acordo · em pagamento';
  if (titulo.estado === 'judicial') return 'no judicial';
  if (titulo.estado === 'negativado') return 'negativado';
  if (titulo.estado === 'protestado') return 'protestado';
  const ultima = trilha[trilha.length - 1];
  return ultima ? `${ultima.split('|')[0]} · em andamento` : 'E+0 · programada';
}

function agregadosDaCarteira(ctx: Contexto, carteira: CarteiraDb): AgregadosCarteira {
  const titulos = ctx.titulos.filter((t) => t.carteiraId === carteira.id);
  const devedores = ctx.devedores.filter((d) => d.carteiraId === carteira.id);
  const acoes = ctx.acoes.filter((a) => a.carteiraId === carteira.id);
  const mensagens = ctx.mensagens.filter((m) =>
    devedores.some((d) => d.id === m.devedorId));
  const pagos = titulos.filter((t) => t.estado === 'pago');
  const abertos = titulos.filter((t) => !['pago', 'cancelado'].includes(t.estado));
  const mesDeHoje = ctx.hoje.slice(0, 7);

  const atualizado = (t: TituloDb) =>
    calcularEncargos(
      t.valorCentavos,
      Math.max(0, difDias(t.pagoEm ? paraIso(t.pagoEm) : ctx.hoje, paraIso(t.vencimento))),
      carteira.multaPct, carteira.jurosMesPct,
    ).totalCentavos;

  const faixasEntrada = FAIXAS_ENTRADA.map((rotulo) => ({ rotulo, valor: 0, qtd: 0 }));
  for (const t of titulos) {
    const f = faixasEntrada.find((x) => x.rotulo === faixaDoAtraso(t.atrasoOriginal))!;
    f.valor += reais(t.valorCentavos);
    f.qtd++;
  }
  const faixasCasa = FAIXAS_CASA.map((rotulo) => ({ rotulo, valor: 0, qtd: 0 }));
  for (const t of abertos) {
    const dias = Math.max(0, difDias(ctx.hoje, paraIso(t.entradaCarteira)));
    const f = faixasCasa.find((x) => x.rotulo === faixaDaCasa(dias))!;
    f.valor += reais(atualizado(t));
    f.qtd++;
  }

  const canais = new Map<string, EficienciaCanal>();
  const pagamentosPorDevedor = new Map<string, string[]>();
  for (const t of pagos) {
    const lista = pagamentosPorDevedor.get(t.devedorId) ?? [];
    if (t.pagoEm) lista.push(paraIso(t.pagoEm));
    pagamentosPorDevedor.set(t.devedorId, lista);
  }
  for (const m of mensagens) {
    if (m.de === 'devedor') continue;
    const canal = canais.get(m.canal) ?? {
      canal: m.canal as EficienciaCanal['canal'],
      enviadas: 0, entregues: 0, lidas: 0, respondidas: 0, pagas48h: 0,
    };
    canal.enviadas++;
    if (m.entrega !== 'falhou') canal.entregues++;
    const diaMsg = m.em.toISOString().slice(0, 10);
    if ((pagamentosPorDevedor.get(m.devedorId) ?? []).some((p) => {
      const d = difDias(p, diaMsg);
      return d >= 0 && d <= 2;
    })) canal.pagas48h++;
    canais.set(m.canal, canal);
  }
  for (const m of mensagens) {
    if (m.de !== 'devedor') continue;
    const canal = canais.get(m.canal);
    if (canal) canal.respondidas++;
  }

  const etapas = new Map<string, EficienciaEtapa>();
  for (const a of acoes) {
    if (!['finalizada', 'pendente'].includes(a.estado)) continue;
    const etapa = etapas.get(a.etapa) ?? {
      etapa: a.etapa as EficienciaEtapa['etapa'], acoes: 0, pagos48h: 0, conversao: 0,
    };
    etapa.acoes++;
    const titulo = ctx.titulos.find((t) => t.id === a.tituloId);
    if (titulo?.pagoEm) {
      const d = difDias(paraIso(titulo.pagoEm), paraIso(a.dataProgramada));
      if (d >= 0 && d <= 2) etapa.pagos48h++;
    }
    etapas.set(a.etapa, etapa);
  }
  const eficienciaEtapa = [...etapas.values()]
    .map((e) => ({ ...e, conversao: e.acoes ? Math.round((e.pagos48h / e.acoes) * 1000) / 10 : 0 }))
    .sort((a, b) => Number(a.etapa.slice(2)) - Number(b.etapa.slice(2)));

  const ligacoesAcoes = acoes.filter((a) => a.canal === 'ligação');
  const atendidas = ligacoesAcoes.filter((a) => a.estado === 'finalizada');
  const promessasCarteira = ctx.promessas.filter((p) =>
    titulos.some((t) => t.id === p.tituloId));
  const pagasEm7d = atendidas.filter((a) => {
    const titulo = ctx.titulos.find((t) => t.id === a.tituloId);
    if (!titulo?.pagoEm) return false;
    const d = difDias(paraIso(titulo.pagoEm), paraIso(a.dataProgramada));
    return d >= 0 && d <= 7;
  }).length;

  const recuperadoPorSemana = Array.from({ length: 6 }, (_, i) => ({ rotulo: `S${i + 1}`, valor: 0 }));
  for (const t of pagos) {
    if (!t.pagoEm) continue;
    const dias = difDias(ctx.hoje, paraIso(t.pagoEm));
    if (dias >= 0 && dias < 42) {
      recuperadoPorSemana[5 - Math.floor(dias / 7)].valor += reais(t.valorPagoCentavos ?? t.valorCentavos);
    }
  }

  const distribuicaoRating = (['A', 'B', 'C', 'D', 'E'] as Letra[]).map((letra) => ({
    letra, qtd: devedores.filter((d) => d.ratingLetra === letra).length,
  }));
  const ratingMedio = devedores.length
    ? Math.round(devedores.reduce((s, d) => s + (d.ratingTotal ?? 50), 0) / devedores.length)
    : 0;

  const valorEntregue = titulos.reduce((s, t) => s + reais(t.valorCentavos), 0);
  const recuperadoAcumulado = pagos.reduce((s, t) => s + reais(t.valorPagoCentavos ?? t.valorCentavos), 0);
  const acordosDaCarteira = ctx.acordos.filter((ac) =>
    ac.titulos.some((v) => titulos.some((t) => t.id === v.tituloId)));
  const vigentes = acordosDaCarteira.filter((ac) => ac.status !== 'quitado');
  const promFeitas = promessasCarteira.length;
  const promCumpridas = promessasCarteira.filter((p) => p.cumprida === true).length;
  const taxaRec = valorEntregue ? recuperadoAcumulado / valorEntregue : 0;
  const pctProm = promFeitas ? promCumpridas / promFeitas : 0.6;

  return {
    carteiraId: carteira.id,
    credorId: carteira.credorId,
    qtdTitulos: titulos.length,
    qtdDevedores: devedores.length,
    valorEntregue: Math.round(valorEntregue),
    valorAberto: Math.round(abertos.reduce((s, t) => s + reais(atualizado(t)), 0)),
    recuperadoMes: Math.round(pagos
      .filter((t) => t.pagoEm && paraIso(t.pagoEm).slice(0, 7) === mesDeHoje)
      .reduce((s, t) => s + reais(t.valorPagoCentavos ?? t.valorCentavos), 0)),
    recuperadoAcumulado: Math.round(recuperadoAcumulado),
    pagosQtd: pagos.length,
    faixasEntrada: faixasEntrada.map((f) => ({ ...f, valor: Math.round(f.valor) })),
    faixasCasa: faixasCasa.map((f) => ({ ...f, valor: Math.round(f.valor) })),
    eficienciaCanal: [...canais.values()].sort((a, b) => b.enviadas - a.enviadas),
    eficienciaEtapa,
    ligacoes: {
      realizadas: ligacoesAcoes.filter((a) => ['finalizada', 'não atendida'].includes(a.estado)).length,
      atendidas: atendidas.length,
      naoAtendidas: ligacoesAcoes.filter((a) => a.estado === 'não atendida').length,
      promessasObtidas: promessasCarteira.filter((p) => p.origem === 'ligação').length,
      promessasCumpridas: promessasCarteira.filter((p) => p.origem === 'ligação' && p.cumprida === true).length,
      pagasEm7d,
    },
    recuperadoPorSemana: recuperadoPorSemana.map((s) => ({ ...s, valor: Math.round(s.valor) })),
    distribuicaoRating,
    ratingMedio,
    promessasFeitas: promFeitas,
    promessasCumpridas: promCumpridas,
    acordosVigentes: vigentes.length,
    previsaoAcordos: Math.round(vigentes.reduce((s, ac) =>
      s + reais(Math.ceil(ac.valorTotalCentavos / ac.parcelas) * (ac.parcelas - ac.parcelasPagas)), 0)),
    score: Math.round(25 + 50 * Math.min(1, taxaRec / 0.45) + 15 * pctProm + ratingMedio * 0.1),
  };
}

// ratingBase compacto do devedor (mesma semântica do seed da Fase 1).
function ratingBaseDoDevedor(ctx: Contexto, devedor: DevedorDb): number[] {
  const doDev = ctx.titulos.filter((t) => t.devedorId === devedor.id);
  const somaValor = doDev.reduce((s, t) => s + t.valorCentavos, 0) || 1;
  const somaDias = doDev.reduce((s, t) => {
    const fim = t.pagoEm ? paraIso(t.pagoEm) : ctx.hoje;
    return s + Math.min(90, Math.max(0, difDias(fim, paraIso(t.entradaCarteira)))) * t.valorCentavos;
  }, 0);
  const semSolucao30 = doDev.filter(
    (t) => t.estado !== 'pago' && difDias(ctx.hoje, paraIso(t.entradaCarteira)) > 30,
  ).length;
  const prom = ctx.promessas.filter((p) => p.devedorId === devedor.id && p.cumprida != null);
  const contestacoes = doDev.filter((t) => t.contestadoEm != null).length
    + ctx.excecoes.filter((e) => e.devedorId === devedor.id).length;
  return [
    doDev.length,
    Math.round(((somaDias / somaValor) / FATOR_REGULARIZACAO) * 10) / 10,
    devedor.horasRespostaMedia ?? -1,
    prom.length,
    prom.filter((p) => p.cumprida).length,
    Math.round((semSolucao30 / Math.max(1, doDev.length)) * 80),
    Math.round((contestacoes / Math.max(1, doDev.length)) * 100) / 100,
  ];
}

export interface ResumoExportacao {
  escritorios: number;
  titulos: number;
  acessosPortal: number;
  destino: string;
}

export async function exportarParaApps(
  raizProduto: string,
  destino = join(raizProduto, 'apps', 'servidor', 'dados'),
): Promise<ResumoExportacao> {
  mkdirSync(destino, { recursive: true });
  const hoje = paraIso(new Date());

  const escritorios = await db.escritorio.findMany({
    include: { usuarios: true }, orderBy: { id: 'asc' },
  });
  let totalTitulos = 0;
  let acessos = 0;
  const resumoEscritorios: object[] = [];
  const portalDevedores: Record<string, object> = {};
  const portalCredores: Record<string, object> = {};
  const tokensDevedor: object[] = [];
  const tokensCredor: object[] = [];

  for (const escritorio of escritorios) {
    const [credores, carteiras, devedores, titulos, acoes, mensagens, excecoes, acordos, documentos, promessas] =
      await Promise.all([
        db.credor.findMany({ where: { escritorioId: escritorio.id }, orderBy: { id: 'asc' } }),
        db.carteira.findMany({ where: { escritorioId: escritorio.id }, orderBy: { id: 'asc' } }),
        db.devedor.findMany({ where: { escritorioId: escritorio.id }, orderBy: { id: 'asc' } }),
        db.titulo.findMany({ where: { escritorioId: escritorio.id }, orderBy: { numero: 'asc' } }),
        db.acaoCobranca.findMany({ where: { escritorioId: escritorio.id } }),
        db.mensagem.findMany({ where: { escritorioId: escritorio.id } }),
        db.excecao.findMany({ where: { escritorioId: escritorio.id }, orderBy: { abertaEm: 'desc' } }),
        db.acordo.findMany({ where: { escritorioId: escritorio.id }, include: { titulos: true } }),
        db.documentoJuridico.findMany({ where: { escritorioId: escritorio.id }, include: { titulos: true } }),
        db.promessa.findMany({ where: { escritorioId: escritorio.id } }),
      ]);
    const ctx: Contexto = {
      hoje, escritorio, credores, carteiras, devedores, titulos,
      acoes, mensagens, excecoes, acordos, documentos, promessas,
    };
    totalTitulos += titulos.length;

    const respostas = new Set(
      mensagens.filter((m) => m.de === 'devedor')
        .map((m) => `${m.devedorId}|${m.em.toISOString().slice(0, 10)}`),
    );
    const trilhas = new Map(titulos.map((t) => [t.id, montarTrilha(ctx, t, respostas)]));
    const agregados = carteiras.map((c) => agregadosDaCarteira(ctx, c));

    const devedoresF1 = devedores.map((d) => {
      const doDev = titulos.filter((t) => t.devedorId === d.id);
      const abertos = doDev.filter((t) => !['pago', 'cancelado'].includes(t.estado));
      const carteira = carteiras.find((c) => c.id === d.carteiraId)!;
      const valorAberto = abertos.reduce((s, t) => s + reais(
        calcularEncargos(t.valorCentavos,
          Math.max(0, difDias(hoje, paraIso(t.vencimento))),
          carteira.multaPct, carteira.jurosMesPct).totalCentavos,
      ), 0);
      const maisAntigo = abertos.reduce<string | null>((menor, t) => {
        const e = paraIso(t.entradaCarteira);
        return menor == null || e < menor ? e : menor;
      }, null);
      return {
        id: d.id, escritorioId: d.escritorioId, credorId: d.credorId, carteiraId: d.carteiraId,
        tipo: d.tipo, nome: d.nome, doc: d.documento, cidade: d.cidade,
        canaisBloqueados: d.canaisBloqueados, vulneravel: d.vulneravel,
        rating: (d.ratingLetra ?? 'C') as Letra, ratingTotal: d.ratingTotal ?? 50,
        ratingBase: ratingBaseDoDevedor(ctx, d), ratingNovo: d.ratingNovo,
        titulosAbertos: abertos.length, valorAberto: Math.round(valorAberto),
        diasDesdeEntrada: maisAntigo ? Math.max(0, difDias(hoje, maisAntigo)) : 0,
        maiorAtrasoTotal: doDev.reduce((m, t) =>
          Math.max(m, t.atrasoOriginal + Math.max(0, difDias(t.pagoEm ? paraIso(t.pagoEm) : hoje, paraIso(t.entradaCarteira)))), 0),
        token: d.token,
      };
    });

    const titulosF1 = titulos.map((t) => {
      const carteira = carteiras.find((c) => c.id === t.carteiraId)!;
      const trilha = trilhas.get(t.id) ?? [];
      return {
        id: t.id, escritorioId: t.escritorioId, credorId: t.credorId,
        carteiraId: t.carteiraId, devedorId: t.devedorId, numero: t.numero,
        valorOriginal: reais(t.valorCentavos),
        valorAtualizado: reais(calcularEncargos(t.valorCentavos,
          Math.max(0, difDias(t.pagoEm ? paraIso(t.pagoEm) : hoje, paraIso(t.vencimento))),
          carteira.multaPct, carteira.jurosMesPct).totalCentavos),
        vencimentoOriginal: paraIso(t.vencimento),
        entradaCarteira: paraIso(t.entradaCarteira),
        atrasoOriginal: t.atrasoOriginal,
        faixaEntrada: faixaDoAtraso(t.atrasoOriginal),
        antecipado: t.antecipado,
        estado: t.estado,
        pagoEm: t.pagoEm ? paraIso(t.pagoEm) : null,
        contestadoEm: t.contestadoEm ? t.contestadoEm.toISOString().slice(0, 10) : null,
        comunicacaoPreviaEm: t.comunicacaoPreviaEnviadaEm ? paraIso(t.comunicacaoPreviaEnviadaEm) : null,
        etapaAtual: etapaAtual(t, trilha),
        trilha,
      };
    });

    const filaHoje = acoes
      .filter((a) => Math.abs(difDias(paraIso(a.dataProgramada), hoje)) <= 3)
      .map((a) => ({
        id: a.id, escritorioId: a.escritorioId, credorId:
          carteiras.find((c) => c.id === a.carteiraId)?.credorId ?? '',
        carteiraId: a.carteiraId, devedorId: a.devedorId, tituloId: a.tituloId,
        etapa: a.etapa, descricao: a.descricao, canal: a.canal, quem: a.quem,
        data: paraIso(a.dataProgramada), estado: a.estado,
        resultado: a.resultado, motivoBloqueio: a.motivoBloqueio,
      }));

    const excecoesF1 = excecoes.slice(0, 40).map((e) => {
      const minAtras = Math.max(1, Math.round((Date.parse(`${hoje}T18:00:00Z`) - e.abertaEm.getTime()) / 60000));
      const conversa = mensagens
        .filter((m) => m.devedorId === e.devedorId)
        .slice(-3)
        .map((m) => ({
          de: (m.de === 'devedor' ? 'devedor' : m.de === 'analista' ? 'analista' : 'IA') as 'IA' | 'devedor' | 'analista',
          texto: m.texto.length > 220 ? `${m.texto.slice(0, 217)}…` : m.texto,
          minAtras,
        }));
      return {
        id: e.id, escritorioId: e.escritorioId,
        carteiraId: devedores.find((d) => d.id === e.devedorId)?.carteiraId ?? '',
        devedorId: e.devedorId, tituloId: e.tituloId,
        motivo: e.motivo, estado: e.estado,
        abertaMinAtras: minAtras, slaMin: e.slaMin,
        valorEnvolvido: reais(e.valorEnvolvidoCentavos),
        assumidaPor: e.assumidaPor,
        tempoAteAssumirMin: e.assumidaEm
          ? Math.max(1, Math.round((e.assumidaEm.getTime() - e.abertaEm.getTime()) / 60000))
          : null,
        causa: e.causa, resolucao: e.resolucao, conversa,
      };
    });

    const acordosF1 = acordos.map((a) => ({
      id: a.id, escritorioId: a.escritorioId,
      carteiraId: devedores.find((d) => d.id === a.devedorId)?.carteiraId ?? '',
      devedorId: a.devedorId, tituloIds: a.titulos.map((t) => t.tituloId),
      valorTotal: reais(a.valorTotalCentavos), jurosEmbutidos: reais(a.jurosEmbutidosCentavos),
      parcelas: a.parcelas, parcelasPagas: a.parcelasPagas, status: a.status,
      origem: a.origem, criadoEm: a.criadoEm.toISOString().slice(0, 10),
    }));

    const documentosF1 = documentos.map((d) => ({
      id: d.id, escritorioId: d.escritorioId,
      carteiraId: devedores.find((x) => x.id === d.devedorId)?.carteiraId ?? '',
      tituloIds: d.titulos.map((t) => t.tituloId), devedorId: d.devedorId,
      tipo: d.tipo, subtipo: d.subtipo ?? undefined,
      status: d.status === 'autorizado' ? 'assinado' : d.status,
      valor: reais(d.valorCentavos),
      geradoEm: d.geradoEm.toISOString().slice(0, 10),
      assinadoPor: d.assinadoPor,
    }));

    const mesDeHoje = hoje.slice(0, 7);
    const honorarios = credores.map((credor) => {
      const recuperadoMes = titulos
        .filter((t) => t.credorId === credor.id && t.pagoEm && paraIso(t.pagoEm).slice(0, 7) === mesDeHoje)
        .reduce((s, t) => s + reais(t.valorPagoCentavos ?? t.valorCentavos), 0);
      const pct = credor.honorariosPct ?? 0;
      return {
        credorId: credor.id, recuperadoMes: Math.round(recuperadoMes),
        pct, valor: Math.round((recuperadoMes * pct) / 100),
      };
    });

    const bloqueios = acoes
      .filter((a) => a.estado === 'bloqueada' && a.motivoBloqueio)
      .slice(-60)
      .map((a, i) => ({
        id: `b${i + 1}`, escritorioId: escritorio.id, carteiraId: a.carteiraId,
        regra: a.motivoBloqueio!,
        detalhe: `${a.etapa} por ${a.canal} — ${devedores.find((d) => d.id === a.devedorId)?.nome ?? a.devedorId}`,
        em: paraIso(a.dataProgramada),
      }));

    const somaAg = (f: (a: AgregadosCarteira) => number) => agregados.reduce((s, a) => s + f(a), 0);
    const scoreTotal = agregados.length
      ? Math.round(agregados.reduce((s, a) => s + a.score * a.valorEntregue, 0) / Math.max(1, somaAg((a) => a.valorEntregue)))
      : 0;

    const dump: DadosEscritorio = {
      escritorio: {
        id: escritorio.id, nome: escritorio.nome, oab: escritorio.oab,
        cidade: escritorio.cidade, plano: escritorio.plano as DadosEscritorio['escritorio']['plano'],
        marca: {
          nomeExibicao: escritorio.marcaNome, iniciais: escritorio.marcaIniciais,
          corPrimaria: escritorio.corPrimaria, corClara: escritorio.corClara,
          mostrarOperadora: escritorio.mostrarOperadora,
        },
        slaMin: escritorio.slaMin,
        usuarios: escritorio.usuarios.map((u) => ({
          nome: u.nome, papel: u.papel as 'sócio', oab: u.oab ?? undefined,
        })),
        retencaoGravacoesAnos: escritorio.retencaoGravacoesAnos,
      },
      credores: credores.map((c) => ({
        id: c.id, escritorioId: c.escritorioId, nome: c.nome,
        setor: c.setor as DadosEscritorio['credores'][number]['setor'],
        contatoNome: c.contatoNome, honorariosPct: c.honorariosPct ?? 0, token: c.token,
      })),
      carteiras: carteiras.map(carteiraParaPlano),
      agregados,
      devedores: devedoresF1 as DadosEscritorio['devedores'],
      titulos: titulosF1 as DadosEscritorio['titulos'],
      filaHoje: filaHoje as DadosEscritorio['filaHoje'],
      excecoes: excecoesF1 as DadosEscritorio['excecoes'],
      acordos: acordosF1 as DadosEscritorio['acordos'],
      documentos: documentosF1 as DadosEscritorio['documentos'],
      honorarios,
      bloqueios,
      score: {
        total: scoreTotal,
        evolucao: [-3, -2, -1, 0].map((m) => ({
          mes: addDias(hoje, m * 30).slice(0, 7),
          valor: Math.max(0, scoreTotal - [9, 6, 3, 0][m + 3]),
        })),
      },
    };
    writeFileSync(join(destino, `${escritorio.id}.json`), JSON.stringify(dump));

    resumoEscritorios.push({
      id: escritorio.id, nome: escritorio.nome, plano: escritorio.plano,
      cidade: escritorio.cidade, marca: dump.escritorio.marca,
    });

    // ---- portais -----------------------------------------------------------
    const contatoEscritorio = `atendimento@${escritorio.marcaIniciais.toLowerCase() || 'escritorio'}.exemplo.invalid`;
    const comAbertos = devedoresF1.filter((d) => d.titulosAbertos > 0).slice(0, 60);
    for (const d of comAbertos) {
      const carteira = carteiras.find((c) => c.id === d.carteiraId)!;
      const credor = credores.find((c) => c.id === d.credorId)!;
      const abertos = titulos.filter((t) => t.devedorId === d.id && !['pago', 'cancelado'].includes(t.estado));
      const pagosDoDev = titulos.filter((t) => t.devedorId === d.id && t.estado === 'pago');
      const totalAbertoCentavos = abertos.reduce((s, t) => s + calcularEncargos(
        t.valorCentavos, Math.max(0, difDias(hoje, paraIso(t.vencimento))),
        carteira.multaPct, carteira.jurosMesPct).totalCentavos, 0);
      portalDevedores[d.token!] = {
        devedor: { nome: d.nome, doc: d.doc, tipo: d.tipo },
        escritorio: {
          nomeExibicao: escritorio.marcaNome, oab: escritorio.oab,
          corPrimaria: escritorio.corPrimaria, corClara: escritorio.corClara,
          mostrarOperadora: escritorio.mostrarOperadora, contato: contatoEscritorio,
        },
        credorOriginal: credor.nome,
        titulosAbertos: abertos.map((t) => {
          const enc = calcularEncargos(t.valorCentavos,
            Math.max(0, difDias(hoje, paraIso(t.vencimento))), carteira.multaPct, carteira.jurosMesPct);
          return {
            numero: t.numero, credor: credor.nome,
            valorOriginal: reais(t.valorCentavos),
            encargos: carteira.multaPct == null ? null : reais(enc.totalCentavos - t.valorCentavos),
            valorAtualizado: reais(enc.totalCentavos),
            vencimentoOriginal: paraIso(t.vencimento),
            estado: t.estado,
          };
        }),
        titulosPagos: pagosDoDev.slice(0, 6).map((t) => ({
          numero: t.numero, valor: reais(t.valorPagoCentavos ?? t.valorCentavos),
          pagoEm: t.pagoEm ? paraIso(t.pagoEm) : hoje,
        })),
        acordos: acordosF1.filter((a) => a.devedorId === d.id).map((a) => ({
          valorTotal: a.valorTotal, parcelas: a.parcelas,
          parcelasPagas: a.parcelasPagas, status: a.status,
        })),
        alcada: { parcelasMax: carteira.parcelasMax, descontoMaxPct: carteira.descontoMaxPct },
        simulacoes: calcularSimulacoes(carteira, totalAbertoCentavos).map((s) => ({
          parcelas: s.parcelas, valorParcela: reais(s.valorParcelaCentavos),
          custoTotal: reais(s.custoTotalCentavos), jurosEmbutidos: reais(s.jurosEmbutidosCentavos),
        })),
      };
      acessos++;
    }
    for (const d of comAbertos.slice(0, 3)) {
      tokensDevedor.push({ token: d.token, devedor: d.nome, escritorio: escritorio.marcaNome });
    }
    for (const credor of credores) {
      portalCredores[credor.token] = {
        credor: { nome: credor.nome, contatoNome: credor.contatoNome },
        escritorio: {
          nomeExibicao: escritorio.marcaNome, oab: escritorio.oab,
          corPrimaria: escritorio.corPrimaria, corClara: escritorio.corClara,
          mostrarOperadora: escritorio.mostrarOperadora,
        },
        hoje,
        carteiras: agregados
          .filter((a) => a.credorId === credor.id)
          .map((a) => {
            const carteira = carteiras.find((c) => c.id === a.carteiraId)!;
            return {
              nome: carteira.nome, tipo: carteira.tipo,
              qtdTitulos: a.qtdTitulos, qtdDevedores: a.qtdDevedores,
              valorEntregue: a.valorEntregue, valorAberto: a.valorAberto,
              recuperadoMes: a.recuperadoMes, recuperadoAcumulado: a.recuperadoAcumulado,
              faixasEntrada: a.faixasEntrada, eficienciaEtapa: a.eficienciaEtapa,
              distribuicaoRating: a.distribuicaoRating, ratingMedio: a.ratingMedio,
              acordosVigentes: a.acordosVigentes, previsaoAcordos: a.previsaoAcordos,
              recuperadoPorSemana: a.recuperadoPorSemana,
            };
          }),
      };
      tokensCredor.push({ token: credor.token, credor: credor.nome, escritorio: escritorio.marcaNome });
      acessos++;
    }
  }

  writeFileSync(join(destino, 'indice.json'), JSON.stringify({
    geradoEm: new Date().toISOString(),
    hoje,
    escritorios: resumoEscritorios,
    analistas: ANALISTAS,
    tokensDevedor,
    tokensCredor,
  }));
  writeFileSync(join(destino, 'devedores.json'), JSON.stringify(portalDevedores));
  writeFileSync(join(destino, 'credores.json'), JSON.stringify(portalCredores));
  writeFileSync(join(destino, 'exemplos.json'), JSON.stringify({ hoje, tokensDevedor, tokensCredor }));

  return { escritorios: escritorios.length, titulos: totalTitulos, acessosPortal: acessos, destino };
}
