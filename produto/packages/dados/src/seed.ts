// Seed da Fase 1 do v3 (CLAUDE.md §10): 3 escritórios fictícios com cores
// próprias, 8 credores, 15 carteiras, 6.000 devedores PF e PJ, 20.000
// títulos com faixas de atraso variadas e 90 dias de histórico simulado
// pela régua reancorada (§4), com as travas da seção 3 ativas e visíveis.
// Nenhuma mensagem real é enviada; CPFs começam com 000.000 e CNPJs com
// 00.000 — nunca documentos reais.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Acao, AgregadosCarteira, AnalistaSentinella, BloqueioConformidade,
  Canal, Carteira, Credor, DadosEscritorio, Devedor, DocumentoJuridico,
  Escritorio, Excecao, FaixaValor,
  IndiceSeed, Letra, Mensagem, PortalCredores,
  PortalDevedores, SimulacaoAcordo, TipoDevedor, Titulo,
} from './tipos';
import { criarRnd, chance, entre, escolha, inteiro } from './prng';
import {
  cidade, cnpjFicticio, cpfFicticio, nomeLojista, nomePessoa,
  nomePessoaCompleta, token,
} from './nomes';
import { planoDaRegua, BLOQUEIOS, PRAZO_COMUNICACAO_PREVIA_DIAS, PassoPlano } from './regua';
import { calcularRating, FATOR_REGULARIZACAO } from './rating';
import { addDias, difDias, faixaDoAtraso, faixaDaCasa, FAIXAS_ENTRADA, FAIXAS_CASA } from './formato';
import { enxugarDump, hidratarDump, canonico } from './transporte';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const hoje = new Date().toISOString().slice(0, 10);
const rnd = criarRnd(20261002);
const DIAS_HISTORIA = 90;
const inicio = addDias(hoje, -(DIAS_HISTORIA - 1));

// ------------------------------------------------------------- escritórios

const ESCRITORIOS: Escritorio[] = [
  {
    id: 'e1',
    nome: 'Almeida & Rocha Advogados (fictício)',
    oab: 'OAB/PR 00.000 (fictícia)',
    cidade: 'Curitiba (PR)',
    plano: 'Avançado',
    marca: {
      nomeExibicao: 'Almeida & Rocha Advogados',
      iniciais: 'AR',
      corPrimaria: '#24466E',
      corClara: '#9FBEE8',
      mostrarOperadora: true,
    },
    slaMin: 15,
    usuarios: [
      { nome: 'Dr. Paulo Almeida', papel: 'sócio', oab: '00.001-PR (fictícia)' },
      { nome: 'Dra. Renata Rocha', papel: 'advogado', oab: '00.002-PR (fictícia)' },
      { nome: 'Carla Menezes', papel: 'coordenador' },
      { nome: 'Fábio Teles', papel: 'financeiro' },
    ],
    retencaoGravacoesAnos: 5,
  },
  {
    id: 'e2',
    nome: 'Serra & Taveira Advocacia (fictício)',
    oab: 'OAB/SP 00.000 (fictícia)',
    cidade: 'Campinas (SP)',
    plano: 'Max',
    marca: {
      nomeExibicao: 'Serra & Taveira Advocacia',
      iniciais: 'ST',
      corPrimaria: '#6B2430',
      corClara: '#E2A3AD',
      mostrarOperadora: false, // Max pode remover o rodapé técnico (§9)
    },
    slaMin: 5,
    usuarios: [
      { nome: 'Dra. Luciana Serra', papel: 'sócio', oab: '00.003-SP (fictícia)' },
      { nome: 'Dr. Henrique Taveira', papel: 'advogado', oab: '00.004-SP (fictícia)' },
      { nome: 'Dra. Bianca Luz', papel: 'advogado', oab: '00.005-SP (fictícia)' },
      { nome: 'Rodrigo Pires', papel: 'coordenador' },
    ],
    retencaoGravacoesAnos: 5,
  },
  {
    id: 'e3',
    nome: 'Oliveira Prado Advogados Associados (fictício)',
    oab: 'OAB/PR 00.000 (fictícia)',
    cidade: 'Maringá (PR)',
    plano: 'Básico',
    marca: {
      nomeExibicao: 'Oliveira Prado Advogados',
      iniciais: 'OP',
      corPrimaria: '#463B6B',
      corClara: '#BCAFE6',
      mostrarOperadora: true,
    },
    slaMin: null, // Básico: a equipe do próprio escritório opera pelo console
    usuarios: [
      { nome: 'Dr. Márcio Oliveira Prado', papel: 'sócio', oab: '00.006-PR (fictícia)' },
      { nome: 'Dra. Tainá Freitas', papel: 'advogado', oab: '00.007-PR (fictícia)' },
      { nome: 'Juliana Castro', papel: 'coordenador' },
      { nome: 'Vitor Ramos', papel: 'negociador' },
      { nome: 'Patrícia Gusmão', papel: 'negociador' },
      { nome: 'André Luz', papel: 'negociador' },
    ],
    retencaoGravacoesAnos: 5,
  },
];

const ANALISTAS: AnalistaSentinella[] = [
  { id: 'an1', nome: 'Marina Duarte', turno: '8h–15h', escritorioIds: ['e1', 'e2'] },
  { id: 'an2', nome: 'Rafael Nogueira', turno: '15h–22h', escritorioIds: ['e1', 'e2'] },
];

// -------------------------------------------------- credores e carteiras

interface DefCarteira extends Omit<Carteira, 'id' | 'escritorioId' | 'credorId'> {
  qtdDevedores: number;
  qtdTitulos: number;
  valorMin: number;
  valorMax: number;
  caudaAlta: number; // chance de valor bem maior
  mixFaixas: [number, number, number, number]; // até30, 31–90, 91–180, 180+
  pontualidadeBase: number; // 0–1: quão pagadora é a carteira
}

interface DefCredor {
  nome: string;
  setor: Credor['setor'];
  honorariosPct: number;
  carteiras: DefCarteira[];
}

const alcadaPadrao = { descontoMaxPct: 10, parcelasMax: 6, prazoMaxDias: 90, entradaMinPct: 10 };

