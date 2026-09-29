// Recálculo mensal do rating A–E (§6) sobre o histórico do banco.
// A fórmula é a mesma da Fase 1 (packages/dados/src/rating.ts); aqui mudam
// apenas as fontes: títulos, promessas, exceções e mensagens reais.

import { db, auditar } from '@sentinella/db';
import { calcularRating } from '@sentinella/dados';
import { paraIso, difDias, diasDeAtrasoEm } from './datas';

export interface ResumoRating {
  clienteId: string;
  lojistas: number;
  mudaramDeLetra: number;
  distribuicao: Record<string, number>;
}

export async function recalcularRating(clienteId: string, hoje: string): Promise<ResumoRating> {
  const [lojistas, titulos, promessas, excecoes, mensagens] = await Promise.all([
    db.lojista.findMany({ where: { clienteId }, orderBy: { id: 'asc' } }),
    db.titulo.findMany({ where: { clienteId } }),
    db.promessa.findMany({ where: { clienteId, cumprida: { not: null } } }),
    db.excecao.findMany({ where: { clienteId }, select: { lojistaId: true } }),
    db.mensagem.findMany({
      where: { clienteId },
      orderBy: { em: 'asc' },
      select: { lojistaId: true, de: true, em: true },
    }),
  ]);

  const porLojistaTitulos = new Map<string, typeof titulos>();
  for (const t of titulos) {
    const lista = porLojistaTitulos.get(t.lojistaId) ?? [];
    lista.push(t);
    porLojistaTitulos.set(t.lojistaId, lista);
  }
  const porLojistaPromessas = new Map<string, { feitas: number; cumpridas: number }>();
  for (const p of promessas) {
    const atual = porLojistaPromessas.get(p.lojistaId) ?? { feitas: 0, cumpridas: 0 };
    atual.feitas++;
    if (p.cumprida) atual.cumpridas++;
    porLojistaPromessas.set(p.lojistaId, atual);
  }
  const porLojistaExcecoes = new Map<string, number>();
  for (const e of excecoes)
    porLojistaExcecoes.set(e.lojistaId, (porLojistaExcecoes.get(e.lojistaId) ?? 0) + 1);

  // Tempo de resposta: horas entre uma mensagem nossa e a primeira resposta
  // do lojista (janela de 72h).
  const horasResposta = new Map<string, { soma: number; n: number }>();
  const ultimaNossa = new Map<string, Date>();
  for (const m of mensagens) {
    if (m.de === 'IA' || m.de === 'analista') ultimaNossa.set(m.lojistaId, m.em);
    else if (m.de === 'lojista') {
      const anterior = ultimaNossa.get(m.lojistaId);
      if (anterior) {
        const horas = (m.em.getTime() - anterior.getTime()) / 3_600_000;
        if (horas >= 0 && horas <= 72) {
          const atual = horasResposta.get(m.lojistaId) ?? { soma: 0, n: 0 };
          atual.soma += horas;
          atual.n++;
          horasResposta.set(m.lojistaId, atual);
        }
        ultimaNossa.delete(m.lojistaId);
      }
    }
  }

  const resumo: ResumoRating = {
    clienteId, lojistas: lojistas.length, mudaramDeLetra: 0,
    distribuicao: { A: 0, B: 0, C: 0, D: 0, E: 0 },
  };

  for (const lojista of lojistas) {
    const doLojista = porLojistaTitulos.get(lojista.id) ?? [];
    const encerradosOuVencidos = doLojista.filter((t) => t.estado !== 'a vencer');
    const somaValor = encerradosOuVencidos.reduce((s, t) => s + t.valorCentavos, 0) || 1;
    const somaAtraso = encerradosOuVencidos.reduce((s, t) => {
      const atraso = t.pagoEm
        ? Math.max(0, difDias(paraIso(t.pagoEm), paraIso(t.vencimento)))
        : diasDeAtrasoEm(paraIso(t.vencimento), hoje);
      return s + atraso * t.valorCentavos;
    }, 0);
    const comAtraso = encerradosOuVencidos.filter((t) =>
      t.pagoEm
        ? difDias(paraIso(t.pagoEm), paraIso(t.vencimento)) > 0
        : diasDeAtrasoEm(paraIso(t.vencimento), hoje) > 0,
    ).length;
    const prom = porLojistaPromessas.get(lojista.id) ?? { feitas: 0, cumpridas: 0 };
    const resp = horasResposta.get(lojista.id);

    const r = calcularRating({
      titulosTotais: doLojista.length,
      diasMediosAtrasoPonderado: somaAtraso / somaValor,
      horasMediasResposta: resp && resp.n > 0 ? resp.soma / resp.n : null,
      promessasFeitas: prom.feitas,
      promessasCumpridas: prom.cumpridas,
      pctTitulosComAtraso: (comAtraso / Math.max(1, encerradosOuVencidos.length)) * 100,
      excecoesPorTitulo: (porLojistaExcecoes.get(lojista.id) ?? 0) / Math.max(1, doLojista.length),
    });

    resumo.distribuicao[r.letra]++;
    const mudou = lojista.ratingLetra !== r.letra;
    if (mudou && lojista.ratingLetra != null) {
      await auditar(clienteId, 'lojista', lojista.id, lojista.ratingLetra, r.letra, 'sistema',
        'rating recalculado (§6) — nunca exibido ao lojista');
      resumo.mudaramDeLetra++;
    }
    await db.lojista.update({
      where: { id: lojista.id },
      data: {
        ratingLetra: r.letra,
        ratingTotal: r.total,
        ratingDetalhe: r.detalhe as object[],
        ratingNovo: r.novo,
      },
    });
  }
  return resumo;
}
