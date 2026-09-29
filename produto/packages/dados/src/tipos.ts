// Tipos do domínio da Fase 1 (CLAUDE.md §8) — estados sempre em pt-BR.

export type Plano = 'Básico' | 'Avançado' | 'Max';
export type Canal = 'WhatsApp' | 'SMS' | 'e-mail' | 'carta' | 'ligação';
export type Letra = 'A' | 'B' | 'C' | 'D' | 'E';

export type EstadoTitulo =
  | 'a vencer'
  | 'vencido'
  | 'em negociação'
  | 'acordo'
  | 'pago'
  | 'protestado'
  | 'negativado'
  | 'jurídico'
  | 'contestado'
  | 'cancelado'
  | 'fora da régua';

export type EstadoAcao =
  | 'agendada'
  | 'em andamento'
  | 'finalizada'
  | 'não atendida'
  | 'pendente'
  | 'cancelada'
  | 'bloqueada';

export type EstadoExcecao = 'aberta' | 'em atendimento' | 'resolvida' | 'devolvida ao cliente';

export type Etapa =
  | 'D−3'
  | 'D0'
  | 'D+3'
  | 'D+7'
  | 'D+10'
  | 'D+15'
  | 'bloqueio'
  | 'D+30'
  | 'D+45'
  | 'jurídico';

export interface Alcada {
  descontoMaxPct: number;
  parcelasMax: number;
  prazoMaxDias: number;
  valorSempreAnalista: number;
}

export interface Cliente {
  id: string;
  nome: string; // sempre marcado como fictícia no seed
  plano: Plano;
  cidade: string;
  setor: string;
  erp: string;
  erpIntegrado: boolean; // bloqueio de pedidos só com ERP integrado (§3)
  canais: Canal[];
  // §12: multa e juros só a partir do cadastro do cliente; sem cadastro, a
  // mensagem e o portal não mencionam multa.
  multaPct: number | null;
  jurosMesPct: number | null;
  alcada: Alcada;
  valorLimiteLigacao: number;
  analistaIds: string[];
  analistaNomeado?: string; // Max: analista de referência
}

export interface DetalheCriterio {
  rotulo: string;
  peso: number; // %
  valor: string; // valor medido, formatado
  pontos: number; // 0–100 no critério
}

export interface Lojista {
  id: string;
  clienteId: string;
  nome: string;
  cidade: string;
  cnpj: string; // fictício, prefixo 00.000 (nunca CNPJ real — §11)
  contatoNome: string;
  contatoPapel: 'financeiro' | 'sócio';
  token: string; // acesso do portal por link protegido
  rating: Letra;
  ratingTotal: number; // 0–100
  ratingDetalhe: DetalheCriterio[];
  ratingNovo: boolean; // menos de 3 títulos de histórico → C (§6)
  titulosAbertos: number;
  valorAberto: number;
  valorVencido: number;
  maiorAtrasoDias: number;
}

export interface Titulo {
  id: string;
  clienteId: string;
  lojistaId: string;
  numero: string;
  valor: number;
  emissao: string; // AAAA-MM-DD
  vencimento: string;
  antecipado: boolean; // Lei 5.474/68: notificação D+15, protesto até D+25
  estado: EstadoTitulo;
  diasAtraso: number; // em relação a "hoje" do seed (0 se não vencido/pago em dia)
  pagoEm: string | null;
  etapaAtual: string; // rótulo curto da última/próxima etapa da régua
}

export interface Acao {
  id: string;
  clienteId: string;
  tituloId: string;
  lojistaId: string;
  etapa: Etapa;
  descricao: string;
  canal: Canal;
  quem: 'IA' | 'analista' | 'sistema';
  data: string;
  estado: EstadoAcao;
  resultado: string | null; // entregue · lido · respondido · atendida · promessa…
}

export interface Mensagem {
  de: 'IA' | 'lojista' | 'analista';
  texto: string;
  minAtras: number;
}

export interface Excecao {
  id: string;
  clienteId: string;
  lojistaId: string;
  tituloId: string | null;
  motivo: string;
  estado: EstadoExcecao;
  abertaMinAtras: number;
  slaMin: number; // 15 (Básico/Avançado) ou 5 (Max)
  valorEnvolvido: number;
  assumidaPor: string | null;
  tempoAteAssumirMin: number | null;
  causa: string | null;
  resolucao: string | null;
  regraSugerida: string | null;
  conversa: Mensagem[];
}

export interface Acordo {
  id: string;
  clienteId: string;
  lojistaId: string;
  tituloIds: string[];
  valorTotal: number;
  parcelas: number;
  parcelasPagas: number;
  status: 'em dia' | 'atrasado' | 'quitado';
  criadoEm: string;
}

export interface Autorizacao {
  id: string;
  clienteId: string;
  lojistaId: string;
  tituloId: string;
  tipo: 'protesto' | 'negativação' | 'bloqueio de pedidos';
  valor: number;
  pedidoEm: string;
  status: 'pendente' | 'aprovada';
  aprovadaEm: string | null;
}

export interface Promessa {
  id: string;
  clienteId: string;
  lojistaId: string;
  tituloId: string;
  para: string;
  cumprida: boolean | null; // null = data ainda no futuro
}

export interface Analista {
  id: string;
  nome: string;
  turno: '8h–15h' | '15h–22h';
  clienteIds: string[];
}

export interface ClienteResumo {
  id: string;
  nome: string;
  plano: Plano;
  cidade: string;
  setor: string;
}

export interface IndiceSeed {
  geradoEm: string;
  hoje: string;
  clientes: ClienteResumo[];
  analistas: Analista[];
  tokensExemplo: { token: string; lojista: string; industria: string }[];
}

export interface DadosCliente {
  cliente: Cliente;
  lojistas: Lojista[];
  titulos: Titulo[];
  acoes: Acao[];
  excecoes: Excecao[];
  acordos: Acordo[];
  autorizacoes: Autorizacao[];
  promessas: Promessa[];
  score: { total: number; evolucao: { mes: string; valor: number }[] };
}

export interface TituloPortal {
  numero: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
  multa: number | null; // null quando o cliente não cadastrou multa (§12)
  juros: number | null;
  total: number;
  estado: EstadoTitulo;
}

export interface EntradaPortal {
  lojista: { nome: string; cnpj: string; contatoNome: string };
  industria: {
    nome: string;
    canais: Canal[];
    temMultaCadastrada: boolean;
    alcada: { descontoMaxPct: number; parcelasMax: number; prazoMaxDias: number };
  };
  titulosAbertos: TituloPortal[];
  titulosPagos: { numero: string; valor: number; pagoEm: string }[];
  acordos: { valorTotal: number; parcelas: number; parcelasPagas: number; status: string }[];
}

export type DadosPortal = Record<string, EntradaPortal>;