const CREDORES_POR_ESC: Record<string, DefCredor[]> = {
  e1: [
    {
      nome: 'Colégio Horizonte (fictício)', setor: 'educação', honorariosPct: 15,
      carteiras: [
        {
          nome: 'Mensalidades 2025', tipo: 'educação', devedores: 'PF',
          alcada: { descontoMaxPct: 15, parcelasMax: 8, prazoMaxDias: 120, entradaMinPct: 10 },
          canais: ['WhatsApp', 'SMS', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: inicio,
          qtdDevedores: 620, qtdTitulos: 2600, valorMin: 420, valorMax: 1650, caudaAlta: 0.02,
          mixFaixas: [0.3, 0.4, 0.2, 0.1], pontualidadeBase: 0.6,
        },
        {
          nome: 'Mensalidades 2024 (legado)', tipo: 'educação', devedores: 'PF',
          alcada: { descontoMaxPct: 25, parcelasMax: 10, prazoMaxDias: 150, entradaMinPct: 5 },
          canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 7),
          qtdDevedores: 340, qtdTitulos: 1500, valorMin: 380, valorMax: 1500, caudaAlta: 0.01,
          mixFaixas: [0, 0.1, 0.35, 0.55], pontualidadeBase: 0.35,
        },
      ],
    },
    {
      nome: 'Central Condomínios Administradora (fictícia)', setor: 'condomínio', honorariosPct: 12,
      carteiras: [
        {
          nome: 'Taxas condominiais — Zona Norte', tipo: 'condomínio', devedores: 'PF',
          alcada: { descontoMaxPct: 8, parcelasMax: 6, prazoMaxDias: 90, entradaMinPct: 15 },
          canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor e escritório',
          contaEmissora: 'conta do escritório', entradaEm: addDias(inicio, 3),
          qtdDevedores: 440, qtdTitulos: 1700, valorMin: 320, valorMax: 1300, caudaAlta: 0.03,
          mixFaixas: [0.25, 0.4, 0.25, 0.1], pontualidadeBase: 0.55,
        },
        {
          nome: 'Taxas condominiais — Centro', tipo: 'condomínio', devedores: 'PF',
          alcada: alcadaPadrao,
          canais: ['WhatsApp', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor e escritório',
          contaEmissora: 'conta do escritório', entradaEm: addDias(inicio, 21),
          qtdDevedores: 300, qtdTitulos: 1100, valorMin: 350, valorMax: 1500, caudaAlta: 0.03,
          mixFaixas: [0.35, 0.4, 0.2, 0.05], pontualidadeBase: 0.6,
        },
      ],
    },
    {
      nome: 'Clínica Vida Plena (fictícia)', setor: 'saúde', honorariosPct: 18,
      carteiras: [
        {
          nome: 'Atendimentos particulares', tipo: 'saúde', devedores: 'PF',
          alcada: { descontoMaxPct: 20, parcelasMax: 10, prazoMaxDias: 150, entradaMinPct: 5 },
          canais: ['WhatsApp', 'SMS', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 10),
          qtdDevedores: 520, qtdTitulos: 1400, valorMin: 150, valorMax: 3800, caudaAlta: 0.05,
          mixFaixas: [0.2, 0.35, 0.3, 0.15], pontualidadeBase: 0.45,
        },
      ],
    },
  ],
  e2: [
    {
      nome: 'Faculdade Ipê (fictícia)', setor: 'educação', honorariosPct: 14,
      carteiras: [
        {
          nome: 'Mensalidades graduação', tipo: 'educação', devedores: 'PF',
          alcada: { descontoMaxPct: 18, parcelasMax: 12, prazoMaxDias: 180, entradaMinPct: 8 },
          canais: ['WhatsApp', 'SMS', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: inicio,
          qtdDevedores: 700, qtdTitulos: 3000, valorMin: 520, valorMax: 1900, caudaAlta: 0.02,
          mixFaixas: [0.3, 0.35, 0.22, 0.13], pontualidadeBase: 0.55,
        },
        {
          nome: 'Acordos rompidos (recuperação)', tipo: 'educação', devedores: 'PF',
          alcada: { descontoMaxPct: 30, parcelasMax: 12, prazoMaxDias: 180, entradaMinPct: 5 },
          canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 14),
          qtdDevedores: 260, qtdTitulos: 900, valorMin: 600, valorMax: 2600, caudaAlta: 0.02,
          mixFaixas: [0, 0.05, 0.3, 0.65], pontualidadeBase: 0.3,
        },
      ],
    },
    {
      nome: 'Hospital Santa Clara (fictício)', setor: 'saúde', honorariosPct: 16,
      carteiras: [
        {
          nome: 'Internações e procedimentos', tipo: 'saúde', devedores: 'PF',
          alcada: { descontoMaxPct: 22, parcelasMax: 12, prazoMaxDias: 180, entradaMinPct: 5 },
          canais: ['WhatsApp', 'SMS', 'e-mail', 'carta', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 5),
          qtdDevedores: 540, qtdTitulos: 1400, valorMin: 300, valorMax: 9500, caudaAlta: 0.08,
          mixFaixas: [0.2, 0.35, 0.28, 0.17], pontualidadeBase: 0.4,
        },
        {
          // Carteira SEM encargos cadastrados: as mensagens e o portal não
          // mencionam multa/juros (regra do v2 §12 que continua no v3).
          nome: 'Pronto atendimento (sem encargos cadastrados)', tipo: 'saúde', devedores: 'PF',
          alcada: alcadaPadrao,
          canais: ['WhatsApp', 'SMS', 'e-mail'], multaPct: null, jurosMesPct: null,
          baseLegal: 'legítimo interesse do credor', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 28),
          qtdDevedores: 320, qtdTitulos: 700, valorMin: 120, valorMax: 900, caudaAlta: 0.01,
          mixFaixas: [0.45, 0.4, 0.15, 0], pontualidadeBase: 0.6,
        },
      ],
    },
    {
      nome: 'Magazine Diamante (fictícia)', setor: 'varejo', honorariosPct: 15,
      carteiras: [
        {
          nome: 'Crediário loja — varejo', tipo: 'varejo', devedores: 'PF e PJ',
          alcada: { descontoMaxPct: 15, parcelasMax: 8, prazoMaxDias: 120, entradaMinPct: 10 },
          canais: ['WhatsApp', 'SMS', 'ligação'], multaPct: 2, jurosMesPct: 1.5,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 12),
          qtdDevedores: 580, qtdTitulos: 1200, valorMin: 180, valorMax: 4200, caudaAlta: 0.04,
          mixFaixas: [0.25, 0.35, 0.25, 0.15], pontualidadeBase: 0.45,
        },
      ],
    },
  ],
  e3: [
    {
      nome: 'Alvorada Administradora de Condomínios (fictícia)', setor: 'condomínio', honorariosPct: 12,
      carteiras: [
        {
          nome: 'Condomínios residenciais', tipo: 'condomínio', devedores: 'PF',
          alcada: alcadaPadrao,
          canais: ['WhatsApp', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor e escritório',
          contaEmissora: 'conta do escritório', entradaEm: addDias(inicio, 2),
          qtdDevedores: 380, qtdTitulos: 1500, valorMin: 300, valorMax: 1400, caudaAlta: 0.02,
          mixFaixas: [0.3, 0.4, 0.2, 0.1], pontualidadeBase: 0.55,
        },
        {
          nome: 'Condomínios comerciais', tipo: 'condomínio', devedores: 'PJ',
          alcada: alcadaPadrao,
          canais: ['WhatsApp', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor e escritório',
          contaEmissora: 'conta do escritório', entradaEm: addDias(inicio, 16),
          qtdDevedores: 180, qtdTitulos: 600, valorMin: 600, valorMax: 3800, caudaAlta: 0.04,
          mixFaixas: [0.3, 0.4, 0.2, 0.1], pontualidadeBase: 0.55,
        },
      ],
    },
    {
      nome: 'Pinheiro Distribuidora de Autopeças (fictícia)', setor: 'indústria', honorariosPct: 10,
      carteiras: [
        {
          nome: 'Duplicatas lojistas', tipo: 'indústria', devedores: 'PJ',
          alcada: { descontoMaxPct: 8, parcelasMax: 4, prazoMaxDias: 60, entradaMinPct: 20 },
          canais: ['WhatsApp', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 6),
          qtdDevedores: 300, qtdTitulos: 1300, valorMin: 800, valorMax: 18000, caudaAlta: 0.06,
          mixFaixas: [0.4, 0.35, 0.18, 0.07], pontualidadeBase: 0.6,
        },
        {
          nome: 'Grandes contas (negociação direta)', tipo: 'indústria', devedores: 'PJ',
          alcada: { descontoMaxPct: 12, parcelasMax: 6, prazoMaxDias: 90, entradaMinPct: 15 },
          canais: ['e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 30),
          qtdDevedores: 60, qtdTitulos: 300, valorMin: 5000, valorMax: 48000, caudaAlta: 0.1,
          mixFaixas: [0.35, 0.4, 0.2, 0.05], pontualidadeBase: 0.65,
        },
        {
          nome: 'Lojistas de bairro (parcelamento direto)', tipo: 'indústria', devedores: 'PJ',
          alcada: { descontoMaxPct: 10, parcelasMax: 6, prazoMaxDias: 90, entradaMinPct: 15 },
          canais: ['WhatsApp', 'e-mail', 'ligação'], multaPct: 2, jurosMesPct: 1,
          baseLegal: 'execução de contrato', controlador: 'credor',
          contaEmissora: 'conta do credor', entradaEm: addDias(inicio, 20),
          qtdDevedores: 460, qtdTitulos: 800, valorMin: 400, valorMax: 6500, caudaAlta: 0.03,
          mixFaixas: [0.35, 0.35, 0.2, 0.1], pontualidadeBase: 0.5,
        },
      ],
    },
  ],
};

// ------------------------------------------------------------- utilidades

const contadores = { credor: 0, carteira: 0, devedor: 0, titulo: 0, acao: 0, exc: 0, acordo: 0, doc: 0, blq: 0 };
const nomesPJ = new Set<string>();

const canalCurto: Record<Canal, string> = {
  WhatsApp: 'w', SMS: 's', 'e-mail': 'm', carta: 'c', 'ligação': 'l',
};

function faixaVazia(rotulos: readonly string[]): FaixaValor[] {
  return rotulos.map((rotulo) => ({ rotulo, valor: 0, qtd: 0 }));
}

function somaFaixa(faixas: FaixaValor[], rotulo: string, valor: number) {
  const f = faixas.find((x) => x.rotulo === rotulo)!;
  f.valor = Math.round(f.valor + valor);
  f.qtd++;
}

const MOTIVOS_EXC = [
  { motivo: 'Devedor pediu para falar com uma pessoa', peso: 26 },
  { motivo: 'Pedido de acordo fora da alçada da carteira', peso: 26 },
  { motivo: 'Contestação da dívida — cobrança pausada', peso: 14 },
  { motivo: 'Pedido de não contato por um canal', peso: 10 },
  { motivo: 'Vulnerabilidade declarada — atenção especial (Lei 14.181)', peso: 8 },
  { motivo: 'IA sem resposta confiável', peso: 16 },
];

function sorteiaMotivo(): string {
  const total = MOTIVOS_EXC.reduce((s, m) => s + m.peso, 0);
  let x = rnd() * total;
  for (const m of MOTIVOS_EXC) {
    x -= m.peso;
    if (x <= 0) return m.motivo;
  }
  return MOTIVOS_EXC[0].motivo;
}

function conversaPara(motivo: string): Mensagem[] {
  const base: Mensagem[] = [
    { de: 'IA', texto: 'Olá! Falo em nome do escritório sobre um débito em aberto. Posso enviar as opções de pagamento ou de acordo?', minAtras: 34 },
  ];
  if (motivo.includes('Contestação')) {
    base.push({ de: 'devedor', texto: 'Essa cobrança está errada — esse valor já foi pago direto na escola.', minAtras: 28 });
    base.push({ de: 'IA', texto: 'Entendi. Registrei a contestação e pausei a cobrança deste título. O escritório vai verificar e te retorna.', minAtras: 27 });
  } else if (motivo.includes('fora da alçada')) {
    base.push({ de: 'devedor', texto: 'Só consigo pagar em mais vezes do que isso, com parcela menor.', minAtras: 25 });
    base.push({ de: 'IA', texto: 'Essa condição passa da alçada desta carteira. Vou acionar um atendente para ver o seu caso.', minAtras: 24 });
  } else if (motivo.includes('não contato')) {
    base.push({ de: 'devedor', texto: 'Não quero mais receber mensagens por aqui, por favor.', minAtras: 22 });
    base.push({ de: 'IA', texto: 'Certo — bloqueei este canal para você agora. Um atendente define o próximo passo pelos outros contatos.', minAtras: 21 });
  } else if (motivo.includes('Vulnerabilidade')) {
    base.push({ de: 'devedor', texto: 'Sou aposentada e estou com dificuldade, não sei como vou pagar isso.', minAtras: 26 });
    base.push({ de: 'IA', texto: 'Obrigada por me contar. Vou passar seu caso para uma pessoa da equipe com prioridade, sem nenhuma pressão.', minAtras: 25 });
  } else if (motivo.includes('pessoa')) {
    base.push({ de: 'devedor', texto: 'Prefiro resolver isso falando com alguém.', minAtras: 20 });
    base.push({ de: 'IA', texto: 'Claro. Uma pessoa da equipe assume esta conversa em instantes.', minAtras: 19 });
  } else {
    base.push({ de: 'devedor', texto: 'Esse valor não bate com o meu contrato.', minAtras: 23 });
    base.push({ de: 'IA', texto: 'Para não passar nada errado, uma pessoa vai conferir os dados da carteira e te responder.', minAtras: 22 });
  }
  return base;
}

// ------------------------------------------------------- geração por carteira

interface PerfilDevedor { pontual: number; respondeH: number | null }

function gerarEscritorio(esc: Escritorio): DadosEscritorio {
  const credores: Credor[] = [];
  const carteiras: Carteira[] = [];
  const agregados: AgregadosCarteira[] = [];
  const devedores: Devedor[] = [];
  const titulos: Titulo[] = [];
  const filaHoje: Acao[] = [];
  const excecoes: Excecao[] = [];
  const acordos: DadosEscritorio['acordos'] = [];
  const documentos: DocumentoJuridico[] = [];
  const honorarios: DadosEscritorio['honorarios'] = [];
  const bloqueios: BloqueioConformidade[] = [];
  const perfis = new Map<string, PerfilDevedor>();
  const advogados = esc.usuarios.filter((u) => u.papel === 'advogado' || u.papel === 'sócio');
  const operadores = esc.plano === 'Básico'
    ? esc.usuarios.filter((u) => u.papel === 'negociador').map((u) => u.nome)
    : ANALISTAS.map((a) => a.nome);

  const recuperadoPorCredorMes = new Map<string, number>();

  for (const defCredor of CREDORES_POR_ESC[esc.id]) {
    const credor: Credor = {
      id: `cr${++contadores.credor}`,
      escritorioId: esc.id,
      nome: defCredor.nome,
      setor: defCredor.setor,
      contatoNome: nomePessoa(rnd),
      honorariosPct: defCredor.honorariosPct,
      token: token(rnd),
    };
    credores.push(credor);

    for (const def of defCredor.carteiras) {
      const carteira: Carteira = {
        id: `ca${++contadores.carteira}`,
        escritorioId: esc.id,
        credorId: credor.id,
        nome: def.nome,
        tipo: def.tipo,
        devedores: def.devedores,
        alcada: def.alcada,
        canais: def.canais,
        multaPct: def.multaPct,
        jurosMesPct: def.jurosMesPct,
        baseLegal: def.baseLegal,
        controlador: def.controlador,
        contaEmissora: def.contaEmissora,
        entradaEm: def.entradaEm,
      };
      carteiras.push(carteira);

      const ag: AgregadosCarteira = {
        carteiraId: carteira.id,
        credorId: credor.id,
        qtdTitulos: 0,
        qtdDevedores: def.qtdDevedores,
        valorEntregue: 0,
        valorAberto: 0,
        recuperadoMes: 0,
        recuperadoAcumulado: 0,
        pagosQtd: 0,
        faixasEntrada: faixaVazia(FAIXAS_ENTRADA),
        faixasCasa: faixaVazia(FAIXAS_CASA),
        eficienciaCanal: (['WhatsApp', 'SMS', 'e-mail', 'carta'] as Canal[])
          .filter((c) => def.canais.includes(c))
          .map((canal) => ({ canal, enviadas: 0, entregues: 0, lidas: 0, respondidas: 0, pagas48h: 0 })),
        eficienciaEtapa: [],
        ligacoes: { realizadas: 0, atendidas: 0, naoAtendidas: 0, promessasObtidas: 0, promessasCumpridas: 0, pagasEm7d: 0 },
        recuperadoPorSemana: Array.from({ length: 6 }, (_, i) => ({ rotulo: `S${i + 1}`, valor: 0 })),
        distribuicaoRating: (['A', 'B', 'C', 'D', 'E'] as Letra[]).map((letra) => ({ letra, qtd: 0 })),
        ratingMedio: 0,
        promessasFeitas: 0,
        promessasCumpridas: 0,
        acordosVigentes: 0,
        previsaoAcordos: 0,
        score: 0,
      };
      agregados.push(ag);
      const etapaStats = new Map<string, { acoes: number; pagos48h: number }>();
      const marcaEtapa = (etapa: string, pagou48: boolean) => {
        const atual = etapaStats.get(etapa) ?? { acoes: 0, pagos48h: 0 };
        atual.acoes++;
        if (pagou48) atual.pagos48h++;
        etapaStats.set(etapa, atual);
      };

      // Devedores da carteira.
      const devsDaCarteira: Devedor[] = [];
      for (let i = 0; i < def.qtdDevedores; i++) {
        const seq = ++contadores.devedor;
        const tipo: TipoDevedor =
          def.devedores === 'PF e PJ' ? (chance(rnd, 0.75) ? 'PF' : 'PJ') : def.devedores;
        const bloqueado = chance(rnd, 0.02);
        const canaisBloq = def.canais.filter((c) => c !== 'ligação');
        const dev: Devedor = {
          id: `d${seq}`,
          escritorioId: esc.id,
          credorId: credor.id,
          carteiraId: carteira.id,
          tipo,
          nome: tipo === 'PF' ? nomePessoaCompleta(rnd) : nomeLojista(rnd, nomesPJ),
          doc: tipo === 'PF' ? cpfFicticio(seq) : cnpjFicticio(seq),
          cidade: cidade(rnd),
          canaisBloqueados: bloqueado && canaisBloq.length ? [escolha(rnd, canaisBloq)] : [],
          vulneravel: tipo === 'PF' && chance(rnd, 0.015),
          rating: 'C', ratingTotal: 50, ratingBase: [], ratingNovo: false,
          titulosAbertos: 0, valorAberto: 0, diasDesdeEntrada: 0, maiorAtrasoTotal: 0,
        };
        devsDaCarteira.push(dev);
        devedores.push(dev);
        perfis.set(dev.id, {
          pontual: Math.min(1, rnd() * 0.7 + def.pontualidadeBase * 0.6),
          respondeH: chance(rnd, 0.08) ? null : Math.round(entre(rnd, 2, 60)),
        });
      }

      const semanasDisponiveis = Math.max(1, Math.floor(difDias(hoje, carteira.entradaEm) / 7));

      // Títulos e trilha simulada pela régua reancorada.
      for (let i = 0; i < def.qtdTitulos; i++) {
        const dev = escolha(rnd, devsDaCarteira);
        const perfil = perfis.get(dev.id)!;
        const lote = inteiro(rnd, 0, semanasDisponiveis - 1);
        const entrada = addDias(carteira.entradaEm, 7 * lote + inteiro(rnd, 0, 2));
        if (difDias(hoje, entrada) < 0) continue;

        const m = def.mixFaixas;
        const u = rnd();
        const atrasoOriginal =
          u < m[0] ? inteiro(rnd, 5, 30)
          : u < m[0] + m[1] ? inteiro(rnd, 31, 90)
          : u < m[0] + m[1] + m[2] ? inteiro(rnd, 91, 180)
          : inteiro(rnd, 181, 540);
        const faixa = faixaDoAtraso(atrasoOriginal);
        const valorOriginal = Math.round(
          entre(rnd, def.valorMin, def.valorMax) + (chance(rnd, def.caudaAlta) ? entre(rnd, def.valorMax, def.valorMax * 4) : 0),
        );
        const antecipado = dev.tipo === 'PJ' && def.tipo === 'indústria' && chance(rnd, 0.12);

        const t: Titulo = {
          id: `t${++contadores.titulo}`,
          escritorioId: esc.id,
          credorId: credor.id,
          carteiraId: carteira.id,
          devedorId: dev.id,
          numero: `${carteira.id.toUpperCase()}-${5000 + contadores.titulo}`,
          valorOriginal,
          valorAtualizado: valorOriginal,
          vencimentoOriginal: addDias(entrada, -atrasoOriginal),
          entradaCarteira: entrada,
          atrasoOriginal,
          faixaEntrada: faixa,
          antecipado,
          estado: 'em cobrança',
          pagoEm: null,
          contestadoEm: null,
          comunicacaoPreviaEm: null,
          etapaAtual: 'E+0 · programada',
          trilha: [],
        };

        const diasNaCasa = difDias(hoje, entrada);
        const plano = planoDaRegua(carteira, faixa);
        const responde = perfil.respondeH != null;
        let pagouEm: string | null = null;
        let encerrou = false;
        let ultimaEtapa = 'E+0 · programada';

        const empurraFila = (passo: PassoPlano, data: string, estado: Acao['estado'], resultado: string | null, motivoBloqueio: string | null = null) => {
          const dHoje = difDias(data, hoje);
          if (dHoje < -3 || dHoje > 3) return;
          filaHoje.push({
            id: `a${++contadores.acao}`,
            escritorioId: esc.id, credorId: credor.id, carteiraId: carteira.id,
            devedorId: dev.id, tituloId: t.id,
            etapa: passo.etapa, descricao: passo.descricao, canal: passo.canal,
            quem: passo.quem, data, estado, resultado, motivoBloqueio,
          });
        };

        const trilha = (passo: PassoPlano, data: string, cod: string, canal?: Canal) => {
          t.trilha.push(`${passo.etapa}|${difDias(hoje, data)}|${canalCurto[canal ?? passo.canal]}|${cod}`);
        };

        const criaAcordo = (data: string): boolean => {
          const parcelas = inteiro(rnd, 2, carteira.alcada.parcelasMax);
          const juros = Math.round(t.valorOriginal * 0.008 * parcelas);
          const total = t.valorOriginal + juros;
          const criadoHa = difDias(hoje, data);
          const pagas = Math.min(parcelas, Math.floor(criadoHa / 30) + (chance(rnd, 0.6) ? 1 : 0));
          const quitado = pagas >= parcelas;
          acordos.push({
            id: `ac${++contadores.acordo}`,
            escritorioId: esc.id, carteiraId: carteira.id, devedorId: dev.id,
            tituloIds: [t.id],
            valorTotal: total, jurosEmbutidos: juros,
            parcelas, parcelasPagas: Math.max(0, Math.min(pagas, parcelas)),
            status: quitado ? 'quitado' : chance(rnd, 0.8) ? 'em dia' : 'atrasado',
            origem: chance(rnd, 0.6) ? 'portal' : 'analista',
            criadoEm: data,
          });
          t.trilha.push(`E+2|${difDias(hoje, data)}|w|acc`);
          if (quitado) {
            pagouEm = addDias(data, parcelas * 30);
            if (difDias(hoje, pagouEm) < 0) pagouEm = addDias(hoje, -inteiro(rnd, 0, 5));
            return false; // segue para registrar o pagamento
          }
          t.estado = 'acordo';
          ag.acordosVigentes++;
          ag.previsaoAcordos += Math.round((total / parcelas) * (parcelas - Math.max(0, pagas)));
          ultimaEtapa = 'acordo · em pagamento';
          return true;
        };

        for (const passo of plano) {
          if (encerrou) break;
          const data = addDias(entrada, passo.off);
          const diasNoFuturo = difDias(data, hoje);

          if (diasNoFuturo > 0) {
            if (diasNoFuturo <= 3) empurraFila(passo, data, 'agendada', null);
            ultimaEtapa = `${passo.etapa} · programada`;
            break;
          }

          // Canal bloqueado a pedido do devedor (§3) — trava visível.
          if (dev.canaisBloqueados.includes(passo.canal)) {
            trilha(passo, data, 'blq');
            empurraFila(passo, data, 'bloqueada', null, BLOQUEIOS.canal);
            if (difDias(hoje, data) <= 20 && bloqueios.length < 60) {
              bloqueios.push({
                id: `b${++contadores.blq}`, escritorioId: esc.id, carteiraId: carteira.id,
                regra: BLOQUEIOS.canal, detalhe: `${passo.etapa} por ${passo.canal} — ${dev.nome}`, em: data,
              });
            }
            ultimaEtapa = `${passo.etapa} · bloqueada`;
            continue;
          }

          if (passo.tipo === 'ligação' || (passo.tipo === 'última proposta' && passo.canal === 'ligação')) {
            ag.ligacoes.realizadas++;
            marcaEtapa(passo.etapa, false);
            const atendeu = chance(rnd, 0.58);
            if (!atendeu) {
              ag.ligacoes.naoAtendidas++;
              trilha(passo, data, 'na');
              empurraFila(passo, data, 'não atendida', 'não atendida — reprogramada para o dia seguinte');
              ultimaEtapa = `${passo.etapa} · não atendida`;
            } else {
              ag.ligacoes.atendidas++;
              const promete = responde && chance(rnd, 0.5);
              trilha(passo, data, promete ? 'atp' : 'at');
              empurraFila(passo, data, 'finalizada', promete ? 'atendida — promessa de pagamento' : 'atendida');
              ultimaEtapa = `${passo.etapa} · atendida`;
              if (promete) {
                ag.promessasFeitas++;
                ag.ligacoes.promessasObtidas++;
                const para = addDias(data, inteiro(rnd, 2, 6));
                const cumpre = chance(rnd, 0.3 + perfil.pontual * 0.45);
                if (cumpre && difDias(hoje, para) >= 0) {
                  pagouEm = addDias(para, -inteiro(rnd, 0, 1));
                  ag.promessasCumpridas++;
                  ag.ligacoes.promessasCumpridas++;
                  ag.ligacoes.pagasEm7d++;
                }
              }
              if (!pagouEm && responde && chance(rnd, 0.1)) {
                encerrou = criaAcordo(data);
              }
            }
          } else if (passo.tipo === 'comunicação prévia') {
            t.comunicacaoPreviaEm = data;
            trilha(passo, data, 'prev');
            marcaEtapa(passo.etapa, false);
            empurraFila(passo, data, 'finalizada', 'enviada com prova de envio');
            documentos.push({
              id: `doc${++contadores.doc}`, escritorioId: esc.id, carteiraId: carteira.id,
              tituloIds: [t.id], devedorId: dev.id, tipo: 'comunicação prévia',
              status: 'enviado com prova', valor: t.valorOriginal, geradoEm: data, assinadoPor: null,
            });
            ultimaEtapa = `${passo.etapa} · comunicação prévia enviada`;
          } else if (passo.tipo === 'notificação') {
            const assinada = chance(rnd, 0.85);
            const adv = escolha(rnd, advogados);
            documentos.push({
              id: `doc${++contadores.doc}`, escritorioId: esc.id, carteiraId: carteira.id,
              tituloIds: [t.id], devedorId: dev.id, tipo: 'notificação extrajudicial',
              status: assinada ? 'assinado' : 'a assinar', valor: t.valorOriginal,
              geradoEm: data, assinadoPor: assinada ? `${adv.nome} — ${adv.oab}` : null,
            });
            marcaEtapa(passo.etapa, false);
            if (assinada) {
              trilha(passo, data, 'notif');
              empurraFila(passo, data, 'finalizada', 'notificação enviada');
              ultimaEtapa = `${passo.etapa} · notificação enviada`;
            } else {
              empurraFila(passo, data, 'pendente', 'aguarda assinatura do advogado');
              ultimaEtapa = `${passo.etapa} · aguarda assinatura`;
            }
          } else if (passo.tipo === 'negativação') {
            marcaEtapa(passo.etapa, false);
            // Trava do CDC: nunca negativar sem comunicação prévia com prazo.
            const previaOk =
              t.comunicacaoPreviaEm != null &&
              difDias(data, t.comunicacaoPreviaEm) >= PRAZO_COMUNICACAO_PREVIA_DIAS;
            if (!previaOk) {
              trilha(passo, data, 'blq');
              empurraFila(passo, data, 'bloqueada', null, BLOQUEIOS.previa);
              if (bloqueios.length < 60)
                bloqueios.push({
                  id: `b${++contadores.blq}`, escritorioId: esc.id, carteiraId: carteira.id,
                  regra: BLOQUEIOS.previa, detalhe: `${t.numero} — ${dev.nome}`, em: data,
                });
              ultimaEtapa = `${passo.etapa} · bloqueada pela conformidade`;
              continue;
            }
            const subtipo = dev.tipo === 'PJ' && chance(rnd, 0.7) ? 'protesto' : 'negativação';
            const autorizada = chance(rnd, 0.62) && difDias(hoje, data) >= 2;
            documentos.push({
              id: `doc${++contadores.doc}`, escritorioId: esc.id, carteiraId: carteira.id,
              tituloIds: [t.id], devedorId: dev.id, tipo: 'autorização', subtipo,
              status: autorizada ? 'assinado' : 'aguarda autorização',
              valor: t.valorOriginal, geradoEm: data,
              assinadoPor: autorizada ? escolha(rnd, advogados).nome : null,
            });
            trilha(passo, data, autorizada ? (subtipo === 'protesto' ? 'prot' : 'neg') : 'aut');
            empurraFila(passo, data, autorizada ? 'finalizada' : 'pendente',
              autorizada ? `${subtipo} registrada` : 'aguarda autorização do escritório');
            if (autorizada) {
              t.estado = subtipo === 'protesto' ? 'protestado' : 'negativado';
              ultimaEtapa = `${passo.etapa} · ${subtipo} registrada`;
            } else {
              ultimaEtapa = `${passo.etapa} · aguarda autorização`;
            }
          } else if (passo.tipo === 'judicial') {
            documentos.push({
              id: `doc${++contadores.doc}`, escritorioId: esc.id, carteiraId: carteira.id,
              tituloIds: [t.id], devedorId: dev.id, tipo: 'dossiê judicial',
              status: 'pronto', valor: t.valorOriginal, geradoEm: data, assinadoPor: null,
            });
            trilha(passo, data, 'dos');
            marcaEtapa(passo.etapa, false);
            if (chance(rnd, 0.6)) {
              t.estado = 'judicial';
              empurraFila(passo, data, 'finalizada', 'encaminhado ao fluxo judicial do escritório');
              ultimaEtapa = `${passo.etapa} · no judicial`;
            } else {
              empurraFila(passo, data, 'pendente', 'dossiê pronto — aguarda o escritório puxar');
              ultimaEtapa = `${passo.etapa} · dossiê pronto`;
            }
            encerrou = true;
          } else {
            // Mensagem ou proposta da IA.
            const ec = ag.eficienciaCanal.find((c) => c.canal === passo.canal);
            if (ec) {
              ec.enviadas++;
              ec.entregues++;
              const leu = chance(rnd, 0.72);
              if (leu) ec.lidas++;
              const respondeu = leu && responde && chance(rnd, 0.4);
              if (respondeu) ec.respondidas++;
              const baseProb =
                (passo.tipo === 'proposta' || passo.tipo === 'última proposta' ? 0.16 : 0.08) *
                (0.5 + perfil.pontual) *
                (faixa === 'até 30' ? 1.4 : faixa === '31–90' ? 1 : faixa === '91–180' ? 0.7 : 0.45);
              const pagou48 = (respondeu && chance(rnd, Math.min(0.5, baseProb * 2.2))) || (!respondeu && chance(rnd, baseProb * 0.4));
              trilha(passo, data, pagou48 ? 'pg48' : respondeu ? 'resp' : leu ? 'lid' : 'ent');
              marcaEtapa(passo.etapa, pagou48);
              empurraFila(passo, data, 'finalizada', pagou48 ? 'pago em até 48h após o contato' : respondeu ? 'respondido' : leu ? 'lido' : 'entregue');
              ultimaEtapa = `${passo.etapa} · ${respondeu ? 'respondido' : 'enviado'}`;
              if (pagou48) {
                ec.pagas48h++;
                pagouEm = addDias(data, inteiro(rnd, 0, 2));
              } else if (respondeu && (passo.tipo === 'proposta' || passo.tipo === 'última proposta') && chance(rnd, 0.3)) {
                if (chance(rnd, 0.12)) {
                  t.estado = 'contestado';
                  t.contestadoEm = data;
                  trilha(passo, data, 'ctt');
                  ultimaEtapa = 'contestado · cobrança pausada';
                  encerrou = true;
                } else {
                  encerrou = criaAcordo(data);
                }
              }
            }
          }

          if (pagouEm && difDias(hoje, pagouEm) >= 0) {
            t.estado = 'pago';
            t.pagoEm = pagouEm;
            encerrou = true;
          }
          if (encerrou) break;
          if (passo.off >= diasNaCasa) break;
        }

        if (pagouEm && t.estado !== 'pago' && difDias(hoje, pagouEm) >= 0) {
          t.estado = 'pago';
          t.pagoEm = pagouEm;
        }

        // Encargos da carteira (nunca "padrão": só com cadastro).
        const mesesAtraso = Math.min(18, (t.atrasoOriginal + difDias(t.pagoEm ?? hoje, entrada)) / 30);
        if (carteira.multaPct != null && carteira.jurosMesPct != null) {
          t.valorAtualizado = Math.round(
            t.valorOriginal * (1 + carteira.multaPct / 100 + (carteira.jurosMesPct / 100) * mesesAtraso),
          );
        }

        t.etapaAtual = t.estado === 'pago' ? 'quitado'
          : t.estado === 'contestado' ? 'contestado · cobrança pausada'
          : t.estado === 'acordo' ? 'acordo · em pagamento'
          : t.estado === 'judicial' ? 'no judicial'
          : ultimaEtapa;

        // Agregados da carteira.
        ag.qtdTitulos++;
        ag.valorEntregue += t.valorOriginal;
        somaFaixa(ag.faixasEntrada, faixa, t.valorOriginal);
        if (t.estado === 'pago') {
          ag.pagosQtd++;
          ag.recuperadoAcumulado += t.valorAtualizado;
          const dPago = difDias(hoje, t.pagoEm!);
          if (t.pagoEm!.slice(0, 7) === hoje.slice(0, 7)) {
            ag.recuperadoMes += t.valorAtualizado;
            recuperadoPorCredorMes.set(credor.id, (recuperadoPorCredorMes.get(credor.id) ?? 0) + t.valorAtualizado);
          }
          if (dPago >= 0 && dPago < 42) ag.recuperadoPorSemana[5 - Math.floor(dPago / 7)].valor += t.valorAtualizado;
        } else if (t.estado !== 'cancelado') {
          ag.valorAberto += t.valorAtualizado;
          somaFaixa(ag.faixasCasa, faixaDaCasa(diasNaCasa), t.valorAtualizado);
          dev.titulosAbertos++;
          dev.valorAberto += t.valorAtualizado;
          dev.diasDesdeEntrada = Math.max(dev.diasDesdeEntrada, diasNaCasa);
          dev.maiorAtrasoTotal = Math.max(dev.maiorAtrasoTotal, atrasoOriginal + diasNaCasa);
        }

        titulos.push(t);
      }

      ag.valorEntregue = Math.round(ag.valorEntregue);
      ag.valorAberto = Math.round(ag.valorAberto);
      ag.recuperadoMes = Math.round(ag.recuperadoMes);
      ag.recuperadoAcumulado = Math.round(ag.recuperadoAcumulado);
      ag.recuperadoPorSemana = ag.recuperadoPorSemana.map((s) => ({ ...s, valor: Math.round(s.valor) }));
      ag.eficienciaEtapa = [...etapaStats.entries()]
        .map(([etapa, s]) => ({
          etapa: etapa as AgregadosCarteira['eficienciaEtapa'][number]['etapa'],
          acoes: s.acoes,
          pagos48h: s.pagos48h,
          conversao: s.acoes ? (s.pagos48h / s.acoes) * 100 : 0,
        }))
        .sort((a, b) => Number(a.etapa.slice(2)) - Number(b.etapa.slice(2)));
    }
  }

  // Rating por devedor (fórmula do §6; no v3 a pontualidade vira "dias até
  // regularizar desde a entrada" — a ficha explica os critérios).
  const titulosPorDevedor = new Map<string, Titulo[]>();
  for (const t of titulos) {
    const lista = titulosPorDevedor.get(t.devedorId) ?? [];
    lista.push(t);
    titulosPorDevedor.set(t.devedorId, lista);
  }
  for (const dev of devedores) {
    const doDev = titulosPorDevedor.get(dev.id) ?? [];
    const perfil = perfis.get(dev.id)!;
    const somaValor = doDev.reduce((s, t) => s + t.valorOriginal, 0) || 1;
    const somaDias = doDev.reduce((s, t) => {
      const fim = t.pagoEm ?? hoje;
      return s + Math.min(90, difDias(fim, t.entradaCarteira)) * t.valorOriginal;
    }, 0);
    const naoResolvidos30 = doDev.filter(
      (t) => t.estado !== 'pago' && difDias(hoje, t.entradaCarteira) > 30,
    ).length;
    const promFeitas = doDev.filter((t) => t.trilha.some((p) => p.endsWith('|atp'))).length;
    const promCumpridas = doDev.filter(
      (t) => t.trilha.some((p) => p.endsWith('|atp')) && t.estado === 'pago',
    ).length;
    const excecoesDoDev = doDev.filter((t) => t.estado === 'contestado').length;

    const base = [
      doDev.length,
      Math.round(((somaDias / somaValor) / FATOR_REGULARIZACAO) * 10) / 10,
      perfil.respondeH ?? -1,
      promFeitas,
      promCumpridas,
      Math.round((naoResolvidos30 / Math.max(1, doDev.length)) * 80),
      Math.round((excecoesDoDev / Math.max(1, doDev.length)) * 100) / 100,
    ];
    const r = calcularRating({
      titulosTotais: base[0],
      diasMediosAtrasoPonderado: base[1],
      horasMediasResposta: base[2] < 0 ? null : base[2],
      promessasFeitas: base[3],
      promessasCumpridas: base[4],
      pctTitulosComAtraso: base[5],
      excecoesPorTitulo: base[6],
    });
    dev.rating = r.letra;
    dev.ratingTotal = r.total;
    dev.ratingBase = base;
    dev.ratingNovo = r.novo;
    dev.valorAberto = Math.round(dev.valorAberto);

    const ag = agregados.find((a) => a.carteiraId === dev.carteiraId)!;
    ag.distribuicaoRating.find((d) => d.letra === r.letra)!.qtd++;
  }
  for (const ag of agregados) {
    const devs = devedores.filter((d) => d.carteiraId === ag.carteiraId);
    ag.ratingMedio = Math.round(devs.reduce((s, d) => s + d.ratingTotal, 0) / Math.max(1, devs.length));
    const taxaRec = ag.valorEntregue ? ag.recuperadoAcumulado / ag.valorEntregue : 0;
    const pctProm = ag.promessasFeitas ? ag.promessasCumpridas / ag.promessasFeitas : 0.6;
    ag.score = Math.round(
      Math.min(99, 25 + 50 * Math.min(1, taxaRec / 0.45) + 15 * pctProm + ag.ratingMedio * 0.1),
    );
  }

  // Bloqueios "de configuração" (texto vetado antes de salvar) e um exemplo
  // de descarte de contato de terceiro na importação — travas visíveis.
  for (const regra of [BLOQUEIOS.texto, BLOQUEIOS.terceiro]) {
    bloqueios.push({
      id: `b${++contadores.blq}`,
      escritorioId: esc.id,
      carteiraId: carteiras[0].id,
      regra,
      detalhe: regra === BLOQUEIOS.texto
        ? 'rascunho de mensagem com termo de pressão indevida — edição devolvida ao coordenador'
        : 'planilha trazia telefone de parente do devedor — campo descartado na importação',
      em: addDias(hoje, -inteiro(rnd, 1, 9)),
    });
  }

  // Exceções da fila de agora (console): abertas e em atendimento, com conversa.
  const abertosGrandes = titulos
    .filter((t) => ['em cobrança', 'em negociação'].includes(t.estado))
    .sort((a, b) => b.valorAtualizado - a.valorAtualizado);
  const qtdExc = 26;
  for (let i = 0; i < qtdExc && i < abertosGrandes.length; i++) {
    const t = abertosGrandes[(i * 7) % abertosGrandes.length];
    const motivo = i === 3 ? MOTIVOS_EXC[4].motivo : sorteiaMotivo();
    const estado: Excecao['estado'] =
      i < 3 ? 'aberta' : i < 5 ? 'em atendimento' : chance(rnd, 0.13) ? 'devolvida ao escritório' : 'resolvida';
    const sla = esc.slaMin;
    const abertaMin =
      estado === 'aberta' ? inteiro(rnd, 1, Math.max(3, (sla ?? 20) - 2)) : inteiro(rnd, 30, 3800);
    if (motivo.includes('fora da alçada') && estado !== 'resolvida') t.estado = 'em negociação';
    excecoes.push({
      id: `e${++contadores.exc}`,
      escritorioId: esc.id,
      carteiraId: t.carteiraId,
      devedorId: t.devedorId,
      tituloId: t.id,
      motivo,
      estado,
      abertaMinAtras: abertaMin,
      slaMin: sla,
      valorEnvolvido: t.valorAtualizado,
      assumidaPor: estado === 'aberta' ? null : escolha(rnd, operadores),
      tempoAteAssumirMin: estado === 'aberta' ? null : inteiro(rnd, 2, Math.max(4, (sla ?? 20) - 1)),
      causa: estado === 'resolvida' || estado === 'devolvida ao escritório'
        ? escolha(rnd, [
            'alçada da carteira apertada para o perfil do devedor',
            'divergência entre a planilha do credor e o contrato',
            'devedor sem contato próprio atualizado',
            'contestação — devolvida ao escritório para responder',
          ])
        : null,
      resolucao: estado === 'resolvida'
        ? escolha(rnd, [
            'acordo fechado dentro da alçada',
            'pagamento confirmado após a conversa',
            'canal trocado a pedido do devedor',
            'caso priorizado por vulnerabilidade — condições facilitadas',
          ])
        : estado === 'devolvida ao escritório'
          ? 'aguardando resposta do escritório'
          : null,
      conversa: conversaPara(motivo),
    });
  }

  // Honorários informativos por credor (a Sentinella não participa — §6.2).
  for (const credor of credores) {
    const rec = Math.round(recuperadoPorCredorMes.get(credor.id) ?? 0);
    honorarios.push({
      credorId: credor.id,
      recuperadoMes: rec,
      pct: credor.honorariosPct,
      valor: Math.round((rec * credor.honorariosPct) / 100),
    });
  }

  // Score do escritório = média das carteiras ponderada pelo valor entregue.
  const pesoTotal = agregados.reduce((s, a) => s + a.valorEntregue, 0) || 1;
  const score = Math.round(agregados.reduce((s, a) => s + a.score * a.valorEntregue, 0) / pesoTotal);
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesAtual = Number(hoje.slice(5, 7)) - 1;
  const evolucao = [3, 2, 1, 0].map((atras, i) => ({
    mes: meses[(mesAtual - atras + 12) % 12],
    valor: Math.max(20, Math.min(99, score - inteiro(rnd, 0, 4) * (3 - i))),
  }));
  evolucao[3].valor = score;

  filaHoje.sort((a, b) => a.data.localeCompare(b.data));

  return {
    escritorio: esc,
    credores,
    carteiras,
    agregados,
    devedores,
    titulos,
    filaHoje,
    excecoes,
    acordos,
    documentos,
    honorarios,
    bloqueios,
    score: { total: score, evolucao },
  };
}

// --------------------------------------------------------------- portais

function simulacoes(valor: number, parcelasMax: number): SimulacaoAcordo[] {
  const opcoes = [2, 4, Math.min(6, parcelasMax), parcelasMax]
    .filter((p, i, arr) => p >= 2 && arr.indexOf(p) === i)
    .slice(0, 3);
  return opcoes.map((parcelas) => {
    const juros = Math.round(valor * 0.008 * parcelas);
    const custoTotal = valor + juros;
    return {
      parcelas,
      valorParcela: Math.round(custoTotal / parcelas),
      custoTotal,
      jurosEmbutidos: juros,
    };
  });
}

function montarPortais(dados: DadosEscritorio[]) {
  const portalDevedores: PortalDevedores = {};
  const portalCredores: PortalCredores = {};
  const tokensDevedor: IndiceSeed['tokensDevedor'] = [];
  const tokensCredor: IndiceSeed['tokensCredor'] = [];

  for (const d of dados) {
    const marca = d.escritorio.marca;
    const candidatos = d.devedores
      .filter((x) => x.valorAberto > 0)
      .sort((a, b) => b.valorAberto - a.valorAberto);
    const amostra = [
      ...candidatos.filter((x) => x.tipo === 'PF').slice(0, 12),
      ...candidatos.filter((x) => x.tipo === 'PJ').slice(0, 6),
    ];
    for (const dev of amostra) {
      const tok = token(rnd);
      dev.token = tok;
      const carteira = d.carteiras.find((c) => c.id === dev.carteiraId)!;
      const credor = d.credores.find((c) => c.id === dev.credorId)!;
      const doDev = d.titulos.filter((t) => t.devedorId === dev.id);
      const abertos = doDev.filter((t) => !['pago', 'cancelado'].includes(t.estado));
      const totalAberto = abertos.reduce((s, t) => s + t.valorAtualizado, 0);
      portalDevedores[tok] = {
        devedor: { nome: dev.nome, doc: dev.doc, tipo: dev.tipo },
        escritorio: {
          nomeExibicao: marca.nomeExibicao,
          oab: d.escritorio.oab,
          corPrimaria: marca.corPrimaria,
          corClara: marca.corClara,
          mostrarOperadora: marca.mostrarOperadora,
          contato: `atendimento@${marca.iniciais.toLowerCase()}.exemplo.invalid`,
        },
        credorOriginal: credor.nome,
        titulosAbertos: abertos.map((t) => ({
          numero: t.numero,
          credor: credor.nome,
          valorOriginal: t.valorOriginal,
          encargos: carteira.multaPct != null ? t.valorAtualizado - t.valorOriginal : null,
          valorAtualizado: t.valorAtualizado,
          vencimentoOriginal: t.vencimentoOriginal,
          estado: t.estado,
        })),
        titulosPagos: doDev
          .filter((t) => t.estado === 'pago')
          .slice(-4)
          .map((t) => ({ numero: t.numero, valor: t.valorAtualizado, pagoEm: t.pagoEm! })),
        acordos: d.acordos
          .filter((a) => a.devedorId === dev.id)
          .map((a) => ({
            valorTotal: a.valorTotal, parcelas: a.parcelas,
            parcelasPagas: a.parcelasPagas, status: a.status,
          })),
        alcada: {
          parcelasMax: carteira.alcada.parcelasMax,
          descontoMaxPct: carteira.alcada.descontoMaxPct,
        },
        simulacoes: simulacoes(Math.round(totalAberto), carteira.alcada.parcelasMax),
      };
    }
    const destaque = amostra[0];
    if (destaque?.token)
      tokensDevedor.push({ token: destaque.token, devedor: destaque.nome, escritorio: marca.nomeExibicao });

    for (const credor of d.credores) {
      portalCredores[credor.token] = {
        credor: { nome: credor.nome, contatoNome: credor.contatoNome },
        escritorio: {
          nomeExibicao: marca.nomeExibicao,
          oab: d.escritorio.oab,
          corPrimaria: marca.corPrimaria,
          corClara: marca.corClara,
          mostrarOperadora: marca.mostrarOperadora,
        },
        hoje,
        carteiras: d.agregados
          .filter((a) => a.credorId === credor.id)
          .map((a) => {
            const c = d.carteiras.find((x) => x.id === a.carteiraId)!;
            return {
              nome: c.nome,
              tipo: c.tipo,
              qtdTitulos: a.qtdTitulos,
              qtdDevedores: a.qtdDevedores,
              valorEntregue: a.valorEntregue,
              valorAberto: a.valorAberto,
              recuperadoMes: a.recuperadoMes,
              recuperadoAcumulado: a.recuperadoAcumulado,
              faixasEntrada: a.faixasEntrada,
              eficienciaEtapa: a.eficienciaEtapa,
              distribuicaoRating: a.distribuicaoRating,
              ratingMedio: a.ratingMedio,
              acordosVigentes: a.acordosVigentes,
              previsaoAcordos: a.previsaoAcordos,
              recuperadoPorSemana: a.recuperadoPorSemana,
            };
          }),
      };
    }
    const credorDestaque = d.credores[0];
    tokensCredor.push({ token: credorDestaque.token, credor: credorDestaque.nome, escritorio: marca.nomeExibicao });
  }
  return { portalDevedores, portalCredores, tokensDevedor, tokensCredor };
}

// ----------------------------------------------------------------- saída

const dados = ESCRITORIOS.map(gerarEscritorio);
const { portalDevedores, portalCredores, tokensDevedor, tokensCredor } = montarPortais(dados);

const indice: IndiceSeed = {
  geradoEm: new Date().toISOString(),
  hoje,
  escritorios: ESCRITORIOS.map(({ id, nome, plano, cidade: cid, marca }) => ({
    id, nome, plano, cidade: cid, marca,
  })),
  analistas: ANALISTAS,
  tokensDevedor,
  tokensCredor,
};

const destinos = [
  join(raiz, 'apps', 'painel', 'public', 'dados'),
  join(raiz, 'apps', 'portal', 'public', 'dados'),
];
for (const destino of destinos) mkdirSync(destino, { recursive: true });

writeFileSync(join(destinos[0], 'indice.json'), JSON.stringify(indice));
for (const d of dados) {
  // Grava o formato de transporte e confere que a hidratação devolve o
  // dump completo, idêntico ao gerado (transporte.ts).
  const magro = enxugarDump(d);
  if (canonico(hidratarDump(JSON.parse(JSON.stringify(magro)))) !== canonico(d)) {
    throw new Error(`transporte: hidratar(enxugar(${d.escritorio.id})) difere do original`);
  }
  writeFileSync(join(destinos[0], `${d.escritorio.id}.json`), JSON.stringify(magro));
}
writeFileSync(join(destinos[1], 'devedores.json'), JSON.stringify(portalDevedores));
writeFileSync(join(destinos[1], 'credores.json'), JSON.stringify(portalCredores));
writeFileSync(
  join(destinos[1], 'exemplos.json'),
  JSON.stringify({ hoje, tokensDevedor, tokensCredor }),
);

const total = (f: (d: DadosEscritorio) => number) => dados.reduce((s, d) => s + f(d), 0);
console.log(
  `Seed v3 (hoje=${hoje}): ${dados.length} escritórios · ${total((d) => d.credores.length)} credores · ` +
    `${total((d) => d.carteiras.length)} carteiras · ${total((d) => d.devedores.length)} devedores · ` +
    `${total((d) => d.titulos.length)} títulos · ${total((d) => d.filaHoje.length)} ações na fila ±3d · ` +
    `${total((d) => d.documentos.length)} documentos · ${total((d) => d.bloqueios.length)} bloqueios de conformidade`,
);
for (const d of dados) {
  const pagos = d.titulos.filter((t) => t.estado === 'pago').length;
  console.log(
    `  ${d.escritorio.id} ${d.escritorio.plano}: score ${d.score.total} · ` +
      `${d.titulos.length} títulos (${pagos} pagos, ${d.titulos.filter((t) => t.estado === 'contestado').length} contestados, ` +
      `${d.titulos.filter((t) => ['negativado', 'protestado'].includes(t.estado)).length} neg/prot, ` +
      `${d.titulos.filter((t) => t.estado === 'judicial').length} judicial) · ` +
      `${d.documentos.filter((x) => x.status === 'a assinar').length} a assinar · ` +
      `${d.documentos.filter((x) => x.status === 'aguarda autorização').length} aguardam autorização`,
  );
}
