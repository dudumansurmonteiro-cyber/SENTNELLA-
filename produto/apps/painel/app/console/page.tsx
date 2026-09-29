'use client';

// Console do analista (§7.4): fila de exceções com cronômetro do SLA,
// ordenada por valor e tempo, através dos clientes do analista.

import { L } from '../../lib/raiz';
import { useEffect, useState } from 'react';
import type { DadosCliente } from '@sentinella/dados';
import { cronometro, moedaCurta } from '@sentinella/dados';
import { Carregando, carregarTodos, useDados } from '../../lib/contexto';
import { Secao } from '../../lib/ui';

export default function Console() {
  const { indice } = useDados();
  const [todos, setTodos] = useState<DadosCliente[] | null>(null);
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    if (indice) carregarTodos(indice.clientes.map((c) => c.id)).then(setTodos);
  }, [indice]);

  useEffect(() => {
    const t = setInterval(() => setAgora((a) => a + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!indice || !todos) return <Carregando />;

  const fila = todos
    .flatMap((d) =>
      d.excecoes
        .filter((e) => e.estado === 'aberta' || e.estado === 'em atendimento')
        .map((e) => ({
          e,
          cliente: d.cliente,
          lojista: d.lojistas.find((l) => l.id === e.lojistaId)!,
        })),
    )
    .sort(
      (a, b) =>
        Number(b.e.estado === 'aberta') - Number(a.e.estado === 'aberta') ||
        b.e.valorEnvolvido - a.e.valorEnvolvido ||
        b.e.abertaMinAtras - a.e.abertaMinAtras,
    );

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Fila de exceções</h1>
      <p className="suave mt-1 text-[13.5px]">
        Ordenada por valor e tempo. SLA de resposta: 15 min (Básico e Avançado) · 5 min (Max).
      </p>

      <Secao titulo={`Aguardando ou em atendimento (${fila.length})`}>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Cronômetro</th><th>Motivo</th><th>Lojista</th><th>Cliente</th>
                <th className="num">Valor</th><th>Situação</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fila.map(({ e, cliente, lojista }) => {
                const seg = e.abertaMinAtras * 60 + agora;
                const estourado = e.estado === 'aberta' && seg > e.slaMin * 60;
                return (
                  <tr key={e.id}>
                    <td>
                      {e.estado === 'aberta' ? (
                        <>
                          <span
                            className={`fonte-titulo text-[16px] font-semibold ${estourado ? 'sinal-txt' : ''}`}
                            aria-label={`aberta há ${Math.floor(seg / 60)} minutos, SLA de ${e.slaMin} minutos`}
                          >
                            {cronometro(seg)}
                          </span>
                          <span className="suave ml-1 text-[11.5px]">/ {e.slaMin} min</span>
                        </>
                      ) : (
                        <span className="suave text-[12.5px]">
                          assumida em {e.tempoAteAssumirMin} min
                        </span>
                      )}
                    </td>
                    <td className={e.estado === 'aberta' ? 'sinal-txt font-medium' : ''}>{e.motivo}</td>
                    <td>{lojista.nome}</td>
                    <td className="suave">{cliente.nome.replace(' (fictícia)', '')} · {cliente.plano}</td>
                    <td className="num font-medium">{moedaCurta(e.valorEnvolvido)}</td>
                    <td className="suave">
                      {e.estado === 'aberta' ? 'aguardando analista' : `${e.assumidaPor} atuando`}
                    </td>
                    <td>
                      <L className="botao botao-sec" para={`console/atender/?e=${e.id}&c=${cliente.id}`}>
                        {e.estado === 'aberta' ? 'assumir' : 'abrir'}
                      </L>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-3">
        {todos.map((d) => {
          const abertas = d.excecoes.filter((x) => x.estado === 'aberta').length;
          const ligPend = d.acoes.filter(
            (a) => a.quem === 'analista' && ['agendada', 'não atendida', 'em andamento'].includes(a.estado),
          ).length;
          const parados = d.titulos.filter((t) => t.diasAtraso > 30 && !['pago', 'cancelado'].includes(t.estado)).length;
          return (
            <Secao key={d.cliente.id} titulo={d.cliente.nome.replace(' (fictícia)', '')}>
              <ul className="text-[13.5px] leading-7">
                <li>{abertas} exceções abertas</li>
                <li>{ligPend} ligações pendentes</li>
                <li>{parados} títulos parados há mais de 30 dias</li>
              </ul>
            </Secao>
          );
        })}
      </div>

      <p className="mt-4 text-[13.5px]">
        <L para="console/ligacoes/">Agenda de ligações do dia</L> ·{' '}
        <L para="console/coordenacao/">Visão do coordenador</L>
      </p>
    </>
  );
}
