// Importação das planilhas padrão (Fase 2 — §11): valida linha a linha,
// relata cada erro com o número da linha e o motivo, e nunca deixa um erro
// derrubar o resto do arquivo. Reimportar é seguro: lojistas são atualizados
// pelo CNPJ e títulos pelo número; título pago não é sobrescrito.

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { db, auditar } from '@sentinella/db';
import {
  lerPlanilha, cnpjNormalizado, reaisParaCentavos, dataParaIso, simNao,
} from './planilhas';
import { deIso } from './datas';

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
  erros: ErroDeLinha[];
}

export function formatarRelatorio(r: RelatorioImportacao): string {
  const linhas = [
    `${r.arquivo}: ${r.processadas} linha(s) — ${r.criadas} criada(s), ` +
      `${r.atualizadas} atualizada(s), ${r.ignoradas} ignorada(s), ${r.erros.length} erro(s)`,
  ];
  for (const e of r.erros) linhas.push(`  linha ${e.linha}: ${e.motivo}`);
  return linhas.join('\n');
}

// Token de acesso do portal: aleatório de verdade (não é o PRNG do seed).
export function novoToken(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let t = '';
  for (let i = 0; i < 12; i++) t += abc[bytes[i] % abc.length];
  return t;
}

const PAPEIS = ['financeiro', 'sócio'];

export async function importarLojistas(
  clienteId: string,
  caminho: string,
): Promise<RelatorioImportacao> {
  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new Error(`cliente ${clienteId} não cadastrado`);

  const plan = lerPlanilha(readFileSync(caminho, 'utf8'));
  const r: RelatorioImportacao = {
    arquivo: caminho, processadas: 0, criadas: 0, atualizadas: 0, ignoradas: 0, erros: [],
  };
  const vistos = new Set<string>();

  for (const { numero, campos } of plan.linhas) {
    r.processadas++;
    const cnpj = cnpjNormalizado(campos.cnpj ?? '');
    if (!cnpj) {
      r.erros.push({ linha: numero, motivo: `CNPJ inválido: "${campos.cnpj ?? ''}" (precisa ter 14 dígitos)` });
      continue;
    }
    if (vistos.has(cnpj)) {
      r.erros.push({ linha: numero, motivo: `CNPJ ${cnpj} repetido na planilha` });
      continue;
    }
    vistos.add(cnpj);

    const nome = (campos.razao_social ?? '').trim();
    if (!nome) {
      r.erros.push({ linha: numero, motivo: 'razão social vazia' });
      continue;
    }
    const papelBruto = (campos.contato_papel ?? '').trim().toLowerCase() || 'financeiro';
    const papel = papelBruto === 'socio' ? 'sócio' : papelBruto;
    if (!PAPEIS.includes(papel)) {
      r.erros.push({
        linha: numero,
        motivo: `contato_papel "${campos.contato_papel}" inválido (use financeiro ou sócio — §3: só o responsável financeiro ou sócio)`,
      });
      continue;
    }
    const naoCobrar = simNao(campos.nao_cobrar ?? '', false);
    if (naoCobrar == null) {
      r.erros.push({ linha: numero, motivo: `nao_cobrar "${campos.nao_cobrar}" inválido (use sim ou não)` });
      continue;
    }

    const dados = {
      nome,
      cidade: (campos.cidade ?? '').trim(),
      contatoNome: (campos.contato_nome ?? '').trim(),
      contatoPapel: papel,
      whatsapp: (campos.whatsapp ?? '').trim(),
      email: (campos.email ?? campos.e_mail ?? '').trim(),
      telefone: (campos.telefone ?? '').trim(),
      naoCobrar,
    };

    const existente = await db.lojista.findUnique({
      where: { clienteId_cnpj: { clienteId, cnpj } },
    });
    if (existente) {
      await db.lojista.update({ where: { id: existente.id }, data: dados });
      r.atualizadas++;
    } else {
      const novo = await db.lojista.create({
        data: { clienteId, cnpj, token: novoToken(), ...dados },
      });
      await auditar(clienteId, 'lojista', novo.id, null, 'cadastrado pela importação', 'sistema', `CNPJ ${cnpj}`);
      r.criadas++;
    }
  }
  return r;
}

