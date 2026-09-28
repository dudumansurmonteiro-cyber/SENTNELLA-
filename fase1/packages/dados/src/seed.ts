// Seed da Fase 1 (CLAUDE.md §11): 3 clientes fictícios, 400 lojistas,
// 3.000 títulos e 90 dias de histórico, gerados de forma determinística.
// Saída: JSON consumido pelo painel (apps/painel/public/dados) e pelo
// portal (apps/portal/public/dados). Nenhuma mensagem real é enviada — tudo
// aqui é simulação (§12).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Acao, Acordo, Analista, Autorizacao, Cliente, DadosCliente, DadosPortal,
  EntradaPortal, Excecao, IndiceSeed, Lojista, Mensagem, Promessa, Titulo,
} from './tipos';
import { criarRnd, chance, diasDeAtraso, entre, escolha, inteiro } from './prng';
import { cidade, cnpjFicticio, nomeLojista, nomePessoa, token } from './nomes';
import { etapaAtualDoTitulo, gerarAcoes } from './regua';
import { calcularRating } from './rating';
import { addDias, difDias } from './formato';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const hoje = new Date().toISOString().slice(0, 10);
const rnd = criarRnd(20260928);

// ---------------------------------------------------------------- clientes

const ANALISTAS: Analista[] = [
  { id: 'an1', nome: 'Marina Duarte', turno: '8h–15h', clienteIds: ['c1', 'c2', 'c3'] },
  { id: 'an2', nome: 'Rafael Nogueira', turno: '15h–22h', clienteIds: ['c1', 'c2', 'c3'] },
];

const CLIENTES: (Cliente & { qtdLojistas: number; qtdTitulos: number })[] = [
  {
    id: 'c1',
    nome: 'Móveis Aurora Ltda (fictícia)',
    plano: 'Avançado',
    cidade: 'Arapongas (PR)',
    setor: 'indústria moveleira',
    erp: 'Sankhya (importação por planilha na Fase 1)',
    erpIntegrado: false,
    canais: ['WhatsApp', 'e-mail', 'carta', 'ligação'],
    multaPct: 2,
    jurosMesPct: 1,
    alcada: { descontoMaxPct: 8, parcelasMax: 4, prazoMaxDias: 45, valorSempreAnalista: 20000 },
    valorLimiteLigacao: 4000,
    analistaIds: ['an1', 'an2'],
    qtdLojistas: 160,
    qtdTitulos: 1200,
  },
  {
    id: 'c2',
    nome: 'Serra Verde Bebidas S.A. (fictícia)',
    plano: 'Max',
    cidade: 'Cascavel (PR)',
    setor: 'alimentos e bebidas',
    erp: 'Omie (conector por API)',
    erpIntegrado: true,
    canais: ['WhatsApp', 'SMS', 'e-mail', 'carta', 'ligação'],
    multaPct: 2,
    jurosMesPct: 1,
    alcada: { descontoMaxPct: 10, parcelasMax: 6, prazoMaxDias: 60, valorSempreAnalista: 15000 },
    valorLimiteLigacao: 3000,
    analistaIds: ['an1', 'an2'],
    analistaNomeado: 'Marina Duarte',
    qtdLojistas: 140,
    qtdTitulos: 1100,
  },
  {
    id: 'c3',
    nome: 'Horizonte Autopeças ME (fictícia)',
    plano: 'Básico',
    cidade: 'Maringá (PR)',
    setor: 'autopeças',
    erp: 'Bling (importação por planilha na Fase 1)',
    erpIntegrado: false,
    canais: ['WhatsApp', 'e-mail'],
    multaPct: null, // sem multa cadastrada → mensagens e portal não mencionam multa (§12)
    jurosMesPct: null,
    alcada: { descontoMaxPct: 5, parcelasMax: 3, prazoMaxDias: 30, valorSempreAnalista: 12000 },
    valorLimiteLigacao: 2500,
    analistaIds: ['an1', 'an2'],
    qtdLojistas: 100,
    qtdTitulos: 700,
  },
];

// ------------------------------------------------------------------ geração

const contadores = { lojista: 0, titulo: 0, acao: 0, excecao: 0, acordo: 0, aut: 0, promessa: 0 };
const nomesUsados = new Set<string>();
const tokensExemplo: IndiceSeed['tokensExemplo'] = [];
const portal: DadosPortal = {};

