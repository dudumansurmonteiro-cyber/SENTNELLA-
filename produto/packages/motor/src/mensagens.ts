// Textos das mensagens da régua v3 — sempre em pt-BR, em NOME DO ESCRITÓRIO
// (white label), tom firme e respeitoso (§3: sem ameaça, sem constrangimento,
// sem citar medida que a régua daquela carteira não alcança — medidas formais
// só aparecem nos documentos formais). Multa e juros só entram quando a
// CARTEIRA tem os percentuais cadastrados; sem cadastro, a mensagem fala
// apenas do valor original.

import { moeda, dataBr } from '@sentinella/dados';

export interface Encargos {
  multaCentavos: number | null;
  jurosCentavos: number | null;
  totalCentavos: number;
}

// Encargos do dia, exatamente a partir do cadastro da carteira. No v3 o
// atraso conta do VENCIMENTO original (os encargos são do contrato), ainda
// que a régua ande pela entrada.
export function calcularEncargos(
  valorCentavos: number,
  diasDeAtraso: number,
  multaPct: number | null,
  jurosMesPct: number | null,
): Encargos {
  const multa =
    multaPct != null && diasDeAtraso > 0 ? Math.round((valorCentavos * multaPct) / 100) : null;
  const juros =
    jurosMesPct != null && diasDeAtraso > 0
      ? Math.round(((valorCentavos * jurosMesPct) / 100 / 30) * Math.min(diasDeAtraso, 540)) // cap 18 meses
      : null;
  return {
    multaCentavos: multa,
    jurosCentavos: juros,
    totalCentavos: valorCentavos + (multa ?? 0) + (juros ?? 0),
  };
}

export interface ContextoMensagem {
  escritorio: string; // marca ativa — em nome de quem a mensagem sai
  oab: string;
  credor: string; // credor original, sempre identificado (§6.4)
  devedorNome: string;
  tratamento: string; // primeiro nome (PF) ou razão social (PJ)
  numero: string;
  valorCentavos: number;
  vencimentoIso: string;
  diasAtrasoDoVencimento: number;
  encargos: Encargos;
  multaCadastrada: boolean;
  linkPortal: string; // espaço do devedor /d/?t=
  parcelasMax: number;
  tom: 'lembrete' | 'regularização';
}

const reais = (c: number) => moeda(c / 100);

function linhaValor(ctx: ContextoMensagem): string {
  const { encargos } = ctx;
  if (ctx.multaCadastrada && encargos.multaCentavos != null && encargos.jurosCentavos != null) {
    return (
      `valor atualizado ${reais(encargos.totalCentavos)} ` +
      `(original ${reais(ctx.valorCentavos)} + multa ${reais(encargos.multaCentavos)} ` +
      `+ juros ${reais(encargos.jurosCentavos)}, como no contrato)`
    );
  }
  return `valor ${reais(ctx.valorCentavos)}`;
}

