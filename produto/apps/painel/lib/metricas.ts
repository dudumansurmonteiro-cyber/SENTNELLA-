// Somas e junções dos agregados POR CARTEIRA (pré-computados no seed): o
// painel filtra as carteiras selecionadas e soma aqui, no cliente — os
// 20.000 títulos nunca são percorridos para montar a visão geral.

import type {
  AgregadosCarteira,
  Canal,
  EficienciaCanal,
  EficienciaEtapa,
  FaixaValor,
  Letra,
  LigacoesResumo,
  SerieSemana,
} from '@sentinella/dados';

export interface TotaisOperacao {
  qtdTitulos: number;
  qtdDevedores: number;
  valorEntregue: number;
  valorAberto: number;
  recuperadoMes: number;
  recuperadoAcumulado: number;
  pagosQtd: number;
  taxaRecuperacaoPct: number; // sobre o valor entregue
  promessasFeitas: number;
  promessasCumpridas: number;
  acordosVigentes: number;
  previsaoAcordos: number;
  ratingMedio: number;
  faixasEntrada: FaixaValor[];
  faixasCasa: FaixaValor[];
  eficienciaCanal: EficienciaCanal[];
  eficienciaEtapa: EficienciaEtapa[];
  ligacoes: LigacoesResumo;
  recuperadoPorSemana: SerieSemana[];
  distribuicaoRating: { letra: Letra; qtd: number }[];
}

function juntarFaixas(listas: FaixaValor[][]): FaixaValor[] {
  const porRotulo = new Map<string, FaixaValor>();
  const ordem: string[] = [];
  for (const lista of listas) {
    for (const f of lista) {
      const atual = porRotulo.get(f.rotulo);
      if (atual) {
        atual.valor += f.valor;
        atual.qtd += f.qtd;
      } else {
        porRotulo.set(f.rotulo, { ...f });
        ordem.push(f.rotulo);
      }
    }
  }
  return ordem.map((r) => porRotulo.get(r)!);
}

export function somarAgregados(ags: AgregadosCarteira[]): TotaisOperacao {
  const soma = (f: (a: AgregadosCarteira) => number) => ags.reduce((s, a) => s + f(a), 0);

  const canais = new Map<Canal, EficienciaCanal>();
  for (const a of ags) {
    for (const c of a.eficienciaCanal) {
      const atual = canais.get(c.canal);
      if (atual) {
        atual.enviadas += c.enviadas;
        atual.entregues += c.entregues;
        atual.lidas += c.lidas;
        atual.respondidas += c.respondidas;
        atual.pagas48h += c.pagas48h;
      } else canais.set(c.canal, { ...c });
    }
  }

  const etapas = new Map<string, EficienciaEtapa>();
  for (const a of ags) {
    for (const e of a.eficienciaEtapa) {
      const atual = etapas.get(e.etapa);
      if (atual) {
        atual.acoes += e.acoes;
        atual.pagos48h += e.pagos48h;
      } else etapas.set(e.etapa, { ...e });
    }
  }
  const eficienciaEtapa = [...etapas.values()]
    .map((e) => ({ ...e, conversao: e.acoes ? Math.round((e.pagos48h / e.acoes) * 1000) / 10 : 0 }))
    .sort((a, b) => Number(a.etapa.slice(2)) - Number(b.etapa.slice(2)));

  const ligacoes: LigacoesResumo = {
    realizadas: 0, atendidas: 0, naoAtendidas: 0,
    promessasObtidas: 0, promessasCumpridas: 0, pagasEm7d: 0,
  };
  for (const a of ags) {
    ligacoes.realizadas += a.ligacoes.realizadas;
    ligacoes.atendidas += a.ligacoes.atendidas;
    ligacoes.naoAtendidas += a.ligacoes.naoAtendidas;
    ligacoes.promessasObtidas += a.ligacoes.promessasObtidas;
    ligacoes.promessasCumpridas += a.ligacoes.promessasCumpridas;
    ligacoes.pagasEm7d += a.ligacoes.pagasEm7d;
  }

  const semanas = new Map<string, SerieSemana>();
  const ordemSemanas: string[] = [];
  for (const a of ags) {
    for (const s of a.recuperadoPorSemana) {
      const atual = semanas.get(s.rotulo);
      if (atual) atual.valor += s.valor;
      else {
        semanas.set(s.rotulo, { ...s });
        ordemSemanas.push(s.rotulo);
      }
    }
  }

  const rating = new Map<Letra, number>();
  for (const a of ags)
    for (const d of a.distribuicaoRating) rating.set(d.letra, (rating.get(d.letra) ?? 0) + d.qtd);

  const valorEntregue = soma((a) => a.valorEntregue);
  const recuperadoAcumulado = soma((a) => a.recuperadoAcumulado);
  const qtdDevedores = soma((a) => a.qtdDevedores);

  return {
    qtdTitulos: soma((a) => a.qtdTitulos),
    qtdDevedores,
    valorEntregue,
    valorAberto: soma((a) => a.valorAberto),
    recuperadoMes: soma((a) => a.recuperadoMes),
    recuperadoAcumulado,
    pagosQtd: soma((a) => a.pagosQtd),
    taxaRecuperacaoPct: valorEntregue ? (recuperadoAcumulado / valorEntregue) * 100 : 0,
    promessasFeitas: soma((a) => a.promessasFeitas),
    promessasCumpridas: soma((a) => a.promessasCumpridas),
    acordosVigentes: soma((a) => a.acordosVigentes),
    previsaoAcordos: soma((a) => a.previsaoAcordos),
    ratingMedio: qtdDevedores
      ? Math.round(ags.reduce((s, a) => s + a.ratingMedio * a.qtdDevedores, 0) / qtdDevedores)
      : 0,
    faixasEntrada: juntarFaixas(ags.map((a) => a.faixasEntrada)),
    faixasCasa: juntarFaixas(ags.map((a) => a.faixasCasa)),
    eficienciaCanal: [...canais.values()].sort((a, b) => b.enviadas - a.enviadas),
    eficienciaEtapa,
    ligacoes,
    recuperadoPorSemana: ordemSemanas.map((r) => semanas.get(r)!),
    distribuicaoRating: (['A', 'B', 'C', 'D', 'E'] as Letra[]).map((letra) => ({
      letra,
      qtd: rating.get(letra) ?? 0,
    })),
  };
}
