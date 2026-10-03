// A régua v3 aplicada a um título do banco: os passos que o motor agenda,
// ancorados na ENTRADA do título na carteira (CLAUDE.md §4). O plano em si
// vem de @sentinella/dados (planoDaRegua) — a mesma régua da demonstração —
// ajustado aqui pela regra do título antecipado (PJ): protesto até 30 dias
// do vencimento, independentemente da entrada.

import type { Carteira as CarteiraDb, Titulo as TituloDb } from '@sentinella/db';
import { planoDaRegua, faixaDoAtraso } from '@sentinella/dados';
import type { Canal, Carteira as CarteiraDados, PassoPlano } from '@sentinella/dados';
import { addDias, difDias, paraIso } from './datas';

export type Passo = PassoPlano; // off relativo à ENTRADA na carteira

// Converte a carteira do banco para o formato do pacote de dados (só os
// campos que o plano usa).
export function carteiraParaPlano(c: CarteiraDb): CarteiraDados {
  return {
    id: c.id,
    escritorioId: c.escritorioId,
    credorId: c.credorId,
    nome: c.nome,
    tipo: c.tipo as CarteiraDados['tipo'],
    devedores: c.devedoresTipo as CarteiraDados['devedores'],
    alcada: {
      descontoMaxPct: c.descontoMaxPct,
      parcelasMax: c.parcelasMax,
      prazoMaxDias: c.prazoMaxDias,
      entradaMinPct: c.entradaMinPct,
    },
    canais: c.canais as Canal[],
    multaPct: c.multaPct,
    jurosMesPct: c.jurosMesPct,
    baseLegal: c.baseLegal as CarteiraDados['baseLegal'],
    controlador: c.controlador as CarteiraDados['controlador'],
    contaEmissora: c.contaEmissora as CarteiraDados['contaEmissora'],
    entradaEm: paraIso(c.entradaEm),
  };
}

export function passosDaRegua(carteira: CarteiraDb, titulo: TituloDb): Passo[] {
  const plano = planoDaRegua(carteiraParaPlano(carteira), faixaDoAtraso(titulo.atrasoOriginal));

  if (!titulo.antecipado) return plano;

  // Título antecipado/descontado (PJ): o protesto precisa sair até 30 dias
  // do VENCIMENTO (regra do v2 que continua no §4). Reposiciona a medida
  // formal para caber nesse prazo e corta o que viria depois dela.
  const entradaIso = paraIso(titulo.entradaCarteira);
  const limiteProtesto = addDias(paraIso(titulo.vencimento), 30);
  const offProtesto = Math.max(3, difDias(limiteProtesto, entradaIso));
  const offNotificacao = Math.max(2, offProtesto - 7);

  const semFormais = plano.filter(
    (p) => !['comunicação prévia', 'notificação', 'negativação', 'última proposta', 'judicial'].includes(p.tipo)
      && p.off < offNotificacao,
  );
  semFormais.push(
    {
      off: offNotificacao,
      etapa: 'E+20',
      descricao: 'Notificação do título antecipado, assinada pelo advogado (protesto até 30 dias do vencimento)',
      quem: 'sistema',
      canal: 'e-mail',
      tipo: 'notificação',
    },
    {
      off: offProtesto,
      etapa: 'E+30',
      descricao: 'Protesto do título antecipado — aguarda autorização do escritório',
      quem: 'sistema',
      canal: 'e-mail',
      tipo: 'negativação',
    },
  );
  return semFormais.sort((a, b) => a.off - b.off);
}

// Estados de título que a régua ainda acompanha; nos demais nada é agendado
// e o que estiver agendado é cancelado pelo tick. "contestado" fica de fora:
// a cobrança PAUSA até o escritório responder (§3).
export const ESTADOS_NA_REGUA = ['em cobrança', 'em negociação'] as const;

export const ESTADOS_TERMINAIS = [
  'pago', 'cancelado', 'contestado', 'acordo', 'negativado', 'protestado', 'judicial',
] as const;
