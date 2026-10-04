// Recálculo mensal do rating A–E (§6) sobre o histórico do banco, por
// DEVEDOR. A fórmula é a mesma da Fase 1 (packages/dados/src/rating.ts); no
// v3 a pontualidade mede os dias até REGULARIZAR desde a ENTRADA na carteira
// (ponderados pelo valor), na mesma escala do seed (FATOR_REGULARIZACAO).
// O rating é interno do escritório e do credor — nunca vai ao devedor.

import { db, auditar } from '@sentinella/db';
import { calcularRating, FATOR_REGULARIZACAO } from '@sentinella/dados';
import { paraIso, difDias } from './datas';

export interface ResumoRating {
  escritorioId: string;
  devedores: number;
  mudaramDeLetra: number;
  distribuicao: Record<string, number>;
}

export async function recalcularRating(escritorioId: string, hoje: string): Promise<ResumoRating> {
  const [devedores, titulos, promessas, excecoes, mensagens] = await Promise.all([
    db.devedor.findMany({ where: { escritorioId }, orderBy: { id: 'asc' } }),
    db.titulo.findMany({ where: { escritorioId } }),
    db.promessa.findMany({ where: { escritorioId, cumprida: { not: null } } }),
    db.excecao.findMany({ where: { escritorioId }, select: { devedorId: true } }),
    db.mensagem.findMany({
      where: { escritorioId },
      orderBy: { em: 'asc' },
      select: { devedorId: true, de: true, em: true },
    }),
  ]);

  const porDevedorTitulos = new Map<string, typeof titulos>();
  for (const t of titulos) {
    const lista = porDevedorTitulos.get(t.devedorId) ?? [];
    lista.push(t);
    porDevedorTitulos.set(t.devedorId, lista);
  }
  const porDevedorPromessas = new Map<string, { feitas: number; cumpridas: number }>();
  for (const p of promessas) {
    const atual = porDevedorPromessas.get(p.devedorId) ?? { feitas: 0, cumpridas: 0 };
    atual.feitas++;
    if (p.cumprida) atual.cumpridas++;
    porDevedorPromessas.set(p.devedorId, atual);
  }
  const porDevedorExcecoes = new Map<string, number>();
  for (const e of excecoes)
    porDevedorExcecoes.set(e.devedorId, (porDevedorExcecoes.get(e.devedorId) ?? 0) + 1);

  // Tempo de resposta: horas entre uma mensagem nossa e a primeira resposta
  // do devedor (janela de 72h).
  const horasResposta = new Map<string, { soma: number; n: number }>();
  const ultimaNossa = new Map<string, Date>();
  for (const m of mensagens) {
    if (m.de === 'IA' || m.de === 'analista' || m.de === 'sistema') ultimaNossa.set(m.devedorId, m.em);
    else if (m.de === 'devedor') {
      const anterior = ultimaNossa.get(m.devedorId);
      if (anterior) {
        const horas = (m.em.getTime() - anterior.getTime()) / 3_600_000;
        if (horas >= 0 && horas <= 72) {
          const atual = horasResposta.get(m.devedorId) ?? { soma: 0, n: 0 };
          atual.soma += horas;
          atual.n++;
          horasResposta.set(m.devedorId, atual);
        }
        ultimaNossa.delete(m.devedorId);
      }
    }
  }

  const resumo: ResumoRating = {
    escritorioId, devedores: devedores.length, mudaramDeLetra: 0,
    distribuicao: { A: 0, B: 0, C: 0, D: 0, E: 0 },
  };

  for (const devedor of devedores) {
    const doDevedor = porDevedorTitulos.get(devedor.id) ?? [];
    const somaValor = doDevedor.reduce((s, t) => s + t.valorCentavos, 0) || 1;
    // Pontualidade v3: dias até regularizar DESDE A ENTRADA (cap 90),
    // ponderados pelo valor; títulos em aberto contam até hoje.
    const somaDias = doDevedor.reduce((s, t) => {
      const fim = t.pagoEm ? paraIso(t.pagoEm) : hoje;
      return s + Math.min(90, Math.max(0, difDias(fim, paraIso(t.entradaCarteira)))) * t.valorCentavos;
    }, 0);
    const semSolucao30 = doDevedor.filter(
      (t) => t.estado !== 'pago' && difDias(hoje, paraIso(t.entradaCarteira)) > 30,
    ).length;
    const prom = porDevedorPromessas.get(devedor.id) ?? { feitas: 0, cumpridas: 0 };
    const resp = horasResposta.get(devedor.id);
    const contestacoes = doDevedor.filter((t) => t.contestadoEm != null).length;

    const r = calcularRating({
      titulosTotais: doDevedor.length,
      diasMediosAtrasoPonderado: somaDias / somaValor / FATOR_REGULARIZACAO,
      horasMediasResposta: resp && resp.n > 0 ? resp.soma / resp.n : null,
      promessasFeitas: prom.feitas,
      promessasCumpridas: prom.cumpridas,
      pctTitulosComAtraso: (semSolucao30 / Math.max(1, doDevedor.length)) * 80,
      excecoesPorTitulo:
        ((porDevedorExcecoes.get(devedor.id) ?? 0) + contestacoes) / Math.max(1, doDevedor.length),
    });

    resumo.distribuicao[r.letra]++;
    const mudou = devedor.ratingLetra !== r.letra;
    if (mudou && devedor.ratingLetra != null) {
      await auditar(escritorioId, 'devedor', devedor.id, devedor.ratingLetra, r.letra, 'sistema',
        'rating recalculado (§6) — nunca exibido ao devedor');
      resumo.mudaramDeLetra++;
    }
    await db.devedor.update({
      where: { id: devedor.id },
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
