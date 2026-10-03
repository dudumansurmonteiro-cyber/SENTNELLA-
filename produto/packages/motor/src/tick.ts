// O motor de régua v3: um "tick" por dia processa a fila sobre a régua
// ANCORADA NA ENTRADA (§4), com as travas da seção 3 aplicadas de verdade:
// contato só com o próprio devedor, canal bloqueado a pedido vira exceção,
// contestação pausa, negativação só com comunicação prévia registrada e
// prazo cumprido, notificação só sai assinada pelo advogado, ligação só na
// janela permitida. Idempotente (chave única título+etapa+canal+tentativa);
// toda mensagem passa pela conferência antes de sair e registra a MARCA
// ATIVA (em nome de qual escritório saiu).

import { db, auditar } from '@sentinella/db';
import type { Carteira, Credor, Devedor, Escritorio, Titulo } from '@sentinella/db';
import { PRAZO_COMUNICACAO_PREVIA_DIAS, BLOQUEIOS, faixaDoAtraso } from '@sentinella/dados';
import {
  addDias, difDias, deIso, paraIso, podeLigarNoDia, proximoDiaDeLigacao, diasDeAtrasoEm,
} from './datas';
import { passosDaRegua, ESTADOS_NA_REGUA, ESTADOS_TERMINAIS } from './passos';
import {
  calcularEncargos, textoDaMensagem, destinoParaCanal, tipoDeTexto, type ContextoMensagem,
} from './mensagens';
import { conferirMensagem } from './conferencia';
import { escolherDriver } from './drivers';

export type Renderizador = (tipo: string, canal: string, ctx: ContextoMensagem) => string;

export interface OpcoesTick {
  hoje: string;
  renderizador?: Renderizador; // injetável nos testes da conferência
  apenasEscritorios?: string[]; // limita o tick (testes; isolamento de tenant)
}

export interface ResumoTick {
  hoje: string;
  acoesAgendadas: number;
  mensagensEnviadas: number;
  mensagensBloqueadas: number;
  bloqueiosConformidade: number; // travas da seção 3 que agiram
  ligacoesNaAgenda: number;
  ligacoesAdiadas: number;
  previasEnviadas: number;
  notificacoesParaAssinar: number;
  medidasAguardandoAutorizacao: number;
  dossiesGerados: number;
  promessasAvaliadas: number;
  acoesCanceladas: number;
  avisosCanais: string[];
}

const urlPortal = () => process.env.PORTAL_URL ?? 'http://localhost:3000';

export function montarContexto(
  escritorio: Escritorio,
  credor: Credor,
  carteira: Carteira,
  devedor: Devedor,
  titulo: Titulo,
  hoje: string,
): ContextoMensagem {
  const vencimentoIso = paraIso(titulo.vencimento);
  const diasAtraso = diasDeAtrasoEm(vencimentoIso, hoje);
  return {
    escritorio: escritorio.marcaNome,
    oab: escritorio.oab,
    credor: credor.nome,
    devedorNome: devedor.nome,
    tratamento: devedor.tipo === 'PF' ? devedor.nome.split(' ')[0] : devedor.nome,
    numero: titulo.numero,
    valorCentavos: titulo.valorCentavos,
    vencimentoIso,
    diasAtrasoDoVencimento: diasAtraso,
    encargos: calcularEncargos(titulo.valorCentavos, diasAtraso, carteira.multaPct, carteira.jurosMesPct),
    multaCadastrada: carteira.multaPct != null,
    linkPortal: `${urlPortal()}/d/?t=${devedor.token}`,
    parcelasMax: carteira.parcelasMax,
    tom: faixaDoAtraso(titulo.atrasoOriginal) === 'até 30' ? 'lembrete' : 'regularização',
  };
}

async function abrirExcecao(
  escritorio: Escritorio,
  devedor: Devedor,
  tituloId: string | null,
  motivo: string,
  valorCentavos: number,
) {
  const excecao = await db.excecao.create({
    data: {
      escritorioId: escritorio.id, devedorId: devedor.id, tituloId,
      motivo, slaMin: escritorio.slaMin, valorEnvolvidoCentavos: valorCentavos,
    },
  });
  await auditar(escritorio.id, 'excecao', excecao.id, null, 'aberta', 'sistema', motivo);
  return excecao;
}

