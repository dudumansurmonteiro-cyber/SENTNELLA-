// A API do espaço do devedor (§6.4), persistente sobre o banco (Fase 2).
// Tudo em nome do escritório (white label): o devedor entra por link com
// token, vê o credor original e quem cobra, e pode — com efeito real:
//  - aceitar acordo dentro da alçada, SEMPRE vendo o custo total antes
//    (Lei 14.181; o aceite grava custoTotalAceitoEm);
//  - contestar um título: a cobrança PAUSA na hora e abre exceção (§3);
//  - informar pagamento: a régua pausa até a conferência da baixa;
//  - pedir para não ser contatado por um canal: a régua respeita e o caso
//    vai ao analista decidir o próximo passo (§3);
//  - pedir para falar com uma pessoa (8h–22h).
// Rating NUNCA aparece aqui. Encargos só quando a carteira os cadastra.

import { db, auditar } from '@sentinella/db';
import type { Carteira, Credor, Devedor, Escritorio, Titulo } from '@sentinella/db';
import {
  aceitarAcordo, calcularEncargos, calcularSimulacoes,
  diasDeAtrasoEm, hojeReal, paraIso, slaDoPlano,
} from '@sentinella/motor';
import type { EntradaPortalDevedor, EstadoTitulo } from '@sentinella/dados';

export interface RespostaRota {
  status: number;
  corpo: unknown;
}

