// Transporte dos JSON da demonstração. Com 20.000 títulos por seed (§12), os
// arquivos por escritório ficariam em ~8 MB se cada registro repetisse ids e
// textos deriváveis. enxugar() descarta, antes de gravar, todo campo que
// hidratar() reconstrói ao carregar — e só quando a reconstrução, feita a
// partir do registro sem o campo, devolve exatamente o mesmo valor. O seed
// ainda roda a dupla completa e compara o resultado canônico com o original.
// As superfícies consomem sempre o dump hidratado (DadosEscritorio inteiro).

import { faixaDoAtraso } from './formato';
import { planoDaRegua, type PassoPlano } from './regua';
import type {
  Acao,
  Acordo,
  Carteira,
  DadosEscritorio,
  Devedor,
  DocumentoJuridico,
  Titulo,
} from './tipos';

const DIA_MS = 86_400_000;
const difDias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DIA_MS);

// etapaAtual dos estados terminais (os mesmos textos do seed); nos demais o
// texto vem da caminhada da régua e segue gravado no título.
function etapaDeEstado(estado: Titulo['estado']): string | null {
  switch (estado) {
    case 'pago': return 'quitado';
    case 'contestado': return 'contestado · cobrança pausada';
    case 'acordo': return 'acordo · em pagamento';
    case 'judicial': return 'no judicial';
    default: return null;
  }
}

class Derivador {
  private escritorioId: string;
  private carteiras = new Map<string, Carteira>();
  private titulos = new Map<string, Titulo>();
  private devedores = new Map<string, Devedor>();
  private passos = new Map<string, PassoPlano | undefined>();

  constructor(dados: Pick<DadosEscritorio, 'escritorio' | 'carteiras'>) {
    this.escritorioId = dados.escritorio.id;
    for (const c of dados.carteiras) this.carteiras.set(c.id, c);
  }

  registrarTitulo(t: Titulo) { this.titulos.set(t.id, t); }
  registrarDevedor(d: Devedor) { this.devedores.set(d.id, d); }

  titulo(t: Partial<Titulo>): Titulo {
    const carteira = this.carteiras.get(t.carteiraId!)!;
    const atraso = t.atrasoOriginal ?? difDias(t.entradaCarteira!, t.vencimentoOriginal!);
    const estado = t.estado ?? 'em cobrança';
    return {
      escritorioId: this.escritorioId,
      credorId: carteira.credorId,
      antecipado: false,
      pagoEm: null,
      contestadoEm: null,
      comunicacaoPreviaEm: null,
      etapaAtual: etapaDeEstado(estado) ?? '',
      ...t,
      atrasoOriginal: atraso,
      faixaEntrada: t.faixaEntrada ?? faixaDoAtraso(atraso),
      estado,
    } as Titulo;
  }

  devedor(d: Partial<Devedor>): Devedor {
    return {
      escritorioId: this.escritorioId,
      canaisBloqueados: [],
      vulneravel: false,
      ratingNovo: false,
      ...d,
    } as Devedor;
  }

  private passo(titulo: Titulo, etapa: string): PassoPlano | undefined {
    const chave = `${titulo.carteiraId}|${titulo.faixaEntrada}|${etapa}`;
    if (!this.passos.has(chave)) {
      const plano = planoDaRegua(this.carteiras.get(titulo.carteiraId)!, titulo.faixaEntrada);
      this.passos.set(chave, plano.find((p) => p.etapa === etapa));
    }
    return this.passos.get(chave);
  }

  acao(a: Partial<Acao>): Acao {
    const titulo = this.titulos.get(a.tituloId!)!;
    const passo = this.passo(titulo, a.etapa!);
    return {
      escritorioId: this.escritorioId,
      credorId: titulo.credorId,
      carteiraId: titulo.carteiraId,
      devedorId: titulo.devedorId,
      descricao: passo?.descricao ?? `Ação da etapa ${a.etapa}`,
      canal: passo?.canal ?? 'e-mail',
      quem: passo?.quem ?? 'sistema',
      resultado: null,
      motivoBloqueio: null,
      ...a,
    } as Acao;
  }

  acordo(a: Partial<Acordo>): Acordo {
    const devedor = this.devedores.get(a.devedorId!)!;
    return { escritorioId: this.escritorioId, carteiraId: devedor.carteiraId, ...a } as Acordo;
  }

