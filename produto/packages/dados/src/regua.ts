// Régua v3 reancorada na entrada do título na carteira (CLAUDE.md §4).
// Dois eixos: E (dias desde a entrada) e a faixa de atraso na entrada.
// As travas da seção 3 (CDC) são aplicadas pelo simulador do seed e pelo
// motor real — aqui fica o PLANO de passos de cada título.

import type { Canal, Carteira, Etapa, FaixaEntrada } from './tipos';

export interface PassoPlano {
  off: number; // dias desde a entrada na carteira
  etapa: Etapa;
  descricao: string;
  quem: 'IA' | 'analista' | 'sistema';
  canal: Canal;
  tipo:
    | 'mensagem'
    | 'proposta'
    | 'ligação'
    | 'comunicação prévia'
    | 'notificação'
    | 'negativação'
    | 'última proposta'
    | 'judicial';
}

const msgDe = (carteira: Carteira): Canal =>
  carteira.canais.includes('WhatsApp') ? 'WhatsApp' : carteira.canais[0] ?? 'e-mail';

// Régua base por entrada (§4), ajustada pela faixa de atraso na entrada.
export function planoDaRegua(carteira: Carteira, faixa: FaixaEntrada): PassoPlano[] {
  const msg = msgDe(carteira);
  const temLigacao = carteira.canais.includes('ligação');
  const cartaOuEmail: Canal = carteira.canais.includes('carta') ? 'carta' : 'e-mail';
  const tom = faixa === 'até 30' ? 'lembrete' : 'regularização';

  if (faixa === 'acima de 180') {
    // Régua curta (§4): E+0, E+3 ligação, E+10 comunicação prévia,
    // E+20 notificação, E+30 negativação/protesto, E+45 judicial.
    const plano: PassoPlano[] = [
      { off: 0, etapa: 'E+0', descricao: `Boas-vindas à cobrança (tom de ${tom}) com valor atualizado e opções de pagamento`, quem: 'IA', canal: msg, tipo: 'mensagem' },
    ];
    if (temLigacao)
      plano.push({ off: 3, etapa: 'E+3', descricao: 'Primeira ligação', quem: 'analista', canal: 'ligação', tipo: 'ligação' });
    else
      plano.push({ off: 3, etapa: 'E+3', descricao: 'Proposta de acordo dentro da alçada', quem: 'IA', canal: msg, tipo: 'proposta' });
    plano.push(
      { off: 10, etapa: 'E+10', descricao: 'Comunicação prévia de negativação (CDC, art. 43, §2º), com prova de envio', quem: 'sistema', canal: cartaOuEmail, tipo: 'comunicação prévia' },
      { off: 20, etapa: 'E+20', descricao: 'Notificação extrajudicial assinada pelo advogado', quem: 'sistema', canal: cartaOuEmail, tipo: 'notificação' },
      { off: 30, etapa: 'E+30', descricao: 'Negativação/protesto — aguarda autorização do escritório, título a título', quem: 'sistema', canal: 'e-mail', tipo: 'negativação' },
      { off: 45, etapa: 'E+45', descricao: 'Encaminhamento ao fluxo judicial do escritório, com dossiê', quem: 'sistema', canal: 'e-mail', tipo: 'judicial' },
    );
    return plano;
  }

  const pular7 = faixa === '91–180';
  const ligacaoCedo = faixa === '91–180'; // ligação já no E+3 (§4)
  const descontoMaior = faixa === '91–180' ? ' (desconto maior dentro da alçada)' : '';

  const plano: PassoPlano[] = [
    { off: 0, etapa: 'E+0', descricao: `Boas-vindas à cobrança (tom de ${tom}): o escritório está responsável por este débito, com valor atualizado e opções de pagamento`, quem: 'IA', canal: msg, tipo: 'mensagem' },
    { off: 2, etapa: 'E+2', descricao: `Proposta de acordo dentro da alçada da carteira${descontoMaior}`, quem: 'IA', canal: msg, tipo: 'proposta' },
  ];

  if (temLigacao) {
    plano.push({
      off: ligacaoCedo ? 3 : 5,
      etapa: ligacaoCedo ? 'E+3' : 'E+5',
      descricao: 'Primeira ligação',
      quem: 'analista',
      canal: 'ligação',
      tipo: 'ligação',
    });
  }
  if (!pular7) {
    plano.push({
      off: 7, etapa: 'E+7',
      descricao: 'Reforço com o link do espaço do devedor',
      quem: 'IA',
      canal: carteira.canais.includes('SMS') ? 'SMS' : msg,
      tipo: 'mensagem',
    });
  }
  if (temLigacao) {
    plano.push({ off: 10, etapa: 'E+10', descricao: 'Segunda ligação e e-mail formal registrando os contatos', quem: 'analista', canal: 'ligação', tipo: 'ligação' });
  } else {
    plano.push({ off: 10, etapa: 'E+10', descricao: 'Cobrança formal por escrito', quem: 'IA', canal: 'e-mail', tipo: 'mensagem' });
  }
  plano.push(
    { off: 15, etapa: 'E+15', descricao: 'Comunicação prévia de negativação (CDC, art. 43, §2º), com prova de envio', quem: 'sistema', canal: cartaOuEmail, tipo: 'comunicação prévia' },
    { off: 20, etapa: 'E+20', descricao: 'Notificação extrajudicial assinada pelo advogado', quem: 'sistema', canal: cartaOuEmail, tipo: 'notificação' },
    { off: 30, etapa: 'E+30', descricao: 'Negativação/protesto — aguarda autorização do escritório, título a título', quem: 'sistema', canal: 'e-mail', tipo: 'negativação' },
    { off: 45, etapa: 'E+45', descricao: 'Última proposta antes do judicial', quem: 'analista', canal: temLigacao ? 'ligação' : msg, tipo: 'última proposta' },
    { off: 60, etapa: 'E+60', descricao: 'Encaminhamento ao fluxo judicial do escritório, com dossiê', quem: 'sistema', canal: 'e-mail', tipo: 'judicial' },
  );
  return plano;
}

// Prazo mínimo (dias) entre a comunicação prévia e a negativação — a trava
// que o motor aplica antes de qualquer inclusão em cadastro (seção 3).
export const PRAZO_COMUNICACAO_PREVIA_DIAS = 10;

// Motivos de bloqueio de conformidade (aceite §12.6 — visíveis no painel).
export const BLOQUEIOS = {
  previa: 'negativação barrada — comunicação prévia sem prazo cumprido (CDC, art. 43, §2º)',
  canal: 'canal bloqueado a pedido do devedor — caso encaminhado ao analista',
  contestado: 'título contestado — cobrança pausada até resposta do escritório',
  texto: 'texto vetado pela conformidade antes de salvar — termo não permitido',
  terceiro: 'contato de terceiro descartado na importação — só falamos com o próprio devedor',
  horario: 'fora da janela permitida de ligação — reprogramada',
} as const;
