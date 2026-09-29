// O motor de régua real (Fase 2 — §11): um "tick" por dia processa a fila de
// ações no banco. É idempotente — rodar duas vezes no mesmo dia não duplica
// nada (chave única por título+etapa+canal+tentativa) — e cada envio passa
// antes pela conferência contra os dados importados; divergência bloqueia a
// mensagem e abre exceção para o analista (§5).

import { db, auditar } from '@sentinella/db';
import type { Cliente, Lojista, Titulo } from '@sentinella/db';
import {
  addDias, difDias, deIso, paraIso, podeLigarNoDia, proximoDiaDeLigacao, diasDeAtrasoEm,
} from './datas';
import { passosDaRegua, ESTADOS_NA_REGUA } from './passos';
import {
  calcularEncargos, textoDaMensagem, destinoParaCanal, type ContextoMensagem,
} from './mensagens';
import { conferirMensagem } from './conferencia';
import { escolherDriver } from './drivers';

const ESTADOS_TERMINAIS = [
  'pago', 'cancelado', 'contestado', 'acordo', 'fora da régua',
  'protestado', 'negativado', 'jurídico',
];

export type Renderizador = (etapa: string, canal: string, ctx: ContextoMensagem) => string;

export interface OpcoesTick {
  hoje: string;
  renderizador?: Renderizador; // injetável nos testes da conferência
  apenasClientes?: string[]; // limita o tick a alguns clientes (testes)
}

export interface ResumoTick {
  hoje: string;
  titulosVencidos: number;
  foraDaRegua: number;
  acoesAgendadas: number;
  mensagensEnviadas: number;
  mensagensBloqueadas: number;
  ligacoesNaAgenda: number;
  ligacoesAdiadas: number;
  autorizacoesCriadas: number;
  pendentesJuridico: number;
  promessasAvaliadas: number;
  acoesCanceladas: number;
  avisosCanais: string[];
}

const urlPortal = () => process.env.PORTAL_URL ?? 'http://localhost:3000';

export function montarContexto(
  cliente: Cliente,
  lojista: Lojista,
  titulo: Titulo,
  hoje: string,
): ContextoMensagem {
  const vencimentoIso = paraIso(titulo.vencimento);
  const diasAtraso = diasDeAtrasoEm(vencimentoIso, hoje);
  return {
    industria: cliente.nome.replace(' (fictícia)', ''),
    contatoNome: lojista.contatoNome || lojista.nome,
    numero: titulo.numero,
    valorCentavos: titulo.valorCentavos,
    vencimentoIso,
    diasAtraso,
    encargos: calcularEncargos(titulo.valorCentavos, diasAtraso, cliente.multaPct, cliente.jurosMesPct),
    multaCadastrada: cliente.multaPct != null,
    linkPortal: `${urlPortal()}/l/?t=${lojista.token}`,
    parcelasMax: cliente.alcadaParcelasMax,
  };
}

