// Textos das mensagens da régua (Fase 2) — sempre em pt-BR, tom firme e
// respeitoso (§3: sem ameaça, sem constrangimento). Multa e juros só entram
// quando o cliente tem os percentuais cadastrados (§12); sem cadastro, a
// mensagem fala apenas do valor original.

import { moeda, dataBr } from '@sentinella/dados';

export interface Encargos {
  multaCentavos: number | null;
  jurosCentavos: number | null;
  totalCentavos: number;
}

// Encargos do dia, exatamente a partir do cadastro do cliente.
export function calcularEncargos(
  valorCentavos: number,
  diasAtraso: number,
  multaPct: number | null,
  jurosMesPct: number | null,
): Encargos {
  const multa =
    multaPct != null && diasAtraso > 0 ? Math.round((valorCentavos * multaPct) / 100) : null;
  const juros =
    jurosMesPct != null && diasAtraso > 0
      ? Math.round(((valorCentavos * jurosMesPct) / 100 / 30) * diasAtraso)
      : null;
  return {
    multaCentavos: multa,
    jurosCentavos: juros,
    totalCentavos: valorCentavos + (multa ?? 0) + (juros ?? 0),
  };
}

export interface ContextoMensagem {
  industria: string;
  contatoNome: string; // responsável financeiro do lojista
  numero: string;
  valorCentavos: number;
  vencimentoIso: string;
  diasAtraso: number;
  encargos: Encargos;
  multaCadastrada: boolean;
  linkPortal: string;
  parcelasMax: number;
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

// Uma mensagem por etapa. WhatsApp e e-mail usam o texto completo; SMS usa a
// versão curta. A etapa "D+30" é a notificação formal (e-mail com confirmação
// de leitura na Fase 2; carta com AR entra na Fase 3).
export function textoDaMensagem(
  etapa: string,
  canal: string,
  ctx: ContextoMensagem,
): string {
  const primeiroNome = ctx.contatoNome.split(' ')[0] || 'olá';
  const venc = dataBr(ctx.vencimentoIso);
  const curto = canal === 'SMS';

  switch (etapa) {
    case 'D−3':
      if (curto)
        return `${ctx.industria}: o titulo ${ctx.numero} de ${reais(ctx.valorCentavos)} vence em ${venc}. 2a via e Pix: ${ctx.linkPortal}`;
      return (
        `Olá, ${primeiroNome}! Aqui é a assistente da ${ctx.industria}. ` +
        `O título ${ctx.numero}, de ${reais(ctx.valorCentavos)}, vence em ${venc}. ` +
        `Boleto e Pix estão no seu espaço: ${ctx.linkPortal} — qualquer dúvida, é só responder por aqui.`
      );
    case 'D0':
      if (curto)
        return `${ctx.industria}: o titulo ${ctx.numero} de ${reais(ctx.valorCentavos)} vence hoje (${venc}). Pagamento: ${ctx.linkPortal}`;
      return (
        `${primeiroNome}, o título ${ctx.numero}, de ${reais(ctx.valorCentavos)}, vence hoje (${venc}). ` +
        `O link de pagamento com boleto e Pix é este: ${ctx.linkPortal}. ` +
        `Se o pagamento já foi feito, me avise por aqui que registro na hora.`
      );
    case 'D+3':
      if (curto)
        return `${ctx.industria}: o titulo ${ctx.numero} venceu em ${venc}. 2a via atualizada: ${ctx.linkPortal}`;
      return (
        `${primeiroNome}, o título ${ctx.numero} venceu em ${venc} e segue em aberto — ` +
        `${linhaValor(ctx)}. A 2ª via atualizada está aqui: ${ctx.linkPortal}. ` +
        `Se houver qualquer divergência, responda esta mensagem e uma pessoa da nossa central resolve com você.`
      );
    case 'D+7':
      if (curto)
        return `${ctx.industria}: podemos parcelar o titulo ${ctx.numero}. Proposta em ${ctx.linkPortal}`;
      return (
        `${primeiroNome}, sobre o título ${ctx.numero} (venceu em ${venc}; ${linhaValor(ctx)}): ` +
        `a ${ctx.industria} autorizou condições facilitadas — dá para parcelar em até ${ctx.parcelasMax}x. ` +
        `Você monta a proposta direto aqui: ${ctx.linkPortal}. Dentro das condições combinadas, a aprovação é na hora.`
      );
    case 'D+10':
      if (curto)
        return `${ctx.industria}: titulo ${ctx.numero} em aberto ha ${ctx.diasAtraso} dias. Fale conosco: ${ctx.linkPortal}`;
      return (
        `${primeiroNome}, o título ${ctx.numero} está em aberto há ${ctx.diasAtraso} dias ` +
        `(${linhaValor(ctx)}). Queremos resolver com você ainda esta semana — pagamento, acordo ou conversa ` +
        `com uma pessoa da central: ${ctx.linkPortal}.`
      );
    case 'D+15':
      return (
        `Prezado(a) ${ctx.contatoNome},\n\n` +
        `Registramos formalmente que o título ${ctx.numero}, emitido por ${ctx.industria}, ` +
        `venceu em ${venc} e permanece em aberto (${linhaValor(ctx)}).\n\n` +
        `Pedimos o pagamento ou uma proposta de acordo em até 5 dias úteis: ${ctx.linkPortal}.\n\n` +
        `Permanecendo em aberto, o débito segue as etapas previstas em contrato.\n\n` +
        `Atenciosamente,\nCentral Sentinella, em nome de ${ctx.industria}`
      );
    case 'D+30':
      return (
        `NOTIFICAÇÃO DE DÉBITO EM ABERTO\n\n` +
        `Prezado(a) ${ctx.contatoNome},\n\n` +
        `${ctx.industria} notifica que o título ${ctx.numero}, vencido em ${venc}, ` +
        `permanece em aberto há ${ctx.diasAtraso} dias (${linhaValor(ctx)}).\n\n` +
        `Solicitamos a regularização em até 5 dias úteis a contar do recebimento desta: ${ctx.linkPortal}.\n\n` +
        `Não havendo regularização ou acordo, o título poderá ser levado a protesto e o débito ` +
        `incluído nos cadastros de proteção ao crédito, conforme previsto em contrato — medidas que a ` +
        `credora está apta a adotar.\n\n` +
        `Esta notificação é enviada com confirmação de leitura.\n\n` +
        `${ctx.industria} — por Central Sentinella`
      );
    default:
      return (
        `${primeiroNome}, sobre o título ${ctx.numero} (${linhaValor(ctx)}): ` +
        `fale com a gente em ${ctx.linkPortal}.`
      );
  }
}

// Endereço de destino conforme o canal (contatos da empresa devedora — §3).
export function destinoParaCanal(
  canal: string,
  lojista: { whatsapp: string; email: string; telefone: string; nome: string },
): string {
  if (canal === 'WhatsApp') return lojista.whatsapp || '(sem WhatsApp cadastrado)';
  if (canal === 'SMS') return lojista.telefone || lojista.whatsapp || '(sem telefone cadastrado)';
  if (canal === 'e-mail' || canal === 'carta') return lojista.email || '(sem e-mail cadastrado)';
  return lojista.telefone || '(sem telefone cadastrado)';
}
