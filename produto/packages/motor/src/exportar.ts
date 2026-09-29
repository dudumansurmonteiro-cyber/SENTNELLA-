// Exporta o banco da Fase 2 no formato JSON que o painel, o console e o
// portal da Fase 1 já consomem. É o mesmo código que alimenta a demonstração
// publicada e o servidor local — a diferença é só onde o JSON é servido.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@sentinella/db';
import { paraIso, difDias, addDias, diasDeAtrasoEm, hojeReal } from './datas';
import { calcularEncargos } from './mensagens';
import { ANALISTAS } from './equipe';

const EM_ATRASO = [
  'vencido', 'em negociação', 'protestado', 'negativado', 'jurídico',
  'contestado', 'fora da régua',
];
const ABERTO = ['a vencer', ...EM_ATRASO, 'acordo'];

const reais = (centavos: number) => Math.round(centavos) / 100;
const minutosDesde = (d: Date, agora: number) => Math.max(1, Math.round((agora - d.getTime()) / 60000));

export async function montarCliente(clienteId: string, hoje = hojeReal()) {
  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return null;
  const agora = Date.now();

  const [lojistas, titulos, acoes, excecoes, acordos, autorizacoes, promessas, mensagensExc] =
    await Promise.all([
      db.lojista.findMany({ where: { clienteId }, orderBy: { id: 'asc' } }),
      db.titulo.findMany({ where: { clienteId }, orderBy: { numero: 'asc' } }),
      db.acaoCobranca.findMany({
        where: { clienteId, dataProgramada: { gte: new Date(`${addDias(hoje, -60)}T00:00:00Z`) } },
        orderBy: [{ dataProgramada: 'asc' }, { id: 'asc' }],
      }),
      db.excecao.findMany({ where: { clienteId }, orderBy: { abertaEm: 'asc' } }),
      db.acordo.findMany({ where: { clienteId }, include: { titulos: true }, orderBy: { id: 'asc' } }),
      db.autorizacao.findMany({ where: { clienteId }, orderBy: { id: 'asc' } }),
      db.promessa.findMany({ where: { clienteId }, orderBy: { id: 'asc' } }),
      db.mensagem.findMany({
        where: { clienteId, excecaoId: { not: null } },
        orderBy: { em: 'asc' },
      }),
    ]);

  // Ações no formato da Fase 1.
  const acoesJson = acoes.map((a) => ({
    id: a.id,
    clienteId,
    tituloId: a.tituloId,
    lojistaId: a.lojistaId,
    etapa: a.etapa,
    descricao: a.tentativa > 1 ? a.descricao : a.descricao,
    canal: a.canal,
    quem: a.quem,
    data: paraIso(a.dataProgramada),
    estado: a.estado,
    resultado: a.resultado,
  }));
  const ultimaAcaoPorTitulo = new Map<string, (typeof acoesJson)[number]>();
  for (const a of acoesJson)
    if (!['cancelada'].includes(a.estado)) ultimaAcaoPorTitulo.set(a.tituloId, a);

  const titulosJson = titulos.map((t) => {
    const vencimentoIso = paraIso(t.vencimento);
    const diasAtraso = EM_ATRASO.includes(t.estado) ? diasDeAtrasoEm(vencimentoIso, hoje) : 0;
    let etapaAtual: string;
    if (t.estado === 'pago') etapaAtual = 'quitado';
    else if (t.estado === 'fora da régua') etapaAtual = 'fora da régua';
    else {
      const ultima = ultimaAcaoPorTitulo.get(t.id);
      etapaAtual = ultima
        ? `${ultima.etapa} · ${ultima.estado === 'agendada' ? 'programada' : ultima.estado}`
        : 'a programar';
    }
    return {
      id: t.id,
      clienteId,
      lojistaId: t.lojistaId,
      numero: t.numero,
      valor: reais(t.valorCentavos),
      emissao: paraIso(t.emissao),
      vencimento: vencimentoIso,
      antecipado: t.antecipado,
      estado: t.estado,
      diasAtraso,
      pagoEm: t.pagoEm ? paraIso(t.pagoEm) : null,
      etapaAtual,
    };
  });
  const porLojista = new Map<string, typeof titulosJson>();
  for (const t of titulosJson) {
    const lista = porLojista.get(t.lojistaId) ?? [];
    lista.push(t);
    porLojista.set(t.lojistaId, lista);
  }

  const lojistasJson = lojistas.map((l) => {
    const doLojista = porLojista.get(l.id) ?? [];
    const abertos = doLojista.filter((t) => !['pago', 'cancelado'].includes(t.estado));
    const maiorAtraso = doLojista.reduce((max, t) => {
      const atraso = t.pagoEm ? Math.max(0, difDias(t.pagoEm, t.vencimento)) : t.diasAtraso;
      return Math.max(max, atraso);
    }, 0);
    return {
      id: l.id,
      clienteId,
      nome: l.nome,
      cidade: l.cidade,
      cnpj: l.cnpj,
      contatoNome: l.contatoNome,
      contatoPapel: l.contatoPapel,
      token: l.token,
      rating: l.ratingLetra ?? 'C',
      ratingTotal: l.ratingTotal ?? 50,
      ratingDetalhe: l.ratingDetalhe ?? [],
      ratingNovo: l.ratingNovo,
      titulosAbertos: abertos.length,
      valorAberto: Math.round(abertos.reduce((s, t) => s + t.valor, 0)),
      valorVencido: Math.round(
        abertos.filter((t) => t.estado !== 'a vencer').reduce((s, t) => s + t.valor, 0),
      ),
      maiorAtrasoDias: maiorAtraso,
    };
  });

  const conversaPorExcecao = new Map<string, { de: string; texto: string; minAtras: number }[]>();
  for (const m of mensagensExc) {
    const lista = conversaPorExcecao.get(m.excecaoId!) ?? [];
    lista.push({ de: m.de, texto: m.texto, minAtras: minutosDesde(m.em, agora) });
    conversaPorExcecao.set(m.excecaoId!, lista);
  }
  const excecoesJson = excecoes.map((e) => ({
    id: e.id,
    clienteId,
    lojistaId: e.lojistaId,
    tituloId: e.tituloId,
    motivo: e.motivo,
    estado: e.estado,
    abertaMinAtras: minutosDesde(e.abertaEm, agora),
    slaMin: e.slaMin,
    valorEnvolvido: reais(e.valorEnvolvidoCentavos),
    assumidaPor: e.assumidaPor,
    tempoAteAssumirMin:
      e.assumidaEm != null
        ? Math.max(1, Math.round((e.assumidaEm.getTime() - e.abertaEm.getTime()) / 60000))
        : null,
    causa: e.causa,
    resolucao: e.resolucao,
    regraSugerida: e.regraSugerida,
    conversa: conversaPorExcecao.get(e.id) ?? [
      { de: 'IA', texto: 'Olá! Identificamos um título em aberto. Posso ajudar com a 2ª via ou um acordo?', minAtras: e.slaMin + 5 },
      { de: 'lojista', texto: 'Preciso revisar esse título antes de pagar.', minAtras: e.slaMin + 2 },
    ],
  }));

  const acordosJson = acordos.map((a) => ({
    id: a.id,
    clienteId,
    lojistaId: a.lojistaId,
    tituloIds: a.titulos.map((t) => t.tituloId),
    valorTotal: reais(a.valorTotalCentavos),
    parcelas: a.parcelas,
    parcelasPagas: a.parcelasPagas,
    status: a.status,
    criadoEm: paraIso(a.criadoEm),
  }));
  const autorizacoesJson = autorizacoes.map((a) => ({
    id: a.id,
    clienteId,
    lojistaId: a.lojistaId,
    tituloId: a.tituloId,
    tipo: a.tipo,
    valor: reais(a.valorCentavos),
    pedidoEm: paraIso(a.pedidoEm),
    status: a.status,
    aprovadaEm: a.aprovadaEm ? paraIso(a.aprovadaEm) : null,
  }));
  const promessasJson = promessas.map((p) => ({
    id: p.id,
    clienteId,
    lojistaId: p.lojistaId,
    tituloId: p.tituloId,
    para: paraIso(p.para),
    cumprida: p.cumprida,
  }));

  // Score Sentinella (0–100), a mesma composição da Fase 1, com a evolução
  // calculada "como se" cada mês tivesse fechado naquele corte.
  const scoreEm = (corte: string) => {
    const titulosAte = titulosJson
      .filter((t) => t.emissao <= corte)
      .map((t) => {
        const pago = t.pagoEm != null && t.pagoEm <= corte;
        const vencido = !pago && t.vencimento < corte;
        return {
          ...t,
          estado: pago ? 'pago' : vencido ? 'vencido' : 'a vencer',
          diasAtraso: vencido ? difDias(corte, t.vencimento) : 0,
        };
      });
    const acoesAte = acoesJson.filter((a) => a.data <= corte && a.estado !== 'agendada');
    const promAte = promessasJson.filter((p) => p.para <= corte && p.cumprida !== null);
    const excAte = excecoesJson.length * Math.min(1, titulosAte.length / Math.max(1, titulosJson.length));
    const pagos = titulosAte.filter((t) => t.estado === 'pago');
    const emDia = pagos.filter((t) => t.pagoEm! <= t.vencimento).length;
    const pctEmDia = pagos.length ? emDia / pagos.length : 0.7;
    const pctProm = promAte.length
      ? promAte.filter((p) => p.cumprida).length / promAte.length
      : 0.7;
    const excPorMil = (excAte / Math.max(1, titulosAte.length)) * 1000;
    const pctAtraso60 =
      titulosAte.filter((t) => t.diasAtraso > 60).length / Math.max(1, titulosAte.length);
    const bloqueadas = acoesAte.filter((a) => a.estado === 'bloqueada').length;
    const conformidade = 1 - bloqueadas / Math.max(1, acoesAte.length);
    return Math.round(
      25 * conformidade +
        30 * pctEmDia +
        15 * pctProm +
        15 * Math.max(0, 1 - excPorMil / 80) +
        15 * Math.max(0, 1 - pctAtraso60 / 0.15),
    );
  };
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const evolucao = [3, 2, 1, 0].map((atras) => {
    const corte = atras === 0 ? hoje : addDias(hoje, -30 * atras);
    const mesIdx = (Number(hoje.slice(5, 7)) - 1 - atras + 12) % 12;
    return { mes: meses[mesIdx], valor: Math.max(20, Math.min(99, scoreEm(corte))) };
  });

  return {
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      plano: cliente.plano,
      cidade: cliente.cidade,
      setor: cliente.setor,
      erp: cliente.erp,
      erpIntegrado: cliente.erpIntegrado,
      canais: cliente.canais,
      multaPct: cliente.multaPct,
      jurosMesPct: cliente.jurosMesPct,
      alcada: {
        descontoMaxPct: cliente.alcadaDescontoMaxPct,
        parcelasMax: cliente.alcadaParcelasMax,
        prazoMaxDias: cliente.alcadaPrazoMaxDias,
        valorSempreAnalista: reais(cliente.alcadaValorSempreAnalista),
      },
      valorLimiteLigacao: reais(cliente.valorLimiteLigacao),
      analistaIds: ANALISTAS.map((a) => a.id),
      ...(cliente.analistaNomeado ? { analistaNomeado: cliente.analistaNomeado } : {}),
    },
    lojistas: lojistasJson,
    titulos: titulosJson,
    acoes: acoesJson,
    excecoes: excecoesJson,
    acordos: acordosJson,
    autorizacoes: autorizacoesJson,
    promessas: promessasJson,
    score: { total: evolucao[3].valor, evolucao },
  };
}

