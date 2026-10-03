// Testes de integração do motor v3 contra o PostgreSQL local
// (bash scripts/banco-local.sh). Usam escritórios de teste tx1/tx2 e limpam
// tudo ao final — nunca tocam no escritório de demonstração e1.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { db } from '@sentinella/db';
import { BLOQUEIOS } from '@sentinella/dados';
import { executarTick, assinarNotificacoes, autorizarMedidas } from '../src/tick';
import { importarDevedores, importarTitulos } from '../src/importar';
import { importarPagamentos } from '../src/baixa';
import { addDias, deIso, paraIso } from '../src/datas';
import { serializarPlanilha } from '../src/planilhas';

const HOJE = '2026-10-05'; // segunda-feira
const IDS = ['tx1', 'tx2'];
const pasta = mkdtempSync(join(tmpdir(), 'sentinella-v3-teste-'));

async function limparTestes() {
  const where = { escritorioId: { in: IDS } };
  await db.registroAuditoria.deleteMany({ where });
  await db.mensagem.deleteMany({ where });
  await db.pagamentoInformado.deleteMany({ where });
  await db.promessa.deleteMany({ where });
  await db.documentoTitulo.deleteMany({ where: { documento: where } });
  await db.documentoJuridico.deleteMany({ where });
  await db.acordoTitulo.deleteMany({ where: { acordo: where } });
  await db.acordo.deleteMany({ where });
  await db.excecao.deleteMany({ where });
  await db.acaoCobranca.deleteMany({ where });
  await db.titulo.deleteMany({ where });
  await db.devedor.deleteMany({ where });
  await db.carteira.deleteMany({ where });
  await db.credor.deleteMany({ where });
  await db.usuarioEscritorio.deleteMany({ where });
  await db.escritorio.deleteMany({ where: { id: { in: IDS } } });
}

let seq = 0;

async function novoEscritorio(id: string) {
  return db.escritorio.create({
    data: {
      id, nome: `Escritório Teste ${id}`, plano: 'Avançado',
      marcaNome: `Teste ${id} Advogados`, marcaIniciais: 'TT',
      oab: 'OAB/XX 99.999 (teste)', slaMin: 15,
    },
  });
}

async function novaCarteira(
  escritorioId: string,
  opts: Partial<{ canais: string[]; multaPct: number | null; jurosMesPct: number | null; devedoresTipo: string; parcelasMax: number }> = {},
) {
  seq++;
  const credor = await db.credor.create({
    data: {
      id: `txcr${seq}`, escritorioId, nome: `Credor Teste ${seq}`,
      setor: 'educação', token: `tokcr${seq}`,
    },
  });
  return db.carteira.create({
    data: {
      id: `txca${seq}`, escritorioId, credorId: credor.id,
      nome: `Carteira Teste ${seq}`, tipo: 'educação',
      devedoresTipo: opts.devedoresTipo ?? 'PF e PJ',
      descontoMaxPct: 10, parcelasMax: opts.parcelasMax ?? 6, prazoMaxDias: 90,
      canais: opts.canais ?? ['WhatsApp', 'SMS', 'e-mail', 'carta', 'ligação'],
      multaPct: opts.multaPct === undefined ? 2 : opts.multaPct,
      jurosMesPct: opts.jurosMesPct === undefined ? 1 : opts.jurosMesPct,
      entradaEm: deIso(HOJE),
    },
  });
}

async function novoDevedor(
  carteira: { id: string; escritorioId: string; credorId: string },
  opts: Partial<{ tipo: 'PF' | 'PJ'; canaisBloqueados: string[]; naoContatar: boolean }> = {},
) {
  seq++;
  return db.devedor.create({
    data: {
      escritorioId: carteira.escritorioId, credorId: carteira.credorId, carteiraId: carteira.id,
      tipo: opts.tipo ?? 'PF', nome: `Devedor Teste ${seq}`,
      documento: opts.tipo === 'PJ' ? `00.000.9${String(seq).padStart(2, '0')}/0001-00` : `000.000.9${String(seq).padStart(2, '0')}-00`,
      token: `tokdev${seq}`, whatsapp: '(00) 90000-0000', email: `t${seq}@teste.exemplo.invalid`,
      telefone: '(00) 3000-0000',
      canaisBloqueados: opts.canaisBloqueados ?? [], naoContatar: opts.naoContatar ?? false,
    },
  });
}

