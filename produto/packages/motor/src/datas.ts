// Datas da Fase 2: o banco guarda DATE (meia-noite UTC); o motor trabalha
// sempre com strings AAAA-MM-DD e converte nas bordas.

import { addDias, difDias } from '@sentinella/dados';

export { addDias, difDias };

export const paraIso = (d: Date): string => d.toISOString().slice(0, 10);
export const deIso = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const hojeReal = (): string => paraIso(new Date());

// 0 = domingo … 6 = sábado
export const diaSemana = (iso: string): number =>
  new Date(`${iso}T12:00:00Z`).getUTCDay();

export const ehDiaUtil = (iso: string): boolean => {
  const d = diaSemana(iso);
  return d >= 1 && d <= 5;
};

// §3: ligações em dias úteis (8h–20h) e sábados (8h–14h); nunca aos domingos.
export const podeLigarNoDia = (iso: string): boolean => diaSemana(iso) !== 0;

export function proximoDiaDeLigacao(iso: string): string {
  let d = addDias(iso, 1);
  while (!podeLigarNoDia(d)) d = addDias(d, 1);
  return d;
}

export function proximoDiaUtil(iso: string): string {
  let d = addDias(iso, 1);
  while (!ehDiaUtil(d)) d = addDias(d, 1);
  return d;
}

// Dias de atraso de um título em aberto (0 quando ainda não venceu).
export const diasDeAtrasoEm = (vencimentoIso: string, hojeIso: string): number =>
  Math.max(0, difDias(hojeIso, vencimentoIso));
