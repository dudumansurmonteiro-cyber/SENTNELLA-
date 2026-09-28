'use client';

// Agenda de ligações do dia (§7.4): por cliente, com roteiro do plano e
// campo de registro (atendida, não atendida, promessa).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DadosCliente } from '@sentinella/dados';
import { dataBr, difDias, moedaCurta } from '@sentinella/dados';
import { Carregando, carregarTodos, useDados } from '../../../lib/contexto';
import { Secao } from '../../../lib/ui';

const RESULTADOS = ['atendida', 'atendida — promessa de pagamento', 'não atendida'];

export default function Ligacoes() {
  const { indice } = useDados();
  const [todos, setTodos] = useState<DadosCliente[] | null>(null);
  const [registros, setRegistros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (indice) carregarTodos(indice.clientes.map((c) => c.id)).then(setTodos);
  }, [indice]);

  if (!indice || !todos) return <Carregando />;
  const hoje = indice.hoje;

  return (
    <>
      <p className="text-[13px]"><Link href="/console/">← Fila de exceções</Link></p>
      <h1 className="fonte-titulo mt-1 text-[22px] font-semibold">
        Agenda de ligações <span className="suave text-[14px] font-normal">· {dataBr(hoje)} e próximos dias</span>
      </h1>
      <p className="suave mt-1 text-[13.5px]">
        Janela permitida: dias úteis 8h–20h, sábado 8h–14h · uma ligação por dia por devedor ·
        aviso de gravação no início · sempre com o responsável financeiro ou sócio.
      </p>

      {todos.map((d) => {
        const agenda = d.acoes
          .filter(
            (a) =>
              a.quem === 'analista' &&
              ['agendada', 'em andamento', 'não atendida'].includes(a.estado) &&
              difDias(a.data, hoje) >= -1 &&
              difDias(a.data, hoje) <= 4,
          )
          .sort((a, b) => a.data.localeCompare(b.data))
          .slice(0, 8);
        if (!agenda.length) return null;
        const roteiro =
          d.cliente.plano === 'Max'
            ? 'Roteiro Max: confirmar responsável · gravação avisada · relembrar acordo aberto · oferecer parcelamento dentro da alçada ampliada · registrar promessa com data.'
            : 'Roteiro padrão: confirmar responsável · gravação avisada · 2ª via na mão · oferecer acordo dentro da alçada · registrar promessa com data.';
        return (
          <Secao key={d.cliente.id} titulo={`${d.cliente.nome.replace(' (fictícia)', '')} · plano ${d.cliente.plano}`}>
            <p className="nota-demo mb-2">{roteiro}</p>
            <div className="overflow-x-auto">
              <table className="tab">
                <thead>
                  <tr>
                    <th>Data</th><th>Lojista</th><th className="num">Valor do título</th>
                    <th>Etapa</th><th>Registro (demo)</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.map((a) => {
                    const lojista = d.lojistas.find((l) => l.id === a.lojistaId)!;
                    const titulo = d.titulos.find((t) => t.id === a.tituloId)!;
                    return (
                      <tr key={a.id}>
                        <td className="suave">{dataBr(a.data)}</td>
                        <td>{lojista.nome} <span className="suave">({lojista.contatoNome})</span></td>
                        <td className="num font-medium">{moedaCurta(titulo.valor)}</td>
                        <td className="suave">{a.etapa}{a.estado === 'não atendida' ? ' · retentativa' : ''}</td>
                        <td>
                          <select
                            className="campo-select"
                            value={registros[a.id] ?? ''}
                            onChange={(e) => setRegistros((r) => ({ ...r, [a.id]: e.target.value }))}
                            aria-label={`Registrar resultado da ligação para ${lojista.nome}`}
                          >
                            <option value="" disabled>registrar…</option>
                            {RESULTADOS.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Secao>
        );
      })}
      {Object.keys(registros).length > 0 && (
        <p className="nota-demo mt-3">
          {Object.keys(registros).length} ligação(ões) registrada(s) nesta demonstração — em
          produção, promessas entram na régua e no rating do lojista.
        </p>
      )}
    </>
  );
}
