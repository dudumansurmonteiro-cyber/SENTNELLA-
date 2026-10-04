// Importação das planilhas padrão v3 (Fase 2 — §8): POR CARTEIRA, com
// validação linha a linha e relato de cada erro sem derrubar o arquivo.
// Regras da seção 3 já na porta de entrada:
//  - contato de TERCEIRO é descartado na importação (colunas contato_terceiro_*
//    nunca entram no banco; o descarte aparece no relatório);
//  - telefone de trabalho só entra se o próprio devedor o indicou
//    (telefone_trabalho_indicado_pelo_devedor = sim).
// Reimportar é seguro: devedores são atualizados pelo CPF/CNPJ e títulos
// pelo número; título pago/encerrado não é sobrescrito.

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { db, auditar } from '@sentinella/db';
import { lerPlanilha, documentoNormalizado, reaisParaCentavos, dataParaIso, simNao } from './planilhas';
import { deIso, difDias, paraIso } from './datas';

export interface ErroDeLinha {
  linha: number;
  motivo: string;
}

export interface RelatorioImportacao {
  arquivo: string;
  processadas: number;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  descartesTerceiro: number; // §3 — contatos de terceiros que ficaram de fora
  erros: ErroDeLinha[];
}

export function formatarRelatorio(r: RelatorioImportacao): string {
  const linhas = [
    `${r.arquivo}: ${r.processadas} linha(s) — ${r.criadas} criada(s), ` +
      `${r.atualizadas} atualizada(s), ${r.ignoradas} ignorada(s), ` +
      `${r.descartesTerceiro} contato(s) de terceiro descartado(s), ${r.erros.length} erro(s)`,
  ];
  for (const e of r.erros) linhas.push(`  linha ${e.linha}: ${e.motivo}`);
  return linhas.join('\n');
}

// Token de acesso dos portais: aleatório de verdade (não é o PRNG do seed).
export function novoToken(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let t = '';
  for (let i = 0; i < 12; i++) t += abc[bytes[i] % abc.length];
  return t;
}

const COLUNAS_TERCEIRO = [
  'contato_terceiro_nome', 'contato_terceiro_telefone', 'contato_terceiro_parentesco',
  'telefone_recado', 'telefone_vizinho', 'telefone_parente', 'contato_empregador',
];

export async function importarDevedores(
  carteiraId: string,
  caminho: string,
): Promise<RelatorioImportacao> {
  const carteira = await db.carteira.findUnique({ where: { id: carteiraId } });
  if (!carteira) throw new Error(`carteira ${carteiraId} não cadastrada`);

  const plan = lerPlanilha(readFileSync(caminho, 'utf8'));
  const r: RelatorioImportacao = {
    arquivo: caminho, processadas: 0, criadas: 0, atualizadas: 0,
    ignoradas: 0, descartesTerceiro: 0, erros: [],
  };
  const vistos = new Set<string>();

  for (const { numero, campos } of plan.linhas) {
    r.processadas++;

    const tipoBruto = (campos.tipo ?? '').trim().toUpperCase();
    const tipo = tipoBruto === 'PF' || tipoBruto === 'PJ' ? tipoBruto : null;
    if (!tipo) {
      r.erros.push({ linha: numero, motivo: `tipo "${campos.tipo ?? ''}" inválido (use PF ou PJ)` });
      continue;
    }
    if (carteira.devedoresTipo !== 'PF e PJ' && carteira.devedoresTipo !== tipo) {
      r.erros.push({ linha: numero, motivo: `a carteira só aceita devedores ${carteira.devedoresTipo}` });
      continue;
    }

    const documento = documentoNormalizado(campos.documento ?? campos.cpf ?? campos.cnpj ?? '', tipo);
    if (!documento) {
      r.erros.push({
        linha: numero,
        motivo: `documento inválido: "${campos.documento ?? ''}" (${tipo === 'PF' ? 'CPF com 11' : 'CNPJ com 14'} dígitos)`,
      });
      continue;
    }
    if (vistos.has(documento)) {
      r.erros.push({ linha: numero, motivo: `documento ${documento} repetido na planilha` });
      continue;
    }
    vistos.add(documento);

    const nome = (campos.nome ?? campos.razao_social ?? '').trim();
    if (!nome) {
      r.erros.push({ linha: numero, motivo: 'nome/razão social em branco' });
      continue;
    }

    // §3: qualquer coluna de contato de terceiro preenchida é DESCARTADA —
    // só falamos com o próprio devedor. A linha segue sem esses dados.
    const colunasComTerceiro = COLUNAS_TERCEIRO.filter((c) => (campos[c] ?? '').trim());
    if (colunasComTerceiro.length) {
      r.descartesTerceiro++;
      r.erros.push({
        linha: numero,
        motivo: `contato de terceiro descartado (${colunasComTerceiro.join(', ')}) — não entra na base (CDC/§3); a linha foi importada sem ele`,
      });
    }

    // Telefone de trabalho: só com a indicação expressa do próprio devedor.
    const trabalhoIndicado = simNao(campos.telefone_trabalho_indicado_pelo_devedor ?? '', false) ?? false;
    const telefoneTrabalho = trabalhoIndicado ? (campos.telefone_trabalho ?? '').trim() : '';
    if (!trabalhoIndicado && (campos.telefone_trabalho ?? '').trim()) {
      r.descartesTerceiro++;
      r.erros.push({
        linha: numero,
        motivo: 'telefone_trabalho descartado — sem indicação do próprio devedor (§3: nada de ligação ao trabalho)',
      });
    }

    const dados = {
      tipo,
      nome,
      cidade: (campos.cidade ?? '').trim(),
      whatsapp: (campos.whatsapp ?? '').trim(),
      email: (campos.email ?? campos.e_mail ?? '').trim(),
      telefone: (campos.telefone ?? '').trim(),
      telefoneTrabalho,
      naoCobrar: simNao(campos.nao_cobrar ?? '', false) ?? false,
    };

    const existente = await db.devedor.findUnique({
      where: { carteiraId_documento: { carteiraId, documento } },
    });
    if (existente) {
      await db.devedor.update({ where: { id: existente.id }, data: dados });
      r.atualizadas++;
    } else {
      const novo = await db.devedor.create({
        data: {
          escritorioId: carteira.escritorioId, credorId: carteira.credorId, carteiraId,
          documento, token: novoToken(), ...dados,
        },
      });
      await auditar(carteira.escritorioId, 'devedor', novo.id, null, 'cadastrado pela importação',
        'sistema', `${tipo} ${documento} na carteira ${carteira.nome}`);
      r.criadas++;
    }
  }
  return r;
}

