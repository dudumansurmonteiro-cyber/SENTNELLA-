// Agregações do painel calculadas sobre o seed (CLAUDE.md §7.2).

import type { Acao, Canal, DadosCliente, Etapa, Titulo } from '@sentinella/dados';
import { addDias, difDias } from '@sentinella/dados';

export const ABERTO: Titulo['estado'][] = [
  'a vencer', 'vencido', 'em negociação', 'acordo', 'protestado', 'negativado',
  'jurídico', 'contestado', 'fora da régua',
];

export const EM_ATRASO: Titulo['estado'][] = [
  'vencido', 'em negociação', 'protestado', 'negativado', 'jurídico',
  'contestado', 'fora da régua',
];

export interface FaixaAtraso {
  rotulo: string;
  valor: number;
  qtd: number;
}

export function visaoGeral(d: DadosCliente, hoje: string) {
  const abertos = d.titulos.filter((t) => ABERTO.includes(t.estado));
  const emAtraso = d.titulos.filter((t) => EM_ATRASO.includes(t.estado));
  const mes = hoje.slice(0, 7);
  const pagosNoMes = d.titulos.filter((t) => t.pagoEm?.startsWith(mes));
  const recuperadoNoMes = pagosNoMes
    .filter((t) => difDias(t.pagoEm!, t.vencimento) > 0)
    .reduce((s, t) => s + t.valor, 0);

  const faixasDef = [
    { rotulo: '1–7 dias', min: 1, max: 7 },
    { rotulo: '8–15', min: 8, max: 15 },
    { rotulo: '16–30', min: 16, max: 30 },
    { rotulo: '31–60', min: 31, max: 60 },
    { rotulo: 'mais de 60', min: 61, max: 100000 },
  ];
  const faixas: FaixaAtraso[] = faixasDef.map((f) => {
    const doGrupo = emAtraso.filter((t) => t.diasAtraso >= f.min && t.diasAtraso <= f.max);
    return {
      rotulo: f.rotulo,
      valor: Math.round(doGrupo.reduce((s, t) => s + t.valor, 0)),
      qtd: doGrupo.length,
    };
  });

  const pagos = d.titulos.filter((t) => t.estado === 'pago');
  const pagosEmDia = pagos.filter((t) => difDias(t.pagoEm!, t.vencimento) <= 0).length;
  const dso =
    pagos.length > 0
      ? Math.round(
          pagos.reduce((s, t) => s + Math.max(0, difDias(t.pagoEm!, t.emissao)), 0) / pagos.length,
        )
      : 0;
  const promAval = d.promessas.filter((p) => p.cumprida !== null);

  return {
    totalAReceber: Math.round(abertos.reduce((s, t) => s + t.valor, 0)),
    qtdAbertos: abertos.length,
    totalEmAtraso: Math.round(emAtraso.reduce((s, t) => s + t.valor, 0)),
    qtdEmAtraso: emAtraso.length,
    recebidoNoMes: Math.round(pagosNoMes.reduce((s, t) => s + t.valor, 0)),
    recuperadoNoMes: Math.round(recuperadoNoMes),
    faixas,
    dso,
    pctPagosEmDia: pagos.length ? (pagosEmDia / pagos.length) * 100 : 0,
    pctPromessas: promAval.length
      ? (promAval.filter((p) => p.cumprida).length / promAval.length) * 100
      : 0,
  };
}

export function recuperadoPorSemana(d: DadosCliente, hoje: string) {
  const semanas: { rotulo: string; valor: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const fim = addDias(hoje, -7 * i);
    const inicio = addDias(fim, -6);
    const valor = d.titulos
      .filter(
        (t) =>
          t.pagoEm &&
          difDias(t.pagoEm, t.vencimento) > 0 &&
          difDias(t.pagoEm, inicio) >= 0 &&
          difDias(fim, t.pagoEm) >= 0,
      )
      .reduce((s, t) => s + t.valor, 0);
    semanas.push({ rotulo: `S${6 - i}`, valor: Math.round(valor) });
  }
  return semanas;
}

export function dezMaiores(d: DadosCliente) {
  return d.titulos
    .filter((t) => EM_ATRASO.includes(t.estado))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)
    .map((t) => ({ titulo: t, lojista: d.lojistas.find((l) => l.id === t.lojistaId)! }));
}

