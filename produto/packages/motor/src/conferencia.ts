// Conferência automática antes de cada envio (§5 e Fase 2 do §11): nenhuma
// mensagem sai citando valor, data ou encargo diferente do que está nos dados
// importados. Divergência → a ação é bloqueada e vira exceção para o analista.

import { numeroBr, dataParaIso } from './planilhas';

export interface EsperadoConferencia {
  valoresCentavos: number[]; // todos os valores que a mensagem pode citar
  datasIso: string[]; // todas as datas que a mensagem pode citar
  multaCadastrada: boolean;
  parcelasMax?: number;
}

export type ResultadoConferencia =
  | { aprovada: true }
  | { aprovada: false; motivo: string };

export function conferirMensagem(
  texto: string,
  esperado: EsperadoConferencia,
): ResultadoConferencia {
  // 1) Sem multa cadastrada, a mensagem não pode mencionar multa nem juros (§12).
  if (!esperado.multaCadastrada && /\bmultas?\b|\bjuros\b/i.test(texto)) {
    return {
      aprovada: false,
      motivo: 'mensagem menciona multa ou juros, mas o cliente não tem percentuais cadastrados',
    };
  }

  // 2) Todo valor em R$ precisa bater com os dados importados (centavo a centavo).
  const valores = [...texto.matchAll(/R\$\s?([\d.]+(?:,\d{1,2})?)/g)];
  for (const v of valores) {
    const n = numeroBr(v[1]);
    if (n == null) return { aprovada: false, motivo: `valor ilegível na mensagem: "${v[0]}"` };
    const centavos = Math.round(n * 100);
    if (!esperado.valoresCentavos.some((e) => Math.abs(e - centavos) <= 1)) {
      return {
        aprovada: false,
        motivo: `valor ${v[0].trim()} não confere com os dados importados`,
      };
    }
  }

  // 3) Toda data dd/mm/aa(aa) precisa ser uma data conhecida do título.
  const datas = [...texto.matchAll(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/g)];
  for (const d of datas) {
    const ano = d[3].length === 2 ? `20${d[3]}` : d[3];
    const iso = dataParaIso(`${d[1]}/${d[2]}/${ano}`);
    if (iso == null || !esperado.datasIso.includes(iso)) {
      return {
        aprovada: false,
        motivo: `data ${d[0]} não confere com os dados importados`,
      };
    }
  }

  // 4) Parcelamento citado não pode passar da alçada do cliente.
  if (esperado.parcelasMax != null) {
    const parcelas = [...texto.matchAll(/\b(?:em\s+até\s+|em\s+)(\d{1,2})x\b/gi)];
    for (const p of parcelas) {
      if (Number(p[1]) > esperado.parcelasMax) {
        return {
          aprovada: false,
          motivo: `parcelamento ${p[1]}x acima da alçada do cliente (${esperado.parcelasMax}x)`,
        };
      }
    }
  }

  return { aprovada: true };
}
