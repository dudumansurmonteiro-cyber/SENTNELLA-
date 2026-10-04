// Testes de unidade do motor v3 (sem banco): conferência, régua por faixa,
// título antecipado, datas, planilhas e custo total dos acordos.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { conferirMensagem } from '../src/conferencia';
import { passosDaRegua } from '../src/passos';
import { calcularSimulacoes } from '../src/acordos';
import { podeLigarNoDia, proximoDiaDeLigacao, addDias } from '../src/datas';
import { numeroBr, dataParaIso, documentoNormalizado } from '../src/planilhas';
import { calcularEncargos } from '../src/mensagens';
import type { Carteira, Titulo } from '@sentinella/db';

const esperadoBase = {
  valoresCentavos: [123_456],
  datasIso: ['2026-09-01'],
  multaCadastrada: true,
  parcelasMax: 6,
};

test('conferência aprova mensagem fiel aos dados', () => {
  const r = conferirMensagem('O débito de R$ 1.234,56 venceu em 01/09/2026. Parcele em até 6x.', esperadoBase);
  assert.deepEqual(r, { aprovada: true });
});

test('conferência barra valor e data divergentes e parcelas acima da alçada', () => {
  assert.equal(conferirMensagem('Pague R$ 999,99 hoje.', esperadoBase).aprovada, false);
  assert.equal(conferirMensagem('Venceu em 02/09/2026.', esperadoBase).aprovada, false);
  assert.equal(conferirMensagem('Parcele em 12x.', esperadoBase).aprovada, false);
});

test('conferência barra termo vedado e medida formal fora de documento formal', () => {
  assert.equal(conferirMensagem('Isso pode virar caso de polícia.', esperadoBase).aprovada, false);
  assert.equal(conferirMensagem('Seu nome será negativado.', esperadoBase).aprovada, false);
  // em documento formal (comunicação prévia), a menção é permitida
  assert.equal(
    conferirMensagem('poderá ser incluído nos cadastros de proteção ao crédito',
      { ...esperadoBase, etapaFormal: true }).aprovada,
    true,
  );
});

test('sem encargos cadastrados, "juros" não passa', () => {
  const r = conferirMensagem('Sem juros até amanhã!', { ...esperadoBase, multaCadastrada: false });
  assert.equal(r.aprovada, false);
});

const carteiraFake = (extra: Partial<Carteira> = {}): Carteira => ({
  id: 'c', escritorioId: 'e', credorId: 'cr', nome: 'Teste', tipo: 'educação',
  devedoresTipo: 'PF e PJ', descontoMaxPct: 10, parcelasMax: 6, prazoMaxDias: 90,
  entradaMinPct: 10, canais: ['WhatsApp', 'SMS', 'e-mail', 'carta', 'ligação'],
  multaPct: 2, jurosMesPct: 1, baseLegal: 'execução de contrato',
  controlador: 'credor', contaEmissora: 'conta do credor', reguaPerfil: 'padrão',
  entradaEm: new Date('2026-07-01T00:00:00Z'), criadoEm: new Date(),
  ...extra,
} as Carteira);

const tituloFake = (atraso: number, extra: Partial<Titulo> = {}): Titulo => ({
  id: 't', escritorioId: 'e', credorId: 'cr', carteiraId: 'c', devedorId: 'd',
  numero: 'T-1', valorCentavos: 100_000,
  vencimento: new Date(`${addDias('2026-10-05', -atraso)}T00:00:00Z`),
  entradaCarteira: new Date('2026-10-05T00:00:00Z'), atrasoOriginal: atraso,
  antecipado: false, estado: 'em cobrança', contestadoEm: null, contestacaoMotivo: null,
  comunicacaoPreviaEnviadaEm: null, comunicacaoPreviaProva: null,
  pagoEm: null, valorPagoCentavos: null, origem: 'csv', criadoEm: new Date(),
  ...extra,
} as Titulo);

test('régua integral até 90 dias; 91–180 pula E+7 e liga no E+3; >180 é curta', () => {
  const ate30 = passosDaRegua(carteiraFake(), tituloFake(20));
  assert.deepEqual(ate30.map((p) => p.etapa).slice(0, 4), ['E+0', 'E+2', 'E+5', 'E+7']);

  const meio = passosDaRegua(carteiraFake(), tituloFake(120));
  assert.ok(!meio.some((p) => p.etapa === 'E+7'));
  assert.ok(meio.some((p) => p.etapa === 'E+3' && p.canal === 'ligação'));

  const curta = passosDaRegua(carteiraFake(), tituloFake(220));
  assert.deepEqual(curta.map((p) => p.etapa), ['E+0', 'E+3', 'E+10', 'E+20', 'E+30', 'E+45']);
  assert.equal(curta.find((p) => p.etapa === 'E+10')?.tipo, 'comunicação prévia');
});

test('título antecipado (PJ): protesto cabe em até 30 dias do vencimento', () => {
  const titulo = tituloFake(10, { antecipado: true });
  const passos = passosDaRegua(carteiraFake(), titulo);
  const protesto = passos.find((p) => p.tipo === 'negativação');
  assert.ok(protesto);
  assert.ok(protesto!.off <= 20); // vencimento−10 → +30 = entrada+20
  assert.ok(!passos.some((p) => p.tipo === 'judicial'));
});

test('ligações: nunca no domingo; próximo dia válido', () => {
  assert.equal(podeLigarNoDia('2026-10-04'), false); // domingo
  assert.equal(podeLigarNoDia('2026-10-03'), true); // sábado
  assert.equal(proximoDiaDeLigacao('2026-10-03'), '2026-10-05');
});

test('planilhas: número BR, datas e documentos', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('R$ 10'), 10);
  assert.equal(dataParaIso('05/10/2026'), '2026-10-05');
  assert.equal(dataParaIso('31/02/2026'), null);
  assert.equal(documentoNormalizado('00000080100', 'PF'), '000.000.801-00');
  assert.equal(documentoNormalizado('00 000 804 0001 00', 'PJ'), '00.000.804/0001-00');
  assert.equal(documentoNormalizado('123', null), null);
});

test('simulações de acordo mostram o custo total com os encargos embutidos', () => {
  const simulacoes = calcularSimulacoes({ parcelasMax: 6 }, 100_000);
  assert.equal(simulacoes[0].parcelas, 2);
  for (const s of simulacoes) {
    assert.equal(s.custoTotalCentavos, 100_000 + s.jurosEmbutidosCentavos);
    assert.ok(s.valorParcelaCentavos * s.parcelas >= s.custoTotalCentavos);
  }
  const aVista = calcularSimulacoes({ parcelasMax: 1 }, 100_000);
  assert.equal(aVista[0].jurosEmbutidosCentavos, 0);
});

test('encargos têm teto de 18 meses de juros', () => {
  const tres_anos = calcularEncargos(100_000, 1080, 2, 1);
  const dezoito_meses = calcularEncargos(100_000, 540, 2, 1);
  assert.equal(tres_anos.jurosCentavos, dezoito_meses.jurosCentavos);
});
