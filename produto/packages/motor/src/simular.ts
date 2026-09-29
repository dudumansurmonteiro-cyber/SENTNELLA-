// Simulação da operação (Fase 2): importa as planilhas de exemplo semana a
// semana e roda o MESMO motor de produção (tick, conferência, drivers
// simulados, baixa) dia a dia por 90 dias. O que é do motor é real; o que é
// dos lojistas (responder, prometer, pagar, contestar) vem de um modelo de
// comportamento determinístico. Nenhuma mensagem real sai daqui (§12).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, auditar } from '@sentinella/db';
import { criarRnd, chance, entre, inteiro, escolha } from '@sentinella/dados';
import type { Rnd } from '@sentinella/dados';
import { addDias, difDias, deIso, paraIso, proximoDiaDeLigacao, diasDeAtrasoEm } from './datas';
import { executarTick } from './tick';
import { importarLojistas, importarTitulos, formatarRelatorio } from './importar';
import { aplicarPagamentos, type Pagamento } from './baixa';
import { recalcularRating } from './rating';
import { cadastrarClientesDemo, CLIENTES_DEMO } from './clientes';
import { gerarPlanilhas, DIAS_DE_SIMULACAO, type PerfilLojista } from './gerar-planilhas';
import { serializarPlanilha } from './planilhas';
import { ANALISTAS, slaDoPlano } from './equipe';

const MOTIVOS_EXCECAO = [
  { motivo: 'Lojista pediu para falar com pessoa', peso: 30 },
  { motivo: 'Contestação de entrega — pedido incompleto', peso: 10 },
  { motivo: 'Contestação — produto com defeito', peso: 6 },
  { motivo: 'Pedido de acordo fora da alçada', peso: 28 },
  { motivo: 'Título acima do valor-limite do cliente', peso: 10 },
  { motivo: 'IA sem resposta confiável', peso: 16 },
];

function sorteiaMotivo(rnd: Rnd): string {
  const total = MOTIVOS_EXCECAO.reduce((s, m) => s + m.peso, 0);
  let x = rnd() * total;
  for (const m of MOTIVOS_EXCECAO) {
    x -= m.peso;
    if (x <= 0) return m.motivo;
  }
  return MOTIVOS_EXCECAO[0].motivo;
}

const RESPOSTAS_LOJISTA = [
  'Recebido, vou ver com o financeiro e retorno ainda hoje.',
  'Pode me mandar a 2ª via atualizada, por favor?',
  'Semana que vem consigo acertar esse valor.',
  'Esse pedido teve um problema na entrega, preciso conferir antes.',
  'Consigo pagar uma parte agora e o resto no fim do mês?',
];

interface EstatisticasSim {
  dias: number;
  mensagens: number;
  respostas: number;
  excecoes: number;
  acordos: number;
  pagamentos: number;
  ligacoes: number;
  promessas: number;
  bloqueadas: number;
}

