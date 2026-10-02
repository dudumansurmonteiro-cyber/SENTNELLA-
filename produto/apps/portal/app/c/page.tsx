'use client';

// Portal do credor: o que o credor vê da carteira entregue ao escritório —
// recuperação, faixas de entrada, eficiência por etapa e o rating médio da
// base (o rating é permitido ao credor; nunca ao devedor). O relatório
// mensal sai pelo botão de imprimir.

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { L, raizApp } from '../../lib/raiz';
import { dataLonga, moedaCompacta, moedaCurta, pct } from '@sentinella/dados';
import type { EntradaPortalCredor, PortalCredores } from '@sentinella/dados';

const iniciaisDe = (nome: string) =>
  nome.split(' ').filter((p) => p[0] === p[0]?.toUpperCase()).slice(0, 2).map((p) => p[0]).join('');

function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="cartao px-4 py-3">
      <div className="suave text-[12.5px]">{rotulo}</div>
      <div className="fonte-titulo mt-0.5 text-[24px] font-semibold" style={{ color: 'var(--link)' }}>
        {valor}
      </div>
      {detalhe && <div className="suave text-[12.5px]">{detalhe}</div>}
    </div>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';
  const [todos, setTodos] = useState<PortalCredores | null>(null);

  useEffect(() => {
    fetch(`${raizApp()}dados/credores.json`).then((r) => r.json()).then(setTodos);
  }, []);

  const entrada: EntradaPortalCredor | undefined = todos?.[token];

  const totais = useMemo(() => {
    if (!entrada) return null;
    const soma = (f: (c: EntradaPortalCredor['carteiras'][number]) => number) =>
      entrada.carteiras.reduce((s, c) => s + f(c), 0);
    const entregue = soma((c) => c.valorEntregue);
    const recuperado = soma((c) => c.recuperadoAcumulado);
    return {
      entregue,
      recuperado,
      taxa: entregue ? (recuperado / entregue) * 100 : 0,
      mes: soma((c) => c.recuperadoMes),
      aberto: soma((c) => c.valorAberto),
      acordos: soma((c) => c.acordosVigentes),
      previsao: soma((c) => c.previsaoAcordos),
      devedores: soma((c) => c.qtdDevedores),
      titulos: soma((c) => c.qtdTitulos),
    };
  }, [entrada]);

  if (!todos) return <main className="container-g pt-10"><p className="suave">Carregando…</p></main>;
  if (!entrada || !totais) {
    return (
      <main className="container-g pt-10">
        <h1 className="fonte-titulo text-[20px] font-semibold">Acesso não encontrado</h1>
        <p className="suave mt-2">
          Confira o código recebido ou use um <L para="">acesso de exemplo</L>.
        </p>
      </main>
    );
  }

  const esc = entrada.escritorio;

  return (
    <>
      <style>{`
        :root{--primary:${esc.corPrimaria};--link:${esc.corPrimaria};--on-primary:#ffffff}
        @media (prefers-color-scheme:dark){:root{--primary:${esc.corClara};--link:${esc.corClara};--on-primary:#14211f}}
      `}</style>

      <header style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
        <div className="container-g flex flex-wrap items-center gap-3 py-3.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[13.5px] font-semibold"
            style={{ background: 'var(--on-primary)', color: 'var(--primary)' }}
          >
            {iniciaisDe(esc.nomeExibicao)}
          </span>
          <div className="mr-auto">
            <b className="fonte-titulo block text-[16.5px] leading-tight">{esc.nomeExibicao}</b>
            <span className="text-[12px]" style={{ opacity: 0.85 }}>
              {esc.oab} · portal do credor
            </span>
          </div>
          <button
            type="button"
            className="botao nao-imprime"
            style={{ background: 'var(--on-primary)', color: 'var(--primary)', borderColor: 'var(--on-primary)' }}
            onClick={() => window.print()}
          >
            Imprimir relatório mensal
          </button>
        </div>
      </header>

      <main className="container-g pb-16 pt-6">
        <h1 className="fonte-titulo text-[21px] font-semibold leading-tight">
          {entrada.credor.nome}
        </h1>
        <p className="suave mt-1 text-[13.5px]">
          Relatório da carteira em cobrança · {dataLonga(entrada.hoje)} · contato:{' '}
          {entrada.credor.contatoNome}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi rotulo="Entregue ao escritório" valor={moedaCompacta(totais.entregue)}
            detalhe={`${totais.titulos.toLocaleString('pt-BR')} títulos · ${totais.devedores.toLocaleString('pt-BR')} devedores`} />
          <Kpi rotulo="Recuperado (90 dias)" valor={moedaCompacta(totais.recuperado)}
            detalhe={`${pct(totais.taxa)} do entregue`} />
          <Kpi rotulo="Recuperado no mês" valor={moedaCompacta(totais.mes)} />
          <Kpi rotulo="Em aberto" valor={moedaCompacta(totais.aberto)} />
          <Kpi rotulo="Acordos vigentes" valor={String(totais.acordos)}
            detalhe={`${moedaCompacta(totais.previsao)} a receber`} />
          <Kpi rotulo="Carteiras" valor={String(entrada.carteiras.length)} />
        </div>

        {entrada.carteiras.map((c) => {
          const taxa = c.valorEntregue ? (c.recuperadoAcumulado / c.valorEntregue) * 100 : 0;
          const maiorFaixa = Math.max(1, ...c.faixasEntrada.map((f) => f.valor));
          const maiorSemana = Math.max(1, ...c.recuperadoPorSemana.map((s) => s.valor));
          const totalRating = Math.max(1, c.distribuicaoRating.reduce((s, d) => s + d.qtd, 0));
          return (
            <section key={c.nome} className="cartao mt-5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="fonte-titulo text-[17px] font-semibold">{c.nome}</h2>
                <span className="suave text-[12.5px]">
                  {c.tipo} · {c.qtdDevedores.toLocaleString('pt-BR')} devedores ·{' '}
                  {c.qtdTitulos.toLocaleString('pt-BR')} títulos
                </span>
              </div>

              <div className="mt-3 grid gap-5 md:grid-cols-3">
                <div>
                  <p className="text-[13.5px]">
                    Recuperado <b>{moedaCurta(c.recuperadoAcumulado)}</b> ({pct(taxa)})
                    <span className="suave"> de {moedaCurta(c.valorEntregue)}</span>
                  </p>
                  <div className="barra mt-1.5" role="img" aria-label={`Taxa de recuperação ${pct(taxa)}`}>
                    <i style={{ width: `${Math.min(100, taxa)}%` }} />
                  </div>
                  <p className="suave mt-2 text-[12.5px]">
                    No mês: {moedaCurta(c.recuperadoMes)} · acordos vigentes: {c.acordosVigentes}{' '}
                    ({moedaCurta(c.previsaoAcordos)} a receber)
                  </p>
                  <p className="mt-2 text-[12.5px]">
                    Base por rating:{' '}
                    {c.distribuicaoRating.map((d) => (
                      <span key={d.letra} className="suave">
                        {d.letra} {pct((d.qtd / totalRating) * 100)}{' '}
                      </span>
                    ))}
                    <span className="suave">· médio {c.ratingMedio}</span>
                  </p>
                </div>

                <div>
                  <b className="text-[12.5px]">Entrada por faixa de atraso</b>
                  {c.faixasEntrada.map((f) => (
                    <div key={f.rotulo} className="mt-1 flex items-center gap-2 text-[12.5px]">
                      <span className="suave w-24 shrink-0">{f.rotulo} dias</span>
                      <div className="barra flex-1" role="img" aria-label={`${f.rotulo}: ${moedaCurta(f.valor)}`}>
                        <i style={{ width: `${Math.max(2, (f.valor / maiorFaixa) * 100)}%` }} />
                      </div>
                      <span className="num w-20 shrink-0 text-right">{moedaCompacta(f.valor)}</span>
                    </div>
                  ))}
                  <b className="mt-3 block text-[12.5px]">Recuperado por semana</b>
                  <div className="mt-1 flex items-end gap-1" aria-hidden="true">
                    {c.recuperadoPorSemana.map((s) => (
                      <i key={s.rotulo} title={`${s.rotulo}: ${moedaCurta(s.valor)}`}
                        style={{ display: 'block', width: 24, height: Math.max(3, (s.valor / maiorSemana) * 40), background: 'var(--primary)', borderRadius: '2px 2px 0 0' }} />
                    ))}
                  </div>
                </div>

                <div>
                  <b className="text-[12.5px]">Eficiência por etapa (E = dias desde a entrada)</b>
                  <table className="tab mt-1">
                    <thead>
                      <tr><th>Etapa</th><th className="num">Ações</th><th className="num">Conversão</th></tr>
                    </thead>
                    <tbody>
                      {c.eficienciaEtapa.slice(0, 7).map((e) => (
                        <tr key={e.etapa}>
                          <td>{e.etapa}</td>
                          <td className="num">{e.acoes.toLocaleString('pt-BR')}</td>
                          <td className="num">{pct(e.conversao, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })}

        <p className="nota mt-5">
          Valores recuperados caem direto na sua conta (ou na do escritório, conforme o contrato) —
          a plataforma não intermedeia pagamentos. Rating e classificações são instrumentos de
          gestão entre você e o escritório; o devedor nunca os vê.
        </p>
      </main>

      <footer style={{ borderTop: '1px solid var(--line-soft)' }}>
        <div className="container-g suave py-4 text-[12px]">
          {esc.nomeExibicao} · {esc.oab}
          {esc.mostrarOperadora && <> · plataforma operada por Sentinella</>}
          · Demonstração com dados fictícios.
        </div>
      </footer>
    </>
  );
}

export default function PortalCredor() {
  return (
    <Suspense fallback={<main className="container-g pt-10"><p className="suave">Carregando…</p></main>}>
      <Conteudo />
    </Suspense>
  );
}
