// A régua Sentinella (§3) aplicada a um título do banco: os passos que o
// motor agenda, respeitando o plano (Básico termina no D+15), o ERP integrado
// (bloqueio de pedidos), o valor-limite de ligação e a regra da duplicata
// antecipada (Lei 5.474/68: notificação no D+15, protesto até o D+25).

import type { Cliente, Titulo } from '@sentinella/db';

export interface Passo {
  off: number; // dias em relação ao vencimento
  etapa: string;
  descricao: string;
  quem: 'IA' | 'analista' | 'sistema';
  canal: string;
}

export function passosDaRegua(cliente: Cliente, titulo: Titulo): Passo[] {
  const canais = cliente.canais as string[];
  const msg = canais.includes('WhatsApp') ? 'WhatsApp' : canais[0] ?? 'e-mail';
  const aviso2via =
    cliente.multaPct != null
      ? 'Aviso de atraso com 2ª via — multa e juros exatamente como no contrato'
      : 'Aviso de atraso com 2ª via atualizada';

  const passos: Passo[] = [
    { off: -3, etapa: 'D−3', descricao: 'Lembrete com boleto ou Pix', quem: 'IA', canal: msg },
    { off: 0, etapa: 'D0', descricao: '“Vence hoje”, com link de pagamento', quem: 'IA', canal: msg },
    { off: 3, etapa: 'D+3', descricao: aviso2via, quem: 'IA', canal: msg },
    { off: 7, etapa: 'D+7', descricao: 'Proposta de acordo dentro da alçada', quem: 'IA', canal: msg },
  ];

  if (titulo.valorCentavos >= cliente.valorLimiteLigacao) {
    passos.push({ off: 10, etapa: 'D+10', descricao: 'Primeira ligação', quem: 'analista', canal: 'ligação' });
    passos.push({
      off: 15,
      etapa: 'D+15',
      descricao: 'Segunda ligação e e-mail formal registrando a conversa',
      quem: 'analista',
      canal: 'ligação',
    });
  } else {
    passos.push({ off: 10, etapa: 'D+10', descricao: 'Cobrança reforçada', quem: 'IA', canal: msg });
    passos.push({ off: 15, etapa: 'D+15', descricao: 'Aviso formal por escrito', quem: 'IA', canal: 'e-mail' });
  }

  if (cliente.plano === 'Básico') return passos; // a régua do Básico termina no D+15

  if (cliente.erpIntegrado) {
    passos.push({
      off: 15,
      etapa: 'bloqueio',
      descricao: 'Bloqueio de novos pedidos no ERP (com aprovação do cliente)',
      quem: 'sistema',
      canal: 'e-mail',
    });
  }

  const offNotificacao = titulo.antecipado ? 15 : 30;
  const offProtesto = titulo.antecipado ? 25 : 45;
  passos.push({
    off: offNotificacao,
    etapa: 'D+30',
    descricao: titulo.antecipado
      ? 'Notificação antecipada — duplicata antecipada, protesto até o D+25'
      : 'Notificação extrajudicial com prova de recebimento',
    quem: 'sistema',
    canal: canais.includes('carta') ? 'carta' : 'e-mail',
  });
  passos.push({
    off: offProtesto,
    etapa: 'D+45',
    descricao: 'Protesto preparado — aguarda autorização do cliente, título a título',
    quem: 'sistema',
    canal: 'e-mail',
  });
  passos.push({
    off: 60,
    etapa: 'jurídico',
    descricao: 'Encaminhamento ao escritório parceiro (contrato direto cliente–escritório)',
    quem: 'sistema',
    canal: 'e-mail',
  });
  return passos;
}

// Estados de título que a régua ainda acompanha; nos demais, nada é agendado
// e o que estiver agendado é cancelado pelo tick.
export const ESTADOS_NA_REGUA = ['a vencer', 'vencido'] as const;