export async function montarPortal(hoje = hojeReal()) {
  const clientes = await db.cliente.findMany({ orderBy: { id: 'asc' } });
  const portal: Record<string, unknown> = {};
  const tokensExemplo: { token: string; lojista: string; industria: string }[] = [];

  for (const cliente of clientes) {
    const lojistas = await db.lojista.findMany({
      where: { clienteId: cliente.id },
      orderBy: { id: 'asc' },
      include: {
        titulos: true,
        acordos: true,
      },
    });
    let exemplo: { token: string; lojista: string; valorVencido: number } | null = null;
    for (const l of lojistas) {
      const abertos = l.titulos.filter((t) => !['pago', 'cancelado'].includes(t.estado));
      if (!abertos.length) continue;
      const titulosAbertos = abertos.map((t) => {
        const vencimentoIso = paraIso(t.vencimento);
        const diasAtraso = diasDeAtrasoEm(vencimentoIso, hoje);
        const enc = calcularEncargos(t.valorCentavos, diasAtraso, cliente.multaPct, cliente.jurosMesPct);
        return {
          numero: t.numero,
          valor: reais(t.valorCentavos),
          vencimento: vencimentoIso,
          diasAtraso,
          multa: enc.multaCentavos != null ? reais(enc.multaCentavos) : null,
          juros: enc.jurosCentavos != null ? reais(enc.jurosCentavos) : null,
          total: reais(enc.totalCentavos),
          estado: t.estado,
        };
      });
      portal[l.token] = {
        lojista: { nome: l.nome, cnpj: l.cnpj, contatoNome: l.contatoNome },
        industria: {
          nome: cliente.nome,
          canais: cliente.canais,
          temMultaCadastrada: cliente.multaPct != null,
          alcada: {
            descontoMaxPct: cliente.alcadaDescontoMaxPct,
            parcelasMax: cliente.alcadaParcelasMax,
            prazoMaxDias: cliente.alcadaPrazoMaxDias,
          },
        },
        titulosAbertos,
        titulosPagos: l.titulos
          .filter((t) => t.estado === 'pago')
          .slice(-5)
          .map((t) => ({ numero: t.numero, valor: reais(t.valorCentavos), pagoEm: paraIso(t.pagoEm!) })),
        acordos: l.acordos.map((a) => ({
          valorTotal: reais(a.valorTotalCentavos),
          parcelas: a.parcelas,
          parcelasPagas: a.parcelasPagas,
          status: a.status,
        })),
      };
      const valorVencido = titulosAbertos
        .filter((t) => t.diasAtraso > 0)
        .reduce((s, t) => s + t.valor, 0);
      if (valorVencido > 0 && (!exemplo || valorVencido > exemplo.valorVencido))
        exemplo = { token: l.token, lojista: l.nome, valorVencido };
    }
    if (exemplo)
      tokensExemplo.push({ token: exemplo.token, lojista: exemplo.lojista, industria: cliente.nome });
  }
  return { portal, tokensExemplo };
}

