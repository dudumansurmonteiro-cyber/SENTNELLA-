// Tipos do domínio v3 (CLAUDE.md §4, §6 e §7) — estados sempre em pt-BR.
// Hierarquia: Escritório (tenant) → Credor → Carteira → Devedor → Título.

export type Plano = 'Básico' | 'Avançado' | 'Max';
export type Canal = 'WhatsApp' | 'SMS' | 'e-mail' | 'carta' | 'ligação';
export type Letra = 'A' | 'B' | 'C' | 'D' | 'E';
export type TipoDevedor = 'PF' | 'PJ';
export type TipoCarteira =
  | 'educação' | 'saúde' | 'condomínio' | 'varejo' | 'financeiro' | 'indústria';

// Faixa de atraso do título NO MOMENTO em que entrou na carteira (§4).
export type FaixaEntrada = 'até 30' | '31–90' | '91–180' | 'acima de 180';

// Etapas da régua reancorada na entrada (E = dias desde a entrada).
export type Etapa =
  | 'E+0' | 'E+2' | 'E+3' | 'E+5' | 'E+7' | 'E+10'
  | 'E+15' | 'E+20' | 'E+30' | 'E+45' | 'E+60';

export type EstadoTitulo =
  | 'em cobrança'
  | 'em negociação'
  | 'acordo'
  | 'pago'
  | 'negativado'
  | 'protestado'
  | 'judicial'
  | 'contestado'
  | 'cancelado';

export type EstadoAcao =
  | 'agendada'
  | 'em andamento'
  | 'finalizada'
  | 'não atendida'
  | 'pendente'
  | 'cancelada'
  | 'bloqueada';

export type EstadoExcecao = 'aberta' | 'em atendimento' | 'resolvida' | 'devolvida ao escritório';

export interface Marca {
  nomeExibicao: string; // o que aparece para credor e devedor
  iniciais: string;
  corPrimaria: string; // cor de marca do escritório (base neutra + 2 cores — §9)
  corClara: string; // variação para o modo escuro
  mostrarOperadora: boolean; // "plataforma operada por Sentinella" no rodapé (removível no Max)
}

export interface UsuarioEscritorio {
  nome: string;
  papel: 'sócio' | 'advogado' | 'coordenador' | 'negociador' | 'financeiro';
  oab?: string; // fictícia no seed (padrão 00.000)
}

export interface Escritorio {
  id: string;
  nome: string; // sempre marcado como fictício no seed
  oab: string; // registro fictício
  cidade: string;
  plano: Plano;
  marca: Marca;
  slaMin: number | null; // null no Básico (equipe do próprio escritório opera)
  usuarios: UsuarioEscritorio[];
  retencaoGravacoesAnos: number;
}

export interface Credor {
  id: string;
  escritorioId: string;
  nome: string;
  setor: TipoCarteira;
  contatoNome: string;
  honorariosPct: number; // regra informativa cadastrada pelo escritório (§6.2)
  token: string; // acesso do portal do credor
}

export interface Alcada {
  descontoMaxPct: number;
  parcelasMax: number;
  prazoMaxDias: number;
  entradaMinPct: number;
}

export interface Carteira {
  id: string;
  escritorioId: string;
  credorId: string;
  nome: string;
  tipo: TipoCarteira;
  devedores: TipoDevedor | 'PF e PJ';
  alcada: Alcada;
  canais: Canal[];
  // §12 do v2 continua: encargos só a partir do cadastro da carteira.
  multaPct: number | null;
  jurosMesPct: number | null;
  baseLegal: 'execução de contrato' | 'legítimo interesse do credor';
  controlador: 'credor' | 'credor e escritório';
  contaEmissora: 'conta do credor' | 'conta do escritório';
  entradaEm: string; // primeira remessa (AAAA-MM-DD)
}

export interface DetalheCriterio {
  rotulo: string;
  peso: number;
  valor: string;
  pontos: number;
}

export interface Devedor {
  id: string;
  escritorioId: string;
  credorId: string;
  carteiraId: string;
  tipo: TipoDevedor;
  nome: string;
  doc: string; // CPF/CNPJ fictício (prefixo 000.000 / 00.000 — nunca real)
  cidade: string;
  // Contatos do próprio devedor — nunca de terceiros (§3).
  canaisBloqueados: Canal[]; // pedido de não contato por canal
  vulneravel: boolean; // declarou vulnerabilidade → atenção especial (Lei 14.181)
  rating: Letra;
  ratingTotal: number;
  // Entradas compactas do cálculo (§6): [títulos, diasMédiosAtraso×10,
  // horasResposta (−1 = não responde), promessasFeitas, promessasCumpridas,
  // %títulosComAtraso, exceçõesPorTítulo×100]. A ficha reconstrói a
  // explicação com calcularRating — evita 6.000 detalhamentos no JSON.
  ratingBase: number[];
  ratingNovo: boolean;
  titulosAbertos: number;
  valorAberto: number; // valor atualizado em aberto
  diasDesdeEntrada: number; // do título mais antigo em aberto
  maiorAtrasoTotal: number; // atraso original + tempo na carteira (do pior título)
  token?: string; // acesso do portal do devedor (só os exemplos do seed)
}

