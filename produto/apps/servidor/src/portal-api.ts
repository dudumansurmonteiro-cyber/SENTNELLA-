// A API do portal do lojista (§7.3), persistente sobre o banco (Fase 2).
// Regras: acordo dentro da alçada é aprovado na hora; fora dela vira exceção
// para o analista; contestação marca o título e avisa; pagamento informado
// pausa a cobrança até a conferência; tudo com trilha de auditoria (§8).
// O lojista nunca vê rating nem dados de outros lojistas.

import { db, auditar } from '@sentinella/db';
import type { Cliente, Lojista, Titulo } from '@sentinella/db';
import { calcularEncargos, paraIso, diasDeAtrasoEm, hojeReal, slaDoPlano } from '@sentinella/motor';
import { moeda, dataBr } from '@sentinella/dados';

export interface RespostaRota {
  status: number;
  corpo: unknown;
  tipo?: 'json' | 'html';
}

const reais = (c: number) => Math.round(c) / 100;

async function porToken(token: string) {
  if (!token || token.length < 6) return null;
  return db.lojista.findUnique({ where: { token }, include: { cliente: true } });
}

async function entradaDoPortal(lojista: Lojista & { cliente: Cliente }) {
  const hoje = hojeReal();
  const cliente = lojista.cliente;
  const titulos = await db.titulo.findMany({
    where: { lojistaId: lojista.id },
    orderBy: { vencimento: 'asc' },
  });
  const abertos = titulos.filter((t) => !['pago', 'cancelado'].includes(t.estado));
  const acordos = await db.acordo.findMany({ where: { lojistaId: lojista.id }, orderBy: { id: 'asc' } });

  return {
    lojista: { nome: lojista.nome, cnpj: lojista.cnpj, contatoNome: lojista.contatoNome },
    industria: {
      nome: cliente.nome,
      canais: cliente.canais,
      temMultaCadastrada: cliente.multaPct != null,
      pixChave: cliente.pixChave,
      alcada: {
        descontoMaxPct: cliente.alcadaDescontoMaxPct,
        parcelasMax: cliente.alcadaParcelasMax,
        prazoMaxDias: cliente.alcadaPrazoMaxDias,
      },
    },
    titulosAbertos: abertos.map((t) => {
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
    }),
    titulosPagos: titulos
      .filter((t) => t.estado === 'pago')
      .slice(-5)
      .map((t) => ({ numero: t.numero, valor: reais(t.valorCentavos), pagoEm: paraIso(t.pagoEm!) })),
    acordos: acordos.map((a) => ({
      valorTotal: reais(a.valorTotalCentavos),
      parcelas: a.parcelas,
      parcelasPagas: a.parcelasPagas,
      status: a.status,
    })),
  };
}

async function tituloDoLojista(lojistaId: string, numero: string) {
  if (!numero) return null;
  const titulo = await db.titulo.findFirst({ where: { lojistaId, numero } });
  return titulo;
}

async function registrarFala(lojista: Lojista, tituloId: string | null, texto: string) {
  await db.mensagem.create({
    data: {
      clienteId: lojista.clienteId, lojistaId: lojista.id, tituloId,
      canal: 'portal', de: 'lojista', texto,
    },
  });
}

// ---------------------------------------------------------------- ações ----