export async function importarTitulos(
  clienteId: string,
  caminho: string,
): Promise<RelatorioImportacao> {
  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new Error(`cliente ${clienteId} não cadastrado`);

  const plan = lerPlanilha(readFileSync(caminho, 'utf8'));
  const r: RelatorioImportacao = {
    arquivo: caminho, processadas: 0, criadas: 0, atualizadas: 0, ignoradas: 0, erros: [],
  };

  const lojistas = await db.lojista.findMany({ where: { clienteId }, select: { id: true, cnpj: true } });
  const porCnpj = new Map(lojistas.map((l) => [l.cnpj, l.id]));
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

    const cnpj = cnpjNormalizado(campos.cnpj_lojista ?? '');
    if (!cnpj) {
      r.erros.push({ linha, motivo: `cnpj_lojista inválido: "${campos.cnpj_lojista ?? ''}"` });
      continue;
    }
    const lojistaId = porCnpj.get(cnpj);
    if (!lojistaId) {
      r.erros.push({ linha, motivo: `lojista de CNPJ ${cnpj} não está na base — importe a planilha de lojistas antes` });
      continue;
    }
    const valorCentavos = reaisParaCentavos(campos.valor ?? '');
    if (valorCentavos == null || valorCentavos <= 0) {
      r.erros.push({ linha, motivo: `valor inválido: "${campos.valor ?? ''}"` });
      continue;
    }
    const emissao = dataParaIso(campos.emissao ?? '');
    if (!emissao) {
      r.erros.push({ linha, motivo: `emissão inválida: "${campos.emissao ?? ''}" (use dd/mm/aaaa)` });
      continue;
    }
    const vencimento = dataParaIso(campos.vencimento ?? '');
    if (!vencimento) {
      r.erros.push({ linha, motivo: `vencimento inválido: "${campos.vencimento ?? ''}" (use dd/mm/aaaa)` });
      continue;
    }
    if (vencimento < emissao) {
      r.erros.push({ linha, motivo: `vencimento ${campos.vencimento} anterior à emissão ${campos.emissao}` });
      continue;
    }
    const antecipado = simNao(campos.antecipado ?? '', false);
    if (antecipado == null) {
      r.erros.push({ linha, motivo: `antecipado "${campos.antecipado}" inválido (use sim ou não)` });
      continue;
    }

    const existente = await db.titulo.findUnique({
      where: { clienteId_numero: { clienteId, numero } },
    });
    if (existente) {
      if (existente.estado === 'pago' || existente.estado === 'cancelado') {
        r.ignoradas++;
        continue; // título encerrado não é sobrescrito pela importação
      }
      const mudou =
        existente.valorCentavos !== valorCentavos ||
        existente.vencimento.toISOString().slice(0, 10) !== vencimento ||
        existente.antecipado !== antecipado;
      await db.titulo.update({
        where: { id: existente.id },
        data: { valorCentavos, emissao: deIso(emissao), vencimento: deIso(vencimento), antecipado, lojistaId },
      });
      if (mudou)
        await auditar(clienteId, 'titulo', existente.id, existente.estado, existente.estado, 'sistema',
          'dados atualizados pela importação (valor, vencimento ou antecipado)');
      r.atualizadas++;
    } else {
      const novo = await db.titulo.create({
        data: {
          clienteId, lojistaId, numero, valorCentavos,
          emissao: deIso(emissao), vencimento: deIso(vencimento),
          antecipado, estado: 'a vencer', origem: 'csv',
        },
      });
      await auditar(clienteId, 'titulo', novo.id, null, 'a vencer', 'sistema', `importado (${numero})`);
      r.criadas++;
    }
  }
  return r;
}
