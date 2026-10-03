// Acordos dentro da alçada da carteira (§4/§6.4): as simulações mostram o
// CUSTO TOTAL antes do aceite (Lei 14.181/2021) e o aceite registra que o
// devedor o viu. Usado pelo espaço do devedor (servidor) e pela simulação.

import { db, auditar } from '@sentinella/db';
import type { Carteira, Titulo } from '@sentinella/db';
import { deIso, diasDeAtrasoEm, paraIso } from './datas';
import { calcularEncargos } from './mensagens';

export interface SimulacaoAcordoMotor {
  parcelas: number;
  valorParcelaCentavos: number;
  custoTotalCentavos: number; // mostrado ANTES do aceite
  jurosEmbutidosCentavos: number;
}

// Juros de parcelamento: 0,8% por parcela sobre o principal (configuração
// de lançamento; por carteira na Fase 3).
const JUROS_POR_PARCELA = 0.008;

export function calcularSimulacoes(
  carteira: Pick<Carteira, 'parcelasMax'>,
  valorCentavos: number,
): SimulacaoAcordoMotor[] {
  const opcoes = [2, Math.ceil(carteira.parcelasMax / 2), carteira.parcelasMax]
    .filter((p, i, lista) => p >= 1 && lista.indexOf(p) === i)
    .sort((a, b) => a - b);
  return opcoes.map((parcelas) => {
    const juros = parcelas > 1 ? Math.round(valorCentavos * JUROS_POR_PARCELA * parcelas) : 0;
    const total = valorCentavos + juros;
    return {
      parcelas,
      valorParcelaCentavos: Math.ceil(total / parcelas),
      custoTotalCentavos: total,
      jurosEmbutidosCentavos: juros,
    };
  });
}

export async function aceitarAcordo(opcoes: {
  devedorId: string;
  titulos: Titulo[];
  parcelas: number;
  origem: 'portal' | 'analista';
  hoje: string;
}): Promise<{ acordoId: string; custoTotalCentavos: number } | { erro: string }> {
  const { devedorId, titulos, parcelas, origem, hoje } = opcoes;
  if (!titulos.length) return { erro: 'nenhum título em aberto para o acordo' };
  const carteira = await db.carteira.findUnique({ where: { id: titulos[0].carteiraId } });
  if (!carteira) return { erro: 'carteira não encontrada' };
  if (parcelas < 1 || parcelas > carteira.parcelasMax) {
    return { erro: `parcelamento fora da alçada da carteira (até ${carteira.parcelasMax}x) — a proposta vai ao analista` };
  }
  // A base do acordo é o valor ATUALIZADO com os encargos do contrato até
  // hoje — a mesma base das simulações mostradas antes do aceite, para que o
  // custo total aceito seja exatamente o custo total exibido (Lei 14.181).
  const principal = titulos.reduce((s, t) => s + calcularEncargos(
    t.valorCentavos, diasDeAtrasoEm(paraIso(t.vencimento), hoje),
    carteira.multaPct, carteira.jurosMesPct,
  ).totalCentavos, 0);
  const juros = parcelas > 1 ? Math.round(principal * JUROS_POR_PARCELA * parcelas) : 0;
  const total = principal + juros;

  const acordo = await db.acordo.create({
    data: {
      escritorioId: carteira.escritorioId,
      devedorId,
      valorTotalCentavos: total,
      jurosEmbutidosCentavos: juros,
      parcelas,
      origem,
      custoTotalAceitoEm: new Date(`${hoje}T12:00:00Z`), // o devedor viu o custo total
      titulos: { create: titulos.map((t) => ({ tituloId: t.id })) },
    },
  });
  for (const titulo of titulos) {
    await db.titulo.update({ where: { id: titulo.id }, data: { estado: 'acordo' } });
    await auditar(carteira.escritorioId, 'titulo', titulo.id, titulo.estado, 'acordo', 'devedor',
      `acordo ${acordo.id} em ${parcelas}x — custo total mostrado antes do aceite`);
  }
  // Ações futuras do título em acordo deixam de fazer sentido.
  await db.acaoCobranca.updateMany({
    where: { tituloId: { in: titulos.map((t) => t.id) }, estado: 'agendada' },
    data: { estado: 'cancelada', resultado: 'acordo aceito no espaço do devedor' },
  });
  // A primeira parcela vence em 7 dias (boleto/Pix na conta do credor ou do
  // escritório — a Sentinella não toca no dinheiro).
  await db.promessa.create({
    data: {
      escritorioId: carteira.escritorioId, devedorId, tituloId: titulos[0].id,
      para: deIso(hoje) /* registrada no aceite */, cumprida: true, origem: origem === 'portal' ? 'portal' : 'ligação',
    },
  }).catch(() => {});
  return { acordoId: acordo.id, custoTotalCentavos: total };
}
