'use client';

// Console da operação (Sentinella): fila de exceções do escritório ativo,
// com cronômetro de SLA. O analista troca de escritório no topo — a faixa
// colorida diz em nome de quem ele fala. No plano Básico a mesa é do próprio
// escritório e o console fica em modo de leitura.

import { L } from '../../lib/raiz';
import { useEffect, useState } from 'react';
import { cronometro, moedaCurta } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { Secao } from '../../lib/ui';

export default function Console() {
  const { indice, dados, escritorioId, trocarEscritorio } = useDados();
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAgora((a) => a + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!indice || !dados) return <Carregando />;

  const mesaPropria = dados.escritorio.slaMin == null;
  const analistas = indice.analistas.filter((a) => a.escritorioIds.includes(escritorioId));
  const fila = dados.excecoes
    .filter((e) => e.estado === 'aberta' || e.estado === 'em atendimento')
    .sort(
      (a, b) =>
        Number(b.estado === 'aberta') - Number(a.estado === 'aberta') ||
        b.valorEnvolvido - a.valorEnvolvido ||
        b.abertaMinAtras - a.abertaMinAtras,
    );
  const nomeDev = (id: string) => dados.devedores.find((d) => d.id === id)?.nome ?? id;

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Fila de exceções</h1>
      <p className="suave mt-1 text-[13.5px]">
        {mesaPropria ? (
          <>Plano Básico: os negociadores do próprio escritório atendem — aqui a Sentinella
          acompanha em modo de leitura.</>
        ) : (
          <>Mesa Sentinella em nome do escritório · analistas: {analistas.map((a) => `${a.nome} (${a.turno})`).join(' · ') || '—'}</>
        )}
      </p>

      <Secao titulo={`Aguardando ou em atendimento (${fila.length})`}>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Cronômetro</th><th>Motivo</th><th>Devedor</th>
                <th className="num">Valor</th><th>Situação</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fila.map((e) => {
                const seg = e.abertaMinAtras * 60 + agora;
                const estourado = e.estado === 'aberta' && e.slaMin != null && seg > e.slaMin * 60;
                return (
                  <tr key={e.id}>
                    <td>
                      {e.estado === 'aberta' ? (
                        <>
                          <span
                            className={`fonte-titulo text-[16px] font-semibold ${estourado ? 'sinal-txt' : ''}`}
                            aria-label={`aberta há ${Math.floor(seg / 60)} minutos${e.slaMin != null ? `, SLA de ${e.slaMin} minutos` : ''}`}
                          >
                            {cronometro(seg)}
                          </span>
                          <span className="suave ml-1 text-[11.5px]">
                            {e.slaMin != null ? `/ ${e.slaMin} min` : 'sem SLA Sentinella'}
                          </span>
                        </>
                      ) : (
                        <span className="suave text-[12.5px]">assumida em {e.tempoAteAssumirMin} min</span>
                      )}
                    </td>
                    <td className={e.estado === 'aberta' ? 'sinal-txt font-medium' : ''}>{e.motivo}</td>
                    <td>{nomeDev(e.devedorId)}</td>
                    <td className="num font-medium">{moedaCurta(e.valorEnvolvido)}</td>
                    <td className="suave">
                      {e.estado === 'aberta'
                        ? mesaPropria ? 'aguardando negociador do escritório' : 'aguardando analista'
                        : `${e.assumidaPor} atuando`}
                    </td>
                    <td>
                      <L className="botao botao-sec" para={`console/atender/?e=${e.id}`}>
                        {e.estado === 'aberta' && !mesaPropria ? 'assumir' : 'abrir'}
                      </L>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Outros escritórios da operação">
        <div className="flex flex-wrap gap-2.5">
          {indice.escritorios
            .filter((e) => e.id !== escritorioId)
            .map((e) => (
              <button
                key={e.id}
                type="button"
                className="cartao flex cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13.5px]"
                onClick={() => trocarEscritorio(e.id)}
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded text-[11.5px] font-semibold"
                  style={{ background: e.marca.corPrimaria, color: '#fff' }}
                >
                  {e.marca.iniciais}
                </span>
                <span>
                  <b>{e.marca.nomeExibicao}</b>
                  <span className="suave block text-[12px]">plano {e.plano} · ativar</span>
                </span>
              </button>
            ))}
        </div>
        <p className="suave mt-2 text-[12.5px]">
          Dados nunca se misturam entre escritórios: trocar de escritório troca todo o contexto.
        </p>
      </Secao>

      <p className="mt-4 text-[13.5px]">
        <L para="console/ligacoes/">Agenda de ligações do dia</L> ·{' '}
        <L para="console/coordenacao/">Visão do coordenador</L>
      </p>
    </>
  );
}
