// Drivers de canal (Fase 2). Regra do brief §12: em desenvolvimento, todos os
// canais operam em modo simulado — nenhuma mensagem real sai a partir de dados
// de demonstração. O modo produção só envia de verdade quando o fornecedor do
// canal estiver definido (PENDENCIAS.md) e as credenciais existirem no
// ambiente; sem isso, o envio cai no simulado e o motivo fica registrado.

export interface Envio {
  canal: string;
  para: string;
  texto: string;
}

export interface ResultadoEnvio {
  entrega: 'simulada' | 'enviada' | 'falhou';
  detalhe: string;
}

export interface DriverCanal {
  canal: string;
  nome: string;
  pronto(): { ok: true } | { ok: false; motivo: string };
  enviar(e: Envio): Promise<ResultadoEnvio>;
}

const simulado = (canal: string): DriverCanal => ({
  canal,
  nome: `${canal} (simulado)`,
  pronto: () => ({ ok: true }),
  enviar: async () => ({
    entrega: 'simulada',
    detalhe: 'modo simulado — nenhuma mensagem real foi enviada',
  }),
});

const aguardandoFornecedor = (canal: string, pendencia: string): DriverCanal => ({
  canal,
  nome: `${canal} (produção)`,
  pronto: () => ({ ok: false, motivo: pendencia }),
  enviar: async () => ({ entrega: 'falhou', detalhe: pendencia }),
});

const DRIVERS_PRODUCAO: Record<string, DriverCanal> = {
  WhatsApp: aguardandoFornecedor(
    'WhatsApp',
    'BSP de WhatsApp em definição (PENDENCIAS.md) — só API oficial via provedor homologado (§3)',
  ),
  'e-mail': aguardandoFornecedor(
    'e-mail',
    'fornecedor de e-mail transacional em definição (PENDENCIAS.md)',
  ),
  SMS: aguardandoFornecedor('SMS', 'fornecedor de SMS em definição (PENDENCIAS.md)'),
  carta: aguardandoFornecedor('carta', 'carta com AR entra na Fase 3 (§9)'),
};

export interface EscolhaDriver {
  driver: DriverCanal;
  aviso: string | null;
}

// CANAIS_MODO=producao ativa os drivers reais; qualquer outro valor (ou nada)
// mantém tudo simulado, que é o padrão de desenvolvimento (§12).
export function escolherDriver(canal: string, modo = process.env.CANAIS_MODO): EscolhaDriver {
  if (modo !== 'producao') return { driver: simulado(canal), aviso: null };
  const real = DRIVERS_PRODUCAO[canal];
  if (!real) return { driver: simulado(canal), aviso: `canal ${canal} sem driver de produção` };
  const estado = real.pronto();
  if (estado.ok) return { driver: real, aviso: null };
  return { driver: simulado(canal), aviso: `${canal}: ${estado.motivo}; envio simulado` };
}