export async function executarTick(opcoes: OpcoesTick): Promise<ResumoTick> {
  const { hoje } = opcoes;
  const renderizar = opcoes.renderizador ?? textoDaMensagem;
  const resumo: ResumoTick = {
    hoje, acoesAgendadas: 0, mensagensEnviadas: 0, mensagensBloqueadas: 0,
    bloqueiosConformidade: 0, ligacoesNaAgenda: 0, ligacoesAdiadas: 0,
    previasEnviadas: 0, notificacoesParaAssinar: 0, medidasAguardandoAutorizacao: 0,
    dossiesGerados: 0, promessasAvaliadas: 0, acoesCanceladas: 0, avisosCanais: [],
  };
  const avisos = new Set<string>();
  const escopo = opcoes.apenasEscritorios?.length
    ? { escritorioId: { in: opcoes.apenasEscritorios } }
    : {};

  const escritorios = await db.escritorio.findMany({
    where: opcoes.apenasEscritorios?.length ? { id: { in: opcoes.apenasEscritorios } } : {},
    orderBy: { id: 'asc' },
  });

  for (const escritorio of escritorios) {
    // ---- 1) ações agendadas de títulos que saíram da régua são canceladas ----
    const orfas = await db.acaoCobranca.findMany({
      where: {
        escritorioId: escritorio.id, estado: 'agendada',
        titulo: { estado: { in: [...ESTADOS_TERMINAIS] } },
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
          escritorioId: escritorio.id, entidade: 'acao', entidadeId: a.id,
          de: 'agendada', para: 'cancelada', autor: 'sistema' as const,
          detalhe: `título em estado "${a.titulo.estado}"`,
        })),
      });
      resumo.acoesCanceladas += orfas.length;
    }

    // ---- 2) agendamento pela régua da ENTRADA (idempotente) -------------------
    const carteiras = await db.carteira.findMany({ where: { escritorioId: escritorio.id } });
    for (const carteira of carteiras) {
      const titulos = await db.titulo.findMany({
        where: {
          carteiraId: carteira.id, estado: { in: [...ESTADOS_NA_REGUA] },
          devedor: { naoCobrar: false, naoContatar: false },
        },
        orderBy: { numero: 'asc' },
      });
      if (!titulos.length) continue;
      const existentes = await db.acaoCobranca.findMany({
        where: { carteiraId: carteira.id, tituloId: { in: titulos.map((t) => t.id) } },
        select: { tituloId: true, etapa: true, canal: true, tentativa: true },
      });
      const chaves = new Set(existentes.map((a) => `${a.tituloId}|${a.etapa}|${a.canal}|${a.tentativa}`));

      const novas: {
        escritorioId: string; carteiraId: string; tituloId: string; devedorId: string;
        etapa: string; canal: string; quem: string; tipo: string; descricao: string;
        dataProgramada: Date; tentativa: number; marcaAtiva: string;
      }[] = [];
      for (const titulo of titulos) {
        const entradaIso = paraIso(titulo.entradaCarteira);
        const passos = passosDaRegua(carteira, titulo);
        // Catch-up: título que entra com parte da régua já "vencida" (entrada
        // retroativa) assume a etapa mais recente, sem disparar as anteriores.
        let atrasadaMaisRecente: (typeof passos)[number] | null = null;
        for (const passo of passos) {
          const dataPasso = addDias(entradaIso, passo.off);
          const chave = `${titulo.id}|${passo.etapa}|${passo.canal}|1`;
          if (difDias(dataPasso, hoje) < 0) {
            if (!chaves.has(chave)) atrasadaMaisRecente = passo;
            continue;
          }
          if (difDias(dataPasso, hoje) > 3) continue; // horizonte de agendamento
          if (chaves.has(chave)) continue;
          chaves.add(chave);
          const data = passo.canal === 'ligação' && !podeLigarNoDia(dataPasso)
            ? proximoDiaDeLigacao(dataPasso)
            : dataPasso;
          novas.push({
            escritorioId: escritorio.id, carteiraId: carteira.id,
            tituloId: titulo.id, devedorId: titulo.devedorId,
            etapa: passo.etapa, canal: passo.canal, quem: passo.quem, tipo: passo.tipo,
            descricao: passo.descricao, dataProgramada: deIso(data), tentativa: 1,
            marcaAtiva: escritorio.marcaNome,
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
              escritorioId: escritorio.id, carteiraId: carteira.id,
              tituloId: titulo.id, devedorId: titulo.devedorId,
              etapa: atrasadaMaisRecente.etapa, canal: atrasadaMaisRecente.canal,
              quem: atrasadaMaisRecente.quem, tipo: atrasadaMaisRecente.tipo,
              descricao: atrasadaMaisRecente.descricao,
              dataProgramada: deIso(data), tentativa: 1,
              marcaAtiva: escritorio.marcaNome,
            });
          }
        }
      }
      if (novas.length) {
        const criadas = await db.acaoCobranca.createMany({ data: novas, skipDuplicates: true });
        resumo.acoesAgendadas += criadas.count;
      }
    }
  }

  // ---- 3) execução das ações do dia ------------------------------------------
  const due = await db.acaoCobranca.findMany({
    where: { ...escopo, estado: 'agendada', dataProgramada: { lte: deIso(hoje) } },
    include: {
      titulo: true, devedor: true, carteira: { include: { credor: true } }, escritorio: true,
    },
    orderBy: [{ escritorioId: 'asc' }, { devedorId: 'asc' }, { id: 'asc' }],
  });

  const ligacoesDoDia = new Set<string>(); // devedores que já têm ligação hoje
  const jaLigadas = await db.acaoCobranca.findMany({
    where: {
      ...escopo,
      canal: 'ligação',
      OR: [
        { estado: 'em andamento', dataProgramada: deIso(hoje) },
        { executadaEm: { gte: deIso(hoje), lt: deIso(addDias(hoje, 1)) } },
      ],
    },
    select: { devedorId: true },
  });
  for (const l of jaLigadas) ligacoesDoDia.add(l.devedorId);

  for (const acao of due) {
    const { titulo, devedor, carteira, escritorio } = acao;
    const credor = carteira.credor;
    if (!ESTADOS_NA_REGUA.includes(titulo.estado as never) || devedor.naoCobrar) continue;

    // §3: título contestado → cobrança pausada até o escritório responder.
    if (titulo.contestadoEm != null) continue;

    // §3: pedido de não contato (total) → nada sai; o caso é do analista.
    if (devedor.naoContatar) continue;

    // §3: canal bloqueado a pedido do devedor → a ação não sai por ali;
    // vira exceção para o analista decidir o próximo passo.
    if ((devedor.canaisBloqueados as string[]).includes(acao.canal)) {
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: { estado: 'bloqueada', motivoBloqueio: BLOQUEIOS.canal, executadaEm: new Date() },
      });
      await abrirExcecao(escritorio, devedor, titulo.id, BLOQUEIOS.canal, titulo.valorCentavos);
      await auditar(escritorio.id, 'acao', acao.id, 'agendada', 'bloqueada', 'sistema', BLOQUEIOS.canal);
      resumo.bloqueiosConformidade++;
      continue;
    }

    // Ligações: janela permitida e no máximo uma por dia por devedor (§3).
    if (acao.canal === 'ligação') {
      if (!podeLigarNoDia(hoje) || ligacoesDoDia.has(acao.devedorId)) {
        await db.acaoCobranca.update({
          where: { id: acao.id },
          data: {
            dataProgramada: deIso(proximoDiaDeLigacao(hoje)),
            motivoBloqueio: podeLigarNoDia(hoje) ? null : BLOQUEIOS.horario,
          },
        });
        resumo.ligacoesAdiadas++;
        continue;
      }
      ligacoesDoDia.add(acao.devedorId);
      await db.acaoCobranca.update({ where: { id: acao.id }, data: { estado: 'em andamento' } });
      await auditar(escritorio.id, 'acao', acao.id, 'agendada', 'em andamento', 'sistema',
        'na agenda de ligações (gravada, com aviso no início)');
      resumo.ligacoesNaAgenda++;
      continue;
    }

    // Comunicação prévia de negativação (CDC, art. 43, §2º): sai com prova e
    // fica registrada no título — é ela que destrava a negativação depois.
    if (acao.tipo === 'comunicação prévia') {
      const contexto = montarContexto(escritorio, credor, carteira, devedor, titulo, hoje);
      const texto = renderizar('comunicação prévia', acao.canal, contexto);
      const { driver, aviso } = escolherDriver(acao.canal);
      if (aviso) avisos.add(aviso);
      const envio = await driver.enviar({ canal: acao.canal, para: destinoParaCanal(acao.canal, devedor), texto });
      const prova = `envio por ${acao.canal} em ${hoje} (${envio.entrega})`;
      await db.titulo.update({
        where: { id: titulo.id },
        data: { comunicacaoPreviaEnviadaEm: deIso(hoje), comunicacaoPreviaProva: prova },
      });
      const doc = await db.documentoJuridico.create({
        data: {
          escritorioId: escritorio.id, devedorId: devedor.id,
          tipo: 'comunicação prévia', status: 'enviado com prova',
          valorCentavos: titulo.valorCentavos, provaEnvio: prova,
          marcaAtiva: escritorio.marcaNome,
          titulos: { create: [{ tituloId: titulo.id }] },
        },
      });
      await db.mensagem.create({
        data: {
          escritorioId: escritorio.id, devedorId: devedor.id, tituloId: titulo.id,
          acaoId: acao.id, canal: acao.canal, de: 'sistema', texto,
          entrega: envio.entrega, marcaAtiva: escritorio.marcaNome,
          em: new Date(`${hoje}T12:00:00Z`),
        },
      });
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: {
          estado: 'finalizada', resultado: `comunicação prévia enviada com prova (${envio.entrega})`,
          mensagemRenderizada: texto, executadaEm: new Date(`${hoje}T12:00:00Z`),
        },
      });
      await auditar(escritorio.id, 'documento', doc.id, null, 'enviado com prova', 'sistema', prova);
      resumo.previasEnviadas++;
      continue;
    }

    // Notificação extrajudicial: ato do advogado — o motor PREPARA e espera a
    // assinatura (assinarNotificacoes); nada é enviado sem ela.
    if (acao.tipo === 'notificação') {
      const contexto = montarContexto(escritorio, credor, carteira, devedor, titulo, hoje);
      const texto = renderizar('notificação', acao.canal, contexto);
      const doc = await db.documentoJuridico.create({
        data: {
          escritorioId: escritorio.id, devedorId: devedor.id,
          tipo: 'notificação extrajudicial', status: 'a assinar',
          valorCentavos: titulo.valorCentavos, modelo: 'modelo-padrão do escritório',
          conteudo: { texto, canal: acao.canal, acaoId: acao.id },
          marcaAtiva: escritorio.marcaNome,
          titulos: { create: [{ tituloId: titulo.id }] },
        },
      });
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: { estado: 'pendente', resultado: 'aguarda assinatura do advogado', executadaEm: new Date() },
      });
      await auditar(escritorio.id, 'documento', doc.id, null, 'a assinar', 'sistema',
        'notificação preparada — ato privativo do advogado');
      resumo.notificacoesParaAssinar++;
      continue;
    }

    // Negativação/protesto: o gate do art. 43, §2º — sem comunicação prévia
    // registrada E prazo cumprido, a medida é BARRADA (visível no painel).
    if (acao.tipo === 'negativação') {
      if (titulo.contestadoEm != null) {
        await db.acaoCobranca.update({
          where: { id: acao.id },
          data: { estado: 'bloqueada', motivoBloqueio: BLOQUEIOS.contestado, executadaEm: new Date() },
        });
        await auditar(escritorio.id, 'acao', acao.id, 'agendada', 'bloqueada', 'sistema', BLOQUEIOS.contestado);
        resumo.bloqueiosConformidade++;
        continue;
      }
      const previaEm = titulo.comunicacaoPreviaEnviadaEm
        ? paraIso(titulo.comunicacaoPreviaEnviadaEm)
        : null;
      const prazoOk = previaEm != null && difDias(hoje, previaEm) >= PRAZO_COMUNICACAO_PREVIA_DIAS;
      if (!prazoOk) {
        await db.acaoCobranca.update({
          where: { id: acao.id },
          data: {
            estado: 'bloqueada', motivoBloqueio: BLOQUEIOS.previa,
            // reprograma para depois do prazo, se a prévia existe
            executadaEm: new Date(),
          },
        });
        await abrirExcecao(escritorio, devedor, titulo.id, BLOQUEIOS.previa, titulo.valorCentavos);
        await auditar(escritorio.id, 'acao', acao.id, 'agendada', 'bloqueada', 'sistema', BLOQUEIOS.previa);
        resumo.bloqueiosConformidade++;
        continue;
      }
      const subtipo = devedor.tipo === 'PJ' ? 'protesto' : 'negativação';
      const doc = await db.documentoJuridico.create({
        data: {
          escritorioId: escritorio.id, devedorId: devedor.id,
          tipo: 'autorização', subtipo, status: 'aguarda autorização',
          valorCentavos: titulo.valorCentavos, marcaAtiva: escritorio.marcaNome,
          titulos: { create: [{ tituloId: titulo.id }] },
        },
      });
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: {
          estado: 'pendente',
          resultado: `${subtipo} preparado — aguarda autorização do escritório, título a título`,
          executadaEm: new Date(),
        },
      });
      await auditar(escritorio.id, 'documento', doc.id, null, 'aguarda autorização', 'sistema',
        `${subtipo} com comunicação prévia de ${previaEm} (prazo cumprido)`);
      resumo.medidasAguardandoAutorizacao++;
      continue;
    }

    // E+60: dossiê completo e encaminhamento ao fluxo judicial do escritório.
    if (acao.tipo === 'judicial') {
      const [acoesDoTitulo, mensagensDoTitulo, promessas, previas] = await Promise.all([
        db.acaoCobranca.findMany({
          where: { tituloId: titulo.id, estado: { in: ['finalizada', 'bloqueada', 'pendente'] } },
          orderBy: { dataProgramada: 'asc' },
          select: { etapa: true, canal: true, estado: true, resultado: true, dataProgramada: true, motivoBloqueio: true },
        }),
        db.mensagem.findMany({ where: { tituloId: titulo.id }, select: { canal: true, de: true, em: true } }),
        db.promessa.findMany({ where: { tituloId: titulo.id } }),
        db.documentoJuridico.findMany({
          where: { titulos: { some: { tituloId: titulo.id } }, tipo: { in: ['comunicação prévia', 'notificação extrajudicial'] } },
          select: { tipo: true, status: true, provaEnvio: true, assinadoPor: true, geradoEm: true },
        }),
      ]);
      const contexto = montarContexto(escritorio, credor, carteira, devedor, titulo, hoje);
      const dossie = {
        titulo: {
          numero: titulo.numero, valorCentavos: titulo.valorCentavos,
          vencimento: paraIso(titulo.vencimento), entradaCarteira: paraIso(titulo.entradaCarteira),
          atrasoOriginal: titulo.atrasoOriginal,
        },
        credor: credor.nome, carteira: carteira.nome,
        devedor: { nome: devedor.nome, tipo: devedor.tipo, documento: devedor.documento },
        calculoAtualizado: contexto.encargos,
        contatos: acoesDoTitulo, mensagens: mensagensDoTitulo.length,
        promessas: promessas.map((p) => ({ para: paraIso(p.para), cumprida: p.cumprida })),
        comunicacoes: previas,
        geradoEm: hoje,
      };
      const doc = await db.documentoJuridico.create({
        data: {
          escritorioId: escritorio.id, devedorId: devedor.id,
          tipo: 'dossiê judicial', status: 'pronto',
          valorCentavos: titulo.valorCentavos, conteudo: JSON.parse(JSON.stringify(dossie)),
          marcaAtiva: escritorio.marcaNome,
          titulos: { create: [{ tituloId: titulo.id }] },
        },
      });
      await db.titulo.update({ where: { id: titulo.id }, data: { estado: 'judicial' } });
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: {
          estado: 'finalizada',
          resultado: 'dossiê gerado — título no fluxo judicial do escritório',
          executadaEm: new Date(`${hoje}T12:00:00Z`),
        },
      });
      await auditar(escritorio.id, 'titulo', titulo.id, 'em cobrança', 'judicial', 'sistema',
        `dossiê ${doc.id} com histórico completo`);
      resumo.dossiesGerados++;
      continue;
    }

    // Mensagem comum (boas-vindas, proposta, reforço, formal, última proposta).
    const contexto = montarContexto(escritorio, credor, carteira, devedor, titulo, hoje);
    const texto = renderizar(tipoDeTexto(acao.tipo, acao.etapa), acao.canal, contexto);
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
      etapaFormal: false,
    };
    const conferencia = conferirMensagem(texto, esperado);

    if (!conferencia.aprovada) {
      await db.acaoCobranca.update({
        where: { id: acao.id },
        data: { estado: 'bloqueada', motivoBloqueio: conferencia.motivo, executadaEm: new Date() },
      });
      await abrirExcecao(escritorio, devedor, titulo.id,
        `Mensagem bloqueada — ${conferencia.motivo}`, titulo.valorCentavos);
      await auditar(escritorio.id, 'acao', acao.id, 'agendada', 'bloqueada', 'sistema', conferencia.motivo);
      resumo.mensagensBloqueadas++;
      continue;
    }

    const { driver, aviso } = escolherDriver(acao.canal);
    if (aviso) avisos.add(aviso);
    const envio = await driver.enviar({ canal: acao.canal, para: destinoParaCanal(acao.canal, devedor), texto });
    await db.mensagem.create({
      data: {
        escritorioId: escritorio.id, devedorId: devedor.id, tituloId: titulo.id,
        acaoId: acao.id, canal: acao.canal, de: 'IA', texto, entrega: envio.entrega,
        marcaAtiva: escritorio.marcaNome, em: new Date(`${hoje}T12:00:00Z`),
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
    await auditar(escritorio.id, 'acao', acao.id, 'agendada', 'finalizada', 'IA',
      `${acao.etapa} por ${acao.canal}, em nome de ${escritorio.marcaNome}`);
    resumo.mensagensEnviadas++;
  }

  // ---- 4) promessas vencidas sem pagamento -----------------------------------
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

// Assinatura das notificações preparadas: ato do advogado (papel "advogado").
// Assina, envia pelo canal previsto e registra a prova.
export async function assinarNotificacoes(
  escritorioId: string,
  hoje: string,
  assinante: string, // "Nome — OAB ..."
  limite?: number,
): Promise<number> {
  const docs = await db.documentoJuridico.findMany({
    where: { escritorioId, tipo: 'notificação extrajudicial', status: 'a assinar' },
    include: { titulos: true, devedor: true },
    orderBy: { geradoEm: 'asc' },
    ...(limite ? { take: limite } : {}),
  });
  let assinadas = 0;
  for (const doc of docs) {
    const conteudo = (doc.conteudo ?? {}) as { texto?: string; canal?: string; acaoId?: string };
    const canal = conteudo.canal ?? 'e-mail';
    const texto = (conteudo.texto ?? '').replace('[assinatura do advogado responsável]', assinante);
    const { driver } = escolherDriver(canal);
    const envio = await driver.enviar({
      canal, para: destinoParaCanal(canal, doc.devedor), texto,
    });
    const prova = `envio por ${canal} em ${hoje} (${envio.entrega})`;
    await db.documentoJuridico.update({
      where: { id: doc.id },
      data: {
        status: 'enviado com prova', assinadoPor: assinante,
        assinadoEm: new Date(`${hoje}T10:00:00Z`), provaEnvio: prova,
      },
    });
    await db.mensagem.create({
      data: {
        escritorioId, devedorId: doc.devedorId, tituloId: doc.titulos[0]?.tituloId,
        canal, de: 'analista', texto, entrega: envio.entrega,
        marcaAtiva: doc.marcaAtiva, em: new Date(`${hoje}T10:00:00Z`),
      },
    });
    if (conteudo.acaoId) {
      await db.acaoCobranca.update({
        where: { id: conteudo.acaoId },
        data: { estado: 'finalizada', resultado: `notificação assinada por ${assinante} e enviada` },
      }).catch(() => {});
    }
    await auditar(escritorioId, 'documento', doc.id, 'a assinar', 'enviado com prova', 'analista',
      `assinada por ${assinante}`);
    assinadas++;
  }
  return assinadas;
}

// Autorização de negativação/protesto, título a título: decisão do
// escritório. Recheca o gate da comunicação prévia na hora de executar.
export async function autorizarMedidas(
  escritorioId: string,
  hoje: string,
  autorizante: string,
  limite?: number,
): Promise<{ autorizadas: number; barradas: number }> {
  const docs = await db.documentoJuridico.findMany({
    where: { escritorioId, tipo: 'autorização', status: 'aguarda autorização' },
    include: { titulos: { include: { titulo: true } } },
    orderBy: { geradoEm: 'asc' },
    ...(limite ? { take: limite } : {}),
  });
  let autorizadas = 0;
  let barradas = 0;
  for (const doc of docs) {
    const vinculo = doc.titulos[0];
    if (!vinculo) continue;
    const titulo = vinculo.titulo;
    const previaEm = titulo.comunicacaoPreviaEnviadaEm ? paraIso(titulo.comunicacaoPreviaEnviadaEm) : null;
    const prazoOk = previaEm != null && difDias(hoje, previaEm) >= PRAZO_COMUNICACAO_PREVIA_DIAS;
    if (titulo.contestadoEm != null || !prazoOk || !ESTADOS_NA_REGUA.includes(titulo.estado as never)) {
      await auditar(escritorioId, 'documento', doc.id, 'aguarda autorização', 'aguarda autorização',
        'sistema', titulo.contestadoEm != null ? BLOQUEIOS.contestado : BLOQUEIOS.previa);
      barradas++;
      continue;
    }
    const novoEstado = doc.subtipo === 'protesto' ? 'protestado' : 'negativado';
    await db.documentoJuridico.update({
      where: { id: doc.id },
      data: { status: 'autorizado', assinadoPor: autorizante, assinadoEm: new Date(`${hoje}T10:00:00Z`) },
    });
    await db.titulo.update({ where: { id: titulo.id }, data: { estado: novoEstado } });
    await auditar(escritorioId, 'titulo', titulo.id, titulo.estado, novoEstado, 'escritório',
      `${doc.subtipo} autorizado por ${autorizante}, título a título`);
    autorizadas++;
  }
  return { autorizadas, barradas };
}

export function formatarResumoTick(r: ResumoTick): string {
  const partes = [
    `${r.acoesAgendadas} ação(ões) agendada(s)`,
    `${r.mensagensEnviadas} mensagem(ns) enviada(s)`,
    `${r.mensagensBloqueadas} bloqueada(s) na conferência`,
    `${r.bloqueiosConformidade} trava(s) de conformidade`,
    `${r.ligacoesNaAgenda} ligação(ões) na agenda`,
    `${r.ligacoesAdiadas} adiada(s)`,
    `${r.previasEnviadas} comunicação(ões) prévia(s)`,
    `${r.notificacoesParaAssinar} notificação(ões) a assinar`,
    `${r.medidasAguardandoAutorizacao} medida(s) aguardando autorização`,
    `${r.dossiesGerados} dossiê(s)`,
    `${r.promessasAvaliadas} promessa(s) avaliada(s)`,
  ];
  const texto = `tick de ${r.hoje}: ${partes.join(' · ')}`;
  return r.avisosCanais.length ? `${texto}\n  avisos: ${r.avisosCanais.join(' | ')}` : texto;
}
