// Rating A–E por lojista (CLAUDE.md §6) — recalculado sobre o histórico
// disponível do seed (90 dias). Pesos: pontualidade 40, tempo de resposta 20,
// promessas cumpridas 20, frequência de atraso 10, exceções geradas 10.
// Faixas internas da Fase 1: A ≥ 85 · B ≥ 70 · C ≥ 50 · D ≥ 30 · E < 30.
// Lojista com menos de 3 títulos de histórico entra como C (§6).

import { DetalheCriterio, Letra } from './tipos';
import { pct } from './formato';

export interface EntradaRating {
  titulosTotais: number;
  diasMediosAtrasoPonderado: number; // ponderado pelo valor
  horasMediasResposta: number | null; // null = nunca respondeu
  promessasFeitas: number;
  promessasCumpridas: number;
  pctTitulosComAtraso: number; // 0–100
  excecoesPorTitulo: number; // exceções ÷ títulos
}

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export function calcularRating(e: EntradaRating): {
  letra: Letra;
  total: number;
  detalhe: DetalheCriterio[];
  novo: boolean;
} {
  if (e.titulosTotais < 3) {
    return {
      letra: 'C',
      total: 50,
      novo: true,
      detalhe: [
        {
          rotulo: 'Lojista novo',
          peso: 100,
          valor: `${e.titulosTotais} título(s) de histórico`,
          pontos: 50,
        },
      ],
    };
  }

  const pPontualidade = clamp(100 - e.diasMediosAtrasoPonderado * (100 / 35));
  const pResposta =
    e.horasMediasResposta == null ? 10 : clamp(100 - (e.horasMediasResposta - 2) * (100 / 46));
  const pPromessas =
    e.promessasFeitas === 0 ? 60 : clamp((e.promessasCumpridas / e.promessasFeitas) * 100);
  const pFrequencia = clamp(100 - e.pctTitulosComAtraso * (100 / 80));
  const pExcecoes = clamp(100 - e.excecoesPorTitulo * 400);

  const detalhe: DetalheCriterio[] = [
    {
      rotulo: 'Pontualidade',
      peso: 40,
      valor: `${e.diasMediosAtrasoPonderado.toFixed(1).replace('.', ',')} dias médios de atraso (ponderado pelo valor)`,
      pontos: Math.round(pPontualidade),
    },
    {
      rotulo: 'Tempo de resposta',
      peso: 20,
      valor:
        e.horasMediasResposta == null
          ? 'não responde aos contatos'
          : `${e.horasMediasResposta.toFixed(0)}h até a primeira resposta`,
      pontos: Math.round(pResposta),
    },
    {
      rotulo: 'Promessas cumpridas',
      peso: 20,
      valor:
        e.promessasFeitas === 0
          ? 'sem promessas no período'
          : `${e.promessasCumpridas} de ${e.promessasFeitas} pagas na data combinada`,
      pontos: Math.round(pPromessas),
    },
    {
      rotulo: 'Frequência de atraso',
      peso: 10,
      valor:
        e.pctTitulosComAtraso >= 99.5
          ? 'todos os títulos pagos após o vencimento'
          : `${pct(e.pctTitulosComAtraso)} dos títulos pagos após o vencimento`,
      pontos: Math.round(pFrequencia),
    },
    {
      rotulo: 'Exceções geradas',
      peso: 10,
      valor: `${e.excecoesPorTitulo.toFixed(2).replace('.', ',')} contestações/escalonamentos por título`,
      pontos: Math.round(pExcecoes),
    },
  ];

  const total = Math.round(
    detalhe.reduce((soma, c) => soma + (c.pontos * c.peso) / 100, 0),
  );

  const letra: Letra = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 50 ? 'C' : total >= 30 ? 'D' : 'E';
  return { letra, total, detalhe, novo: false };
}