export async function importarTitulos(
  carteiraId: string,
  caminho: string,
  hoje: string, // a ENTRADA na carteira é a data da importação (ou coluna própria)
): Promise<RelatorioImportacao> {
  const carteira = await db.carteira.findUnique({ where: { id: carteiraId } });
  if (!carteira) throw new Error(`carteira ${carteiraId} não cadastrada`);

  const plan = lerPlanilha(readFileSync(caminho, 'utf8'));
  const r: RelatorioImportacao = {
    arquivo: caminho, processadas: 0, criadas: 0, atualizadas: 0,
    ignoradas: 0, descartesTerceiro: 0, erros: [],
  };

  const devedores = await db.devedor.findMany({
    where: { carteiraId }, select: { id: true, documento: true, tipo: true },
  });
  const porDocumento = new Map(devedores.map((d) => [d.documento, d]));
  const vistos = new Set<string>();

  for (const { numero: linha, campos } of plan.linhas) {
    r.processadas++;
    const numero = (campos.numero ?? '').trim();
    if (!numero) {
      r.erros.push({ linha, motivo: 'número do título vazio' });
      continue;
    }
    if (vistos.has(numero)) {
      r.erros.push({ linha, motivo: `título ${numero} repetido na planilha` });
      continue;
    }
    vistos.add(numero);

    const docBruto = campos.documento_devedor ?? campos.documento ?? '';
    const documento = documentoNormalizado(docBruto, null);
    if (!documento) {
      r.erros.push({ linha, motivo: `documento_devedor inválido: "${docBruto}"` });
      continue;
    }
    const devedor = porDocumento.get(documento);
    if (!devedor) {
      r.erros.push({
        linha,
        motivo: `devedor de documento ${documento} não está na carteira — importe a planilha de devedores antes`,
      });
      continue;
    }

    const valorCentavos = reaisParaCentavos(campos.valor ?? '');
    if (valorCentavos == null || valorCentavos <= 0) {
      r.erros.push({ linha, motivo: `valor inválido: "${campos.valor ?? ''}"` });
      continue;
    }
    const vencimento = dataParaIso(campos.vencimento ?? '');
    if (!vencimento) {
      r.erros.push({ linha, motivo: `vencimento inválido: "${campos.vencimento ?? ''}" (use dd/mm/aaaa)` });
      continue;
    }
    const entrada = (campos.entrada_carteira ?? '').trim()
      ? dataParaIso(campos.entrada_carteira)
      : hoje;
    if (!entrada) {
      r.erros.push({ linha, motivo: `entrada_carteira inválida: "${campos.entrada_carteira}"` });
      continue;
    }
    const atrasoOriginal = Math.max(0, difDias(entrada, vencimento));

    const antecipado = simNao(campos.antecipado ?? '', false);
    if (antecipado == null) {
      r.erros.push({ linha, motivo: `antecipado "${campos.antecipado}" inválido (use sim ou não)` });
      continue;
    }
    if (antecipado && devedor.tipo !== 'PJ') {
      r.erros.push({ linha, motivo: 'título antecipado só vale para devedor PJ (duplicata)' });
      continue;
    }

    const existente = await db.titulo.findUnique({
      where: { carteiraId_numero: { carteiraId, numero } },
    });
    if (existente) {
      if (['pago', 'cancelado', 'judicial'].includes(existente.estado)) {
        r.ignoradas++;
        continue; // título encerrado não é sobrescrito pela importação
      }
      const mudou =
        existente.valorCentavos !== valorCentavos ||
        paraIso(existente.vencimento) !== vencimento ||
        existente.antecipado !== antecipado;
      await db.titulo.update({
        where: { id: existente.id },
        data: { valorCentavos, vencimento: deIso(vencimento), antecipado, devedorId: devedor.id },
      });
      if (mudou)
        await auditar(carteira.escritorioId, 'titulo', existente.id, existente.estado, existente.estado,
          'sistema', 'dados atualizados pela importação (valor, vencimento ou antecipado)');
      r.atualizadas++;
    } else {
      const novo = await db.titulo.create({
        data: {
          escritorioId: carteira.escritorioId, credorId: carteira.credorId, carteiraId,
          devedorId: devedor.id, numero, valorCentavos,
          vencimento: deIso(vencimento), entradaCarteira: deIso(entrada),
          atrasoOriginal, antecipado, estado: 'em cobrança', origem: 'csv',
        },
      });
      await auditar(carteira.escritorioId, 'titulo', novo.id, null, 'em cobrança', 'sistema',
        `importado (${numero}; entrada ${entrada}, ${atrasoOriginal} dia(s) de atraso)`);
      r.criadas++;
    }
  }
  return r;
}
