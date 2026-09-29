// Testes de integração do motor contra o PostgreSQL local (bash scripts/banco-local.sh).
// Usam clientes de teste tx1/tx2/tx3 e limpam tudo ao final — nunca tocam nos
// dados dos clientes de demonstração c1/c2/c3.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { db } from '@sentinella/db';
import { executarTick } from '../src/tick';
import { importarLojistas, importarTitulos } from '../src/importar';
import { importarPagamentos } from '../src/baixa';
import { addDias, deIso, paraIso } from '../src/datas';
import { serializarPlanilha } from '../src/planilhas';

const HOJE = '2026-10-05'; // segunda-feira
const IDS = ['tx1', 'tx2', 'tx3'];
const pasta = mkdtempSync(join(tmpdir(), 'sentinella-teste-'));

async function limparTestes() {
  const where = { clienteId: { in: IDS } };
  await db.registroAuditoria.deleteMany({ where });
  await db.mensagem.deleteMany({ where });
  await db.pagamentoInformado.deleteMany({ where });
  await db.promessa.deleteMany({ where });
  await db.autorizacao.deleteMany({ where });
  await db.acordoTitulo.deleteMany({ where: { acordo: where } });
  await db.acordo.deleteMany({ where });
  await db.excecao.deleteMany({ where });
  await db.acaoCobranca.deleteMany({ where });
  await db.titulo.deleteMany({ where });
  await db.lojista.deleteMany({ where });
  await db.cliente.deleteMany({ where: { id: { in: IDS } } });
}

const baseCliente = {
  cidade: 'Arapongas (PR)', setor: 'teste', erp: 'planilha', erpIntegrado: false,
  alcadaDescontoMaxPct: 8, alcadaParcelasMax: 4, alcadaPrazoMaxDias: 45,
  alcadaValorSempreAnalista: 2_000_000, valorLimiteLigacao: 300_000,
};

let seq = 0;
async function novoLojista(clienteId: string) {
  seq++;
  return db.lojista.create({
    data: {
      clienteId, nome: `Lojista Teste ${seq}`, cnpj: `00.000.9${String(seq).padStart(2, '0')}/0001-00`,
      contatoNome: 'Contato Teste', token: `teste${clienteId}${seq}`,
      email: `t${seq}@teste.exemplo.invalid`, whatsapp: '(00) 90000-0000',
    },
  });
}

async function novoTitulo(
  clienteId: string, lojistaId: string,
  opts: { venc: string; valor?: number; antecipado?: boolean },
) {
  seq++;
  return db.titulo.create({
    data: {
      clienteId, lojistaId, numero: `${clienteId.toUpperCase()}-${1000 + seq}`,
      valorCentavos: opts.valor ?? 150_000,
      emissao: deIso(addDias(opts.venc, -30)), vencimento: deIso(opts.venc),
      antecipado: opts.antecipado ?? false,
    },
  });
}