async function novoTitulo(
  carteira: { id: string; escritorioId: string; credorId: string },
  devedorId: string,
  opts: { entrada: string; atraso: number; valor?: number; antecipado?: boolean; estado?: string; contestadoEm?: string; previaEm?: string },
) {
  seq++;
  return db.titulo.create({
    data: {
      escritorioId: carteira.escritorioId, credorId: carteira.credorId, carteiraId: carteira.id,
      devedorId, numero: `TX-${seq}`, valorCentavos: opts.valor ?? 120_000,
      vencimento: deIso(addDias(opts.entrada, -opts.atraso)),
      entradaCarteira: deIso(opts.entrada), atrasoOriginal: opts.atraso,
      antecipado: opts.antecipado ?? false,
      estado: opts.estado ?? 'em cobrança',
      contestadoEm: opts.contestadoEm ? new Date(`${opts.contestadoEm}T12:00:00Z`) : null,
      comunicacaoPreviaEnviadaEm: opts.previaEm ? deIso(opts.previaEm) : null,
    },
  });
}

before(async () => {
  await limparTestes();
  await novoEscritorio('tx1');
  await novoEscritorio('tx2');
});
after(async () => {
  await limparTestes();
  await db.$disconnect();
});

const tick = (hoje: string) => executarTick({ hoje, apenasEscritorios: IDS });
const tickSo = (hoje: string, ids: string[]) => executarTick({ hoje, apenasEscritorios: ids });

test('E+0 agendado e enviado no dia da entrada, com a marca do escritório', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 20 });
  await tick(HOJE);
  const mensagens = await db.mensagem.findMany({ where: { tituloId: titulo.id } });
  assert.equal(mensagens.length, 1);
  assert.match(mensagens[0].texto, /Teste tx1 Advogados/);
  assert.match(mensagens[0].texto, /Credor Teste/);
  assert.equal(mensagens[0].marcaAtiva, 'Teste tx1 Advogados');
  const acoes = await db.acaoCobranca.findMany({ where: { tituloId: titulo.id } });
  assert.ok(acoes.some((a) => a.etapa === 'E+0' && a.estado === 'finalizada'));
  assert.ok(acoes.some((a) => a.etapa === 'E+2' && a.estado === 'agendada'));
});

test('catch-up: entrada retroativa assume a etapa corrente sem disparar as anteriores', async () => {
  const carteira = await novaCarteira('tx1', { canais: ['WhatsApp', 'e-mail'] });
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: addDias(HOJE, -12), atraso: 40 });
  await tick(HOJE);
  const feitas = await db.acaoCobranca.findMany({
    where: { tituloId: titulo.id, estado: { in: ['finalizada', 'pendente'] } },
  });
  assert.equal(feitas.length, 1);
  assert.equal(feitas[0].etapa, 'E+10'); // a mais recente vencida (sem ligação na carteira)
});

test('canal bloqueado a pedido do devedor vira exceção e nada sai por ali', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira, { canaisBloqueados: ['WhatsApp'] });
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 15 });
  const resumo = await tick(HOJE);
  assert.ok(resumo.bloqueiosConformidade >= 1);
  const acao = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, etapa: 'E+0' } });
  assert.equal(acao?.estado, 'bloqueada');
  assert.equal(acao?.motivoBloqueio, BLOQUEIOS.canal);
  assert.equal(await db.mensagem.count({ where: { tituloId: titulo.id } }), 0);
  assert.equal(await db.excecao.count({ where: { tituloId: titulo.id } }), 1);
});

test('pedido de não contato total: nada é agendado', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira, { naoContatar: true });
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 10 });
  await tick(HOJE);
  assert.equal(await db.acaoCobranca.count({ where: { tituloId: titulo.id } }), 0);
});

