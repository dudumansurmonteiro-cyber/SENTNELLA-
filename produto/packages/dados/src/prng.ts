// Gerador determinístico (mulberry32) para o seed ser reproduzível.

export function criarRnd(semente: number) {
  let a = semente >>> 0;
  return function rnd(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rnd = ReturnType<typeof criarRnd>;

export const entre = (rnd: Rnd, min: number, max: number) => min + rnd() * (max - min);
export const inteiro = (rnd: Rnd, min: number, max: number) => Math.floor(entre(rnd, min, max + 1));
export const escolha = <T>(rnd: Rnd, itens: readonly T[]): T => itens[Math.floor(rnd() * itens.length)];
export const chance = (rnd: Rnd, p: number) => rnd() < p;

// Distribuição de atraso: muitos atrasos curtos, cauda longa.
export function diasDeAtraso(rnd: Rnd): number {
  const u = rnd();
  return Math.max(1, Math.round(-Math.log(1 - u * 0.985) * 16));
}