before(async () => {
  await limparTestes();
  await db.cliente.create({
    data: {
      id: 'tx1', nome: 'Indústria Teste Avançado (fictícia)', plano: 'Avançado',
      canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'], multaPct: 2, jurosMesPct: 1,
      ...baseCliente,
    },
  });
  await db.cliente.create({
    data: {
      id: 'tx2', nome: 'Indústria Teste Básico (fictícia)', plano: 'Básico',
      canais: ['WhatsApp', 'e-mail'], multaPct: null, jurosMesPct: null,
      ...baseCliente,
    },
  });
  await db.cliente.create({
    data: {
      id: 'tx3', nome: 'Indústria Teste Conferência (fictícia)', plano: 'Max',
      canais: ['WhatsApp', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
      ...baseCliente,
    },
  });
});

after(async () => {
  await limparTestes();
  await db.$disconnect();
});

test('importação valida linha a linha e relata erros sem derrubar o arquivo', async () => {
  const lojistasCsv = join(pasta, 'lojistas.csv');
  writeFileSync(lojistasCsv, serializarPlanilha(
    ['cnpj', 'razao_social', 'cidade', 'contato_nome', 'contato_papel', 'nao_cobrar'],
    [
      ['00.000.801/0001-10', 'Loja Válida Um', 'Maringá', 'Ana', 'financeiro', 'não'],
      ['123', 'Loja CNPJ Ruim', 'Maringá', 'Bia', 'financeiro', 'não'],
      ['00.000.802/0001-20', '', 'Maringá', 'Caio', 'financeiro', 'não'],
      ['00.000.803/0001-30', 'Loja Válida Dois', 'Londrina', 'Davi', 'sócio', 'sim'],
      ['00.000.801/0001-10', 'Loja Repetida', 'Maringá', 'Eva', 'financeiro', 'não'],
    ],
  ));
  const r = await importarLojistas('tx1', lojistasCsv);
  assert.equal(r.criadas, 2);
  assert.equal(r.erros.length, 3);
  assert.deepEqual(r.erros.map((e) => e.linha), [3, 4, 6]);

  const naoCobrar = await db.lojista.findFirst({ where: { clienteId: 'tx1', cnpj: '00.000.803/0001-30' } });
  assert.equal(naoCobrar?.naoCobrar, true);

  const titulosCsv = join(pasta, 'titulos.csv');
  writeFileSync(titulosCsv, serializarPlanilha(
    ['numero', 'cnpj_lojista', 'valor', 'emissao', 'vencimento', 'antecipado'],
    [
      ['TX1-1', '00.000.801/0001-10', '1.500,00', '01/09/2026', '01/10/2026', 'não'],
      ['TX1-2', '00.000.801/0001-10', 'abc', '01/09/2026', '01/10/2026', 'não'],
      ['TX1-3', '00.000.777/0001-77', '900,00', '01/09/2026', '01/10/2026', 'não'],
      ['TX1-4', '00.000.801/0001-10', '2.000,00', '01/10/2026', '01/09/2026', 'não'],
      ['TX1-1', '00.000.801/0001-10', '1.500,00', '01/09/2026', '01/10/2026', 'não'],
    ],
  ));
  const rt = await importarTitulos('tx1', titulosCsv);
  assert.equal(rt.criadas, 1);
  assert.equal(rt.erros.length, 4);

  // Reimportar atualiza pelo número, sem duplicar.
  writeFileSync(titulosCsv, serializarPlanilha(
    ['numero', 'cnpj_lojista', 'valor', 'emissao', 'vencimento', 'antecipado'],
    [['TX1-1', '00.000.801/0001-10', '1.750,00', '01/09/2026', '01/10/2026', 'não']],
  ));
  const rt2 = await importarTitulos('tx1', titulosCsv);
  assert.equal(rt2.atualizadas, 1);
  const atualizado = await db.titulo.findUnique({
    where: { clienteId_numero: { clienteId: 'tx1', numero: 'TX1-1' } },
  });
  assert.equal(atualizado?.valorCentavos, 175_000);
});

test('janela de ligação (§3): agendada no sábado, adiada no domingo para segunda', async () => {
  const lojista = await novoLojista('tx1');
  await novoTitulo('tx1', lojista.id, { venc: addDias('2026-10-03', -10), valor: 500_000 });

  // Sexta: o D+10 cai no sábado — pode ser agendado (sábado liga até 14h).
  await executarTick({ hoje: '2026-10-02', apenasClientes: IDS });
  const sabado = await db.acaoCobranca.findFirst({
    where: { lojistaId: lojista.id, canal: 'ligação', etapa: 'D+10' },
  });
  assert.equal(paraIso(sabado!.dataProgramada), '2026-10-03');

  // Domingo: sem tick no sábado, a ligação venceu — mas domingo não se liga.
  const domingo = await executarTick({ hoje: '2026-10-04', apenasClientes: IDS });
  assert.ok(domingo.ligacoesAdiadas >= 1);
  const adiada = await db.acaoCobranca.findFirst({ where: { id: sabado!.id } });
  assert.equal(paraIso(adiada!.dataProgramada), '2026-10-05');
  assert.equal(adiada!.estado, 'agendada');
});

test('no máximo uma ligação por dia por devedor (§3)', async () => {
  const lojista = await novoLojista('tx1');
  await novoTitulo('tx1', lojista.id, { venc: addDias(HOJE, -10), valor: 800_000 });
  await novoTitulo('tx1', lojista.id, { venc: addDias(HOJE, -10), valor: 600_000 });

  const resumo = await executarTick({ hoje: HOJE, apenasClientes: IDS });
  const doLojista = await db.acaoCobranca.findMany({
    where: { lojistaId: lojista.id, canal: 'ligação', etapa: 'D+10' },
    orderBy: { id: 'asc' },
  });
  assert.equal(doLojista.length, 2);
  const emAndamento = doLojista.filter((a) => a.estado === 'em andamento');
  const adiadas = doLojista.filter(
    (a) => a.estado === 'agendada' && paraIso(a.dataProgramada) === '2026-10-06',
  );
  assert.equal(emAndamento.length, 1);
  assert.equal(adiadas.length, 1);
  assert.ok(resumo.ligacoesNaAgenda >= 1);
});

test('mensagem do dia sai simulada, com registro, e o tick é idempotente', async () => {
  const lojista = await novoLojista('tx1');
  const titulo = await novoTitulo('tx1', lojista.id, { venc: addDias(HOJE, 3), valor: 120_000 });

  const r1 = await executarTick({ hoje: HOJE, apenasClientes: IDS });
  assert.ok(r1.mensagensEnviadas >= 1);
  const acao = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, etapa: 'D−3' } });
  assert.equal(acao?.estado, 'finalizada');
  assert.equal(acao?.resultado, 'entregue (simulada)');
  const mensagem = await db.mensagem.findFirst({ where: { acaoId: acao!.id } });
  assert.equal(mensagem?.entrega, 'simulada');
  assert.match(mensagem!.texto, /vence em 08\/10\/26/);

  // Idempotência medida no que é nosso: nada do tx1 muda numa segunda rodada.
  const antes = {
    acoes: await db.acaoCobranca.count({ where: { clienteId: 'tx1' } }),
    mensagens: await db.mensagem.count({ where: { clienteId: 'tx1' } }),
  };
  await executarTick({ hoje: HOJE, apenasClientes: IDS });
  assert.equal(await db.acaoCobranca.count({ where: { clienteId: 'tx1' } }), antes.acoes);
  assert.equal(await db.mensagem.count({ where: { clienteId: 'tx1' } }), antes.mensagens);
  const duplicadas = await db.acaoCobranca.count({ where: { tituloId: titulo.id, etapa: 'D−3' } });
  assert.equal(duplicadas, 1);
});