const MOTIVOS = [
  { motivo: 'Lojista pediu para falar com pessoa', peso: 25 },
  { motivo: 'Contestação de entrega — pedido incompleto', peso: 12 },
  { motivo: 'Contestação — produto com defeito', peso: 8 },
  { motivo: 'Pedido de acordo fora da alçada', peso: 25 },
  { motivo: 'Título acima do valor-limite do cliente', peso: 10 },
  { motivo: 'IA sem resposta confiável', peso: 10 },
  { motivo: 'Mensagem bloqueada — valor divergente do ERP', peso: 10 },
];

function sorteiaMotivo(): string {
  const total = MOTIVOS.reduce((s, m) => s + m.peso, 0);
  let x = rnd() * total;
  for (const m of MOTIVOS) {
    x -= m.peso;
    if (x <= 0) return m.motivo;
  }
  return MOTIVOS[0].motivo;
}

function conversaPara(motivo: string, lojistaNome: string): Mensagem[] {
  const base: Mensagem[] = [
    { de: 'IA', texto: 'Olá! Identificamos um título em aberto. Posso enviar a 2ª via ou um link de pagamento?', minAtras: 38 },
  ];
  if (motivo.includes('entrega') || motivo.includes('defeito')) {
    base.push({ de: 'lojista', texto: 'Não vou pagar assim — a entrega veio errada e ninguém resolveu.', minAtras: 31 });
    base.push({ de: 'IA', texto: 'Entendi. Vou registrar a contestação e chamar uma pessoa da central para cuidar disso agora.', minAtras: 30 });
  } else if (motivo.includes('fora da alçada')) {
    base.push({ de: 'lojista', texto: 'Consigo pagar, mas só em 6 vezes começando mês que vem.', minAtras: 26 });
    base.push({ de: 'IA', texto: 'Essa condição passa da alçada combinada com a indústria. Vou acionar um analista para ver com você.', minAtras: 25 });
  } else if (motivo.includes('pessoa')) {
    base.push({ de: 'lojista', texto: 'Prefiro falar com uma pessoa, por favor.', minAtras: 22 });
    base.push({ de: 'IA', texto: 'Claro. Um analista da central assume esta conversa em instantes.', minAtras: 21 });
  } else {
    base.push({ de: 'lojista', texto: 'Esse valor não bate com o que combinei com o vendedor.', minAtras: 24 });
    base.push({ de: 'IA', texto: 'Para não passar nenhuma informação errada, um analista vai conferir com o cadastro e te responder.', minAtras: 23 });
  }
  return base;
}