export async function executarTick(opcoes: OpcoesTick): Promise<ResumoTick> {
  const { hoje } = opcoes;
  const renderizar = opcoes.renderizador ?? textoDaMensagem;
  const resumo: ResumoTick = {
    hoje, titulosVencidos: 0, foraDaRegua: 0, acoesAgendadas: 0,
    mensagensEnviadas: 0, mensagensBloqueadas: 0, ligacoesNaAgenda: 0,
    ligacoesAdiadas: 0, autorizacoesCriadas: 0, pendentesJuridico: 0,
    promessasAvaliadas: 0, acoesCanceladas: 0, avisosCanais: [],
  };
  const avisos = new Set<string>();
  const escopo = opcoes.apenasClientes?.length
    ? { clienteId: { in: opcoes.apenasClientes } }
    : {};

  const clientes = await db.cliente.findMany({
    where: opcoes.apenasClientes?.length ? { id: { in: opcoes.apenasClientes } } : {},
    orderBy: { id: 'asc' },
  });

  // ---- 1) a vencer → vencido -------------------------------------------------
  for (const cliente of clientes) {
    const vencendo = await db.titulo.findMany({
      where: { clienteId: cliente.id, estado: 'a vencer', vencimento: { lt: deIso(hoje) } },
      select: { id: true },
    });
    if (vencendo.length) {
      const ids = vencendo.map((t) => t.id);
      await db.titulo.updateMany({ where: { id: { in: ids } }, data: { estado: 'vencido' } });
      await db.registroAuditoria.createMany({
        data: ids.map((id) => ({
          clienteId: cliente.id, entidade: 'titulo', entidadeId: id,
          de: 'a vencer', para: 'vencido', autor: 'sistema' as const,
        })),
      });
      resumo.titulosVencidos += ids.length;
    }

    // ---- 2) Básico: depois do D+15, o título sai da régua (§3) ---------------
    if (cliente.plano === 'Básico') {
      const fora = await db.titulo.findMany({
        where: { clienteId: cliente.id, estado: 'vencido', vencimento: { lt: deIso(addDias(hoje, -15)) } },
        select: { id: true },
      });
      if (fora.length) {
        const ids = fora.map((t) => t.id);
        await db.titulo.updateMany({ where: { id: { in: ids } }, data: { estado: 'fora da régua' } });
        await db.registroAuditoria.createMany({
          data: ids.map((id) => ({
            clienteId: cliente.id, entidade: 'titulo', entidadeId: id,
            de: 'vencido', para: 'fora da régua', autor: 'sistema' as const,
            detalhe: 'plano Básico — a régua termina no D+15',
          })),
        });
        resumo.foraDaRegua += ids.length;
      }
    }

    // ---- 3) ações agendadas de títulos que saíram da régua são canceladas ----
    const orfas = await db.acaoCobranca.findMany({
      where: {
        clienteId: cliente.id, estado: 'agendada',
        titulo: { estado: { in: ESTADOS_TERMINAIS } },
      },
      select: { id: true, titulo: { select: { estado: true } } },
    });
    if (orfas.length) {
      await db.acaoCobranca.updateMany({
        where: { id: { in: orfas.map((a) => a.id) } },
        data: { estado: 'cancelada', resultado: 'título saiu da régua' },
      });
      await db.registroAuditoria.createMany({
        data: orfas.map((a) => ({
          clienteId: cliente.id, entidade: 'acao', entidadeId: a.id,
          de: 'agendada', para: 'cancelada', autor: 'sistema' as const,
          detalhe: `título em estado "${a.titulo.estado}"`,
        })),
      });
      resumo.acoesCanceladas += orfas.length;
    }

    // ---- 4) agendamento (idempotente pela chave única) -----------------------
    const titulos = await db.titulo.findMany({
      where: {
        clienteId: cliente.id, estado: { in: [...ESTADOS_NA_REGUA] },
        lojista: { naoCobrar: false },
      },
      orderBy: { numero: 'asc' },
    });
    const existentes = await db.acaoCobranca.findMany({
      where: { clienteId: cliente.id, tituloId: { in: titulos.map((t) => t.id) } },
      select: { tituloId: true, etapa: true, canal: true, tentativa: true },
    });
    const chaves = new Set(existentes.map((a) => `${a.tituloId}|${a.etapa}|${a.canal}|${a.tentativa}`));

    const novas: {
      clienteId: string; tituloId: string; lojistaId: string; etapa: string;
      canal: string; quem: string; descricao: string; dataProgramada: Date; tentativa: number;
    }[] = [];
    for (const titulo of titulos) {
      const vencimentoIso = paraIso(titulo.vencimento);
      const passos = passosDaRegua(cliente, titulo);
      // Catch-up: título importado já em atraso entra na etapa em que deveria
      // estar (a mais recente vencida), sem disparar as anteriores.
      let atrasadaMaisRecente: (typeof passos)[number] | null = null;
      for (const passo of passos) {
        const dataPasso = addDias(vencimentoIso, passo.off);
        if (difDias(dataPasso, hoje) < 0) {
          if (passo.off >= 3 && !chaves.has(`${titulo.id}|${passo.etapa}|${passo.canal}|1`))
            atrasadaMaisRecente = passo;
          continue;
        }
        if (difDias(dataPasso, hoje) > 3) continue; // horizonte de agendamento
        const chave = `${titulo.id}|${passo.etapa}|${passo.canal}|1`;
        if (chaves.has(chave)) continue;
        chaves.add(chave);
        const data = passo.canal === 'ligação' && !podeLigarNoDia(dataPasso)
          ? proximoDiaDeLigacao(dataPasso)
          : dataPasso;
        novas.push({
          clienteId: cliente.id, tituloId: titulo.id, lojistaId: titulo.lojistaId,
          etapa: passo.etapa, canal: passo.canal, quem: passo.quem,
          descricao: passo.descricao, dataProgramada: deIso(data), tentativa: 1,
        });
      }
      if (atrasadaMaisRecente) {
        const chave = `${titulo.id}|${atrasadaMaisRecente.etapa}|${atrasadaMaisRecente.canal}|1`;
        if (!chaves.has(chave)) {
          chaves.add(chave);
          const data = atrasadaMaisRecente.canal === 'ligação' && !podeLigarNoDia(hoje)
            ? proximoDiaDeLigacao(hoje)
            : hoje;
          novas.push({
            clienteId: cliente.id, tituloId: titulo.id, lojistaId: titulo.lojistaId,
            etapa: atrasadaMaisRecente.etapa, canal: atrasadaMaisRecente.canal,
            quem: atrasadaMaisRecente.quem, descricao: atrasadaMaisRecente.descricao,
            dataProgramada: deIso(data), tentativa: 1,
          });
        }
      }
    }
    if (novas.length) {
      const criadas = await db.acaoCobranca.createMany({ data: novas, skipDuplicates: true });
      resumo.acoesAgendadas += criadas.count;
    }
  }

  // ---- 5) execução das ações do dia ------------------------------------------
  const due = await db.acaoCobranca.findMany({
    where: { ...escopo, estado: 'agendada', dataProgramada: { lte: deIso(hoje) } },
    include: { titulo: true, lojista: true, cliente: true },
    orderBy: [{ clienteId: 'asc' }, { lojistaId: 'asc' }, { id: 'asc' }],
  });

  const ligacoesDoDia = new Set<string>(); // lojistas que já têm ligação hoje
  const jaLigadas = await db.acaoCobranca.findMany({
    where: {
      ...escopo,
      canal: 'ligação',
      OR: [
        { estado: 'em andamento', dataProgramada: deIso(hoje) },
        { executadaEm: { gte: deIso(hoje), lt: deIso(addDias(hoje, 1)) } },
      ],
    },
    select: { lojistaId: true },
  });
  for (const l of jaLigadas) ligacoesDoDia.add(l.lojistaId);

  for (const acao of due) {
    const { titulo, lojista, cliente } = acao;
    // Régua pausada (negociação em curso, lista de não cobrança): a ação espera.
    if (!ESTADOS_NA_REGUA.includes(titulo.estado as never) || lojista.naoCobrar) continue;

    if (acao.canal === 'ligação') {
      // §3: dias úteis e sábados; no máximo uma ligação por dia por devedor.
      if (!podeLigarNoDia(hoje) || ligacoesDoDia.has(acao.lojistaId)) {
        await db.acaoCobranca.update({
          where: { id: acao.id },
          data: { dataProgramada: deIso(proximoDiaDeLigacao(hoje)) },
        });
        resumo.ligacoesAdiadas++;
        continue;
      }
      ligacoesDoDia.add(acao.lojistaId);
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: { estado: 'em andamento' },
      });
      await auditar(cliente.id, 'acao', acao.id, 'agendada', 'em andamento', 'sistema',
        'na agenda de ligações do analista');
      resumo.ligacoesNaAgenda++;
      continue;
    }

    if (acao.etapa === 'D+45' || acao.etapa === 'bloqueio') {
      const tipo = acao.etapa === 'D+45' ? 'protesto' : 'bloqueio de pedidos';
      const jaExiste = await db.autorizacao.findFirst({
        where: { tituloId: titulo.id, tipo },
      });
      if (!jaExiste) {
        const aut = await db.autorizacao.create({
          data: {
            clienteId: cliente.id, lojistaId: lojista.id, tituloId: titulo.id,
            tipo, valorCentavos: titulo.valorCentavos,
            pedidoEm: new Date(`${hoje}T09:00:00Z`),
          },
        });
        await auditar(cliente.id, 'autorizacao', aut.id, null, 'pendente', 'sistema',
          `${tipo} preparado — aguarda autorização do cliente`);
        resumo.autorizacoesCriadas++;
      }
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: {
          estado: 'pendente',
          resultado: acao.etapa === 'D+45'
            ? 'aguarda autorização do cliente'
            : 'aguarda aprovação do cliente — execução no ERP entra na Fase 3',
          executadaEm: new Date(),
        },
      });
      continue;
    }

    if (acao.etapa === 'jurídico') {
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: {
          estado: 'pendente',
          resultado: 'aguarda encaminhamento — contrato direto entre cliente e escritório parceiro (em definição)',
          executadaEm: new Date(),
        },
      });
      resumo.pendentesJuridico++;
      continue;
    }

    // Mensagem (IA ou sistema) por WhatsApp, SMS, e-mail ou carta.
    const contexto = montarContexto(cliente, lojista, titulo, hoje);
    const texto = renderizar(acao.etapa, acao.canal, contexto);
    const esperado = {
      valoresCentavos: [
        contexto.valorCentavos,
        contexto.encargos.totalCentavos,
        ...(contexto.encargos.multaCentavos != null ? [contexto.encargos.multaCentavos] : []),
        ...(contexto.encargos.jurosCentavos != null ? [contexto.encargos.jurosCentavos] : []),
      ],
      datasIso: [contexto.vencimentoIso, hoje],
      multaCadastrada: contexto.multaCadastrada,
      parcelasMax: contexto.parcelasMax,
    };
    const conferencia = conferirMensagem(texto, esperado);

    if (!conferencia.aprovada) {
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: { estado: 'bloqueada', motivoBloqueio: conferencia.motivo, executadaEm: new Date() },
      });
      const excecao = await db.excecao.create({
        data: {
          clienteId: cliente.id, lojistaId: lojista.id, tituloId: titulo.id,
          motivo: `Mensagem bloqueada — ${conferencia.motivo}`,
          slaMin: cliente.plano === 'Max' ? 5 : 15,
          valorEnvolvidoCentavos: titulo.valorCentavos,
        },
      });
      await auditar(cliente.id, 'acao', acao.id, 'agendada', 'bloqueada', 'sistema', conferencia.motivo);
      await auditar(cliente.id, 'excecao', excecao.id, null, 'aberta', 'sistema', 'conferência barrou o envio');
      resumo.mensagensBloqueadas++;
      continue;
    }

    const { driver, aviso } = escolherDriver(acao.canal);
    if (aviso) avisos.add(aviso);
    const envio = await driver.enviar({
      canal: acao.canal,
      para: destinoParaCanal(acao.canal, lojista),
      texto,
    });
    await db.mensagem.create({
      data: {
        clienteId: cliente.id, lojistaId: lojista.id, tituloId: titulo.id,
        acaoId: acao.id, canal: acao.canal, de: 'IA', texto, entrega: envio.entrega,
        em: new Date(`${hoje}T12:00:00Z`),
      },
    });
    await db.acaoCobranca.update({
      where: { id: acao.id },
      data: {
        estado: 'finalizada',
        resultado: envio.entrega === 'simulada' ? 'entregue (simulada)' : 'entregue',
        mensagemRenderizada: texto,
        executadaEm: new Date(`${hoje}T12:00:00Z`),
      },
    });
    await auditar(cliente.id, 'acao', acao.id, 'agendada', 'finalizada', 'IA', `${acao.etapa} por ${acao.canal}`);
    resumo.mensagensEnviadas++;
  }

  // ---- 6) promessas vencidas sem pagamento -----------------------------------
  const promessasVencidas = await db.promessa.findMany({
    where: { ...escopo, cumprida: null, para: { lt: deIso(hoje) } },
    include: { titulo: { select: { pagoEm: true } } },
  });
  for (const promessa of promessasVencidas) {
    const cumprida =
      promessa.titulo.pagoEm != null &&
      difDias(paraIso(promessa.para), paraIso(promessa.titulo.pagoEm)) >= -1;
    await db.promessa.update({ where: { id: promessa.id }, data: { cumprida } });
    resumo.promessasAvaliadas++;
  }

  resumo.avisosCanais = [...avisos];
  return resumo;
}

export function formatarResumoTick(r: ResumoTick): string {
  const partes = [
    `${r.titulosVencidos} título(s) vencido(s)`,
    `${r.foraDaRegua} fora da régua`,
    `${r.acoesAgendadas} ação(ões) agendada(s)`,
    `${r.mensagensEnviadas} mensagem(ns) enviada(s)`,
    `${r.mensagensBloqueadas} bloqueada(s) na conferência`,
    `${r.ligacoesNaAgenda} ligação(ões) na agenda`,
    `${r.ligacoesAdiadas} adiada(s)`,
    `${r.autorizacoesCriadas} autorização(ões) preparada(s)`,
    `${r.promessasAvaliadas} promessa(s) avaliada(s)`,
  ];
  const texto = `tick de ${r.hoje}: ${partes.join(' · ')}`;
  return r.avisosCanais.length ? `${texto}\n  avisos: ${r.avisosCanais.join(' | ')}` : texto;
}