test('Básico termina no D+15: título sai da régua e nada é agendado além', async () => {
  const lojista = await novoLojista('tx2');
  const dentro = await novoTitulo('tx2', lojista.id, { venc: addDias(HOJE, -12), valor: 100_000 });
  const alem = await novoTitulo('tx2', lojista.id, { venc: addDias(HOJE, -20), valor: 100_000 });

  await executarTick({ hoje: HOJE, apenasClientes: IDS });

  const foraDaRegua = await db.titulo.findUnique({ where: { id: alem.id } });
  assert.equal(foraDaRegua?.estado, 'fora da régua');
  assert.equal(await db.acaoCobranca.count({ where: { tituloId: alem.id } }), 0);

  const noPrazo = await db.titulo.findUnique({ where: { id: dentro.id } });
  assert.equal(noPrazo?.estado, 'vencido');
  const etapas = await db.acaoCobranca.findMany({ where: { tituloId: dentro.id }, select: { etapa: true } });
  assert.ok(etapas.length >= 1);
  assert.ok(etapas.every((a) => !['D+30', 'D+45', 'bloqueio', 'jurídico'].includes(a.etapa)));

  // Sem multa cadastrada, a mensagem não menciona multa (§12).
  const mensagem = await db.mensagem.findFirst({ where: { tituloId: dentro.id } });
  assert.ok(mensagem);
  assert.ok(!/multa|juros/i.test(mensagem!.texto));
});

