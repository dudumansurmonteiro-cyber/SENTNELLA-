'use client';

// Visão do coordenador (§7.4): carga por analista, SLA cumprido, incidentes
// por causa e sugestões de regra pendentes.

import { L } from '../../../lib/raiz';
import { useEffect, useState } from 'react';
import type { DadosCliente } from '@sentinella/dados';
import { pct } from '@sentinella/dados';
import { Carregando, carregarTodos, useDados } from '../../../lib/contexto';
import { Kpi, Secao } from '../../../lib/ui';

export default function Coordenacao() {
  const { indice } = useDados();
  const [todos, setTodos] = useState<DadosCliente[] | null>(null);

  useEffect(() => {
    if (indice) carregarTodos(indice.clientes.map((c) => c.id)).then(setTodos);
  }, [indice]);

  if (!indice || !todos) return <Carregando />;

  const excecoes = todos.flatMap((d) => d.excecoes);
  const atendidas = excecoes.filter((e) => e.tempoAteAssumirMin != null);
  const dentroSla = atendidas.filter((e) => e.tempoAteAssumirMin! <= e.slaMin);
  const tempoMedio = atendidas.length
    ? atendidas.reduce((s, e) => s + e.tempoAteAssumirMin!, 0) / atendidas.length
    : 0;

  const porCausa = new Map<string, number>();
  for (const e of excecoes)
    if (e.causa) porCausa.set(e.causa, (porCausa.get(e.causa) ?? 0) + 1);

  const sugestoes = excecoes.filter((e) => e.regraSugerida);

  return (
    <>
      <p className="text-[13px]"><L para="console/">← Fila de exceções</L></p>
      <h1 className="fonte-titulo mt-1 text-[22px] font-semibold">Visão do coordenador</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Exceções no período" valor={String(excecoes.length)} />
        <Kpi rotulo="SLA cumprido" valor={pct(atendidas.length ? (dentroSla.length / atendidas.length) * 100 : 0)} detalhe={`${dentroSla.length} de ${atendidas.length} dentro do prazo`} destaque />
        <Kpi rotulo="Tempo médio até assumir" valor={`${tempoMedio.toFixed(1).replace('.', ',')} min`} />
        <Kpi rotulo="Sugestões de regra pendentes" valor={String(sugestoes.length)} />
      </div>

      <Secao titulo="Carga por analista">
        <table className="tab">
          <thead>
            <tr><th>Analista</th><th>Turno</th><th className="num">Exceções assumidas</th><th className="num">Clientes</th></tr>
          </thead>
          <tbody>
            {indice.analistas.map((an) => {
              const doAnalista = excecoes.filter((e) => e.assumidaPor === an.nome);
              return (
                <tr key={an.id}>
                  <td className="font-medium">{an.nome}</td>
                  <td className="suave">{an.turno}</td>
                  <td className="num">{doAnalista.length}</td>
                  <td className="num">{an.clienteIds.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="suave mt-2 text-[12.5px]">
          Premissa da operação: um analista para cada cinco clientes, com no mínimo dois analistas
          cobrindo 8h–22h em dois turnos.
        </p>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Incidentes por causa">
          {[...porCausa.entries()].sort((a, b) => b[1] - a[1]).map(([causa, qtd]) => (
            <p key={causa} className="flex justify-between border-b py-1.5 text-[13.5px]" style={{ borderColor: 'var(--line-soft)' }}>
              <span>{causa}</span><b>{qtd}</b>
            </p>
          ))}
        </Secao>

        <Secao titulo="Sugestões de regra (para aprovar com o cliente)">
          {sugestoes.map((e) => {
            const cliente = todos.find((d) => d.cliente.id === e.clienteId)!.cliente;
            return (
              <p key={e.id} className="border-b py-1.5 text-[13.5px]" style={{ borderColor: 'var(--line-soft)' }}>
                <span className="sinal-txt">“{e.regraSugerida}”</span>
                <span className="suave"> — a partir de incidente em {cliente.nome.replace(' (fictícia)', '')}</span>
              </p>
            );
          })}
          {sugestoes.length === 0 && <p className="suave text-[13px]">Nenhuma pendente.</p>}
        </Secao>
      </div>
    </>
  );
}