export async function proporAcordo(
  lojista: Lojista & { cliente: Cliente },
  numero: string,
  parcelas: number,
): Promise<RespostaRota> {
  const cliente = lojista.cliente;
  const titulo = await tituloDoLojista(lojista.id, numero);
  if (!titulo) return { status: 404, corpo: { erro: 'título não encontrado' } };
  if (!['vencido', 'em negociação', 'a vencer'].includes(titulo.estado))
    return { status: 409, corpo: { erro: `este título está "${titulo.estado}" e não aceita proposta agora` } };
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48)
    return { status: 400, corpo: { erro: 'número de parcelas inválido' } };

  await registrarFala(lojista, titulo.id, `Proposta de acordo pelo portal: título ${numero} em ${parcelas}x.`);

  const dentroDaAlcada =
    parcelas <= cliente.alcadaParcelasMax &&
    titulo.valorCentavos < cliente.alcadaValorSempreAnalista;

  if (dentroDaAlcada) {
    const acordo = await db.acordo.create({
      data: {
        clienteId: cliente.id, lojistaId: lojista.id,
        valorTotalCentavos: titulo.valorCentavos, parcelas, origem: 'portal',
        titulos: { create: [{ tituloId: titulo.id }] },
      },
    });
    await db.titulo.update({ where: { id: titulo.id }, data: { estado: 'acordo' } });
    await auditar(cliente.id, 'titulo', titulo.id, titulo.estado, 'acordo', 'lojista',
      `acordo em ${parcelas}x pelo portal — dentro da alçada, aprovado na hora`);
    await auditar(cliente.id, 'acordo', acordo.id, null, 'em dia', 'IA', 'aprovado automaticamente (alçada)');
    return {
      status: 200,
      corpo: {
        aprovado: true,
        mensagem: `Acordo do título ${numero} em ${parcelas}x aprovado na hora — está dentro da alçada combinada com a indústria. A 1ª parcela chega pelos canais de sempre.`,
      },
    };
  }

  const porParcelas = parcelas > cliente.alcadaParcelasMax;
  const excecao = await db.excecao.create({
    data: {
      clienteId: cliente.id, lojistaId: lojista.id, tituloId: titulo.id,
      motivo: porParcelas
        ? 'Pedido de acordo fora da alçada'
        : 'Título acima do valor-limite do cliente',
      slaMin: slaDoPlano(cliente.plano),
      valorEnvolvidoCentavos: titulo.valorCentavos,
    },
  });
  if (titulo.estado === 'vencido') {
    await db.titulo.update({ where: { id: titulo.id }, data: { estado: 'em negociação' } });
    await auditar(cliente.id, 'titulo', titulo.id, 'vencido', 'em negociação', 'IA', 'proposta fora da alçada');
  }
  await auditar(cliente.id, 'excecao', excecao.id, null, 'aberta', 'IA', `proposta de ${parcelas}x pelo portal`);
  return {
    status: 200,
    corpo: {
      aprovado: false,
      mensagem: porParcelas
        ? `Parcelamento em ${parcelas}x passa da alçada. A proposta foi para um analista da central humana — retorno dentro do horário de atendimento (8h às 22h).`
        : `Para um título deste valor, a proposta sempre passa por uma pessoa. Um analista da central humana já recebeu o seu pedido de ${parcelas}x — retorno dentro do horário de atendimento (8h às 22h).`,
    },
  };
}

export async function informarPagamento(
  lojista: Lojista & { cliente: Cliente },
  numero: string,
  observacao: string,
): Promise<RespostaRota> {
  const titulo = await tituloDoLojista(lojista.id, numero);
  if (!titulo) return { status: 404, corpo: { erro: 'título não encontrado' } };
  if (titulo.estado === 'pago')
    return { status: 200, corpo: { mensagem: `O título ${numero} já consta como pago.` } };

  await db.pagamentoInformado.create({
    data: {
      clienteId: lojista.clienteId, lojistaId: lojista.id, tituloId: titulo.id,
      observacao: observacao?.slice(0, 500) || null,
    },
  });
  const pausadas = await db.acaoCobranca.updateMany({
    where: { tituloId: titulo.id, estado: 'agendada' },
    data: { estado: 'pendente', resultado: 'pagamento informado pelo lojista — aguardando conferência' },
  });
  await auditar(lojista.clienteId, 'titulo', titulo.id, titulo.estado, titulo.estado, 'lojista',
    `pagamento informado pelo portal — cobrança pausada (${pausadas.count} ação(ões)) até a conferência`);
  await registrarFala(lojista, titulo.id, `Pagamento informado pelo portal para o título ${numero}.`);
  return {
    status: 200,
    corpo: {
      mensagem: `Pagamento informado para ${numero}. A cobrança fica pausada até a conferência na próxima baixa — se puder, guarde o comprovante.`,
    },
  };
}

