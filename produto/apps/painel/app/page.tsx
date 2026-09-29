'use client';

// Visão geral (§7.2a): totais, atraso por faixa, DSO, promessas e Score.

import Link from 'next/link';
import { moedaCompacta, moedaCurta, pct } from '@sentinella/dados';
import { Carregando, useDados } from '../lib/contexto';
import { visaoGeral, recuperadoPorSemana, dezMaiores, distribuicaoRating } from '../lib/metricas';
import { BarraLinha, Colunas, Kpi, Secao, Selo } from '../lib/ui';

export default function VisaoGeral() {
  const { dados, indice } = useDados();
  if (!dados || !indice) return <Carregando />;
  const hoje = indice.hoje;
  const v = visaoGeral(dados, hoje);
  const semanas = recuperadoPorSemana(dados, hoje);
  const top = dezMaiores(dados).slice(0, 5);
  const dist = distribuicaoRating(dados);
  const maxFaixa = Math.max(1, ...v.faixas.map((f) => f.valor));
  const plano = dados.cliente.plano;

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">
        {dados.cliente.nome}
        <span className="suave ml-2 text-[14px] font-normal">
          plano {plano} · {dados.cliente.setor} · {dados.cliente.cidade}
        </span>
      </h1>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Total a receber" valor={moedaCompacta(v.totalAReceber)} detalhe={`${v.qtdAbertos} títulos ativos`} />
        <Kpi rotulo="Total em atraso" valor={moedaCompacta(v.totalEmAtraso)} detalhe={`${v.qtdEmAtraso} títulos vencidos`} />
        <Kpi rotulo="Recebido no mês" valor={moedaCompacta(v.recebidoNoMes)} detalhe={`recuperado após atraso: ${moedaCompacta(v.recuperadoNoMes)}`} />
        <Kpi rotulo="Score Sentinella" valor={`${dados.score.total}/100`} detalhe="saúde da carteira" destaque />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Atraso por faixa">
          {v.faixas.map((f) => (
            <BarraLinha
              key={f.rotulo}
              rotulo={f.rotulo}
              valorTexto={moedaCompacta(f.valor)}
              fracao={f.valor / maxFaixa}
            />
          ))}
          <p className="suave mt-2 text-[12.5px]">
            {v.faixas.reduce((s, f) => s + f.qtd, 0)} títulos em atraso ·
            prazo médio de recebimento (DSO): <b className="font-medium">{v.dso} dias</b> ·
            pagos até o vencimento: <b className="font-medium">{pct(v.pctPagosEmDia)}</b> ·
            promessas cumpridas: <b className="font-medium">{pct(v.pctPromessas)}</b>
          </p>
        </Secao>

        <Secao titulo="Recuperado após atraso, por semana">
          <Colunas dados={semanas.map((s) => ({ rotulo: s.rotulo, valor: s.valor }))} formato={moedaCompacta} />
          <div className="mt-3 flex items-center gap-3">
            <span className="suave text-[12.5px]">Score Sentinella nos últimos meses:</span>
            {dados.score.evolucao.map((e) => (
              <span key={e.mes} className="chip">{e.mes} · {e.valor}</span>
            ))}
          </div>
        </Secao>
      </div>

      <Secao
        titulo="Os cinco maiores valores em atraso"
        acao={<Link href="/devedores/" className="text-[13px]">ver os dez e a lista completa</Link>}
      >
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Lojista</th><th className="num">Valor</th><th className="num">Dias</th>
                <th>Rating</th><th>Etapa da régua</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ titulo, lojista }) => (
                <tr key={titulo.id}>
                  <td>
                    <Link href={`/devedores/ficha/?l=${lojista.id}`}>{lojista.nome}</Link>
                  </td>
                  <td className="num font-medium">{moedaCurta(titulo.valor)}</td>
                  <td className="num">{titulo.diasAtraso}</td>
                  <td><Selo letra={lojista.rating} /></td>
                  <td className="suave">{titulo.etapaAtual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Carteira por rating">
        <div className="flex flex-wrap items-center gap-4">
          {dist.map((d) => (
            <span key={d.letra} className="flex items-center gap-2 text-[13.5px]">
              <Selo letra={d.letra} /> {d.qtd} lojistas
            </span>
          ))}
          <span className="suave text-[12.5px]">
            recalculado todo mês · nunca mostrado ao lojista
          </span>
        </div>
      </Secao>

      {plano === 'Básico' && (
        <p className="nota-demo mt-4">
          {dados.titulos.filter((t) => t.estado === 'fora da régua').length} títulos passaram do
          D+15 e estão <b>fora da régua</b> do plano Básico. No Avançado, eles seguiriam para
          notificação, protesto e jurídico.
        </p>
      )}
    </>
  );
}