export async function simular(destino: string, semente: number): Promise<EstatisticasSim> {
  const rnd = criarRnd(semente);
  await cadastrarClientesDemo();
  const geradas = gerarPlanilhas(destino, semente);
  const perfis = geradas.perfis;
  const { inicio, hoje } = geradas;

  const est: EstatisticasSim = {
    dias: 0, mensagens: 0, respostas: 0, excecoes: 0, acordos: 0,
    pagamentos: 0, ligacoes: 0, promessas: 0, bloqueadas: 0,
  };

  // Lojistas entram uma vez, no início — como na implantação real.
  for (const c of CLIENTES_DEMO) {
    const r = await importarLojistas(c.id, geradas.porCliente[c.id].lojistas);
    console.log(formatarRelatorio(r));
  }
  const lojistas = await db.lojista.findMany();
  const perfilPorLojistaId = new Map<string, PerfilLojista>();
  for (const l of lojistas)
    perfilPorLojistaId.set(l.id, perfis[l.cnpj] ?? { pontual: 0.5, horasResp: 24 });

  const pagamentosRegistrados = new Map<string, string[][]>(); // clienteId → linhas CSV
  for (const c of CLIENTES_DEMO) pagamentosRegistrados.set(c.id, []);

  for (let d = 0; d < DIAS_DE_SIMULACAO; d++) {
    const dia = addDias(inicio, d);
    est.dias++;

    // Importação semanal de títulos (como o financeiro do cliente faria).
    if (d % 7 === 0) {
      const semana = d / 7;
      for (const c of CLIENTES_DEMO) {
        const arquivo = geradas.porCliente[c.id].titulosPorSemana.find((a) =>
          a.endsWith(`titulos-semana-${String(semana + 1).padStart(2, '0')}.csv`),
        );
        if (arquivo) {
          const r = await importarTitulos(c.id, arquivo);
          if (r.erros.length) console.log(formatarRelatorio(r));
        }
      }
    }

    const resumo = await executarTick({ hoje: dia });
    est.mensagens += resumo.mensagensEnviadas;
    est.bloqueadas += resumo.mensagensBloqueadas;

    await comportamentoDoDia(dia, hoje, rnd, perfilPorLojistaId, pagamentosRegistrados, est);

    // Rating mensal (§6) e no fim do período.
    if (d % 30 === 29 || d === DIAS_DE_SIMULACAO - 1)
      for (const c of CLIENTES_DEMO) await recalcularRating(c.id, dia);
  }

  // Registro dos pagamentos gerados (o mesmo formato da planilha de baixa).
  for (const c of CLIENTES_DEMO) {
    writeFileSync(
      join(destino, 'dados-exemplo', c.id, 'pagamentos.csv'),
      serializarPlanilha(['numero_titulo', 'data_pagamento', 'valor_pago'], pagamentosRegistrados.get(c.id)!),
    );
  }

  await excecoesDaFilaDeAgora(hoje, rnd);
  return est;
}