// Trilha compacta de contatos de um título: "etapa|data|canal|resultado".
// Canais: w=WhatsApp s=SMS m=e-mail c=carta l=ligação. Resultados: ver
// TRILHA em formato.ts. Mantém o JSON pequeno com 20.000 títulos.
export type PassoTrilha = string;

export interface Titulo {
  id: string;
  escritorioId: string;
  credorId: string;
  carteiraId: string;
  devedorId: string;
  numero: string;
  valorOriginal: number;
  valorAtualizado: number; // com encargos da carteira (ou = original, sem cadastro)
  vencimentoOriginal: string;
  entradaCarteira: string;
  atrasoOriginal: number; // dias de atraso quando entrou
  faixaEntrada: FaixaEntrada;
  antecipado: boolean; // só PJ — regra do v2 (protesto até 30 dias do vencimento)
  estado: EstadoTitulo;
  pagoEm: string | null;
  contestadoEm: string | null;
  comunicacaoPreviaEm: string | null; // CDC art. 43 §2º — antes de negativar
  etapaAtual: string;
  trilha: PassoTrilha[];
}

export interface Acao {
  id: string;
  escritorioId: string;
  credorId: string;
  carteiraId: string;
  devedorId: string;
  tituloId: string;
  etapa: Etapa;
  descricao: string;
  canal: Canal;
  quem: 'IA' | 'analista' | 'sistema';
  data: string;
  estado: EstadoAcao;
  resultado: string | null;
  motivoBloqueio: string | null; // travas da seção 3, visíveis (aceite §12.6)
}

export interface Mensagem {
  de: 'IA' | 'devedor' | 'analista';
  texto: string;
  minAtras: number;
}

export interface Excecao {
  id: string;
  escritorioId: string;
  carteiraId: string;
  devedorId: string;
  tituloId: string | null;
  motivo: string;
  estado: EstadoExcecao;
  abertaMinAtras: number;
  slaMin: number | null; // null = equipe do escritório (Básico)
  valorEnvolvido: number;
  assumidaPor: string | null;
  tempoAteAssumirMin: number | null;
  causa: string | null;
  resolucao: string | null;
  conversa: Mensagem[];
}

export interface Acordo {
  id: string;
  escritorioId: string;
  carteiraId: string;
  devedorId: string;
  tituloIds: string[];
  valorTotal: number; // custo total mostrado antes do aceite (Lei 14.181)
  jurosEmbutidos: number;
  parcelas: number;
  parcelasPagas: number;
  status: 'em dia' | 'atrasado' | 'quitado';
  origem: 'portal' | 'analista';
  criadoEm: string;
}

export type TipoDocumento =
  | 'comunicação prévia' | 'notificação extrajudicial' | 'autorização' | 'dossiê judicial';

export interface DocumentoJuridico {
  id: string;
  escritorioId: string;
  carteiraId: string;
  tituloIds: string[];
  devedorId: string;
  tipo: TipoDocumento;
  subtipo?: 'protesto' | 'negativação';
  status: 'a assinar' | 'aguarda autorização' | 'assinado' | 'enviado com prova' | 'pronto';
  valor: number;
  geradoEm: string;
  assinadoPor: string | null; // "Dra. Fulana — OAB fictícia"
}

export interface HonorariosCredor {
  credorId: string;
  recuperadoMes: number;
  pct: number;
  valor: number;
}

export interface SerieSemana {
  rotulo: string;
  valor: number;
}

export interface EficienciaCanal {
  canal: Canal;
  enviadas: number;
  entregues: number;
  lidas: number;
  respondidas: number;
  pagas48h: number;
}

export interface EficienciaEtapa {
  etapa: Etapa;
  acoes: number;
  pagos48h: number;
  conversao: number; // %
}

export interface LigacoesResumo {
  realizadas: number;
  atendidas: number;
  naoAtendidas: number;
  promessasObtidas: number;
  promessasCumpridas: number;
  pagasEm7d: number;
}

export interface FaixaValor {
  rotulo: string;
  valor: number;
  qtd: number;
}