function gerarCliente(c: (typeof CLIENTES)[number]): DadosCliente {
  const lojistas: Lojista[] = [];
  const titulos: Titulo[] = [];
  const acoes: Acao[] = [];
  const excecoes: Excecao[] = [];
  const acordos: Acordo[] = [];
  const autorizacoes: Autorizacao[] = [];
  const promessas: Promessa[] = [];

  interface Perfil { pontual: number; horasResp: number | null }
  const perfis = new Map<string, Perfil>();

  for (let i = 0; i < c.qtdLojistas; i++) {
    const id = `l${++contadores.lojista}`;
    const lojista: Lojista = {
      id,
      clienteId: c.id,
      nome: nomeLojista(rnd, nomesUsados),
      cidade: cidade(rnd),
      cnpj: cnpjFicticio(contadores.lojista),
      contatoNome: nomePessoa(rnd),
      contatoPapel: chance(rnd, 0.8) ? 'financeiro' : 'sócio',
      token: token(rnd),
      rating: 'C', ratingTotal: 50, ratingDetalhe: [], ratingNovo: false,
      titulosAbertos: 0, valorAberto: 0, valorVencido: 0, maiorAtrasoDias: 0,
    };
    lojistas.push(lojista);
    perfis.set(id, {
      pontual: rnd(), // 0 = sempre atrasa · 1 = sempre em dia
      horasResp: chance(rnd, 0.08) ? null : Math.round(entre(rnd, 2, 60)),
    });
  }

  for (let i = 0; i < c.qtdTitulos; i++) {
    const lojista = escolha(rnd, lojistas);
    const perfil = perfis.get(lojista.id)!;
    const emissao = addDias(hoje, -inteiro(rnd, 5, 95));
    const prazo = escolha(rnd, [28, 28, 35, 35, 42]);
    const vencimento = addDias(emissao, prazo);
    const valor = Math.round(entre(rnd, 380, 9200) + (chance(rnd, 0.06) ? entre(rnd, 8000, 42000) : 0));
    const antecipado = c.plano !== 'Básico' && chance(rnd, 0.15);

    const t: Titulo = {
      id: `t${++contadores.titulo}`,
      clienteId: c.id,
      lojistaId: lojista.id,
      numero: `${c.id.toUpperCase()}-${String(4000 + contadores.titulo)}`,
      valor,
      emissao,
      vencimento,
      antecipado,
      estado: 'a vencer',
      diasAtraso: 0,
      pagoEm: null,
      etapaAtual: '',
    };

    const vencido = difDias(hoje, vencimento) >= 0;
    if (vencido) {
      const sorte = rnd() * (0.55 + perfil.pontual * 0.5);
      if (sorte > 0.42) {
        t.estado = 'pago';
        t.pagoEm = addDias(vencimento, -inteiro(rnd, 0, 3));
        if (difDias(t.pagoEm, emissao) < 1) t.pagoEm = vencimento;
      } else if (sorte > 0.13) {
        const atraso = diasDeAtraso(rnd);
        const dataPgto = addDias(vencimento, atraso);
        if (difDias(hoje, dataPgto) >= 0) {
          t.estado = 'pago';
          t.pagoEm = dataPgto;
        } else {
          t.estado = 'vencido';
          t.diasAtraso = difDias(hoje, vencimento);
        }
      } else {
        t.estado = 'vencido';
        t.diasAtraso = difDias(hoje, vencimento);
      }
      if (t.estado === 'pago') {
        const atrasoPago = Math.max(0, difDias(t.pagoEm!, vencimento));
        if (atrasoPago > lojista.maiorAtrasoDias) lojista.maiorAtrasoDias = atrasoPago;
      }
    }

    if (t.estado === 'vencido') {
      if (c.plano === 'Básico' && t.diasAtraso > 15) t.estado = 'fora da régua';
      else if (chance(rnd, 0.012)) t.estado = 'contestado';
      else if (chance(rnd, 0.004)) t.estado = 'cancelado';
      else if (c.plano !== 'Básico') {
        const limiteProtesto = t.antecipado ? 25 : 45;
        if (t.diasAtraso >= 60 && c.plano === 'Max' && chance(rnd, 0.35)) t.estado = 'jurídico';
        else if (t.diasAtraso >= limiteProtesto && chance(rnd, 0.5)) {
          const aprovada = chance(rnd, 0.7);
          autorizacoes.push({
            id: `au${++contadores.aut}`,
            clienteId: c.id,
            lojistaId: lojista.id,
            tituloId: t.id,
            tipo: chance(rnd, 0.75) ? 'protesto' : 'negativação',
            valor: t.valor,
            pedidoEm: addDias(vencimento, limiteProtesto),
            status: aprovada ? 'aprovada' : 'pendente',
            aprovadaEm: aprovada ? addDias(vencimento, limiteProtesto + inteiro(rnd, 1, 3)) : null,
          });
          if (aprovada) t.estado = chance(rnd, 0.75) ? 'protestado' : 'negativado';
        }
      }
      if (t.diasAtraso > lojista.maiorAtrasoDias) lojista.maiorAtrasoDias = t.diasAtraso;
    }

    titulos.push(t);
  }

  // Acordos: lojistas com mais de um título vencido fecham acordo.
  const porLojistaVencidos = new Map<string, Titulo[]>();
  for (const t of titulos)
    if (t.estado === 'vencido')
      porLojistaVencidos.set(t.lojistaId, [...(porLojistaVencidos.get(t.lojistaId) ?? []), t]);
  let acordosAlvo = c.plano === 'Básico' ? 8 : 16;
  for (const [lojistaId, vencidos] of porLojistaVencidos) {
    if (acordosAlvo <= 0) break;
    if (vencidos.length >= 2 && chance(rnd, 0.5)) {
      const alvo = vencidos.slice(0, inteiro(rnd, 1, 2));
      const parcelas = inteiro(rnd, 2, c.alcada.parcelasMax);
      const pagas = inteiro(rnd, 0, parcelas - 1);
      acordos.push({
        id: `ac${++contadores.acordo}`,
        clienteId: c.id,
        lojistaId,
        tituloIds: alvo.map((t) => t.id),
        valorTotal: Math.round(alvo.reduce((s, t) => s + t.valor, 0)),
        parcelas,
        parcelasPagas: pagas,
        status: chance(rnd, 0.78) ? 'em dia' : 'atrasado',
        criadoEm: addDias(hoje, -inteiro(rnd, 3, 25)),
      });
      for (const t of alvo) t.estado = 'acordo';
      acordosAlvo--;
    }
  }

  // Ações da régua para cada título com vencimento no horizonte.
  for (const t of titulos) {
    if (difDias(hoje, t.vencimento) < -10) continue;
    if (t.estado === 'cancelado') continue;
    acoes.push(...gerarAcoes(rnd, c, t, hoje, contadores));
  }
  acoes.sort((a, b) => a.data.localeCompare(b.data));

  // Promessas nascem das ligações atendidas com promessa.
  for (const a of acoes) {
    if (a.resultado === 'atendida — promessa de pagamento') {
      const para = addDias(a.data, inteiro(rnd, 2, 6));
      const t = titulos.find((x) => x.id === a.tituloId)!;
      // Cumprida = pago até a data combinada (pagar antes também cumpre).
      const cumprida =
        difDias(hoje, para) < 0
          ? t.pagoEm != null && difDias(t.pagoEm, para) <= 1
            ? true
            : null
          : t.pagoEm != null && difDias(t.pagoEm, para) <= 1;
      promessas.push({
        id: `p${++contadores.promessa}`,
        clienteId: c.id,
        lojistaId: a.lojistaId,
        tituloId: a.tituloId,
        para,
        cumprida,
      });
    }
  }

  // Exceções: abertas (para o console), em atendimento e resolvidas.
  const slaMin = c.plano === 'Max' ? 5 : 15;
  const vencidosRestantes = titulos.filter((t) => ['vencido', 'em negociação', 'contestado'].includes(t.estado));
  const qtdExc = c.plano === 'Básico' ? 18 : 30;
  for (let i = 0; i < qtdExc && vencidosRestantes.length; i++) {
    const t = escolha(rnd, vencidosRestantes);
    const lojista = lojistas.find((l) => l.id === t.lojistaId)!;
    const motivo = sorteiaMotivo();
    let estado: Excecao['estado'];
    if (i < 3) estado = 'aberta';
    else if (i < 5) estado = 'em atendimento';
    else estado = chance(rnd, 0.12) ? 'devolvida ao cliente' : 'resolvida';

    if (motivo.includes('fora da alçada') && estado !== 'resolvida' && t.estado === 'vencido')
      t.estado = 'em negociação';

    const analista = escolha(rnd, ANALISTAS);
    excecoes.push({
      id: `e${++contadores.excecao}`,
      clienteId: c.id,
      lojistaId: t.lojistaId,
      tituloId: t.id,
      motivo,
      estado,
      abertaMinAtras:
        estado === 'aberta' ? inteiro(rnd, 1, Math.max(2, slaMin - 3)) : inteiro(rnd, 40, 4000),
      slaMin,
      valorEnvolvido: t.valor,
      assumidaPor: estado === 'aberta' ? null : analista.nome,
      tempoAteAssumirMin: estado === 'aberta' ? null : inteiro(rnd, 2, slaMin - 1),
      causa:
        estado === 'resolvida' || estado === 'devolvida ao cliente'
          ? escolha(rnd, [
              'regra de alçada apertada para o perfil do lojista',
              'divergência de cadastro entre pedido e ERP',
              'lojista sem contato financeiro atualizado',
              'contestação comercial — encaminhada ao representante',
            ])
          : null,
      resolucao:
        estado === 'resolvida'
          ? escolha(rnd, [
              'acordo fechado dentro da alçada',
              'pagamento confirmado após conversa',
              'transferido ao representante comercial',
              'cadastro corrigido e cobrança retomada',
            ])
          : estado === 'devolvida ao cliente'
            ? 'aguardando definição do cliente'
            : null,
      regraSugerida:
        estado === 'resolvida' && chance(rnd, 0.22)
          ? 'permitir parcelamento em uma parcela extra para rating A e B'
          : null,
      conversa: conversaPara(motivo, lojista.nome),
    });
  }

  // Agregados e rating por lojista.
  for (const l of lojistas) {
    const doLojista = titulos.filter((t) => t.lojistaId === l.id);
    const abertos = doLojista.filter((t) => !['pago', 'cancelado'].includes(t.estado));
    l.titulosAbertos = abertos.length;
    l.valorAberto = Math.round(abertos.reduce((s, t) => s + t.valor, 0));
    l.valorVencido = Math.round(
      abertos.filter((t) => t.estado !== 'a vencer').reduce((s, t) => s + t.valor, 0),
    );

    const encerradosOuVencidos = doLojista.filter((t) => t.estado !== 'a vencer');
    const somaValor = encerradosOuVencidos.reduce((s, t) => s + t.valor, 0) || 1;
    const somaAtrasoPonderado = encerradosOuVencidos.reduce((s, t) => {
      const atraso = t.pagoEm ? Math.max(0, difDias(t.pagoEm, t.vencimento)) : t.diasAtraso;
      return s + atraso * t.valor;
    }, 0);
    const comAtraso = encerradosOuVencidos.filter(
      (t) => (t.pagoEm ? difDias(t.pagoEm, t.vencimento) > 0 : t.diasAtraso > 0),
    ).length;
    const promDoLojista = promessas.filter((p) => p.lojistaId === l.id && p.cumprida !== null);
    const excDoLojista = excecoes.filter((e) => e.lojistaId === l.id).length;

    const r = calcularRating({
      titulosTotais: doLojista.length,
      diasMediosAtrasoPonderado: somaAtrasoPonderado / somaValor,
      horasMediasResposta: perfis.get(l.id)!.horasResp,
      promessasFeitas: promDoLojista.length,
      promessasCumpridas: promDoLojista.filter((p) => p.cumprida).length,
      pctTitulosComAtraso: (comAtraso / Math.max(1, encerradosOuVencidos.length)) * 100,
      excecoesPorTitulo: excDoLojista / Math.max(1, doLojista.length),
    });
    l.rating = r.letra;
    l.ratingTotal = r.total;
    l.ratingDetalhe = r.detalhe;
    l.ratingNovo = r.novo;
  }

  for (const t of titulos) t.etapaAtual = etapaAtualDoTitulo(acoes, t);

  // Score Sentinella da carteira (0–100): índice interno da Fase 1 (§3),
  // composto de conformidade com a política (25%), pagamento em dia entre os
  // pagos (30%), promessas cumpridas (15%), exceções por mil títulos (15%) e
  // atraso acima de 60 dias (15%).
  const pagos = titulos.filter((t) => t.estado === 'pago');
  const emDia = pagos.filter((t) => t.pagoEm && difDias(t.pagoEm, t.vencimento) <= 0).length;
  const promAval = promessas.filter((p) => p.cumprida !== null);
  const pctEmDia = emDia / Math.max(1, pagos.length);
  const pctProm = promAval.length ? promAval.filter((p) => p.cumprida).length / promAval.length : 0.7;
  const excPorMil = (excecoes.length / Math.max(1, titulos.length)) * 1000;
  const pctAtraso60 =
    titulos.filter((t) => t.diasAtraso > 60).length / Math.max(1, titulos.length);
  const conformidade =
    1 - acoes.filter((a) => a.estado === 'bloqueada').length / Math.max(1, acoes.length);
  const score = Math.round(
    25 * conformidade +
      30 * pctEmDia +
      15 * pctProm +
      15 * Math.max(0, 1 - excPorMil / 80) +
      15 * Math.max(0, 1 - pctAtraso60 / 0.15),
  );
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesAtual = Number(hoje.slice(5, 7)) - 1;
  const evolucao = [3, 2, 1, 0].map((atras, i) => ({
    mes: meses[(mesAtual - atras + 12) % 12],
    valor: Math.max(20, Math.min(99, score - inteiro(rnd, 0, 3) * (3 - i))),
  }));
  evolucao[3].valor = score;

  // Portal do lojista: só os dados daquele lojista, com juros do contrato.
  for (const l of lojistas) {
    const abertos = titulos.filter(
      (t) => t.lojistaId === l.id && !['pago', 'cancelado'].includes(t.estado),
    );
    if (!abertos.length) continue;
    const entrada: EntradaPortal = {
      lojista: { nome: l.nome, cnpj: l.cnpj, contatoNome: l.contatoNome },
      industria: {
        nome: c.nome,
        canais: c.canais,
        temMultaCadastrada: c.multaPct != null,
        alcada: {
          descontoMaxPct: c.alcada.descontoMaxPct,
          parcelasMax: c.alcada.parcelasMax,
          prazoMaxDias: c.alcada.prazoMaxDias,
        },
      },
      titulosAbertos: abertos.map((t) => {
        const multa = c.multaPct != null && t.diasAtraso > 0 ? (t.valor * c.multaPct) / 100 : null;
        const juros =
          c.jurosMesPct != null && t.diasAtraso > 0
            ? ((t.valor * c.jurosMesPct) / 100 / 30) * t.diasAtraso
            : null;
        return {
          numero: t.numero,
          valor: t.valor,
          vencimento: t.vencimento,
          diasAtraso: t.diasAtraso,
          multa: multa != null ? Math.round(multa * 100) / 100 : null,
          juros: juros != null ? Math.round(juros * 100) / 100 : null,
          total: Math.round((t.valor + (multa ?? 0) + (juros ?? 0)) * 100) / 100,
          estado: t.estado,
        };
      }),
      titulosPagos: titulos
        .filter((t) => t.lojistaId === l.id && t.estado === 'pago')
        .slice(-5)
        .map((t) => ({ numero: t.numero, valor: t.valor, pagoEm: t.pagoEm! })),
      acordos: acordos
        .filter((a) => a.lojistaId === l.id)
        .map((a) => ({
          valorTotal: a.valorTotal,
          parcelas: a.parcelas,
          parcelasPagas: a.parcelasPagas,
          status: a.status,
        })),
    };
    portal[l.token] = entrada;
  }

  // Um lojista de exemplo por cliente para a home do portal.
  const exemplo = lojistas
    .filter((l) => l.valorVencido > 0 && portal[l.token])
    .sort((a, b) => b.valorVencido - a.valorVencido)[0];
  if (exemplo)
    tokensExemplo.push({ token: exemplo.token, lojista: exemplo.nome, industria: c.nome });

  const { qtdLojistas, qtdTitulos, ...cliente } = c;
  return {
    cliente,
    lojistas,
    titulos,
    acoes,
    excecoes,
    acordos,
    autorizacoes,
    promessas,
    score: { total: score, evolucao },
  };
}