// ---------------------------------------------------------------------------
// Comportamento dos lojistas e do cliente em um dia simulado.
// ---------------------------------------------------------------------------
async function comportamentoDoDia(
  dia: string,
  hojeFinal: string,
  rnd: Rnd,
  perfilPorLojistaId: Map<string, PerfilLojista>,
  pagamentosRegistrados: Map<string, string[][]>,
  est: EstatisticasSim,
) {
  const clientes = await db.cliente.findMany({ orderBy: { id: 'asc' } });

  for (const cliente of clientes) {
    // ---- respostas às mensagens enviadas hoje --------------------------------
    const enviadas = await db.acaoCobranca.findMany({
      where: {
        clienteId: cliente.id, estado: 'finalizada', canal: { not: 'ligação' },
        executadaEm: { gte: deIso(dia), lt: deIso(addDias(dia, 1)) },
        resultado: { startsWith: 'entregue' },
      },
      include: { lojista: true, titulo: true },
      orderBy: { id: 'asc' },
    });
    for (const acao of enviadas) {
      if (!chance(rnd, 0.72)) continue; // nem tudo é lido
      let resultado = 'lido';
      const perfil = perfilPorLojistaId.get(acao.lojistaId)!;
      const responde = perfil.horasResp != null && chance(rnd, 0.38);
      if (responde) {
        resultado = 'respondido';
        est.respostas++;
        // A resposta chega "horasResp" depois da mensagem das 12h — pode cair
        // no dia seguinte; é esse intervalo real que o rating mede (§6).
        const atrasoHoras = Math.max(0.5, entre(rnd, 0.5, (perfil.horasResp ?? 4) * 1.6));
        await db.mensagem.create({
          data: {
            clienteId: cliente.id, lojistaId: acao.lojistaId, tituloId: acao.tituloId,
            acaoId: acao.id, canal: acao.canal, de: 'lojista',
            texto: escolha(rnd, RESPOSTAS_LOJISTA),
            em: new Date(deIso(dia).getTime() + (12 + atrasoHoras) * 3_600_000),
          },
        });
      }
      await db.acaoCobranca.update({ where: { id: acao.id }, data: { resultado } });

      // Exceções nascem de respostas com problema (§5).
      if (responde && chance(rnd, 0.16)) {
        const motivo = sorteiaMotivo(rnd);
        await criarExcecaoSimulada(cliente, acao.lojistaId, acao.tituloId, motivo, dia, hojeFinal, rnd, est);
      }

      // Proposta de acordo no D+7: parte dos lojistas propõe na hora.
      if (responde && acao.etapa === 'D+7' && chance(rnd, 0.3) && acao.titulo.estado === 'vencido') {
        const parcelas = inteiro(rnd, 2, cliente.alcadaParcelasMax + 2);
        if (parcelas <= cliente.alcadaParcelasMax) {
          const acordo = await db.acordo.create({
            data: {
              clienteId: cliente.id, lojistaId: acao.lojistaId,
              valorTotalCentavos: acao.titulo.valorCentavos,
              parcelas, origem: 'portal',
              criadoEm: new Date(`${dia}T15:00:00Z`),
              titulos: { create: [{ tituloId: acao.tituloId }] },
            },
          });
          await db.titulo.update({ where: { id: acao.tituloId }, data: { estado: 'acordo' } });
          await auditar(cliente.id, 'titulo', acao.tituloId, 'vencido', 'acordo', 'lojista',
            `acordo em ${parcelas}x dentro da alçada — aprovado na hora`);
          await auditar(cliente.id, 'acordo', acordo.id, null, 'em dia', 'IA', 'proposta pelo portal, dentro da alçada');
          est.acordos++;
        } else {
          await criarExcecaoSimulada(
            cliente, acao.lojistaId, acao.tituloId, 'Pedido de acordo fora da alçada', dia, hojeFinal, rnd, est,
          );
        }
      }
    }

    // ---- ligações do dia (agenda do analista) --------------------------------
    const ligacoes = await db.acaoCobranca.findMany({
      where: {
        clienteId: cliente.id, canal: 'ligação', estado: 'em andamento',
        dataProgramada: { lte: deIso(dia) },
      },
      include: { titulo: true },
      orderBy: { id: 'asc' },
    });
    for (const lig of ligacoes) {
      est.ligacoes++;
      const analista = escolha(rnd, ANALISTAS).nome;
      if (chance(rnd, 0.42)) {
        await db.acaoCobranca.update({
          where: { id: lig.id },
          data: {
            estado: 'não atendida',
            resultado: 'não atendida — reprogramada para o dia seguinte',
            executadaEm: new Date(`${dia}T17:00:00Z`),
          },
        });
        await auditar(cliente.id, 'acao', lig.id, 'em andamento', 'não atendida', 'analista',
          `${analista} — tentativa registrada (§3: uma ligação por dia)`);
        if (lig.tentativa < 3) {
          await db.acaoCobranca.createMany({
            data: [{
              clienteId: cliente.id, tituloId: lig.tituloId, lojistaId: lig.lojistaId,
              etapa: lig.etapa, canal: 'ligação', quem: 'analista',
              descricao: `${lig.descricao.replace(/ \(nova tentativa\)$/, '')} (nova tentativa)`,
              dataProgramada: deIso(proximoDiaDeLigacao(dia)), tentativa: lig.tentativa + 1,
            }],
            skipDuplicates: true,
          });
        }
      } else {
        const promete = chance(rnd, 0.55);
        await db.acaoCobranca.update({
          where: { id: lig.id },
          data: {
            estado: 'finalizada',
            resultado: promete ? 'atendida — promessa de pagamento' : 'atendida',
            executadaEm: new Date(`${dia}T17:00:00Z`),
          },
        });
        await auditar(cliente.id, 'acao', lig.id, 'em andamento', 'finalizada', 'analista', analista);
        if (promete) {
          await db.promessa.create({
            data: {
              clienteId: cliente.id, lojistaId: lig.lojistaId, tituloId: lig.tituloId,
              para: deIso(addDias(dia, inteiro(rnd, 2, 6))), origem: 'ligação',
              criadaEm: new Date(`${dia}T17:00:00Z`),
            },
          });
          est.promessas++;
        }
      }
    }

    // ---- decisões do cliente: autorizações de protesto -----------------------
    const autorizacoes = await db.autorizacao.findMany({
      where: { clienteId: cliente.id, status: 'pendente', pedidoEm: { lt: deIso(addDias(dia, -1)) } },
      include: { titulo: true },
      orderBy: { id: 'asc' },
    });
    for (const aut of autorizacoes) {
      if (!chance(rnd, 0.4)) continue; // o cliente autoriza aos poucos
      await db.autorizacao.update({
        where: { id: aut.id },
        data: { status: 'aprovada', aprovadaEm: new Date(`${dia}T10:00:00Z`) },
      });
      await auditar(cliente.id, 'autorizacao', aut.id, 'pendente', 'aprovada', 'cliente', aut.tipo);
      if (aut.tipo === 'protesto' && ['vencido', 'em negociação'].includes(aut.titulo.estado)) {
        await db.titulo.update({ where: { id: aut.tituloId }, data: { estado: 'protestado' } });
        await auditar(cliente.id, 'titulo', aut.tituloId, aut.titulo.estado, 'protestado', 'sistema',
          'protesto autorizado pelo cliente — envio ao cartório (CENPROT na Fase 3)');
      }
      await db.acaoCobranca.updateMany({
        where: {
          tituloId: aut.tituloId, estado: 'pendente',
          etapa: aut.tipo === 'protesto' ? 'D+45' : 'bloqueio',
        },
        data: {
          estado: 'finalizada',
          resultado: aut.tipo === 'protesto'
            ? 'autorizado pelo cliente'
            : 'aprovado — bloqueio registrado (conector de ERP na Fase 3)',
        },
      });
    }

    // ---- encaminhamento ao jurídico ------------------------------------------
    const juridicos = await db.acaoCobranca.findMany({
      where: {
        clienteId: cliente.id, etapa: 'jurídico', estado: 'pendente',
        dataProgramada: { lt: deIso(addDias(dia, -2)) },
      },
      include: { titulo: true },
      orderBy: { id: 'asc' },
    });
    for (const j of juridicos) {
      if (!chance(rnd, 0.5)) continue;
      if (!['vencido', 'em negociação'].includes(j.titulo.estado)) continue;
      await db.titulo.update({ where: { id: j.tituloId }, data: { estado: 'jurídico' } });
      await db.acaoCobranca.update({
        where: { id: j.id },
        data: { estado: 'finalizada', resultado: 'encaminhado ao escritório parceiro' },
      });
      await auditar(cliente.id, 'titulo', j.tituloId, j.titulo.estado, 'jurídico', 'cliente',
        'encaminhado ao escritório parceiro (contrato direto cliente–escritório)');
    }

    // ---- acordos: parcelas andam; quitou → baixa dos títulos -----------------
    if (difDias(dia, '2000-01-01') % 7 === 3) {
      const acordosAbertos = await db.acordo.findMany({
        where: { clienteId: cliente.id, status: { in: ['em dia', 'atrasado'] } },
        include: { titulos: { include: { titulo: true } } },
        orderBy: { id: 'asc' },
      });
      for (const acordo of acordosAbertos) {
        if (chance(rnd, 0.55)) {
          const pagas = acordo.parcelasPagas + 1;
          if (pagas >= acordo.parcelas) {
            await db.acordo.update({
              where: { id: acordo.id },
              data: { parcelasPagas: acordo.parcelas, status: 'quitado' },
            });
            await auditar(cliente.id, 'acordo', acordo.id, acordo.status, 'quitado', 'sistema', 'todas as parcelas pagas');
            const pagamentos: Pagamento[] = acordo.titulos.map((at) => ({
              numeroTitulo: at.titulo.numero, dataIso: dia, valorCentavos: at.titulo.valorCentavos,
            }));
            await aplicarPagamentos(cliente.id, pagamentos);
            registrar(pagamentosRegistrados, cliente.id, pagamentos);
            est.pagamentos += pagamentos.length;
          } else {
            await db.acordo.update({
              where: { id: acordo.id },
              data: { parcelasPagas: pagas, status: 'em dia' },
            });
          }
        } else if (acordo.status === 'em dia' && chance(rnd, 0.3)) {
          await db.acordo.update({ where: { id: acordo.id }, data: { status: 'atrasado' } });
          await auditar(cliente.id, 'acordo', acordo.id, 'em dia', 'atrasado', 'sistema', 'parcela em atraso');
        }
      }
    }

    // ---- pagamentos do dia ---------------------------------------------------
    const abertos = await db.titulo.findMany({
      where: { clienteId: cliente.id, estado: { in: ['a vencer', 'vencido'] } },
      orderBy: { numero: 'asc' },
    });
    const promessasParaHoje = await db.promessa.findMany({
      where: {
        clienteId: cliente.id, cumprida: null,
        para: { gte: deIso(addDias(dia, -1)), lte: deIso(addDias(dia, 1)) },
      },
      select: { tituloId: true },
    });
    const comPromessa = new Set(promessasParaHoje.map((p) => p.tituloId));
    const contatosRecentes = await db.acaoCobranca.findMany({
      where: {
        clienteId: cliente.id, estado: 'finalizada',
        executadaEm: { gte: deIso(addDias(dia, -2)) },
      },
      select: { tituloId: true },
    });
    const comContato = new Set(contatosRecentes.map((a) => a.tituloId));

    const pagamentos: Pagamento[] = [];
    for (const titulo of abertos) {
      const perfil = perfilPorLojistaId.get(titulo.lojistaId)!;
      const vencimentoIso = paraIso(titulo.vencimento);
      const paraVencer = difDias(vencimentoIso, dia); // >0 = ainda não venceu
      let prob: number;
      if (paraVencer > 3) prob = 0.004;
      else if (paraVencer >= 0) prob = 0.06 + perfil.pontual * 0.3;
      else prob = 0.012 + perfil.pontual * 0.03;
      if (paraVencer < 0 && comContato.has(titulo.id)) prob *= 2.4; // contato converte
      if (comPromessa.has(titulo.id)) prob = 0.55; // promessa marcada para hoje
      if (chance(rnd, prob)) {
        pagamentos.push({ numeroTitulo: titulo.numero, dataIso: dia, valorCentavos: titulo.valorCentavos });
      }
    }
    if (pagamentos.length) {
      await aplicarPagamentos(cliente.id, pagamentos);
      registrar(pagamentosRegistrados, cliente.id, pagamentos);
      est.pagamentos += pagamentos.length;

      // "Pago em até 48h após o contato" — o número que fecha o argumento do
      // painel de eficiência.
      const pagosIds = await db.titulo.findMany({
        where: { clienteId: cliente.id, numero: { in: pagamentos.map((p) => p.numeroTitulo) } },
        select: { id: true },
      });
      await db.acaoCobranca.updateMany({
        where: {
          tituloId: { in: pagosIds.map((t) => t.id) },
          estado: 'finalizada', canal: { not: 'ligação' },
          executadaEm: { gte: deIso(addDias(dia, -2)) },
        },
        data: { resultado: 'pago em até 48h após o contato' },
      });
      await db.acaoCobranca.updateMany({
        where: {
          tituloId: { in: pagosIds.map((t) => t.id) },
          estado: 'finalizada', canal: 'ligação',
          executadaEm: { gte: deIso(addDias(dia, -7)) },
          resultado: { startsWith: 'atendida' },
        },
        data: { resultado: 'atendida — pago em até 7 dias' },
      });
    }
  }
}

