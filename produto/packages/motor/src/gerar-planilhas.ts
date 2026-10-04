// Gera as planilhas da Fase 2 (v3):
//  1) planilhas-modelo/ — os modelos que o escritório preenche POR CARTEIRA
//     (devedores, títulos, pagamentos), com linhas de exemplo fictícias.
//  2) dados-exemplo/ — planilhas completas e determinísticas das carteiras do
//     escritório fictício (400 devedores PF e PJ, 1.200 títulos), separadas
//     por SEMANA DE ENTRADA, que a simulação importa como um escritório real
//     importaria. Algumas linhas trazem contato de terceiro de propósito —
//     para o relatório de importação mostrar o descarte (§3).
// Nada aqui usa CPF/CNPJ real (§11): 000.000.* e 00.000.*.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  criarRnd, entre, inteiro, escolha, chance,
  nomeLojista, nomePessoa, nomePessoaCompleta, cidade, cnpjFicticio, cpfFicticio,
} from '@sentinella/dados';
import type { Rnd } from '@sentinella/dados';
import { serializarPlanilha } from './planilhas';
import { addDias, hojeReal } from './datas';
import { CARTEIRAS_DEMO } from './escritorios';

export const SEMENTE_PADRAO = 20261003;
export const DIAS_DE_SIMULACAO = 90;

const COLUNAS_DEVEDORES = [
  'tipo', 'documento', 'nome', 'cidade', 'whatsapp', 'email', 'telefone',
  'telefone_trabalho', 'telefone_trabalho_indicado_pelo_devedor',
  'contato_terceiro_nome', 'contato_terceiro_telefone', 'nao_cobrar',
];
const COLUNAS_TITULOS = [
  'numero', 'documento_devedor', 'valor', 'vencimento', 'entrada_carteira', 'antecipado',
];
const COLUNAS_PAGAMENTOS = ['numero_titulo', 'data_pagamento', 'valor_pago'];

const dataBr4 = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};
const valorBr = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

// Contatos visivelmente fictícios: DDD 00 e domínio reservado ".invalid".
const foneFicticio = (rnd: Rnd) => `(00) 9${inteiro(rnd, 1000, 9999)}-${inteiro(rnd, 1000, 9999)}`;
const emailFicticio = (nome: string) =>
  `${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@exemplo.invalid`;

export interface PerfilDevedor {
  pontual: number; // 0 = nunca regulariza · 1 = regulariza cedo
  respondeH: number | null; // null = não responde
}

export interface PlanilhasGeradas {
  raiz: string;
  hoje: string;
  inicio: string;
  porCarteira: Record<string, { devedores: string; titulosPorSemana: string[] }>;
  perfis: Record<string, PerfilDevedor>; // por documento
}

const VOLUMES: Record<string, { devedores: number; titulos: number; valorMin: number; valorMax: number; mix: number[] }> = {
  ca1: { devedores: 220, titulos: 700, valorMin: 380, valorMax: 1900, mix: [0.3, 0.4, 0.2, 0.1] },
  ca2: { devedores: 80, titulos: 160, valorMin: 120, valorMax: 900, mix: [0.45, 0.4, 0.15, 0] },
  ca3: { devedores: 100, titulos: 340, valorMin: 800, valorMax: 18000, mix: [0.4, 0.35, 0.18, 0.07] },
};

function atrasoDaFaixa(rnd: Rnd, mix: number[]): number {
  const sorteio = rnd();
  let acumulado = 0;
  for (let faixa = 0; faixa < 4; faixa++) {
    acumulado += mix[faixa];
    if (sorteio <= acumulado) {
      if (faixa === 0) return inteiro(rnd, 1, 30);
      if (faixa === 1) return inteiro(rnd, 31, 90);
      if (faixa === 2) return inteiro(rnd, 91, 180);
      return inteiro(rnd, 181, 540);
    }
  }
  return inteiro(rnd, 1, 30);
}