// ------------------------------------------------------------------- saída

const porCliente = CLIENTES.map(gerarCliente);

const indice: IndiceSeed = {
  geradoEm: new Date().toISOString(),
  hoje,
  clientes: CLIENTES.map(({ id, nome, plano, cidade: cid, setor }) => ({
    id, nome, plano, cidade: cid, setor,
  })),
  analistas: ANALISTAS,
  tokensExemplo,
};

const destinos = [
  join(raiz, 'apps', 'painel', 'public', 'dados'),
  join(raiz, 'apps', 'portal', 'public', 'dados'),
];
for (const destino of destinos) mkdirSync(destino, { recursive: true });

writeFileSync(join(destinos[0], 'indice.json'), JSON.stringify(indice));
for (const d of porCliente)
  writeFileSync(join(destinos[0], `${d.cliente.id}.json`), JSON.stringify(d));
writeFileSync(join(destinos[1], 'portal.json'), JSON.stringify(portal));
writeFileSync(
  join(destinos[1], 'exemplos.json'),
  JSON.stringify({ hoje, tokensExemplo }),
);

const totalTitulos = porCliente.reduce((s, d) => s + d.titulos.length, 0);
const totalLojistas = porCliente.reduce((s, d) => s + d.lojistas.length, 0);
const totalAcoes = porCliente.reduce((s, d) => s + d.acoes.length, 0);
console.log(
  `Seed gerado (hoje=${hoje}): ${porCliente.length} clientes · ${totalLojistas} lojistas · ` +
    `${totalTitulos} títulos · ${totalAcoes} ações · ` +
    `${porCliente.reduce((s, d) => s + d.excecoes.length, 0)} exceções · ` +
    `${Object.keys(portal).length} acessos de portal`,
);
for (const d of porCliente)
  console.log(
    `  ${d.cliente.id} ${d.cliente.plano}: score ${d.score.total} · ` +
      `${d.titulos.filter((t) => t.estado === 'vencido').length} vencidos · ` +
      `${d.titulos.filter((t) => t.estado === 'fora da régua').length} fora da régua · ` +
      `${d.autorizacoes.filter((a) => a.status === 'pendente').length} autorizações pendentes`,
  );