const reais = (c: number) => Math.round(c) / 100;
const moedaBr = (c: number) =>
  (Math.round(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Canais que o devedor gerencia nas preferências (carta entra na Fase 3).
const CANAIS_PREFERENCIA = ['WhatsApp', 'SMS', 'e-mail', 'ligação'];
// Estados que ainda aceitam acordo pelo espaço do devedor: contestado está
// em análise, judicial saiu da régua extrajudicial, acordo já tem acordo.
const ESTADOS_NEGOCIAVEIS = ['em cobrança', 'negativado', 'protestado'];
const ENCERRADOS = ['pago', 'cancelado'];

type DevedorCompleto = Devedor & {
  escritorio: Escritorio;
  credor: Credor;
  carteira: Carteira;
};

async function porToken(token: string): Promise<DevedorCompleto | null> {
  if (!token || token.length < 6 || token.length > 40) return null;
  return db.devedor.findUnique({
    where: { token },
    include: { escritorio: true, credor: true, carteira: true },
  });
}

const atualizado = (t: Titulo, carteira: Carteira, hoje: string) =>
  calcularEncargos(
    t.valorCentavos,
    diasDeAtrasoEm(paraIso(t.vencimento), hoje),
    carteira.multaPct,
    carteira.jurosMesPct,
  );

// Toda fala do devedor pelo portal fica na conversa, com a marca ativa (§7).
async function registrarFala(d: DevedorCompleto, tituloId: string | null, texto: string) {
  await db.mensagem.create({
    data: {
      escritorioId: d.escritorioId, devedorId: d.id, tituloId,
      canal: 'portal', de: 'devedor', texto, entrega: 'enviada',
      marcaAtiva: d.escritorio.marcaNome,
    },
  });
}

async function abrirExcecao(
  d: DevedorCompleto,
  tituloId: string | null,
  motivo: string,
  valorCentavos: number,
) {
  const excecao = await db.excecao.create({
    data: {
      escritorioId: d.escritorioId, devedorId: d.id, tituloId,
      motivo, slaMin: slaDoPlano(d.escritorio.plano),
      valorEnvolvidoCentavos: valorCentavos,
    },
  });
  await auditar(d.escritorioId, 'excecao', excecao.id, null, 'aberta', 'devedor', motivo);
  return excecao;
}

async function tituloDoDevedor(d: DevedorCompleto, numero: string) {
  if (!numero) return null;
  return db.titulo.findFirst({ where: { devedorId: d.id, numero } });
}

// ------------------------------------------------- entrada (GET, viva) ----

export async function entradaDoDevedor(d: DevedorCompleto): Promise<EntradaPortalDevedor> {
  const hoje = hojeReal();
  const { escritorio, credor, carteira } = d;
  const titulos = await db.titulo.findMany({
    where: { devedorId: d.id },
    orderBy: { vencimento: 'asc' },
  });
  const abertos = titulos.filter((t) => !ENCERRADOS.includes(t.estado));
  const negociaveis = abertos.filter((t) => ESTADOS_NEGOCIAVEIS.includes(t.estado));
  const acordos = await db.acordo.findMany({
    where: { devedorId: d.id },
    orderBy: { criadoEm: 'asc' },
  });
  const totalNegociavelCentavos = negociaveis.reduce(
    (s, t) => s + atualizado(t, carteira, hoje).totalCentavos, 0,
  );

  return {
    devedor: { nome: d.nome, doc: d.documento, tipo: d.tipo as 'PF' | 'PJ' },
    escritorio: {
      nomeExibicao: escritorio.marcaNome,
      oab: escritorio.oab,
      corPrimaria: escritorio.corPrimaria,
      corClara: escritorio.corClara,
      mostrarOperadora: escritorio.mostrarOperadora,
      contato: `atendimento@${(escritorio.marcaIniciais || 'escritorio').toLowerCase()}.exemplo.invalid`,
    },
    credorOriginal: credor.nome,
    titulosAbertos: abertos.map((t) => {
      const enc = atualizado(t, carteira, hoje);
      return {
        numero: t.numero,
        credor: credor.nome,
        valorOriginal: reais(t.valorCentavos),
        encargos: carteira.multaPct == null ? null : reais(enc.totalCentavos - t.valorCentavos),
        valorAtualizado: reais(enc.totalCentavos),
        vencimentoOriginal: paraIso(t.vencimento),
        estado: t.estado as EstadoTitulo,
      };
    }),
    titulosPagos: titulos
      .filter((t) => t.estado === 'pago')
      .slice(-6)
      .map((t) => ({
        numero: t.numero,
        valor: reais(t.valorPagoCentavos ?? t.valorCentavos),
        pagoEm: t.pagoEm ? paraIso(t.pagoEm) : hoje,
      })),
    acordos: acordos.map((a) => ({
      valorTotal: reais(a.valorTotalCentavos),
      parcelas: a.parcelas,
      parcelasPagas: a.parcelasPagas,
      status: a.status,
    })),
    alcada: { parcelasMax: carteira.parcelasMax, descontoMaxPct: carteira.descontoMaxPct },
    // Simulações sobre o que ainda cabe em acordo, com o custo total — a
    // MESMA base que o aceite usa, então o número mostrado é o número aceito.
    simulacoes: calcularSimulacoes(carteira, totalNegociavelCentavos).map((s) => ({
      parcelas: s.parcelas,
      valorParcela: reais(s.valorParcelaCentavos),
      custoTotal: reais(s.custoTotalCentavos),
      jurosEmbutidos: reais(s.jurosEmbutidosCentavos),
    })),
    canaisBloqueados: d.canaisBloqueados,
  };
}

// --------------------------------------------------------------- ações ----

export async function acordoPeloPortal(
  d: DevedorCompleto,
  parcelas: number,
): Promise<RespostaRota> {
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48)
    return { status: 400, corpo: { erro: 'número de parcelas inválido' } };
  const hoje = hojeReal();
  const negociaveis = (await db.titulo.findMany({
    where: { devedorId: d.id }, orderBy: { vencimento: 'asc' },
  })).filter((t) => ESTADOS_NEGOCIAVEIS.includes(t.estado));
  if (!negociaveis.length)
    return { status: 409, corpo: { erro: 'nenhum título em aberto aceita acordo agora' } };

  await registrarFala(d, negociaveis[0].id, `Proposta de acordo pelo espaço do devedor: ${parcelas}x.`);

  if (parcelas > d.carteira.parcelasMax) {
    const valor = negociaveis.reduce((s, t) => s + t.valorCentavos, 0);
    await abrirExcecao(d, negociaveis[0].id, 'Pedido de acordo fora da alçada', valor);
    return {
      status: 200,
      corpo: {
        aprovado: false,
        mensagem: `Parcelamento em ${parcelas}x passa da alçada desta carteira (até ${d.carteira.parcelasMax}x). A proposta foi para o escritório decidir — você recebe o retorno pelos seus canais, no horário de atendimento (8h às 22h).`,
      },
    };
  }

  const r = await aceitarAcordo({
    devedorId: d.id, titulos: negociaveis, parcelas, origem: 'portal', hoje,
  });
  if ('erro' in r) return { status: 409, corpo: { erro: r.erro } };
  return {
    status: 200,
    corpo: {
      aprovado: true,
      custoTotal: reais(r.custoTotalCentavos),
      mensagem: `Acordo em ${parcelas}x aceito — custo total de ${moedaBr(r.custoTotalCentavos)}, exatamente o que você viu antes de aceitar. A 1ª parcela chega por boleto/Pix emitido na conta do credor ou do escritório.`,
    },
  };
}

export async function informarPagamento(
  d: DevedorCompleto,
  numero: string,
  observacao: string,
): Promise<RespostaRota> {
  const titulo = await tituloDoDevedor(d, numero);
  if (!titulo) return { status: 404, corpo: { erro: 'título não encontrado' } };
  if (titulo.estado === 'pago')
    return { status: 200, corpo: { mensagem: `O título ${numero} já consta como pago — tudo certo.` } };

  await db.pagamentoInformado.create({
    data: {
      escritorioId: d.escritorioId, devedorId: d.id, tituloId: titulo.id,
      observacao: observacao?.trim().slice(0, 500) || null,
    },
  });
  const pausadas = await db.acaoCobranca.updateMany({
    where: { tituloId: titulo.id, estado: 'agendada' },
    data: { estado: 'pendente', resultado: 'pagamento informado pelo devedor — aguardando conferência' },
  });
  await auditar(d.escritorioId, 'titulo', titulo.id, titulo.estado, titulo.estado, 'devedor',
    `pagamento informado pelo espaço do devedor — cobrança pausada (${pausadas.count} ação(ões)) até a conferência`);
  await registrarFala(d, titulo.id, `Pagamento informado pelo espaço do devedor para o título ${numero}.`);
  return {
    status: 200,
    corpo: {
      mensagem: `Pagamento informado para o título ${numero}. A cobrança fica pausada até a conferência — se puder, guarde o comprovante.`,
    },
  };
}

export async function contestarTitulo(
  d: DevedorCompleto,
  numero: string,
  motivo: string,
): Promise<RespostaRota> {
  const texto = (motivo ?? '').trim().slice(0, 400);
  if (!texto) return { status: 400, corpo: { erro: 'conte em uma frase o que está errado' } };
  const titulo = await tituloDoDevedor(d, numero);
  if (!titulo) return { status: 404, corpo: { erro: 'título não encontrado' } };
  if (['pago', 'cancelado', 'contestado', 'judicial'].includes(titulo.estado))
    return { status: 409, corpo: { erro: `este título está "${titulo.estado}" e não muda por aqui` } };

  await db.titulo.update({
    where: { id: titulo.id },
    data: { estado: 'contestado', contestadoEm: new Date(), contestacaoMotivo: texto },
  });
  // §3: título contestado PARA — nada agendado ou em andamento continua, e
  // nunca negativar sem decisão do escritório.
  const canceladas = await db.acaoCobranca.updateMany({
    where: { tituloId: titulo.id, estado: { in: ['agendada', 'pendente', 'em andamento'] } },
    data: { estado: 'cancelada', resultado: 'título contestado — cobrança pausada' },
  });
  await abrirExcecao(d, titulo.id, `Contestação de dívida — ${texto.slice(0, 120)}`, titulo.valorCentavos);
  await auditar(d.escritorioId, 'titulo', titulo.id, titulo.estado, 'contestado', 'devedor', texto);
  await registrarFala(d, titulo.id, `Contestação pelo espaço do devedor (título ${numero}): ${texto}`);
  return {
    status: 200,
    corpo: {
      mensagem: `Contestação registrada. O título ${numero} entrou em análise, a cobrança dele foi pausada (${canceladas.count} ação(ões)) e o escritório vai responder. Nenhuma medida como negativação sai enquanto a análise não termina.`,
    },
  };
}

export async function preferenciasDeContato(
  d: DevedorCompleto,
  aceitos: unknown,
): Promise<RespostaRota> {
  const lista = Array.isArray(aceitos) ? aceitos.map(String) : null;
  if (!lista || lista.some((c) => !CANAIS_PREFERENCIA.includes(c)))
    return { status: 400, corpo: { erro: 'canais inválidos' } };

  const bloqueadosAgora = CANAIS_PREFERENCIA.filter((c) => !lista.includes(c));
  // Bloqueios fora da lista gerenciável (ex.: carta, na Fase 3) ficam como estão.
  const preservados = d.canaisBloqueados.filter((c) => !CANAIS_PREFERENCIA.includes(c));
  const novaLista = [...preservados, ...bloqueadosAgora];
  const novos = bloqueadosAgora.filter((c) => !d.canaisBloqueados.includes(c));

  await db.devedor.update({ where: { id: d.id }, data: { canaisBloqueados: novaLista } });
  await auditar(d.escritorioId, 'devedor', d.id,
    d.canaisBloqueados.join(', ') || 'nenhum bloqueio',
    novaLista.join(', ') || 'nenhum bloqueio',
    'devedor', 'preferências de contato pelo espaço do devedor');
  if (novos.length) {
    // §3: canal bloqueado → o caso vai ao analista definir o próximo passo.
    const maior = await db.titulo.findFirst({
      where: { devedorId: d.id, estado: { notIn: ENCERRADOS } },
      orderBy: { valorCentavos: 'desc' },
    });
    await abrirExcecao(d, maior?.id ?? null,
      `Pedido de não contato por ${novos.join(' e ')}`, maior?.valorCentavos ?? 0);
  }
  await registrarFala(d, null,
    `Preferências de contato: aceita ${lista.join(', ') || 'nenhum canal'};` +
    ` bloqueia ${bloqueadosAgora.join(', ') || 'nenhum'}.`);
  return {
    status: 200,
    corpo: {
      mensagem: bloqueadosAgora.length
        ? `Preferências registradas — ${bloqueadosAgora.join(' e ')} fora dos próximos contatos, a partir de agora. Uma pessoa do escritório confirma o melhor canal com você.`
        : 'Preferências registradas — todos os canais liberados.',
    },
  };
}

export async function falarComPessoa(
  d: DevedorCompleto,
  mensagem: string,
): Promise<RespostaRota> {
  const texto = (mensagem ?? '').trim().slice(0, 400);
  const maior = await db.titulo.findFirst({
    where: { devedorId: d.id, estado: { notIn: ENCERRADOS } },
    orderBy: { valorCentavos: 'desc' },
  });
  await abrirExcecao(d, maior?.id ?? null, 'Devedor pediu para falar com uma pessoa',
    maior?.valorCentavos ?? 0);
  await registrarFala(d, maior?.id ?? null,
    texto ? `Pedido de atendimento humano: ${texto}` : 'Pedido pelo espaço do devedor: falar com uma pessoa.');
  return {
    status: 200,
    corpo: {
      mensagem: 'Pedido registrado: uma pessoa responde em nome do escritório pelo seu canal preferido, das 8h às 22h. Se você estiver em situação difícil, diga — há tratamento adequado previsto em lei.',
    },
  };
}

// ------------------------------------------------------------ roteador ----

export async function rotasDevedor(
  token: string,
  acao: string,
  metodo: string,
  corpo: Record<string, unknown>,
): Promise<RespostaRota> {
  const devedor = await porToken(token);
  if (!devedor) return { status: 404, corpo: { erro: 'link não encontrado ou expirado' } };

  if (metodo === 'GET' && !acao)
    return { status: 200, corpo: await entradaDoDevedor(devedor) };
  if (metodo !== 'POST')
    return { status: 405, corpo: { erro: 'método não permitido' } };

  const numero = String(corpo.numero ?? '');
  switch (acao) {
    case 'acordo':
      return acordoPeloPortal(devedor, Number(corpo.parcelas));
    case 'pagamento':
      return informarPagamento(devedor, numero, String(corpo.observacao ?? ''));
    case 'contestacao':
      return contestarTitulo(devedor, numero, String(corpo.motivo ?? ''));
    case 'contato':
      return preferenciasDeContato(devedor, corpo.aceitos);
    case 'pessoa':
      return falarComPessoa(devedor, String(corpo.mensagem ?? ''));
    default:
      return { status: 404, corpo: { erro: 'ação desconhecida' } };
  }
}