export async function montarIndice(hoje = hojeReal()) {
  const clientes = await db.cliente.findMany({ orderBy: { id: 'asc' } });
  const { tokensExemplo } = await montarPortal(hoje);
  return {
    geradoEm: new Date().toISOString(),
    hoje,
    clientes: clientes.map((c) => ({
      id: c.id, nome: c.nome, plano: c.plano, cidade: c.cidade, setor: c.setor,
    })),
    analistas: ANALISTAS,
    tokensExemplo,
  };
}

export async function exportarParaApps(raizProduto: string, hoje = hojeReal()) {
  const destinos = [
    join(raizProduto, 'apps', 'painel', 'public', 'dados'),
    join(raizProduto, 'apps', 'portal', 'public', 'dados'),
  ];
  for (const d of destinos) mkdirSync(d, { recursive: true });

  const indice = await montarIndice(hoje);
  writeFileSync(join(destinos[0], 'indice.json'), JSON.stringify(indice));

  let totalTitulos = 0;
  for (const c of indice.clientes) {
    const dados = await montarCliente(c.id, hoje);
    if (!dados) continue;
    totalTitulos += dados.titulos.length;
    writeFileSync(join(destinos[0], `${c.id}.json`), JSON.stringify(dados));
  }
  const { portal } = await montarPortal(hoje);
  writeFileSync(join(destinos[1], 'portal.json'), JSON.stringify(portal));
  writeFileSync(
    join(destinos[1], 'exemplos.json'),
    JSON.stringify({ hoje, tokensExemplo: indice.tokensExemplo }),
  );
  return { clientes: indice.clientes.length, titulos: totalTitulos, acessosPortal: Object.keys(portal).length };
}