  documento(d: Partial<DocumentoJuridico>): DocumentoJuridico {
    const titulo = this.titulos.get(d.tituloIds![0])!;
    return {
      escritorioId: this.escritorioId,
      carteiraId: titulo.carteiraId,
      devedorId: titulo.devedorId,
      assinadoPor: null,
      ...d,
    } as DocumentoJuridico;
  }
}

// Tira do registro cada campo candidato cuja derivação — calculada a partir
// do registro SEM esses campos, como o hidratar verá — devolve o mesmo valor.
function enxuga<T extends object>(
  obj: T,
  derivar: (parcial: Partial<T>) => T,
  campos: (keyof T)[],
): Partial<T> {
  const parcial = { ...obj } as Record<string, unknown>;
  for (const c of campos) delete parcial[c as string];
  const cheio = derivar(parcial as Partial<T>);
  const magro = { ...obj } as Record<string, unknown>;
  for (const c of campos) {
    const a = obj[c];
    const b = cheio[c];
    const iguais = Array.isArray(a) ? JSON.stringify(a) === JSON.stringify(b) : a === b;
    if (iguais) delete magro[c as string];
  }
  return magro as Partial<T>;
}

const CAMPOS_TITULO: (keyof Titulo)[] = [
  'escritorioId', 'credorId', 'atrasoOriginal', 'faixaEntrada', 'antecipado',
  'pagoEm', 'contestadoEm', 'comunicacaoPreviaEm', 'etapaAtual',
];
const CAMPOS_DEVEDOR: (keyof Devedor)[] = [
  'escritorioId', 'canaisBloqueados', 'vulneravel', 'ratingNovo',
];
const CAMPOS_ACAO: (keyof Acao)[] = [
  'escritorioId', 'credorId', 'carteiraId', 'devedorId',
  'descricao', 'canal', 'quem', 'resultado', 'motivoBloqueio',
];
const CAMPOS_ACORDO: (keyof Acordo)[] = ['escritorioId', 'carteiraId'];
const CAMPOS_DOCUMENTO: (keyof DocumentoJuridico)[] = [
  'escritorioId', 'carteiraId', 'devedorId', 'assinadoPor',
];

export function enxugarDump(dados: DadosEscritorio): unknown {
  const der = new Derivador(dados);
  for (const t of dados.titulos) der.registrarTitulo(t);
  for (const d of dados.devedores) der.registrarDevedor(d);

  return {
    ...dados,
    devedores: dados.devedores.map((d) => enxuga(d, (p) => der.devedor(p), CAMPOS_DEVEDOR)),
    titulos: dados.titulos.map((t) => enxuga(t, (p) => der.titulo(p), CAMPOS_TITULO)),
    filaHoje: dados.filaHoje.map((a) => enxuga(a, (p) => der.acao(p), CAMPOS_ACAO)),
    acordos: dados.acordos.map((a) => enxuga(a, (p) => der.acordo(p), CAMPOS_ACORDO)),
    documentos: dados.documentos.map((d) => enxuga(d, (p) => der.documento(p), CAMPOS_DOCUMENTO)),
  };
}

export function hidratarDump(bruto: unknown): DadosEscritorio {
  const dados = bruto as DadosEscritorio;
  const der = new Derivador(dados);
  const titulos = dados.titulos.map((t) => der.titulo(t));
  for (const t of titulos) der.registrarTitulo(t);
  const devedores = dados.devedores.map((d) => der.devedor(d));
  for (const d of devedores) der.registrarDevedor(d);
  return {
    ...dados,
    devedores,
    titulos,
    filaHoje: dados.filaHoje.map((a) => der.acao(a)),
    acordos: dados.acordos.map((a) => der.acordo(a)),
    documentos: dados.documentos.map((d) => der.documento(d)),
  };
}

// Forma canônica (chaves ordenadas) para o seed conferir que
// hidratar(enxugar(d)) == d independentemente da ordem dos campos.
export function canonico(x: unknown): string {
  return JSON.stringify(ordenar(JSON.parse(JSON.stringify(x))));
}

function ordenar(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(ordenar);
  if (x && typeof x === 'object') {
    return Object.fromEntries(
      Object.entries(x as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, ordenar(v)]),
    );
  }
  return x;
}
