// Cadastro de implantação do v3: escritório (tenant), credores e carteiras.
// É feito pela Sentinella na implantação — não entra por planilha. Aqui fica
// o escritório fictício usado no ciclo real de desenvolvimento (importação →
// tick → baixa), com carteiras de alçadas, canais e encargos distintos —
// inclusive uma SEM encargos cadastrados, para exercitar a regra do §12.

import { db } from '@sentinella/db';
import { deIso } from './datas';
import { novoToken } from './importar';

export interface CarteiraDemo {
  id: string;
  credorId: string;
  nome: string;
  tipo: string;
  devedoresTipo: 'PF' | 'PJ' | 'PF e PJ';
  descontoMaxPct: number;
  parcelasMax: number;
  prazoMaxDias: number;
  entradaMinPct: number;
  canais: string[];
  multaPct: number | null;
  jurosMesPct: number | null;
  baseLegal: string;
  controlador: string;
  contaEmissora: string;
}

export const ESCRITORIO_DEMO = {
  id: 'e1',
  nome: 'Almeida & Rocha Advogados (fictício)',
  oab: 'OAB/PR 00.000 (fictícia)',
  cidade: 'Curitiba (PR)',
  plano: 'Avançado',
  marcaNome: 'Almeida & Rocha Advogados',
  marcaIniciais: 'AR',
  corPrimaria: '#24466E',
  corClara: '#9FBEE8',
  mostrarOperadora: true,
  slaMin: 15,
  retencaoGravacoesAnos: 5,
} as const;

export const USUARIOS_DEMO = [
  { nome: 'Helena Rocha', papel: 'sócio', oab: 'OAB/PR 00.000 (fictícia)' },
  { nome: 'Dra. Carla Esteves', papel: 'advogado', oab: 'OAB/PR 00.001 (fictícia)' },
  { nome: 'Renato Prado', papel: 'coordenador', oab: null },
  { nome: 'Sofia Lima', papel: 'financeiro', oab: null },
] as const;

export const CREDORES_DEMO = [
  {
    id: 'cr1',
    nome: 'Colégio Horizonte (fictício)',
    setor: 'educação',
    contatoNome: 'Bruno Gomes',
    honorariosPct: 15,
  },
  {
    id: 'cr2',
    nome: 'Pinheiro Distribuidora de Autopeças (fictícia)',
    setor: 'indústria',
    contatoNome: 'Vera Teixeira',
    honorariosPct: 10,
  },
] as const;

export const CARTEIRAS_DEMO: CarteiraDemo[] = [
  {
    id: 'ca1', credorId: 'cr1',
    nome: 'Mensalidades 2025', tipo: 'educação', devedoresTipo: 'PF',
    descontoMaxPct: 15, parcelasMax: 8, prazoMaxDias: 120, entradaMinPct: 10,
    canais: ['WhatsApp', 'SMS', 'e-mail', 'ligação'],
    multaPct: 2, jurosMesPct: 1,
    baseLegal: 'execução de contrato', controlador: 'credor', contaEmissora: 'conta do credor',
  },
  {
    id: 'ca2', credorId: 'cr1',
    nome: 'Pronto atendimento (sem encargos cadastrados)', tipo: 'educação', devedoresTipo: 'PF',
    descontoMaxPct: 10, parcelasMax: 6, prazoMaxDias: 90, entradaMinPct: 10,
    canais: ['WhatsApp', 'e-mail'],
    multaPct: null, jurosMesPct: null,
    baseLegal: 'legítimo interesse do credor', controlador: 'credor', contaEmissora: 'conta do credor',
  },
  {
    id: 'ca3', credorId: 'cr2',
    nome: 'Duplicatas lojistas', tipo: 'indústria', devedoresTipo: 'PJ',
    descontoMaxPct: 8, parcelasMax: 4, prazoMaxDias: 60, entradaMinPct: 20,
    canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'],
    multaPct: 2, jurosMesPct: 1,
    baseLegal: 'execução de contrato', controlador: 'credor e escritório', contaEmissora: 'conta do escritório',
  },
];

// Advogada que assina notificações e autoriza medidas nos comandos/simulação.
export const ADVOGADA_DEMO = 'Dra. Carla Esteves — OAB/PR 00.001 (fictícia)';

// Idempotente: upsert do escritório, credores e carteiras da demonstração.
export async function garantirCadastro(entradaEmIso: string): Promise<void> {
  const e = ESCRITORIO_DEMO;
  await db.escritorio.upsert({
    where: { id: e.id },
    update: { ...e },
    create: { ...e },
  });
  await db.usuarioEscritorio.deleteMany({ where: { escritorioId: e.id } });
  await db.usuarioEscritorio.createMany({
    data: USUARIOS_DEMO.map((u) => ({ escritorioId: e.id, ...u })),
  });
  for (const credor of CREDORES_DEMO) {
    await db.credor.upsert({
      where: { id: credor.id },
      update: { ...credor, escritorioId: e.id },
      create: { ...credor, escritorioId: e.id, token: novoToken() },
    });
  }
  for (const carteira of CARTEIRAS_DEMO) {
    const { id, credorId, ...resto } = carteira;
    await db.carteira.upsert({
      where: { id },
      update: { ...resto, escritorioId: e.id, credorId },
      create: { id, ...resto, escritorioId: e.id, credorId, entradaEm: deIso(entradaEmIso) },
    });
  }
}
