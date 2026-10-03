// Cliente Prisma compartilhado + auditoria de mudanças de estado (§7).

import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();

export type Autor = 'IA' | 'analista' | 'escritório' | 'credor' | 'devedor' | 'sistema';

export async function auditar(
  escritorioId: string,
  entidade: string,
  entidadeId: string,
  de: string | null,
  para: string,
  autor: Autor,
  detalhe?: string,
) {
  await db.registroAuditoria.create({
    data: { escritorioId, entidade, entidadeId, de, para, autor, detalhe },
  });
}

export * from '@prisma/client';