const CANAIS: Canal[] = ['WhatsApp', 'SMS', 'e-mail', 'carta'];

export function eficienciaPorCanal(d: DadosCliente) {
  return CANAIS.filter((c) => d.cliente.canais.includes(c)).map((canal) => {
    const doCanal = d.acoes.filter((a) => a.canal === canal && a.quem !== 'analista');
    const enviadas = doCanal.filter((a) => !['agendada', 'bloqueada', 'cancelada'].includes(a.estado));
    const contar = (nivel: string[]) =>
      enviadas.filter((a) => a.resultado && nivel.some((n) => a.resultado!.includes(n))).length;
    return {
      canal,
      enviadas: enviadas.length,
      entregues: contar(['entregue', 'lido', 'respondido', 'pago em até 48h', 'aguardando resposta']),
      lidas: contar(['lido', 'respondido', 'pago em até 48h']),
      respondidas: contar(['respondido', 'pago em até 48h', 'aguardando resposta']),
      pagas48h: contar(['pago em até 48h']),
    };
  });
}

const ETAPAS: Etapa[] = ['D−3', 'D0', 'D+3', 'D+7', 'D+10', 'D+15', 'D+30', 'D+45'];

export function conversaoPorEtapa(d: DadosCliente) {
  const porTitulo = new Map<string, Acao[]>();
  for (const a of d.acoes)
    porTitulo.set(a.tituloId, [...(porTitulo.get(a.tituloId) ?? []), a]);

  return ETAPAS.map((etapa) => {
    const acoes = d.acoes.filter(
      (a) => a.etapa === etapa && !['agendada', 'cancelada', 'bloqueada'].includes(a.estado),
    );
    let pagosDepois = 0;
    for (const a of acoes) {
      const t = d.titulos.find((x) => x.id === a.tituloId);
      if (t?.pagoEm) {
        const dif = difDias(t.pagoEm, a.data);
        if (dif >= 0 && dif <= 2) pagosDepois++;
      }
    }
    return {
      etapa,
      acoes: acoes.length,
      pagos48h: pagosDepois,
      conversao: acoes.length ? (pagosDepois / acoes.length) * 100 : 0,
    };
  }).filter((e) => e.acoes > 0);
}

export function ligacoesResumo(d: DadosCliente) {
  const lig = d.acoes.filter((a) => a.quem === 'analista');
  const feitas = lig.filter((a) => a.estado !== 'agendada' && a.estado !== 'em andamento');
  const atendidas = feitas.filter((a) => a.resultado?.startsWith('atendida'));
  const promessas = d.promessas;
  const cumpridas = promessas.filter((p) => p.cumprida === true);
  return {
    realizadas: feitas.length,
    atendidas: atendidas.length,
    naoAtendidas: feitas.length - atendidas.length,
    promessasObtidas: promessas.length,
    promessasCumpridas: cumpridas.length,
  };
}

export function operacaoDoDia(d: DadosCliente, hoje: string) {
  const doDia = d.acoes.filter((a) => a.data === hoje);
  const proximas = d.acoes.filter((a) => difDias(a.data, hoje) >= 0 && difDias(a.data, hoje) <= 3);
  const mensagensHoje = doDia.filter((a) => a.quem === 'IA').length;
  const ligacoesHoje = proximas.filter((a) => a.quem === 'analista' && ['agendada', 'em andamento', 'não atendida'].includes(a.estado)).length;
  const notificacoes = proximas.filter((a) => a.etapa === 'D+30').length;
  const porEstado = (estado: Acao['estado']) => proximas.filter((a) => a.estado === estado);
  return {
    mensagensHoje,
    ligacoesHoje,
    notificacoes,
    protestosAguardando: d.autorizacoes.filter((a) => a.status === 'pendente').length,
    fila: {
      agendado: porEstado('agendada'),
      'em andamento': porEstado('em andamento'),
      pendente: porEstado('pendente'),
      'não atendido': porEstado('não atendida'),
      cancelado: porEstado('cancelada'),
      bloqueado: porEstado('bloqueada'),
      finalizado: doDia.filter((a) => a.estado === 'finalizada'),
    },
  };
}

export function distribuicaoRating(d: DadosCliente) {
  const letras = ['A', 'B', 'C', 'D', 'E'] as const;
  return letras.map((letra) => ({
    letra,
    qtd: d.lojistas.filter((l) => l.rating === letra).length,
  }));
}