test('negativação sem comunicação prévia é barrada (CDC, art. 43, §2º)', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: addDias(HOJE, -30), atraso: 25 });
  // força a ação de negativação devida hoje, sem prévia registrada
  await db.acaoCobranca.create({
    data: {
      escritorioId: 'tx1', carteiraId: carteira.id, tituloId: titulo.id, devedorId: devedor.id,
      etapa: 'E+30', canal: 'e-mail', quem: 'sistema', tipo: 'negativação',
      descricao: 'Negativação/protesto', dataProgramada: deIso(HOJE), marcaAtiva: 'Teste tx1 Advogados',
    },
  });
  await tick(HOJE);
  const acao = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, tipo: 'negativação' } });
  assert.equal(acao?.estado, 'bloqueada');
  assert.equal(acao?.motivoBloqueio, BLOQUEIOS.previa);
  assert.equal((await db.titulo.findUnique({ where: { id: titulo.id } }))?.estado, 'em cobrança');
});

test('com prévia e prazo cumprido: medida aguarda autorização; autorizar muda o estado', async () => {
  const carteira = await novaCarteira('tx1');
  const pf = await novoDevedor(carteira, { tipo: 'PF' });
  const pj = await novoDevedor(carteira, { tipo: 'PJ' });
  const tituloPf = await novoTitulo(carteira, pf.id, { entrada: addDias(HOJE, -40), atraso: 20, previaEm: addDias(HOJE, -12) });
  const tituloPj = await novoTitulo(carteira, pj.id, { entrada: addDias(HOJE, -40), atraso: 20, previaEm: addDias(HOJE, -12) });
  for (const t of [tituloPf, tituloPj]) {
    await db.acaoCobranca.create({
      data: {
        escritorioId: 'tx1', carteiraId: carteira.id, tituloId: t.id, devedorId: t.devedorId,
        etapa: 'E+30', canal: 'e-mail', quem: 'sistema', tipo: 'negativação',
        descricao: 'Negativação/protesto', dataProgramada: deIso(HOJE), marcaAtiva: 'Teste tx1 Advogados',
      },
    });
  }
  const resumo = await tick(HOJE);
  assert.ok(resumo.medidasAguardandoAutorizacao >= 2);
  const docs = await db.documentoJuridico.findMany({
    where: { escritorioId: 'tx1', tipo: 'autorização', status: 'aguarda autorização' },
  });
  assert.ok(docs.length >= 2);

  const r = await autorizarMedidas('tx1', HOJE, 'Dra. Teste — OAB/XX 1 (teste)');
  assert.ok(r.autorizadas >= 2);
  assert.equal((await db.titulo.findUnique({ where: { id: tituloPf.id } }))?.estado, 'negativado');
  assert.equal((await db.titulo.findUnique({ where: { id: tituloPj.id } }))?.estado, 'protestado');
});

test('título contestado: medida barrada e cobrança pausada', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, {
    entrada: addDias(HOJE, -40), atraso: 20,
    previaEm: addDias(HOJE, -15), estado: 'contestado', contestadoEm: addDias(HOJE, -2),
  });
  await db.acaoCobranca.create({
    data: {
      escritorioId: 'tx1', carteiraId: carteira.id, tituloId: titulo.id, devedorId: devedor.id,
      etapa: 'E+30', canal: 'e-mail', quem: 'sistema', tipo: 'negativação',
      descricao: 'Negativação/protesto', dataProgramada: deIso(HOJE), marcaAtiva: 'Teste tx1 Advogados',
    },
  });
  await tick(HOJE);
  // título contestado está fora da régua: a ação órfã é cancelada, nunca executada
  const acao = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, tipo: 'negativação' } });
  assert.equal(acao?.estado, 'cancelada');
  assert.equal((await db.titulo.findUnique({ where: { id: titulo.id } }))?.estado, 'contestado');
  assert.equal(await db.mensagem.count({ where: { tituloId: titulo.id } }), 0);
});