function registrar(
  mapa: Map<string, string[][]>,
  clienteId: string,
  pagamentos: Pagamento[],
) {
  const linhas = mapa.get(clienteId)!;
  for (const p of pagamentos) {
    const [a, m, d] = p.dataIso.split('-');
    linhas.push([p.numeroTitulo, `${d}/${m}/${a}`, ((p.valorCentavos ?? 0) / 100).toFixed(2).replace('.', ',')]);
  }
}

async function criarExcecaoSimulada(
  cliente: { id: string; plano: string },
  lojistaId: string,
  tituloId: string,
  motivo: string,
  dia: string,
  hojeFinal: string,
  rnd: Rnd,
  est: EstatisticasSim,
) {
  const titulo = await db.titulo.findUnique({ where: { id: tituloId } });
  if (!titulo) return;
  const sla = slaDoPlano(cliente.plano);
  const contestacao = motivo.includes('Contestação');
  const foraDaAlcada = motivo.includes('fora da alçada');

  // Exceções antigas se resolvem; as dos últimos dias ficam na fila do console,
  // com o relógio de agora (o cronômetro de SLA conta a partir da abertura).
  const recente = difDias(hojeFinal, dia) <= 1;
  const analista = escolha(rnd, ANALISTAS).nome;
  const abertaEm = recente
    ? new Date(Date.now() - inteiro(rnd, 1, Math.max(2, sla - 3)) * 60000)
    : new Date(`${dia}T14:00:00Z`);
  const resolvida = !recente;

  const excecao = await db.excecao.create({
    data: {
      clienteId: cliente.id, lojistaId, tituloId, motivo, slaMin: sla,
      valorEnvolvidoCentavos: titulo.valorCentavos,
      abertaEm,
      estado: resolvida ? 'resolvida' : 'aberta',
      assumidaPor: resolvida ? analista : null,
      assumidaEm: resolvida ? new Date(abertaEm.getTime() + inteiro(rnd, 2, sla - 1) * 60000) : null,
      causa: resolvida
        ? escolha(rnd, [
            'regra de alçada apertada para o perfil do lojista',
            'divergência de cadastro entre pedido e ERP',
            'lojista sem contato financeiro atualizado',
            'contestação comercial — encaminhada ao representante',
          ])
        : null,
      resolucao: resolvida
        ? escolha(rnd, [
            'acordo fechado dentro da alçada',
            'pagamento confirmado após conversa',
            'transferido ao representante comercial',
            'cadastro corrigido e cobrança retomada',
          ])
        : null,
      regraSugerida: resolvida && chance(rnd, 0.18)
        ? 'permitir parcelamento em uma parcela extra para rating A e B'
        : null,
    },
  });
  await auditar(cliente.id, 'excecao', excecao.id, null, 'aberta', 'IA', motivo);
  if (resolvida)
    await auditar(cliente.id, 'excecao', excecao.id, 'aberta', 'resolvida', 'analista', analista);
  est.excecoes++;

  if (contestacao && ['vencido', 'a vencer'].includes(titulo.estado)) {
    await db.titulo.update({ where: { id: tituloId }, data: { estado: 'contestado' } });
    await auditar(cliente.id, 'titulo', tituloId, titulo.estado, 'contestado', 'lojista', motivo);
    if (resolvida && chance(rnd, 0.6)) {
      // Contestação procedente vira crédito; improcedente, o lojista paga.
      const procedente = chance(rnd, 0.4);
      await db.titulo.update({
        where: { id: tituloId },
        data: procedente
          ? { estado: 'cancelado' }
          : { estado: 'pago', pagoEm: deIso(addDias(dia, inteiro(rnd, 2, 6))), valorPagoCentavos: titulo.valorCentavos },
      });
      await auditar(cliente.id, 'titulo', tituloId, 'contestado', procedente ? 'cancelado' : 'pago', 'analista',
        procedente ? 'contestação procedente — crédito emitido pelo cliente' : 'esclarecida — pagamento realizado');
    }
  } else if (foraDaAlcada && titulo.estado === 'vencido') {
    await db.titulo.update({ where: { id: tituloId }, data: { estado: 'em negociação' } });
    await auditar(cliente.id, 'titulo', tituloId, 'vencido', 'em negociação', 'analista', 'negociação fora da alçada em curso');
    if (resolvida) {
      const fechou = chance(rnd, 0.6);
      if (fechou) {
        await db.acordo.create({
          data: {
            clienteId: cliente.id, lojistaId,
            valorTotalCentavos: titulo.valorCentavos,
            parcelas: inteiro(rnd, 2, 4), origem: 'analista',
            criadoEm: new Date(`${dia}T16:00:00Z`),
            titulos: { create: [{ tituloId }] },
          },
        });
        await db.titulo.update({ where: { id: tituloId }, data: { estado: 'acordo' } });
        await auditar(cliente.id, 'titulo', tituloId, 'em negociação', 'acordo', 'analista', 'acordo aprovado pelo cliente');
        est.acordos++;
      } else {
        await db.titulo.update({ where: { id: tituloId }, data: { estado: 'vencido' } });
        await auditar(cliente.id, 'titulo', tituloId, 'em negociação', 'vencido', 'analista', 'negociação sem acordo — cobrança retomada');
      }
    }
  }
}

