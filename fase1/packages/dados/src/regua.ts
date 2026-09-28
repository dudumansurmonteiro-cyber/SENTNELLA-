// Motor de régua simulado (Fase 1 — CLAUDE.md §3 e §11).
// Gera as ações de cobrança de um título a partir do plano do cliente,
// respeitando: Básico termina no D+15; bloqueio de pedidos só com ERP
// integrado; duplicata antecipada tem notificação no D+15 e protesto até o
// D+25 (Lei 5.474/68, art. 13, §4º); mensagem sem multa quando o cliente não
// cadastrou multa (§12).

import { Acao, Canal, Cliente, Etapa, Titulo } from './tipos';
import { Rnd, chance, escolha } from './prng';
import { addDias, difDias } from './formato';

interface Passo {
  off: number;
  etapa: Etapa;
  descricao: string;
  quem: 'IA' | 'analista' | 'sistema';
  canal: Canal;
}

function passosPara(cliente: Cliente, titulo: Titulo): Passo[] {
  const msg: Canal = cliente.canais.includes('WhatsApp') ? 'WhatsApp' : cliente.canais[0];
  const aviso2via = cliente.multaPct != null
    ? 'Aviso de atraso com 2ª via — multa e juros exatamente como no contrato'
    : 'Aviso de atraso com 2ª via atualizada';

  const base: Passo[] = [
    { off: -3, etapa: 'D−3', descricao: 'Lembrete com boleto ou Pix', quem: 'IA', canal: msg },
    { off: 0, etapa: 'D0', descricao: '“Vence hoje”, com link de pagamento', quem: 'IA', canal: msg },
    { off: 3, etapa: 'D+3', descricao: aviso2via, quem: 'IA', canal: msg },
    { off: 7, etapa: 'D+7', descricao: 'Proposta de acordo dentro da alçada', quem: 'IA', canal: msg },
  ];

  // Ligações do analista: títulos relevantes (acima do valor-limite do cliente).
  if (titulo.valor >= cliente.valorLimiteLigacao) {
    base.push({ off: 10, etapa: 'D+10', descricao: 'Primeira ligação', quem: 'analista', canal: 'ligação' });
    base.push({ off: 15, etapa: 'D+15', descricao: 'Segunda ligação e e-mail formal registrando a conversa', quem: 'analista', canal: 'ligação' });
  } else {
    base.push({ off: 10, etapa: 'D+10', descricao: 'Cobrança reforçada', quem: 'IA', canal: msg });
    base.push({ off: 15, etapa: 'D+15', descricao: 'Aviso formal por escrito', quem: 'IA', canal: 'e-mail' });
  }

  if (cliente.plano === 'Básico') return base; // a régua do Básico termina no D+15

  if (cliente.erpIntegrado) {
    base.push({ off: 15, etapa: 'bloqueio', descricao: 'Bloqueio de novos pedidos no ERP (aprovado pelo cliente)', quem: 'sistema', canal: 'e-mail' });
  }

  const offNotif = titulo.antecipado ? 15 : 30;
  const offProt = titulo.antecipado ? 25 : 45;
  base.push({
    off: offNotif,
    etapa: 'D+30',
    descricao: titulo.antecipado
      ? 'Notificação extrajudicial antecipada — duplicata antecipada, protesto até o D+25'
      : 'Notificação extrajudicial com prova de recebimento',
    quem: 'sistema',
    canal: cliente.canais.includes('carta') ? 'carta' : 'e-mail',
  });
  base.push({
    off: offProt,
    etapa: 'D+45',
    descricao: 'Protesto preparado — aguarda autorização do cliente',
    quem: 'sistema',
    canal: 'e-mail',
  });
  base.push({ off: 60, etapa: 'jurídico', descricao: 'Encaminhamento ao escritório parceiro', quem: 'sistema', canal: 'e-mail' });
  return base;
}

const RESULTADOS_MSG = ['entregue', 'lido', 'respondido'] as const;

export function gerarAcoes(
  rnd: Rnd,
  cliente: Cliente,
  titulo: Titulo,
  hoje: string,
  contadores: { acao: number },
): Acao[] {
  const acoes: Acao[] = [];
  const fim = titulo.pagoEm ?? null;

  for (const p of passosPara(cliente, titulo)) {
    const data = addDias(titulo.vencimento, p.off);
    if (fim && difDias(data, fim) > 0) break; // título pago antes desta etapa
    const diasNoFuturo = difDias(data, hoje);
    if (diasNoFuturo > 10) break; // agenda só o horizonte próximo

    let estado: Acao['estado'];
    let resultado: string | null = null;

    if (diasNoFuturo > 0) {
      estado = 'agendada';
    } else if (diasNoFuturo === 0) {
      estado = chance(rnd, 0.5) ? 'em andamento' : 'agendada';
    } else if (p.quem === 'analista') {
      if (chance(rnd, 0.42)) {
        estado = 'não atendida';
        resultado = 'não atendida — reprogramada para o dia seguinte';
      } else {
        estado = 'finalizada';
        resultado = chance(rnd, 0.55) ? 'atendida — promessa de pagamento' : 'atendida';
      }
    } else if (p.etapa === 'D+45') {
      estado = 'pendente';
      resultado = 'aguarda autorização do cliente';
    } else if (chance(rnd, 0.006)) {
      estado = 'bloqueada';
      resultado = 'valor divergente do ERP — conferência barrou o envio';
    } else if (chance(rnd, 0.05)) {
      estado = 'pendente';
      resultado = 'aguardando resposta do lojista';
    } else {
      estado = 'finalizada';
      const nivel = Math.min(2, Math.floor(rnd() * 3.4));
      resultado = RESULTADOS_MSG[nivel];
      if (titulo.pagoEm && difDias(titulo.pagoEm, data) <= 2 && difDias(titulo.pagoEm, data) >= 0) {
        resultado = 'pago em até 48h após o contato';
      }
    }

    acoes.push({
      id: `a${++contadores.acao}`,
      clienteId: cliente.id,
      tituloId: titulo.id,
      lojistaId: titulo.lojistaId,
      etapa: p.etapa,
      descricao: p.descricao,
      canal: p.canal,
      quem: p.quem,
      data,
      estado,
      resultado,
    });

    if (estado === 'não atendida' && difDias(addDias(data, 1), hoje) <= 0) {
      const nova = addDias(data, 1);
      const atendeu = chance(rnd, 0.62);
      acoes.push({
        id: `a${++contadores.acao}`,
        clienteId: cliente.id,
        tituloId: titulo.id,
        lojistaId: titulo.lojistaId,
        etapa: p.etapa,
        descricao: `${p.descricao} (nova tentativa)`,
        canal: p.canal,
        quem: p.quem,
        data: nova,
        estado: atendeu ? 'finalizada' : 'não atendida',
        resultado: atendeu
          ? (chance(rnd, 0.5) ? 'atendida — promessa de pagamento' : 'atendida')
          : 'não atendida',
      });
    }
  }
  return acoes;
}

export function etapaAtualDoTitulo(acoes: Acao[], titulo: Titulo): string {
  if (titulo.estado === 'pago') return 'quitado';
  if (titulo.estado === 'fora da régua') return 'fora da régua';
  const doTitulo = acoes.filter((a) => a.tituloId === titulo.id);
  if (!doTitulo.length) return 'a programar';
  const ultima = doTitulo[doTitulo.length - 1];
  return `${ultima.etapa} · ${ultima.estado === 'agendada' ? 'programada' : ultima.estado}`;
}

export const escolhaCanal = (rnd: Rnd, canais: Canal[]) => escolha(rnd, canais);