test('notificação só sai assinada pelo advogado', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 15 });
  await db.acaoCobranca.create({
    data: {
      escritorioId: 'tx1', carteiraId: carteira.id, tituloId: titulo.id, devedorId: devedor.id,
      etapa: 'E+20', canal: 'e-mail', quem: 'sistema', tipo: 'notificação',
      descricao: 'Notificação extrajudicial', dataProgramada: deIso(HOJE), marcaAtiva: 'Teste tx1 Advogados',
    },
  });
  const resumo = await tick(HOJE);
  assert.ok(resumo.notificacoesParaAssinar >= 1);
  // Nada enviado ainda (a mensagem de E+0 é outra; filtramos pela notificação)
  const doc = await db.documentoJuridico.findFirst({
    where: { escritorioId: 'tx1', tipo: 'notificação extrajudicial', titulos: { some: { tituloId: titulo.id } } },
  });
  assert.equal(doc?.status, 'a assinar');

  const assinadas = await assinarNotificacoes('tx1', HOJE, 'Dra. Teste — OAB/XX 1 (teste)');
  assert.ok(assinadas >= 1);
  const depois = await db.documentoJuridico.findUnique({ where: { id: doc!.id } });
  assert.equal(depois?.status, 'enviado com prova');
  assert.match(depois?.assinadoPor ?? '', /Dra\. Teste/);
  const enviadas = await db.mensagem.findMany({ where: { tituloId: titulo.id, de: 'analista' } });
  assert.equal(enviadas.length, 1);
  assert.match(enviadas[0].texto, /Dra\. Teste/); // assinatura entrou no texto
});

test('conferência bloqueia: valor divergente, termo vedado e medida formal em mensagem comum', async () => {
  const carteira = await novaCarteira('tx1', { canais: ['WhatsApp'] });
  const d1 = await novoDevedor(carteira);
  const d2 = await novoDevedor(carteira);
  const d3 = await novoDevedor(carteira);
  const t1 = await novoTitulo(carteira, d1.id, { entrada: HOJE, atraso: 10 });
  const t2 = await novoTitulo(carteira, d2.id, { entrada: HOJE, atraso: 10 });
  const t3 = await novoTitulo(carteira, d3.id, { entrada: HOJE, atraso: 10 });
  const porDevedor: Record<string, string> = {
    [d1.id]: 'Débito de R$ 9.999,99 em aberto.',
    [d2.id]: 'Pague ou vamos acionar a polícia.',
    [d3.id]: 'Seu nome pode ser protestado e negativado.',
  };
  const r2 = await executarTick({
    hoje: HOJE,
    apenasEscritorios: ['tx1'],
    renderizador: (_tipo, _canal, ctx) => {
      // associa pelo link do portal (token do devedor)
      const token = ctx.linkPortal.split('t=')[1];
      if (token === d1.token) return porDevedor[d1.id];
      if (token === d2.token) return porDevedor[d2.id];
      return porDevedor[d3.id];
    },
  });
  assert.ok(r2.mensagensBloqueadas >= 3);
  for (const t of [t1, t2, t3]) {
    const acao = await db.acaoCobranca.findFirst({ where: { tituloId: t.id, etapa: 'E+0' } });
    assert.equal(acao?.estado, 'bloqueada');
  }
  assert.equal(await db.mensagem.count({ where: { tituloId: { in: [t1.id, t2.id, t3.id] }, de: 'IA' } }), 0);
});

test('sem encargos cadastrados, mensagem que cita juros é bloqueada', async () => {
  const carteira = await novaCarteira('tx1', { canais: ['WhatsApp'], multaPct: null, jurosMesPct: null });
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 10, valor: 50_000 });
  const resumo = await executarTick({
    hoje: HOJE,
    apenasEscritorios: ['tx1'],
    renderizador: () => 'Seu débito de R$ 500,00 está acumulando juros.',
  });
  assert.ok(resumo.mensagensBloqueadas >= 1);
  const acao = await db.acaoCobranca.findFirst({ where: { tituloId: titulo.id, etapa: 'E+0' } });
  assert.equal(acao?.estado, 'bloqueada');
  assert.match(acao?.motivoBloqueio ?? '', /multa ou juros/);
});