export function gerarPlanilhas(destino: string, semente = SEMENTE_PADRAO): PlanilhasGeradas {
  const rnd = criarRnd(semente);
  const hoje = hojeReal();
  const inicio = addDias(hoje, -(DIAS_DE_SIMULACAO - 1));

  // ---------------------------------------------------------------- modelos
  const modelo = join(destino, 'planilhas-modelo');
  mkdirSync(modelo, { recursive: true });
  writeFileSync(
    join(modelo, 'devedores.csv'),
    serializarPlanilha(COLUNAS_DEVEDORES, [
      ['PF', '000.000.001-17', 'Ana Almeida Duarte', 'Curitiba', '(00) 91234-5678', 'ana.exemplo@exemplo.invalid', '(00) 3123-4567', '', 'não', '', '', 'não'],
      ['PJ', '00.000.002/0001-24', 'Bazar Modelo ME', 'Londrina', '(00) 92345-6789', 'financeiro@bazar-modelo.exemplo.invalid', '', '', 'não', '', '', 'não'],
      ['PF', '000.000.003-31', 'Carla Cardoso Lima', 'Maringá', '', 'carla.exemplo@exemplo.invalid', '(00) 3345-6789', '(00) 3999-0000', 'sim', '', '', 'não'],
    ]),
  );
  writeFileSync(
    join(modelo, 'titulos.csv'),
    serializarPlanilha(COLUNAS_TITULOS, [
      ['CT-10001', '000.000.001-17', '2.350,00', dataBr4(addDias(hoje, -45)), dataBr4(hoje), 'não'],
      ['CT-10002', '000.000.001-17', '1.180,50', dataBr4(addDias(hoje, -120)), dataBr4(hoje), 'não'],
      ['CT-10003', '00.000.002/0001-24', '4.920,00', dataBr4(addDias(hoje, -20)), dataBr4(hoje), 'sim'],
    ]),
  );
  writeFileSync(
    join(modelo, 'pagamentos.csv'),
    serializarPlanilha(COLUNAS_PAGAMENTOS, [
      ['CT-10001', dataBr4(hoje), '2.350,00'],
      ['CT-10002', dataBr4(addDias(hoje, -1)), ''],
    ]),
  );
  writeFileSync(
    join(modelo, 'LEIA-ME.txt'),
    [
      'Planilhas-modelo da Sentinella (v3) — uma por CARTEIRA.',
      '',
      'devedores.csv — tipo (PF/PJ), documento (CPF/CNPJ), contatos DO PRÓPRIO',
      'devedor. Colunas de contato de terceiro existem no modelo apenas para',
      'deixar a regra explícita: qualquer valor nelas é DESCARTADO na importação',
      '(CDC — só falamos com o próprio devedor). telefone_trabalho só entra se',
      'telefone_trabalho_indicado_pelo_devedor = sim.',
      '',
      'titulos.csv — numero, documento_devedor, valor (vírgula decimal),',
      'vencimento (dd/mm/aaaa), entrada_carteira (vazio = dia da importação),',
      'antecipado (sim só para duplicata de devedor PJ).',
      '',
      'pagamentos.csv — baixa pelo extrato da conta do credor/escritório;',
      'valor_pago vazio = valor do título.',
    ].join('\n'),
  );

  // ----------------------------------------------------- dados de exemplo
  const raiz = join(destino, 'dados-exemplo');
  mkdirSync(raiz, { recursive: true });
  const porCarteira: PlanilhasGeradas['porCarteira'] = {};
  const perfis: PlanilhasGeradas['perfis'] = {};
  let seqPf = 100;
  let seqPj = 100;
  let seqTitulo = 20000;

  for (const carteira of CARTEIRAS_DEMO) {
    const volume = VOLUMES[carteira.id];
    const pasta = join(raiz, carteira.id);
    mkdirSync(pasta, { recursive: true });
    const usados = new Set<string>();

    const linhasDevedores: string[][] = [];
    const documentos: { documento: string; tipo: 'PF' | 'PJ' }[] = [];
    for (let i = 0; i < volume.devedores; i++) {
      const tipo: 'PF' | 'PJ' =
        carteira.devedoresTipo === 'PF e PJ' ? (chance(rnd, 0.5) ? 'PF' : 'PJ')
        : (carteira.devedoresTipo as 'PF' | 'PJ');
      const documento = tipo === 'PF' ? cpfFicticio(seqPf++) : cnpjFicticio(seqPj++);
      const nome = tipo === 'PF' ? nomePessoaCompleta(rnd) : nomeLojista(rnd, usados);
      documentos.push({ documento, tipo });
      perfis[documento] = {
        pontual: entre(rnd, 0.1, 0.95),
        respondeH: chance(rnd, 0.72) ? entre(rnd, 1, 40) : null,
      };
      // ~4% das linhas trazem contato de terceiro — para o relatório de
      // importação mostrar o descarte; ~3% trazem telefone de trabalho sem a
      // indicação do devedor (também descartado).
      const terceiro = chance(rnd, 0.04);
      const trabalhoSemIndicacao = chance(rnd, 0.03);
      const trabalhoIndicado = !trabalhoSemIndicacao && chance(rnd, 0.06);
      linhasDevedores.push([
        tipo,
        documento,
        nome,
        cidade(rnd),
        chance(rnd, 0.9) ? foneFicticio(rnd) : '',
        chance(rnd, 0.85) ? emailFicticio(nome) : '',
        chance(rnd, 0.6) ? foneFicticio(rnd) : '',
        trabalhoSemIndicacao || trabalhoIndicado ? foneFicticio(rnd) : '',
        trabalhoIndicado ? 'sim' : 'não',
        terceiro ? nomePessoa(rnd) : '',
        terceiro ? foneFicticio(rnd) : '',
        chance(rnd, 0.01) ? 'sim' : 'não',
      ]);
    }
    const arquivoDevedores = join(pasta, 'devedores.csv');
    writeFileSync(arquivoDevedores, serializarPlanilha(COLUNAS_DEVEDORES, linhasDevedores));

    // Títulos em levas semanais de ENTRADA (semana 0 = início da simulação).
    const semanas = Math.ceil(DIAS_DE_SIMULACAO / 7);
    const porSemana: string[][][] = Array.from({ length: semanas }, () => []);
    for (let i = 0; i < volume.titulos; i++) {
      const dev = escolha(rnd, documentos);
      const semana = Math.min(semanas - 1, Math.floor(Math.pow(rnd(), 1.4) * semanas));
      const entrada = addDias(inicio, semana * 7);
      const atraso = atrasoDaFaixa(rnd, volume.mix);
      const vencimento = addDias(entrada, -atraso);
      const valor = Math.round(entre(rnd, volume.valorMin, volume.valorMax) * 100);
      const antecipado = dev.tipo === 'PJ' && carteira.id === 'ca3' && chance(rnd, 0.12);
      porSemana[semana].push([
        `${carteira.id.toUpperCase()}-${seqTitulo++}`,
        dev.documento,
        valorBr(valor),
        dataBr4(vencimento),
        dataBr4(entrada),
        antecipado ? 'sim' : 'não',
      ]);
    }
    const titulosPorSemana: string[] = [];
    porSemana.forEach((linhas, semana) => {
      if (!linhas.length) return;
      const arquivo = join(pasta, `titulos-semana-${String(semana + 1).padStart(2, '0')}.csv`);
      writeFileSync(arquivo, serializarPlanilha(COLUNAS_TITULOS, linhas));
      titulosPorSemana.push(arquivo);
    });
    porCarteira[carteira.id] = { devedores: arquivoDevedores, titulosPorSemana };
  }

  return { raiz, hoje, inicio, porCarteira, perfis };
}
