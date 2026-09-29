// Cliente Prisma compartilhado + auditoria de mudanças de estado (§8).

import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();

export type Autor = 'IA' | 'analista' | 'cliente' | 'lojista' | 'sistema';

export async function auditar(
  clienteId: string,
  entidade: string,
  entidadeId: string,
  de: string | null,
  para: string,
  autor: Autor,
  detalhe?: string,
) {
  await db.registroAuditoria.create({
    data: { clienteId, entidade, entidadeId, de, para, autor, detalhe },
  });
}

export * from '@prisma/client';