test('ligação: nunca no domingo e no máximo uma por devedor por dia', async () => {
  const domingo = '2026-10-04';
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  // duas ligações devidas para o mesmo devedor
  const ta = await novoTitulo(carteira, devedor.id, { entrada: addDias(domingo, -5), atraso: 20 });
  const tb = await novoTitulo(carteira, devedor.id, { entrada: addDias(domingo, -5), atraso: 20 });
  for (const t of [ta, tb]) {
    await db.acaoCobranca.create({
      data: {
        escritorioId: 'tx1', carteiraId: carteira.id, tituloId: t.id, devedorId: devedor.id,
        etapa: 'E+5', canal: 'ligação', quem: 'analista', tipo: 'ligação',
        descricao: 'Primeira ligação', dataProgramada: deIso(domingo), marcaAtiva: 'Teste tx1 Advogados',
      },
    });
  }
  const r1 = await tick(domingo);
  assert.equal(r1.ligacoesNaAgenda, 0);
  assert.ok(r1.ligacoesAdiadas >= 2);

  const r2 = await tick(HOJE); // segunda
  assert.equal(r2.ligacoesNaAgenda, 1);
  assert.ok(r2.ligacoesAdiadas >= 1);
});

test('importação: terceiros descartados, trabalho sem indicação fora, dedupe e tipo da carteira', async () => {
  const carteira = await novaCarteira('tx1', { devedoresTipo: 'PF' });
  const arquivo = join(pasta, 'devedores.csv');
  writeFileSync(arquivo, serializarPlanilha(
    ['tipo', 'documento', 'nome', 'whatsapp', 'telefone_trabalho', 'telefone_trabalho_indicado_pelo_devedor', 'contato_terceiro_nome', 'contato_terceiro_telefone'],
    [
      ['PF', '000.000.801-00', 'Ana Teste Um', '(00) 90000-0001', '', 'não', 'Vizinho Zé', '(00) 98888-0000'],
      ['PF', '000.000.802-00', 'Bia Teste Dois', '(00) 90000-0002', '(00) 3777-0000', 'não', '', ''],
      ['PF', '000.000.803-00', 'Cris Teste Três', '(00) 90000-0003', '(00) 3777-1111', 'sim', '', ''],
      ['PF', '000.000.801-00', 'Ana Repetida', '', '', 'não', '', ''],
      ['PJ', '00.000.804/0001-00', 'Loja Teste', '', '', 'não', '', ''],
    ],
  ));
  const r = await importarDevedores(carteira.id, arquivo);
  assert.equal(r.criadas, 3);
  assert.equal(r.descartesTerceiro, 2); // terceiro da Ana + trabalho sem indicação da Bia
  assert.ok(r.erros.some((e) => /repetido/.test(e.motivo)));
  assert.ok(r.erros.some((e) => /só aceita devedores PF/.test(e.motivo)));
  const ana = await db.devedor.findFirst({ where: { carteiraId: carteira.id, documento: '000.000.801-00' } });
  assert.equal(ana?.nome, 'Ana Teste Um');
  const bia = await db.devedor.findFirst({ where: { carteiraId: carteira.id, documento: '000.000.802-00' } });
  assert.equal(bia?.telefoneTrabalho, '');
  const cris = await db.devedor.findFirst({ where: { carteiraId: carteira.id, documento: '000.000.803-00' } });
  assert.equal(cris?.telefoneTrabalho, '(00) 3777-1111');
});

