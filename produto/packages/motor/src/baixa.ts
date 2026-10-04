// Baixa de pagamentos por importação (Fase 2 — §10.2), agora por CARTEIRA.
// Cada pagamento: título → pago (com auditoria), ações futuras canceladas,
// promessas do título avaliadas (pagar até a data combinada cumpre) e
// "pagamento informado" pelo espaço do devedor marcado como conferido.
// O dinheiro em si NUNCA passa pela Sentinella: a baixa espelha o extrato da
// conta do credor ou do escritório (arquivo de retorno / planilha).

import { readFileSync } from 'node:fs';
import { db, auditar } from '@sentinella/db';
import { lerPlanilha, reaisParaCentavos, dataParaIso } from './planilhas';
import { deIso, paraIso, difDias } from './datas';
import type { RelatorioImportacao } from './importar';

export interface Pagamento {
  numeroTitulo: string;
  dataIso: string;
  valorCentavos: number | null; // null = valor do título
}

export interface ResultadoBaixa {
  baixados: number;
  jaPagos: number;
  naoEncontrados: string[];
  promessasCumpridas: number;
  promessasFalhas: number;
  acoesCanceladas: number;
}

export async function aplicarPagamentos(
  carteiraId: string,
  pagamentos: Pagamento[],
): Promise<ResultadoBaixa> {
  const carteira = await db.carteira.findUnique({ where: { id: carteiraId } });
  if (!carteira) throw new Error(`carteira ${carteiraId} não cadastrada`);

  const resultado: ResultadoBaixa = {
    baixados: 0, jaPagos: 0, naoEncontrados: [],
    promessasCumpridas: 0, promessasFalhas: 0, acoesCanceladas: 0,
  };

  for (const p of pagamentos) {
    const titulo = await db.titulo.findUnique({
      where: { carteiraId_numero: { carteiraId, numero: p.numeroTitulo } },
    });
    if (!titulo) {
      resultado.naoEncontrados.push(p.numeroTitulo);
      continue;
    }
    if (titulo.estado === 'pago') {
      resultado.jaPagos++;
      continue;
    }

    await db.titulo.update({
      where: { id: titulo.id },
      data: {
        estado: 'pago',
        pagoEm: deIso(p.dataIso),
        valorPagoCentavos: p.valorCentavos ?? titulo.valorCentavos,
      },
    });
    await auditar(carteira.escritorioId, 'titulo', titulo.id, titulo.estado, 'pago', 'sistema',
      `baixa por importação — pagamento em ${p.dataIso} na ${carteira.contaEmissora}`);
    resultado.baixados++;

    // Ações ainda não executadas deixam de fazer sentido.
    const pendentes = await db.acaoCobranca.findMany({
      where: { tituloId: titulo.id, estado: { in: ['agendada', 'pendente', 'em andamento'] } },
      select: { id: true, estado: true },
    });
    for (const a of pendentes) {
      await db.acaoCobranca.update({
        where: { id: a.id },
        data: { estado: 'cancelada', resultado: 'título pago — baixa por importação' },
      });
      await auditar(carteira.escritorioId, 'acao', a.id, a.estado, 'cancelada', 'sistema', 'título pago');
    }
    resultado.acoesCanceladas += pendentes.length;

    // Promessas em aberto: pagar até a data combinada (1 dia de tolerância
    // de compensação) cumpre a promessa.
    const promessas = await db.promessa.findMany({
      where: { tituloId: titulo.id, cumprida: null },
    });
    for (const promessa of promessas) {
      const cumprida = difDias(paraIso(promessa.para), p.dataIso) >= -1;
      await db.promessa.update({ where: { id: promessa.id }, data: { cumprida } });
      if (cumprida) resultado.promessasCumpridas++;
      else resultado.promessasFalhas++;
    }

    await db.pagamentoInformado.updateMany({
      where: { tituloId: titulo.id, conferido: false },
      data: { conferido: true },
    });
  }
  return resultado;
}

export async function importarPagamentos(
  carteiraId: string,
  caminho: string,
): Promise<{ relatorio: RelatorioImportacao; baixa: ResultadoBaixa }> {
  const plan = lerPlanilha(readFileSync(caminho, 'utf8'));
  const relatorio: RelatorioImportacao = {
    arquivo: caminho, processadas: 0, criadas: 0, atualizadas: 0,
    ignoradas: 0, descartesTerceiro: 0, erros: [],
  };
  const pagamentos: Pagamento[] = [];

  for (const { numero: linha, campos } of plan.linhas) {
    relatorio.processadas++;
    const numeroTitulo = (campos.numero_titulo ?? campos.numero ?? '').trim();
    if (!numeroTitulo) {
      relatorio.erros.push({ linha, motivo: 'número do título vazio' });
      continue;
    }
    const dataIso = dataParaIso(campos.data_pagamento ?? campos.data ?? '');
    if (!dataIso) {
      relatorio.erros.push({ linha, motivo: `data de pagamento inválida: "${campos.data_pagamento ?? ''}"` });
      continue;
    }
    let valorCentavos: number | null = null;
    if ((campos.valor_pago ?? '').trim()) {
      valorCentavos = reaisParaCentavos(campos.valor_pago);
      if (valorCentavos == null || valorCentavos <= 0) {
        relatorio.erros.push({ linha, motivo: `valor pago inválido: "${campos.valor_pago}"` });
        continue;
      }
    }
    pagamentos.push({ numeroTitulo, dataIso, valorCentavos });
  }

  const baixa = await aplicarPagamentos(carteiraId, pagamentos);
  relatorio.atualizadas = baixa.baixados;
  relatorio.ignoradas = baixa.jaPagos;
  for (const numero of baixa.naoEncontrados)
    relatorio.erros.push({ linha: 0, motivo: `título ${numero} não encontrado na carteira` });
  return { relatorio, baixa };
}
