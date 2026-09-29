// Os três clientes fictícios da demonstração (§11 — Fase 1/2). O cadastro de
// cliente é feito pela Sentinella na implantação; não entra por planilha.
// Valores monetários em centavos.

import { db } from '@sentinella/db';

export interface ClienteDemo {
  id: string;
  nome: string;
  plano: string;
  cidade: string;
  setor: string;
  erp: string;
  erpIntegrado: boolean;
  canais: string[];
  multaPct: number | null;
  jurosMesPct: number | null;
  alcadaDescontoMaxPct: number;
  alcadaParcelasMax: number;
  alcadaPrazoMaxDias: number;
  alcadaValorSempreAnalista: number;
  valorLimiteLigacao: number;
  analistaNomeado: string | null;
  qtdLojistas: number;
  qtdTitulos: number;
}

export const CLIENTES_DEMO: ClienteDemo[] = [
  {
    id: 'c1',
    nome: 'Móveis Aurora Ltda (fictícia)',
    plano: 'Avançado',
    cidade: 'Arapongas (PR)',
    setor: 'indústria moveleira',
    erp: 'Sankhya (importação por planilha na Fase 2)',
    erpIntegrado: false,
    canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'],
    multaPct: 2,
    jurosMesPct: 1,
    alcadaDescontoMaxPct: 8,
    alcadaParcelasMax: 4,
    alcadaPrazoMaxDias: 45,
    alcadaValorSempreAnalista: 2_000_000,
    valorLimiteLigacao: 400_000,
    analistaNomeado: null,
    qtdLojistas: 160,
    qtdTitulos: 1200,
  },
  {
    id: 'c2',
    nome: 'Serra Verde Bebidas S.A. (fictícia)',
    plano: 'Max',
    cidade: 'Cascavel (PR)',
    setor: 'alimentos e bebidas',
    erp: 'Omie (conector por API)',
    erpIntegrado: true,
    canais: ['WhatsApp', 'SMS', 'e-mail', 'carta', 'ligação'],
    multaPct: 2,
    jurosMesPct: 1,
    alcadaDescontoMaxPct: 10,
    alcadaParcelasMax: 6,
    alcadaPrazoMaxDias: 60,
    alcadaValorSempreAnalista: 1_500_000,
    valorLimiteLigacao: 300_000,
    analistaNomeado: 'Marina Duarte',
    qtdLojistas: 140,
    qtdTitulos: 1100,
  },
  {
    id: 'c3',
    nome: 'Horizonte Autopeças ME (fictícia)',
    plano: 'Básico',
    cidade: 'Maringá (PR)',
    setor: 'autopeças',
    erp: 'Bling (importação por planilha na Fase 2)',
    erpIntegrado: false,
    canais: ['WhatsApp', 'e-mail'],
    // §12: sem multa cadastrada → nenhuma mensagem menciona multa.
    multaPct: null,
    jurosMesPct: null,
    alcadaDescontoMaxPct: 5,
    alcadaParcelasMax: 3,
    alcadaPrazoMaxDias: 30,
    alcadaValorSempreAnalista: 1_200_000,
    valorLimiteLigacao: 250_000,
    analistaNomeado: null,
    qtdLojistas: 100,
    qtdTitulos: 700,
  },
];

export async function cadastrarClientesDemo(): Promise<void> {
  for (const { qtdLojistas, qtdTitulos, ...cliente } of CLIENTES_DEMO) {
    await db.cliente.upsert({
      where: { id: cliente.id },
      update: cliente,
      create: cliente,
    });
  }
}
