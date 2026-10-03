// Leitura e escrita das planilhas padrão (Fase 2 — CLAUDE.md §11).
// Formato aceito: CSV com separador ";" (padrão do Excel brasileiro) ou ",",
// detectado pelo cabeçalho; valores com vírgula decimal (1.234,56); datas em
// dd/mm/aaaa ou aaaa-mm-dd; campos entre aspas podem conter o separador.

export interface LinhaPlanilha {
  numero: number; // número da linha no arquivo (cabeçalho = 1)
  campos: Record<string, string>;
}

export interface Planilha {
  separador: ';' | ',';
  cabecalho: string[];
  linhas: LinhaPlanilha[];
}

// Normaliza um nome de coluna: minúsculas, sem acento, espaços → "_".
export function normalizarColuna(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

function dividir(linha: string, sep: ';' | ','): string[] {
  const campos: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (aspas) {
      if (ch === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else aspas = false;
      } else atual += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      campos.push(atual);
      atual = '';
    } else atual += ch;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

export function lerPlanilha(texto: string): Planilha {
  const semBom = texto.replace(/^﻿/, '');
  const linhasBrutas = semBom.split(/\r\n|\n|\r/);
  const primeira = linhasBrutas[0] ?? '';
  const separador: ';' | ',' =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const cabecalho = dividir(primeira, separador).map(normalizarColuna);

  const linhas: LinhaPlanilha[] = [];
  for (let i = 1; i < linhasBrutas.length; i++) {
    const bruta = linhasBrutas[i];
    if (!bruta || !bruta.trim()) continue;
    const valores = dividir(bruta, separador);
    const campos: Record<string, string> = {};
    cabecalho.forEach((col, j) => {
      campos[col] = valores[j] ?? '';
    });
    linhas.push({ numero: i + 1, campos });
  }
  return { separador, cabecalho, linhas };
}

export function serializarPlanilha(cabecalho: string[], linhas: string[][]): string {
  const proteger = (v: string) =>
    /[";\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const corpo = [cabecalho, ...linhas].map((l) => l.map(proteger).join(';')).join('\n');
  return `﻿${corpo}\n`; // BOM para o Excel abrir em UTF-8
}

// "1.234,56" | "1234,56" | "1234.56" | "1234" → número (ou null se inválido).
export function numeroBr(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/i, '');
  if (!t) return null;
  let normalizado: string;
  if (t.includes(',')) normalizado = t.replace(/\./g, '').replace(',', '.');
  else normalizado = t;
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

export function reaisParaCentavos(texto: string): number | null {
  const n = numeroBr(texto);
  return n == null ? null : Math.round(n * 100);
}

// "dd/mm/aaaa" ou "aaaa-mm-dd" → ISO (ou null se inválida).
export function dataParaIso(texto: string): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;
  let x: RegExpMatchArray | null;
  if ((x = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    d = Number(x[1]); m = Number(x[2]); a = Number(x[3]);
  } else if ((x = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    a = Number(x[1]); m = Number(x[2]); d = Number(x[3]);
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  return data.toISOString().slice(0, 10);
}

// "sim"/"não" (e variações) → boolean; vazio → padrao; outro texto → null.
export function simNao(texto: string, padrao = false): boolean | null {
  const t = texto.trim().toLowerCase();
  if (!t) return padrao;
  if (['sim', 's', '1', 'verdadeiro'].includes(t)) return true;
  if (['não', 'nao', 'n', '0', 'falso'].includes(t)) return false;
  return null;
}

export function cnpjNormalizado(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length !== 14) return null;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

export function cpfNormalizado(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length !== 11) return null;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

// CPF (PF), CNPJ (PJ) ou qualquer um dos dois (tipo null) — formatado.
export function documentoNormalizado(texto: string, tipo: 'PF' | 'PJ' | null): string | null {
  if (tipo === 'PF') return cpfNormalizado(texto);
  if (tipo === 'PJ') return cnpjNormalizado(texto);
  return cpfNormalizado(texto) ?? cnpjNormalizado(texto);
}