// Agregados pré-computados POR CARTEIRA (o painel soma as carteiras
// filtradas no cliente — com 20.000 títulos, agregamos no seed).
export interface AgregadosCarteira {
  carteiraId: string;
  credorId: string;
  qtdTitulos: number;
  qtdDevedores: number;
  valorEntregue: number;
  valorAberto: number;
  recuperadoMes: number;
  recuperadoAcumulado: number;
  pagosQtd: number;
  faixasEntrada: FaixaValor[]; // atraso original ao entrar (4 faixas)
  faixasCasa: FaixaValor[]; // tempo desde a entrada (em aberto)
  eficienciaCanal: EficienciaCanal[];
  eficienciaEtapa: EficienciaEtapa[];
  ligacoes: LigacoesResumo;
  recuperadoPorSemana: SerieSemana[]; // últimas 6 semanas
  distribuicaoRating: { letra: Letra; qtd: number }[];
  ratingMedio: number; // 0–100
  promessasFeitas: number;
  promessasCumpridas: number;
  acordosVigentes: number;
  previsaoAcordos: number; // parcelas a receber
  score: number;
}

export interface BloqueioConformidade {
  id: string;
  escritorioId: string;
  carteiraId: string;
  regra: string; // qual trava da seção 3 agiu
  detalhe: string;
  em: string;
}

export interface DadosEscritorio {
  escritorio: Escritorio;
  credores: Credor[];
  carteiras: Carteira[];
  agregados: AgregadosCarteira[];
  devedores: Devedor[];
  titulos: Titulo[];
  filaHoje: Acao[]; // ações na janela hoje±3 (a fila do dia)
  excecoes: Excecao[];
  acordos: Acordo[];
  documentos: DocumentoJuridico[];
  honorarios: HonorariosCredor[];
  bloqueios: BloqueioConformidade[];
  score: { total: number; evolucao: { mes: string; valor: number }[] };
}

export interface EscritorioResumo {
  id: string;
  nome: string;
  plano: Plano;
  cidade: string;
  marca: Marca;
}

export interface AnalistaSentinella {
  id: string;
  nome: string;
  turno: '8h–15h' | '15h–22h';
  escritorioIds: string[]; // Avançado/Max — o console troca de escritório ativo
}

export interface IndiceSeed {
  geradoEm: string;
  hoje: string;
  escritorios: EscritorioResumo[];
  analistas: AnalistaSentinella[];
  tokensDevedor: { token: string; devedor: string; escritorio: string }[];
  tokensCredor: { token: string; credor: string; escritorio: string }[];
}

// ---------------------------------------------------------------- portais ----

export interface TituloPortalDevedor {
  numero: string;
  credor: string;
  valorOriginal: number;
  encargos: number | null; // null quando a carteira não tem encargos cadastrados
  valorAtualizado: number;
  vencimentoOriginal: string;
  estado: EstadoTitulo;
}

export interface SimulacaoAcordo {
  parcelas: number;
  valorParcela: number;
  custoTotal: number; // mostrado ANTES do aceite (Lei 14.181)
  jurosEmbutidos: number;
}

export interface EntradaPortalDevedor {
  devedor: { nome: string; doc: string; tipo: TipoDevedor };
  escritorio: {
    nomeExibicao: string;
    oab: string;
    corPrimaria: string;
    corClara: string;
    mostrarOperadora: boolean;
    contato: string;
  };
  credorOriginal: string;
  titulosAbertos: TituloPortalDevedor[];
  titulosPagos: { numero: string; valor: number; pagoEm: string }[];
  acordos: { valorTotal: number; parcelas: number; parcelasPagas: number; status: string }[];
  alcada: { parcelasMax: number; descontoMaxPct: number };
  simulacoes: SimulacaoAcordo[]; // opções dentro da alçada, com custo total
}

export interface EntradaPortalCredor {
  credor: { nome: string; contatoNome: string };
  escritorio: {
    nomeExibicao: string;
    oab: string;
    corPrimaria: string;
    corClara: string;
    mostrarOperadora: boolean;
  };
  hoje: string;
  carteiras: {
    nome: string;
    tipo: TipoCarteira;
    qtdTitulos: number;
    qtdDevedores: number;
    valorEntregue: number;
    valorAberto: number;
    recuperadoMes: number;
    recuperadoAcumulado: number;
    faixasEntrada: FaixaValor[];
    eficienciaEtapa: EficienciaEtapa[];
    distribuicaoRating: { letra: Letra; qtd: number }[];
    ratingMedio: number;
    acordosVigentes: number;
    previsaoAcordos: number;
    recuperadoPorSemana: SerieSemana[];
  }[];
}

export type PortalDevedores = Record<string, EntradaPortalDevedor>;
export type PortalCredores = Record<string, EntradaPortalCredor>;
