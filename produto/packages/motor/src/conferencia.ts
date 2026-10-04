// Conferência automática antes de cada envio (v3 §3 + regra do v2 §12):
// nenhuma mensagem sai citando valor, data ou encargo diferente dos dados
// importados; nenhuma mensagem comum cita medida formal (protesto,
// negativação, judicial) — isso é texto de documento formal, não de cobrança
// de rotina (CDC, art. 71: citar consequência que não virá é informação
// falsa); e nenhum texto passa com termo vedado. Divergência → a ação é
// bloqueada e vira exceção para o analista.

import { numeroBr, dataParaIso } from './planilhas';

// Termos que nunca saem em mensagem de cobrança (§3: tom sem ameaça nem
// constrangimento; §1/§9: vocabulário proibido do produto).
export const TERMOS_VEDADOS = [
  'ameaça', 'ameaca', 'polícia', 'policia', 'criminal', 'crime', 'prisão', 'prisao',
  'preso', 'cadeia', 'vergonha', 'vexame', 'caloteiro', 'constrangimento',
  'seguro', 'apólice', 'apolice', 'cobertura', 'garantia total', '100%',
  'revolucionário', 'revolucionario', 'disruptivo',
] as const;

const MEDIDAS_FORMAIS = /\bprotest\w*|\bnegativ\w*|\bjudicial\w*|\bexecuç\w*|\bexecuc\w*|cadastros? de proteção|spc\b|serasa\b/i;

export interface EsperadoConferencia {
  valoresCentavos: number[]; // todos os valores que a mensagem pode citar
  datasIso: string[]; // todas as datas que a mensagem pode citar
  multaCadastrada: boolean;
  parcelasMax?: number;
  // true nos documentos formais (comunicação prévia, notificação): só eles
  // podem citar medidas — e só quando a régua da carteira realmente as alcança.
  etapaFormal?: boolean;
}

export type ResultadoConferencia =
  | { aprovada: true }
  | { aprovada: false; motivo: string };

export function conferirMensagem(
  texto: string,
  esperado: EsperadoConferencia,
): ResultadoConferencia {
  const minusculo = texto.toLowerCase();

  // 1) Termos vedados nunca passam (tom e vocabulário — §3/§9).
  for (const termo of TERMOS_VEDADOS) {
    if (minusculo.includes(termo)) {
      return { aprovada: false, motivo: `texto vetado pela conformidade — termo não permitido: "${termo}"` };
    }
  }

  // 2) Medida formal só em documento formal (CDC, arts. 42 e 71).
  if (!esperado.etapaFormal && MEDIDAS_FORMAIS.test(texto)) {
    return {
      aprovada: false,
      motivo: 'mensagem comum cita medida formal (protesto/negativação/judicial) — isso é texto de documento formal',
    };
  }

  // 3) Sem encargos cadastrados na carteira, a mensagem não menciona multa/juros.
  if (!esperado.multaCadastrada && /\bmultas?\b|\bjuros\b/i.test(texto)) {
    return {
      aprovada: false,
      motivo: 'mensagem menciona multa ou juros, mas a carteira não tem percentuais cadastrados',
    };
  }

  // 4) Todo valor em R$ precisa bater com os dados importados (centavo a centavo).
  const valores = [...texto.matchAll(/R\$\s?([\d.]+(?:,\d{1,2})?)/g)];
  for (const v of valores) {
    const n = numeroBr(v[1]);
    if (n == null) return { aprovada: false, motivo: `valor ilegível na mensagem: "${v[0]}"` };
    const centavos = Math.round(n * 100);
    if (!esperado.valoresCentavos.some((e) => Math.abs(e - centavos) <= 1)) {
      return { aprovada: false, motivo: `valor ${v[0].trim()} não confere com os dados importados` };
    }
  }

  // 5) Toda data dd/mm/aa(aa) precisa ser uma data conhecida do título.
  const datas = [...texto.matchAll(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/g)];
  for (const d of datas) {
    const ano = d[3].length === 2 ? `20${d[3]}` : d[3];
    const iso = dataParaIso(`${d[1]}/${d[2]}/${ano}`);
    if (iso == null || !esperado.datasIso.includes(iso)) {
      return { aprovada: false, motivo: `data ${d[0]} não confere com os dados importados` };
    }
  }

  // 6) Parcelamento citado não pode passar da alçada da carteira.
  if (esperado.parcelasMax != null) {
    const parcelas = [...texto.matchAll(/\b(?:em\s+até\s+|em\s+)(\d{1,2})x\b/gi)];
    for (const p of parcelas) {
      if (Number(p[1]) > esperado.parcelasMax) {
        return {
          aprovada: false,
          motivo: `parcelamento ${p[1]}x acima da alçada da carteira (${esperado.parcelasMax}x)`,
        };
      }
    }
  }

  return { aprovada: true };
}