test('importação de títulos: entrada, atraso original e antecipado só PJ; pago não é sobrescrito', async () => {
  const carteira = await novaCarteira('tx1');
  const pf = await novoDevedor(carteira, { tipo: 'PF' });
  const arquivoT = join(pasta, 'titulos.csv');
  writeFileSync(arquivoT, serializarPlanilha(
    ['numero', 'documento_devedor', 'valor', 'vencimento', 'entrada_carteira', 'antecipado'],
    [
      ['TI-1', pf.documento, '1.000,00', '01/08/2026', '', 'não'],
      ['TI-2', pf.documento, '2.000,00', '01/09/2026', '20/09/2026', 'não'],
      ['TI-3', pf.documento, '3.000,00', '01/09/2026', '', 'sim'], // antecipado em PF → erro
    ],
  ));
  const r = await importarTitulos(carteira.id, arquivoT, HOJE);
  assert.equal(r.criadas, 2);
  assert.ok(r.erros.some((e) => /antecipado só vale para devedor PJ/.test(e.motivo)));
  const t1 = await db.titulo.findUnique({ where: { carteiraId_numero: { carteiraId: carteira.id, numero: 'TI-1' } } });
  assert.equal(paraIso(t1!.entradaCarteira), HOJE);
  assert.equal(t1!.atrasoOriginal, 65); // 01/08 → 05/10
  const t2 = await db.titulo.findUnique({ where: { carteiraId_numero: { carteiraId: carteira.id, numero: 'TI-2' } } });
  assert.equal(paraIso(t2!.entradaCarteira), '2026-09-20');
  assert.equal(t2!.atrasoOriginal, 19);

  // pago não é sobrescrito
  await db.titulo.update({ where: { id: t1!.id }, data: { estado: 'pago', pagoEm: deIso(HOJE) } });
  writeFileSync(arquivoT, serializarPlanilha(
    ['numero', 'documento_devedor', 'valor', 'vencimento', 'entrada_carteira', 'antecipado'],
    [['TI-1', pf.documento, '9.999,00', '01/08/2026', '', 'não']],
  ));
  const r2 = await importarTitulos(carteira.id, arquivoT, HOJE);
  assert.equal(r2.ignoradas, 1);
  const t1b = await db.titulo.findUnique({ where: { id: t1!.id } });
  assert.equal(t1b!.valorCentavos, 100_000);
});

test('baixa: título pago cancela ações futuras e avalia promessa', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 10 });
  await tick(HOJE); // agenda E+2 etc.
  await db.promessa.create({
    data: {
      escritorioId: 'tx1', devedorId: devedor.id, tituloId: titulo.id,
      para: deIso(addDias(HOJE, 3)), origem: 'ligação',
    },
  });
  const arquivoP = join(pasta, 'pagamentos.csv');
  writeFileSync(arquivoP, serializarPlanilha(
    ['numero_titulo', 'data_pagamento', 'valor_pago'],
    [[titulo.numero, '06/10/2026', '']],
  ));
  const { baixa } = await importarPagamentos(carteira.id, arquivoP);
  assert.equal(baixa.baixados, 1);
  assert.equal(baixa.promessasCumpridas, 1);
  assert.equal(await db.acaoCobranca.count({ where: { tituloId: titulo.id, estado: 'agendada' } }), 0);
});

test('tick é idempotente: rodar duas vezes no mesmo dia não duplica nada', async () => {
  const carteira = await novaCarteira('tx1');
  const devedor = await novoDevedor(carteira);
  const titulo = await novoTitulo(carteira, devedor.id, { entrada: HOJE, atraso: 10 });
  await tick(HOJE);
  const mensagensAntes = await db.mensagem.count({ where: { tituloId: titulo.id } });
  const acoesAntes = await db.acaoCobranca.count({ where: { tituloId: titulo.id } });
  const r2 = await tick(HOJE);
  assert.equal(await db.mensagem.count({ where: { tituloId: titulo.id } }), mensagensAntes);
  assert.equal(await db.acaoCobranca.count({ where: { tituloId: titulo.id } }), acoesAntes);
});

test('isolamento de tenant: o tick de um escritório não executa ações do outro', async () => {
  const c1 = await novaCarteira('tx1');
  const c2 = await novaCarteira('tx2');
  const d1 = await novoDevedor(c1);
  const d2 = await novoDevedor(c2);
  const t1 = await novoTitulo(c1, d1.id, { entrada: HOJE, atraso: 10 });
  const t2 = await novoTitulo(c2, d2.id, { entrada: HOJE, atraso: 10 });
  await tickSo(HOJE, ['tx1']);
  assert.ok((await db.mensagem.count({ where: { tituloId: t1.id } })) >= 1);
  assert.equal(await db.mensagem.count({ where: { tituloId: t2.id } }), 0);
  const acaoT2 = await db.acaoCobranca.findFirst({ where: { tituloId: t2.id, etapa: 'E+0' } });
  assert.equal(acaoT2, null); // nem agendadas: o agendamento também é por escritório
});