// Uma mensagem por TIPO de passo (a etapa E+N varia com a faixa de entrada).
// WhatsApp e e-mail usam o texto completo; SMS usa a versão curta.
export function textoDaMensagem(tipo: string, canal: string, ctx: ContextoMensagem): string {
  const nome = ctx.tratamento || 'olá';
  const venc = dataBr(ctx.vencimentoIso);
  const curto = canal === 'SMS';

  switch (tipo) {
    case 'mensagem-boas-vindas': // E+0
      if (curto)
        return `${ctx.escritorio}: o debito ${ctx.numero} (${ctx.credor}) esta sob nossos cuidados. Valor e opcoes: ${ctx.linkPortal}`;
      return (
        `Olá, ${nome}. Aqui é o atendimento de ${ctx.escritorio}, responsável pelo débito ` +
        `${ctx.numero}, de ${ctx.credor} — ${linhaValor(ctx)}, vencido em ${venc}. ` +
        (ctx.tom === 'lembrete'
          ? `Deve ter passado despercebido: as opções de pagamento estão no seu espaço: ${ctx.linkPortal}. `
          : `As opções de pagamento e parcelamento estão no seu espaço: ${ctx.linkPortal}. `) +
        `Qualquer dúvida, é só responder por aqui.`
      );
    case 'proposta': // E+2 / E+3
      if (curto)
        return `${ctx.escritorio}: da para parcelar o debito ${ctx.numero}. Simule e veja o custo total antes de aceitar: ${ctx.linkPortal}`;
      return (
        `${nome}, sobre o débito ${ctx.numero}, de ${ctx.credor} (${linhaValor(ctx)}): ` +
        `dá para parcelar em até ${ctx.parcelasMax}x. Você simula no seu espaço e vê o custo total ` +
        `antes de aceitar qualquer condição: ${ctx.linkPortal}. Dentro das condições aprovadas, a confirmação é na hora.`
      );
    case 'mensagem-reforco': // E+7
      if (curto)
        return `${ctx.escritorio}: seu espaco para resolver o debito ${ctx.numero}: ${ctx.linkPortal}`;
      return (
        `${nome}, este é o seu espaço para resolver o débito ${ctx.numero} (${ctx.credor}) ` +
        `no seu tempo: 2ª via, Pix, parcelamento ou falar com uma pessoa — ${ctx.linkPortal}.`
      );
    case 'mensagem-formal': // E+10 (sem ligação na carteira)
      return (
        `Prezado(a) ${ctx.devedorNome},\n\n` +
        `${ctx.escritorio} (${ctx.oab}) registra que o débito ${ctx.numero}, de ${ctx.credor}, ` +
        `vencido em ${venc}, permanece em aberto (${linhaValor(ctx)}).\n\n` +
        `Pedimos o pagamento ou uma proposta de acordo em até 5 dias úteis: ${ctx.linkPortal}.\n\n` +
        `Se houver qualquer divergência, responda esta mensagem — a cobrança é revisada por uma pessoa.\n\n` +
        `Atenciosamente,\n${ctx.escritorio}`
      );
    case 'comunicação prévia': // E+15 — CDC, art. 43, §2º
      return (
        `COMUNICAÇÃO PRÉVIA — CDC, art. 43, §2º\n\n` +
        `Prezado(a) ${ctx.devedorNome},\n\n` +
        `${ctx.escritorio} (${ctx.oab}), responsável pela cobrança do débito ${ctx.numero}, ` +
        `de ${ctx.credor}, vencido em ${venc} (${linhaValor(ctx)}), comunica que, permanecendo o débito ` +
        `em aberto após 10 dias do recebimento desta, ele poderá ser incluído nos cadastros de ` +
        `proteção ao crédito, conforme autoriza o contrato.\n\n` +
        `Para regularizar, negociar ou contestar o débito: ${ctx.linkPortal}.\n\n` +
        `Esta comunicação é enviada com prova de envio.\n\n${ctx.escritorio}`
      );
    case 'notificação': // E+20 — assinada pelo advogado
      return (
        `NOTIFICAÇÃO EXTRAJUDICIAL\n\n` +
        `Prezado(a) ${ctx.devedorNome},\n\n` +
        `${ctx.escritorio} (${ctx.oab}), na qualidade de responsável pela cobrança do débito ` +
        `${ctx.numero}, de ${ctx.credor}, vencido em ${venc} (${linhaValor(ctx)}), NOTIFICA ` +
        `V.Sa. a regularizar o débito em até 5 dias úteis a contar do recebimento desta.\n\n` +
        `Alternativas de pagamento, parcelamento e contestação: ${ctx.linkPortal}.\n\n` +
        `Não havendo regularização, serão adotadas as medidas previstas em contrato e na lei.\n\n` +
        `[assinatura do advogado responsável]\n${ctx.escritorio}`
      );
    case 'última proposta': // E+45
      if (curto)
        return `${ctx.escritorio}: ultima rodada de condicoes facilitadas para o debito ${ctx.numero}: ${ctx.linkPortal}`;
      return (
        `${nome}, antes de o débito ${ctx.numero} (${ctx.credor}) seguir para a próxima fase do ` +
        `escritório, queremos tentar um acordo: condições facilitadas, com o custo total na sua ` +
        `frente antes de aceitar — ${ctx.linkPortal}. Se preferir falar com uma pessoa, respondemos por aqui.`
      );
    default:
      return (
        `${nome}, sobre o débito ${ctx.numero} (${ctx.credor}; ${linhaValor(ctx)}): ` +
        `seu espaço para resolver é ${ctx.linkPortal}.`
      );
  }
}

// Endereço de destino conforme o canal — SEMPRE contatos do próprio devedor
// (§3; contato de terceiro nem entra no banco). Ligação usa o telefone
// pessoal; o do trabalho só existe no cadastro se o próprio devedor indicou.
export function destinoParaCanal(
  canal: string,
  devedor: { whatsapp: string; email: string; telefone: string; telefoneTrabalho: string; nome: string },
): string {
  if (canal === 'WhatsApp') return devedor.whatsapp || '(sem WhatsApp cadastrado)';
  if (canal === 'SMS') return devedor.telefone || devedor.whatsapp || '(sem telefone cadastrado)';
  if (canal === 'e-mail' || canal === 'carta') return devedor.email || '(sem e-mail cadastrado)';
  return devedor.telefone || devedor.telefoneTrabalho || '(sem telefone cadastrado)';
}

// Tipo de passo → tipo de texto (os "mensagem" variam pela posição na régua).
export function tipoDeTexto(tipoPasso: string, etapa: string): string {
  if (tipoPasso !== 'mensagem') return tipoPasso;
  if (etapa === 'E+0') return 'mensagem-boas-vindas';
  if (etapa === 'E+7') return 'mensagem-reforco';
  return 'mensagem-formal';
}