// A fila "de agora": garante exceções abertas e em atendimento no fim da
// simulação, com conversa registrada, para o console mostrar o dia real.
async function excecoesDaFilaDeAgora(hoje: string, rnd: Rnd) {
  for (const clienteDemo of CLIENTES_DEMO) {
    const cliente = await db.cliente.findUnique({ where: { id: clienteDemo.id } });
    if (!cliente) continue;
    const sla = slaDoPlano(cliente.plano);
    const abertas = await db.excecao.count({ where: { clienteId: cliente.id, estado: 'aberta' } });
    const emAtendimento = await db.excecao.count({ where: { clienteId: cliente.id, estado: 'em atendimento' } });

    const alvoAbertas = Math.max(0, 3 - abertas);
    const alvoAtendimento = Math.max(0, 2 - emAtendimento);
    if (alvoAbertas + alvoAtendimento === 0) continue;

    const candidatos = await db.titulo.findMany({
      where: { clienteId: cliente.id, estado: 'vencido' },
      orderBy: { valorCentavos: 'desc' },
      take: (alvoAbertas + alvoAtendimento) * 2,
      include: { lojista: true },
    });
    let i = 0;
    for (let n = 0; n < alvoAbertas + alvoAtendimento && i < candidatos.length; n++, i++) {
      const titulo = candidatos[i];
      const motivo = sorteiaMotivo(rnd);
      const aberta = n < alvoAbertas;
      const minAtras = aberta ? inteiro(rnd, 1, Math.max(2, sla - 3)) : inteiro(rnd, 8, 40);
      const abertaEm = new Date(Date.now() - minAtras * 60000);
      const excecao = await db.excecao.create({
        data: {
          clienteId: cliente.id, lojistaId: titulo.lojistaId, tituloId: titulo.id,
          motivo, slaMin: sla, valorEnvolvidoCentavos: titulo.valorCentavos,
          abertaEm,
          estado: aberta ? 'aberta' : 'em atendimento',
          assumidaPor: aberta ? null : escolha(rnd, ANALISTAS).nome,
          assumidaEm: aberta ? null : new Date(abertaEm.getTime() + inteiro(rnd, 2, sla - 1) * 60000),
        },
      });
      await auditar(cliente.id, 'excecao', excecao.id, null, 'aberta', 'IA', motivo);

      const conversa: { de: string; texto: string; min: number }[] = [
        { de: 'IA', texto: 'Olá! Identificamos um título em aberto. Posso enviar a 2ª via ou um link de pagamento?', min: minAtras + 7 },
      ];
      if (motivo.includes('entrega') || motivo.includes('defeito')) {
        conversa.push({ de: 'lojista', texto: 'Não vou pagar assim — a entrega veio errada e ninguém resolveu.', min: minAtras + 2 });
        conversa.push({ de: 'IA', texto: 'Entendi. Vou registrar a contestação e chamar uma pessoa da central para cuidar disso agora.', min: minAtras + 1 });
      } else if (motivo.includes('fora da alçada')) {
        conversa.push({ de: 'lojista', texto: 'Consigo pagar, mas só em mais vezes, começando mês que vem.', min: minAtras + 2 });
        conversa.push({ de: 'IA', texto: 'Essa condição passa da alçada combinada com a indústria. Vou acionar um analista para ver com você.', min: minAtras + 1 });
      } else if (motivo.includes('pessoa')) {
        conversa.push({ de: 'lojista', texto: 'Prefiro falar com uma pessoa, por favor.', min: minAtras + 2 });
        conversa.push({ de: 'IA', texto: 'Claro. Um analista da central assume esta conversa em instantes.', min: minAtras + 1 });
      } else {
        conversa.push({ de: 'lojista', texto: 'Esse valor não bate com o que combinei com o vendedor.', min: minAtras + 2 });
        conversa.push({ de: 'IA', texto: 'Para não passar nenhuma informação errada, um analista vai conferir com o cadastro e te responder.', min: minAtras + 1 });
      }
      for (const m of conversa) {
        await db.mensagem.create({
          data: {
            clienteId: cliente.id, lojistaId: titulo.lojistaId, tituloId: titulo.id,
            excecaoId: excecao.id, canal: 'WhatsApp', de: m.de, texto: m.texto,
            em: new Date(Date.now() - m.min * 60000),
          },
        });
      }
    }
  }
}