export async function contestarTitulo(
  lojista: Lojista & { cliente: Cliente },
  numero: string,
  motivo: string,
): Promise<RespostaRota> {
  const motivosValidos = [
    'Entrega incompleta ou errada',
    'Produto com defeito',
    'Valor diferente do combinado',
  ];
  if (!motivosValidos.includes(motivo))
    return { status: 400, corpo: { erro: 'motivo de contestação inválido' } };
  const titulo = await tituloDoLojista(lojista.id, numero);
  if (!titulo) return { status: 404, corpo: { erro: 'título não encontrado' } };
  if (['pago', 'cancelado', 'contestado'].includes(titulo.estado))
    return { status: 409, corpo: { erro: `este título está "${titulo.estado}"` } };

  await db.titulo.update({ where: { id: titulo.id }, data: { estado: 'contestado' } });
  const canceladas = await db.acaoCobranca.updateMany({
    where: { tituloId: titulo.id, estado: { in: ['agendada', 'pendente'] } },
    data: { estado: 'cancelada', resultado: 'título contestado — cobrança pausada' },
  });
  const excecao = await db.excecao.create({
    data: {
      clienteId: lojista.clienteId, lojistaId: lojista.id, tituloId: titulo.id,
      motivo: `Contestação — ${motivo.toLowerCase()}`,
      slaMin: slaDoPlano(lojista.cliente.plano),
      valorEnvolvidoCentavos: titulo.valorCentavos,
    },
  });
  await auditar(lojista.clienteId, 'titulo', titulo.id, titulo.estado, 'contestado', 'lojista', motivo);
  await auditar(lojista.clienteId, 'excecao', excecao.id, null, 'aberta', 'IA',
    'contestação pelo portal — representante comercial avisado');
  await registrarFala(lojista, titulo.id, `Contestação pelo portal (${motivo}) para o título ${numero}.`);
  return {
    status: 200,
    corpo: {
      mensagem: `Contestação registrada (“${motivo}”). O título ${numero} foi marcado como contestado, a cobrança foi pausada (${canceladas.count} ação(ões)) e o representante comercial foi avisado. Um analista acompanha o caso.`,
    },
  };
}

export async function falarComPessoa(
  lojista: Lojista & { cliente: Cliente },
): Promise<RespostaRota> {
  const maiorAberto = await db.titulo.findFirst({
    where: { lojistaId: lojista.id, estado: { in: ['vencido', 'em negociação', 'a vencer'] } },
    orderBy: { valorCentavos: 'desc' },
  });
  const excecao = await db.excecao.create({
    data: {
      clienteId: lojista.clienteId, lojistaId: lojista.id,
      tituloId: maiorAberto?.id ?? null,
      motivo: 'Lojista pediu para falar com pessoa',
      slaMin: slaDoPlano(lojista.cliente.plano),
      valorEnvolvidoCentavos: maiorAberto?.valorCentavos ?? 0,
    },
  });
  await auditar(lojista.clienteId, 'excecao', excecao.id, null, 'aberta', 'IA', 'pedido pelo portal');
  await registrarFala(lojista, maiorAberto?.id ?? null, 'Pedido pelo portal: falar com uma pessoa.');
  return {
    status: 200,
    corpo: {
      mensagem: 'Pedido registrado: uma pessoa da central assume esta conversa. Atendimento humano das 8h às 22h.',
    },
  };
}

