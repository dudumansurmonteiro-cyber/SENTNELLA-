// Testes de unidade do motor (sem banco): planilhas, conferência, calendário
// de ligações e textos de mensagem.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  lerPlanilha, serializarPlanilha, numeroBr, dataParaIso, simNao, cnpjNormalizado,
} from '../src/planilhas';
import { conferirMensagem } from '../src/conferencia';
import { podeLigarNoDia, proximoDiaDeLigacao, ehDiaUtil } from '../src/datas';
import { calcularEncargos, textoDaMensagem, type ContextoMensagem } from '../src/mensagens';
import { escolherDriver } from '../src/drivers';

test('planilha: separador ponto e vírgula, aspas e acentos no cabeçalho', () => {
  const p = lerPlanilha('﻿CNPJ;Razão Social;Cidade\n00000001000117;"Loja; A";Maringá\n\n12.345;Loja B;Londrina\n');
  assert.deepEqual(p.cabecalho, ['cnpj', 'razao_social', 'cidade']);
  assert.equal(p.linhas.length, 2);
  assert.equal(p.linhas[0].campos.razao_social, 'Loja; A');
  assert.equal(p.linhas[0].numero, 2);
  assert.equal(p.linhas[1].numero, 4); // linha vazia não conta como registro
});

test('planilha: separador vírgula também é aceito', () => {
  const p = lerPlanilha('numero,valor\nNF-1,"1.234,56"\n');
  assert.equal(p.linhas[0].campos.valor, '1.234,56');
});

test('números brasileiros', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('1234,5'), 1234.5);
  assert.equal(numeroBr('1234.56'), 1234.56);
  assert.equal(numeroBr('R$ 980,00'), 980);
  assert.equal(numeroBr('abc'), null);
});

test('datas e sim/não', () => {
  assert.equal(dataParaIso('05/08/2026'), '2026-08-05');
  assert.equal(dataParaIso('2026-08-05'), '2026-08-05');
  assert.equal(dataParaIso('31/02/2026'), null);
  assert.equal(simNao('SIM'), true);
  assert.equal(simNao('não'), false);
  assert.equal(simNao('', true), true);
  assert.equal(simNao('talvez'), null);
  assert.equal(cnpjNormalizado('00000001000117'), '00.000.001/0001-17');
  assert.equal(cnpjNormalizado('123'), null);
});

test('serializar e reler é estável', () => {
  const texto = serializarPlanilha(['a', 'b'], [['x;1', 'ç"2']]);
  const relida = lerPlanilha(texto);
  assert.equal(relida.linhas[0].campos.a, 'x;1');
  assert.equal(relida.linhas[0].campos.b, 'ç"2');
});

test('calendário de ligações (§3): sem domingo; sábado pode', () => {
  assert.equal(podeLigarNoDia('2026-10-04'), false); // domingo
  assert.equal(podeLigarNoDia('2026-10-03'), true); // sábado
  assert.equal(proximoDiaDeLigacao('2026-10-03'), '2026-10-05'); // sáb → seg
  assert.equal(ehDiaUtil('2026-10-03'), false);
});

const contextoBase: ContextoMensagem = {
  industria: 'Móveis Aurora Ltda',
  contatoNome: 'Ana Almeida',
  numero: 'C1-4001',
  valorCentavos: 235000,
  vencimentoIso: '2026-09-20',
  diasAtraso: 8,
  encargos: calcularEncargos(235000, 8, 2, 1),
  multaCadastrada: true,
  linkPortal: 'http://localhost:3000/l/?t=abc',
  parcelasMax: 4,
};

test('encargos vêm só do cadastro (§12)', () => {
  const com = calcularEncargos(100000, 10, 2, 1);
  assert.equal(com.multaCentavos, 2000);
  assert.equal(com.jurosCentavos, Math.round((100000 * 0.01 / 30) * 10));
  const sem = calcularEncargos(100000, 10, null, null);
  assert.equal(sem.multaCentavos, null);
  assert.equal(sem.jurosCentavos, null);
  assert.equal(sem.totalCentavos, 100000);
});

test('mensagem sem multa cadastrada não menciona multa nem juros', () => {
  const ctx: ContextoMensagem = {
    ...contextoBase,
    encargos: calcularEncargos(235000, 8, null, null),
    multaCadastrada: false,
  };
  for (const etapa of ['D−3', 'D0', 'D+3', 'D+7', 'D+10', 'D+15', 'D+30']) {
    const texto = textoDaMensagem(etapa, 'WhatsApp', ctx);
    assert.ok(!/multa|juros/i.test(texto), `${etapa} não deve citar multa: ${texto}`);
  }
});

test('nenhum texto de mensagem usa palavra proibida (§12)', () => {
  const proibidas = /seguro|apólice|cobertura|garantia total|100%|revolucionári|disruptiv/i;
  for (const etapa of ['D−3', 'D0', 'D+3', 'D+7', 'D+10', 'D+15', 'D+30']) {
    for (const canal of ['WhatsApp', 'SMS', 'e-mail']) {
      const texto = textoDaMensagem(etapa, canal, contextoBase);
      assert.ok(!proibidas.test(texto), `${etapa}/${canal}: ${texto}`);
    }
  }
});

test('conferência aprova mensagem fiel aos dados', () => {
  const texto = textoDaMensagem('D+3', 'WhatsApp', contextoBase);
  const r = conferirMensagem(texto, {
    valoresCentavos: [
      contextoBase.valorCentavos,
      contextoBase.encargos.totalCentavos,
      contextoBase.encargos.multaCentavos!,
      contextoBase.encargos.jurosCentavos!,
    ],
    datasIso: [contextoBase.vencimentoIso, '2026-09-28'],
    multaCadastrada: true,
    parcelasMax: 4,
  });
  assert.deepEqual(r, { aprovada: true });
});

test('conferência bloqueia valor divergente, multa sem cadastro, data estranha e parcelas fora da alçada', () => {
  const esperado = {
    valoresCentavos: [235000],
    datasIso: ['2026-09-20'],
    multaCadastrada: false,
    parcelasMax: 3,
  };
  const valor = conferirMensagem('O título soma R$ 9.999,99.', esperado);
  assert.equal(valor.aprovada, false);
  assert.match((valor as { motivo: string }).motivo, /não confere/);

  const multa = conferirMensagem('Com multa de R$ 2.350,00.', esperado);
  assert.equal(multa.aprovada, false);
  assert.match((multa as { motivo: string }).motivo, /multa/);

  const data = conferirMensagem('Vence em 01/01/2027.', esperado);
  assert.equal(data.aprovada, false);

  const parcelas = conferirMensagem('Dá para parcelar em até 6x.', esperado);
  assert.equal(parcelas.aprovada, false);
  assert.match((parcelas as { motivo: string }).motivo, /alçada/);

  const ok = conferirMensagem('O título C1-4001 de R$ 2.350,00 venceu em 20/09/26.', esperado);
  assert.deepEqual(ok, { aprovada: true });
});

test('drivers: desenvolvimento fica simulado; produção sem fornecedor cai no simulado com aviso', async () => {
  const dev = escolherDriver('WhatsApp', undefined);
  assert.equal(dev.aviso, null);
  assert.equal((await dev.driver.enviar({ canal: 'WhatsApp', para: 'x', texto: 'y' })).entrega, 'simulada');

  const prod = escolherDriver('WhatsApp', 'producao');
  assert.match(prod.aviso ?? '', /BSP/);
  assert.equal((await prod.driver.enviar({ canal: 'WhatsApp', para: 'x', texto: 'y' })).entrega, 'simulada');
});
