'use client';

// Hoje — operação do dia (§7.2d): o que sai hoje, a fila por status, as
// exceções abertas e o que depende do cliente.

import Link from 'next/link';
import { useState } from 'react';
import { dataBr, moedaCurta } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { operacaoDoDia } from '../../lib/metricas';
import { ChipAcao, Kpi, Secao } from '../../lib/ui';

export default function Hoje() {
  const { dados, indice } = useDados();
  const [aprovadas, setAprovadas] = useState<string[]>([]);
  if (!dados || !indice) return <Carregando />;
  const op = operacaoDoDia(dados, indice.hoje);
  const excecoesAbertas = dados.excecoes.filter((e) => e.estado !== 'resolvida' && e.estado !== 'devolvida ao cliente');
  const pendentes = dados.autorizacoes.filter((a) => a.status === 'pendente' && !aprovadas.includes(a.id));
  const contestadas = dados.titulos.filter((t) => t.estado === 'contestado');

  const filas = Object.entries(op.fila) as [string, typeof op.fila.agendado][];

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">
        Hoje <span className="suave text-[14px] font-normal">· {dataBr(indice.hoje)}</span>
      </h1>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Mensagens que saem hoje" valor={String(op.mensagensHoje)} />
        <Kpi rotulo="Ligações do analista (próx. dias)" valor={String(op.ligacoesHoje)} />
        <Kpi rotulo="Notificações a caminho" valor={String(op.notificacoes)} />
        <Kpi rotulo="Protestos aguardando você" valor={String(pendentes.length)} destaque={pendentes.length > 0} />
      </div>

      <Secao titulo="Fila por status (hoje e próximos 3 dias)">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {filas.map(([nome, acoes]) => (
            <div key={nome} className="cartao px-3 py-2.5" style={{ background: 'var(--panel-row)' }}>
              <div className="mb-1.5 flex items-center justify-between">
                <ChipAcao estado={(nome === 'agendado' ? 'agendada' : nome === 'em andamento' ? 'em andamento' : nome === 'pendente' ? 'pendente' : nome === 'não atendido' ? 'não atendida' : nome === 'cancelado' ? 'cancelada' : nome === 'bloqueado' ? 'bloqueada' : 'finalizada') as any} />
                <b className="text-[15px]">{acoes.length}</b>
              </div>
              {acoes.slice(0, 3).map((a) => (
                <p key={a.id} className="suave truncate py-0.5 text-[12.5px]" title={a.descricao}>
                  {a.etapa} · {a.descricao}
                </p>
              ))}
              {acoes.length > 3 && <p className="suave text-[12px]">+ {acoes.length - 3}…</p>}
              {acoes.length === 0 && <p className="suave text-[12.5px]">nada por aqui</p>}
            </div>
          ))}
        </div>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao
          titulo={`Exceções abertas agora (${excecoesAbertas.length})`}
          acao={<Link className="text-[13px]" href="/console/">abrir no console</Link>}
        >
          {excecoesAbertas.map((e) => {
            const lojista = dados.lojistas.find((l) => l.id === e.lojistaId)!;
            return (
              <p key={e.id} className="border-b py-1.5 text-[13.5px]" style={{ borderColor: 'var(--line-soft)' }}>
                <span className="sinal-txt font-medium">{e.motivo}</span> — {lojista.nome} ·{' '}
                {moedaCurta(e.valorEnvolvido)} ·{' '}
                {e.assumidaPor ? `${e.assumidaPor} atuando` : 'aguardando analista'}
              </p>
            );
          })}
          {excecoesAbertas.length === 0 && <p className="suave text-[13px]">Nenhuma exceção aberta.</p>}
        </Secao>

        <Secao titulo="Depende de você">
          {pendentes.map((a) => {
            const lojista = dados.lojistas.find((l) => l.id === a.lojistaId)!;
            return (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5" style={{ borderColor: 'var(--line-soft)' }}>
                <span className="text-[13.5px]">
                  <span className="sinal-txt font-medium">Autorizar {a.tipo}</span> — {lojista.nome} ·{' '}
                  {moedaCurta(a.valor)} · pedido em {dataBr(a.pedidoEm)}
                </span>
                <button className="botao botao-sinal" onClick={() => setAprovadas((x) => [...x, a.id])}>
                  autorizar (demo)
                </button>
              </div>
            );
          })}
          {pendentes.length === 0 && <p className="suave text-[13px]">Nenhuma autorização pendente.</p>}
          {contestadas.length > 0 && (
            <p className="suave mt-2 text-[13px]">
              {contestadas.length} título(s) contestado(s) aguardando resposta do seu representante
              comercial.
            </p>
          )}
          {aprovadas.length > 0 && (
            <p className="nota-demo mt-2">
              {aprovadas.length} autorização(ões) aprovada(s) nesta demonstração — em produção, o
              protesto segue para o cartório eletrônico.
            </p>
          )}
        </Secao>
      </div>
    </>
  );
}