// 2ª via imprimível do título, com os encargos do dia — sempre a partir do
// cadastro (§12): sem multa cadastrada, nada de multa. A linha digitável do
// boleto é emitida pelo banco do cliente (integração na Fase 3), e a chave
// Pix só aparece se estiver cadastrada.
export async function segundaVia(
  lojista: Lojista & { cliente: Cliente },
  numero: string,
): Promise<RespostaRota> {
  const titulo = await tituloDoLojista(lojista.id, numero);
  if (!titulo) return { status: 404, corpo: '<p lang="pt-BR">Título não encontrado.</p>', tipo: 'html' };
  const cliente = lojista.cliente;
  const hoje = hojeReal();
  const vencimentoIso = paraIso(titulo.vencimento);
  const diasAtraso = diasDeAtrasoEm(vencimentoIso, hoje);
  const enc = calcularEncargos(titulo.valorCentavos, diasAtraso, cliente.multaPct, cliente.jurosMesPct);
  const ficticia = cliente.nome.includes('(fictícia)');
  const nomeIndustria = cliente.nome.replace(' (fictícia)', '');

  await registrarFala(lojista, titulo.id, `2ª via do título ${numero} emitida pelo portal.`);
  await auditar(cliente.id, 'titulo', titulo.id, titulo.estado, titulo.estado, 'lojista', '2ª via emitida pelo portal');

  const linhaEncargos =
    enc.multaCentavos != null && enc.jurosCentavos != null
      ? `<tr><td>Multa (${cliente.multaPct}%)</td><td class="num">${moeda(reais(enc.multaCentavos))}</td></tr>
         <tr><td>Juros (${cliente.jurosMesPct}% a.m., ${diasAtraso} dia(s))</td><td class="num">${moeda(reais(enc.jurosCentavos))}</td></tr>`
      : '';
  const pix = cliente.pixChave
    ? `<p><strong>Pix:</strong> <code>${cliente.pixChave}</code></p>`
    : `<p class="suave">Chave Pix: não cadastrada pela indústria — em definição.</p>`;

  const corpo = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>2ª via — ${numero}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#14211F;background:#F4F6F5;margin:0;padding:24px;}
  .folha{max-width:640px;margin:0 auto;background:#fff;border:1px solid #C6CFCB;border-radius:8px;padding:28px;}
  h1{font-size:18px;margin:0 0 2px;} .suave{color:#5a6a66;font-size:13px;}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;}
  td{padding:6px 0;border-bottom:1px solid #e3e8e6;} .num{text-align:right;font-variant-numeric:tabular-nums;}
  .total td{font-weight:700;border-bottom:none;padding-top:10px;}
  .chip{display:inline-block;border:1px solid #C6CFCB;border-radius:99px;padding:1px 10px;font-size:12px;margin-left:8px;}
  .aviso{font-size:12.5px;color:#5a6a66;border-top:1px solid #e3e8e6;padding-top:12px;margin-top:16px;}
  button{background:#0E4A45;color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:14px;cursor:pointer;}
  @media print{button{display:none} body{background:#fff;padding:0} .folha{border:none}}
</style></head><body><div class="folha">
  <h1>2ª via de cobrança${ficticia ? '<span class="chip">demonstração</span>' : ''}</h1>
  <p class="suave">${nomeIndustria} · emitida em ${dataBr(hoje)} pelo espaço do lojista</p>
  <p style="margin-top:14px"><strong>${lojista.nome}</strong><br><span class="suave">CNPJ ${ficticia ? 'fictício ' : ''}${lojista.cnpj}</span></p>
  <table>
    <tr><td>Título</td><td class="num">${numero}</td></tr>
    <tr><td>Vencimento original</td><td class="num">${dataBr(vencimentoIso)}</td></tr>
    ${diasAtraso > 0 ? `<tr><td>Dias de atraso</td><td class="num">${diasAtraso}</td></tr>` : ''}
    <tr><td>Valor original</td><td class="num">${moeda(reais(titulo.valorCentavos))}</td></tr>
    ${linhaEncargos}
    <tr class="total"><td>Total para pagamento hoje</td><td class="num">${moeda(reais(enc.totalCentavos))}</td></tr>
  </table>
  ${pix}
  <p class="suave">Boleto bancário: a linha digitável é emitida pelo banco de ${nomeIndustria} — integração bancária em definição (entra na Fase 3).</p>
  <button onclick="window.print()">Imprimir ou salvar em PDF</button>
  <p class="aviso">Documento informativo com os encargos calculados exatamente como no contrato entre ${nomeIndustria} e o lojista. Dúvidas ou divergências: responda pelo espaço do lojista e uma pessoa da central atende você (8h às 22h). Operado pela Sentinella Recebíveis.</p>
</div></body></html>`;
  return { status: 200, corpo, tipo: 'html' };
}

// ------------------------------------------------------------- roteador ----

export async function rotasPortal(
  token: string,
  acao: string,
  metodo: string,
  corpo: Record<string, unknown>,
  parametros: URLSearchParams,
): Promise<RespostaRota & { tipo: 'json' | 'html' }> {
  const lojista = await porToken(token);
  if (!lojista)
    return { status: 404, corpo: { erro: 'link não encontrado ou expirado' }, tipo: 'json' };

  if (metodo === 'GET' && !acao)
    return { status: 200, corpo: await entradaDoPortal(lojista), tipo: 'json' };
  if (metodo === 'GET' && acao === 'segunda-via') {
    const r = await segundaVia(lojista, parametros.get('numero') ?? '');
    return { ...r, tipo: 'html' };
  }
  if (metodo !== 'POST')
    return { status: 405, corpo: { erro: 'método não permitido' }, tipo: 'json' };

  const numero = String(corpo.numero ?? '');
  switch (acao) {
    case 'acordo':
      return { ...(await proporAcordo(lojista, numero, Number(corpo.parcelas))), tipo: 'json' };
    case 'pagamento':
      return { ...(await informarPagamento(lojista, numero, String(corpo.observacao ?? ''))), tipo: 'json' };
    case 'contestacao':
      return { ...(await contestarTitulo(lojista, numero, String(corpo.motivo ?? ''))), tipo: 'json' };
    case 'pessoa':
      return { ...(await falarComPessoa(lojista)), tipo: 'json' };
    default:
      return { status: 404, corpo: { erro: 'ação desconhecida' }, tipo: 'json' };
  }
}