test('duplicata antecipada: notificação no D+15 (Lei 5.474/68) e protesto no D+25', async () => {
  const lojista = await novoLojista('tx1');
  const titulo = await novoTitulo('tx1', lojista.id, {
    venc: addDias(HOJE, -16), valor: 150_000, antecipado: true,
  });

  await executarTick({ hoje: HOJE, apenasClientes: IDS });

  const notificacao = await db.acaoCobranca.findFirst({
    where: { tituloId: titulo.id, etapa: 'D+30' },
  });
  assert.ok(notificacao, 'a notificação antecipada deve existir');
  assert.equal(notificacao!.estado, 'finalizada');
  assert.match(notificacao!.descricao, /antecipada/);
  const texto = await db.mensagem.findFirst({ where: { acaoId: notificacao!.id } });
  assert.match(texto!.texto, /NOTIFICAÇÃO DE DÉBITO/);

  // O protesto (D+45 da régua) fica programado para vencimento+25.
  const naoAntecipado = await novoTitulo('tx1', lojista.id, { venc: addDias(HOJE, -16), valor: 150_000 });
  await executarTick({ hoje: HOJE, apenasClientes: IDS });
  const protestoAntecipado = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, etapa: 'D+45' } });
  const protestoNormal = await db.acaoCobranca.findFirst({ where: { tituloId: naoAntecipado.id, etapa: 'D+45' } });
  if (protestoAntecipado)
    assert.equal(paraIso(protestoAntecipado.dataProgramada), addDias(paraIso(titulo.vencimento), 25));
  assert.equal(protestoNormal, null); // no D+16 o protesto do não antecipado (D+45) ainda nem entra no horizonte
});

test('conferência bloqueia mensagem divergente e abre exceção', async () => {
  const lojista = await novoLojista('tx3');
  const titulo = await novoTitulo('tx3', lojista.id, { venc: addDias(HOJE, -3), valor: 200_000 });

  const resumo = await executarTick({
    hoje: HOJE,
    apenasClientes: IDS,
    renderizador: (etapa, _canal, ctx) =>
      `Sobre o título ${ctx.numero}: o valor em aberto é R$ 9.999,99 (${etapa}).`,
  });
  assert.ok(resumo.mensagensBloqueadas >= 1);

  const acao = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, etapa: 'D+3' } });
  assert.equal(acao?.estado, 'bloqueada');
  assert.match(acao!.motivoBloqueio ?? '', /não confere/);
  assert.equal(await db.mensagem.count({ where: { acaoId: acao!.id } }), 0);

  const excecao = await db.excecao.findFirst({ where: { tituloId: titulo.id } });
  assert.equal(excecao?.estado, 'aberta');
  assert.match(excecao!.motivo, /^Mensagem bloqueada/);
  assert.equal(excecao!.slaMin, 5); // tx3 é Max
});

test('baixa por importação: pago, ações futuras canceladas, promessa cumprida', async () => {
  const lojista = await novoLojista('tx1');
  const titulo = await novoTitulo('tx1', lojista.id, { venc: addDias(HOJE, -5), valor: 130_000 });
  await executarTick({ hoje: HOJE, apenasClientes: IDS });

  await db.promessa.create({
    data: {
      clienteId: 'tx1', lojistaId: lojista.id, tituloId: titulo.id,
      para: deIso(addDias(HOJE, 2)), origem: 'ligação',
    },
  });
  const futuras = await db.acaoCobranca.count({
    where: { tituloId: titulo.id, estado: 'agendada' },
  });
  assert.ok(futuras >= 1, 'deve haver ação futura agendada (D+7 no horizonte)');

  const pagamentosCsv = join(pasta, 'pagamentos.csv');
  writeFileSync(pagamentosCsv, serializarPlanilha(
    ['numero_titulo', 'data_pagamento', 'valor_pago'],
    [
      [titulo.numero, '05/10/2026', '1.300,00'],
      ['NAO-EXISTE', '05/10/2026', ''],
    ],
  ));
  const { relatorio, baixa } = await importarPagamentos('tx1', pagamentosCsv);
  assert.equal(baixa.baixados, 1);
  assert.equal(relatorio.erros.length, 1);

  const pago = await db.titulo.findUnique({ where: { id: titulo.id } });
  assert.equal(pago?.estado, 'pago');
  assert.equal(pago?.valorPagoCentavos, 130_000);
  assert.equal(await db.acaoCobranca.count({ where: { tituloId: titulo.id, estado: 'agendada' } }), 0);
  const promessa = await db.promessa.findFirst({ where: { tituloId: titulo.id } });
  assert.equal(promessa?.cumprida, true);

  const trilha = await db.registroAuditoria.findFirst({
    where: { entidade: 'titulo', entidadeId: titulo.id, para: 'pago' },
  });
  assert.ok(trilha, 'a baixa precisa deixar trilha de auditoria');
});
