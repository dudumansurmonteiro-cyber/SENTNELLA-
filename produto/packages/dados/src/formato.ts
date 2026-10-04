// Formatação pt-BR compartilhada entre painel e portal.

const fmtMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtMoedaCurta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export const moeda = (v: number) => fmtMoeda.format(v);
export const moedaCurta = (v: number) => fmtMoedaCurta.format(v);

export function moedaCompacta(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (Math.abs(v) >= 10_000) return `R$ ${Math.round(v / 1000)} mil`;
  return fmtMoedaCurta.format(v);
}

export function dataBr(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(2)}`;
}

export function dataLonga(iso: string): string {
  const [a, m, d] = iso.split('-');
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`;
}

export const pct = (v: number, casas = 0) =>
  `${v.toFixed(casas).replace('.', ',')}%`;

export function duracao(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function cronometro(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function difDias(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
}

// ------------------------------------------------------------------ v3 ----

// Dicionários da trilha compacta de contatos ("E+2|47|w|resp"):
// o 2º campo é "dias atrás" em relação ao hoje do seed.
export const TRILHA_CANAL: Record<string, string> = {
  w: 'WhatsApp', s: 'SMS', m: 'e-mail', c: 'carta', l: 'ligação', p: 'portal',
};

export const TRILHA_RESULTADO: Record<string, string> = {
  ent: 'entregue',
  lid: 'lido',
  resp: 'respondido',
  pg48: 'pago em até 48h após o contato',
  at: 'ligação atendida',
  atp: 'atendida — promessa de pagamento',
  na: 'não atendida — reprogramada',
  prev: 'comunicação prévia enviada com prova (CDC art. 43, §2º)',
  notif: 'notificação extrajudicial enviada',
  aut: 'preparado — aguarda autorização do escritório',
  neg: 'negativação registrada',
  prot: 'protesto registrado',
  dos: 'dossiê judicial gerado',
  acc: 'acordo fechado dentro da alçada',
  ctt: 'contestou — cobrança pausada',
  blq: 'bloqueada pela conformidade',
  pend: 'aguardando resposta',
};

export interface PassoTrilhaExpandido {
  etapa: string;
  data: string;
  canal: string;
  resultado: string;
  codigo: string;
}

export function expandirTrilha(trilha: string[], hoje: string): PassoTrilhaExpandido[] {
  return trilha.map((p) => {
    const [etapa, diasAtras, canal, cod] = p.split('|');
    return {
      etapa,
      data: addDias(hoje, -Number(diasAtras)),
      canal: TRILHA_CANAL[canal] ?? canal,
      resultado: TRILHA_RESULTADO[cod] ?? cod,
      codigo: cod,
    };
  });
}

export const FAIXAS_ENTRADA = ['até 30', '31–90', '91–180', 'acima de 180'] as const;

export function faixaDoAtraso(dias: number): (typeof FAIXAS_ENTRADA)[number] {
  if (dias <= 30) return 'até 30';
  if (dias <= 90) return '31–90';
  if (dias <= 180) return '91–180';
  return 'acima de 180';
}

export const FAIXAS_CASA = ['0–15 dias', '16–30', '31–60', '61–90'] as const;

export function faixaDaCasa(dias: number): (typeof FAIXAS_CASA)[number] {
  if (dias <= 15) return '0–15 dias';
  if (dias <= 30) return '16–30';
  if (dias <= 60) return '31–60';
  return '61–90';
}
