'use client';

// O dia da operação: a fila de ações (hoje ± 3 dias), as pendências que só o
// advogado resolve — assinaturas, autorizações título a título, dossiês — e
// os bloqueios de conformidade. Ações aqui são demonstrativas e não persistem.

import { useMemo, useState } from 'react';
import { L } from '../../lib/raiz';
import { dataBr, moedaCurta } from '@sentinella/dados';
import type { DocumentoJuridico } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { ChipAcao, Secao } from '../../lib/ui';

function BotaoDemo({
  feito, rotulo, rotuloFeito, onClick,
}: {
  feito: boolean; rotulo: string; rotuloFeito: string; onClick: () => void;
}) {
  if (feito) {
    return (
      <span className="chip chip-ok">
        <span className="glifo" aria-hidden="true">✓</span>
        {rotuloFeito} · não persiste
      </span>
    );
  }
  return (
    <button type="button" className="botao botao-sec" style={{ padding: '3px 10px', fontSize: 12.5 }}
      onClick={onClick}>
      {rotulo}
    </button>
  );
}

function ListaDocs({
  docs, titulo, rotuloAcao, rotuloFeito, devedorNome,
}: {
  docs: DocumentoJuridico[];
  titulo: string;
  rotuloAcao: string;
  rotuloFeito: string;
  devedorNome: (id: string) => string;
}) {
  const [limite, setLimite] = useState(8);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  return (
    <Secao titulo={`${titulo} (${docs.length})`}>
      <ul className="space-y-2 text-[13.5px]">
        {docs.slice(0, limite).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <b>{d.tipo}{d.subtipo ? ` (${d.subtipo})` : ''}</b>
            <L para={`devedores/ficha/?d=${d.devedorId}`}>{devedorNome(d.devedorId)}</L>
            <span className="suave">{moedaCurta(d.valor)} · {dataBr(d.geradoEm)}</span>
            <span className="ml-auto">
              <BotaoDemo
                feito={feitos.has(d.id)}
                rotulo={rotuloAcao}
                rotuloFeito={rotuloFeito}
                onClick={() => setFeitos(new Set(feitos).add(d.id))}
              />
            </span>
          </li>
        ))}
      </ul>
      {docs.length > limite && (
        <button type="button" className="botao botao-sec mt-3" onClick={() => setLimite(limite + 24)}>
          Mostrar mais ({docs.length - limite})
        </button>
      )}
    </Secao>
  );
}

export default function Hoje() {
  const { dados, hoje } = useDados();
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [limiteFila, setLimiteFila] = useState(40);

  const fila = useMemo(() => {
    if (!dados || !hoje) return [];
    return dados.filaHoje
      .filter((a) => a.data === hoje)
      .filter((a) => estadoFiltro === 'todos' || a.estado === estadoFiltro)
      .sort((a, b) => (a.estado === 'bloqueada' ? -1 : 1) - (b.estado === 'bloqueada' ? -1 : 1));
  }, [dados, hoje, estadoFiltro]);

  if (!dados) return <Carregando />;

  const nomeDev = (id: string) => dados.devedores.find((d) => d.id === id)?.nome ?? id;
  const aAssinar = dados.documentos.filter((d) => d.status === 'a assinar');
  const autorizacoes = dados.documentos.filter((d) => d.status === 'aguarda autorização');
  const dossies = dados.documentos.filter((d) => d.tipo === 'dossiê judicial' && d.status === 'pronto');
  const excecoes = dados.excecoes
    .filter((e) => e.estado === 'aberta' || e.estado === 'em atendimento')
    .sort((a, b) => b.abertaMinAtras - a.abertaMinAtras);
  const bloqueios = [...dados.bloqueios].sort((a, b) => b.em.localeCompare(a.em));
  const estadosNaFila = [...new Set(dados.filaHoje.filter((a) => a.data === hoje).map((a) => a.estado))];

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">
        Hoje{hoje && <span className="suave text-[15px] font-normal"> · {dataBr(hoje)}</span>}
      </h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Secao
            titulo={`Fila do dia (${fila.length})`}
            acao={
              <select className="campo-select" value={estadoFiltro} aria-label="Filtrar por estado"
                onChange={(e) => { setEstadoFiltro(e.target.value); setLimiteFila(40); }}>
                <option value="todos">Todos os estados</option>
                {estadosNaFila.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            }
          >
            <ul className="space-y-2 text-[13.5px]">
              {fila.slice(0, limiteFila).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <b className="w-11">{a.etapa}</b>
                  <span className="chip">{a.canal}</span>
                  <ChipAcao estado={a.estado} />
                  <L para={`devedores/ficha/?d=${a.devedorId}`}>{nomeDev(a.devedorId)}</L>
                  <span className="suave">· {a.quem}</span>
                  {a.motivoBloqueio && <span className="sinal-txt w-full text-[12.5px]">{a.motivoBloqueio}</span>}
                </li>
              ))}
            </ul>
            {fila.length > limiteFila && (
              <button type="button" className="botao botao-sec mt-3"
                onClick={() => setLimiteFila(limiteFila + 80)}>
                Mostrar mais ({fila.length - limiteFila})
              </button>
            )}
            <p className="suave mt-3 text-[12.5px]">
              Cada mensagem passa pela conferência de conformidade antes de sair; divergência
              bloqueia o envio e abre exceção.
            </p>
          </Secao>

          <Secao titulo={`Exceções em atendimento (${excecoes.length})`}>
            <ul className="space-y-2.5 text-[13.5px]">
              {excecoes.map((e) => {
                const estourou = e.slaMin != null && e.abertaMinAtras > e.slaMin && e.estado === 'aberta';
                return (
                  <li key={e.id}>
                    <div className="flex flex-wrap items-center gap-x-2.5">
                      <b>{e.motivo}</b>
                      <span className={`chip ${estourou ? 'chip-sinal' : ''}`}>
                        {e.estado} · há {e.abertaMinAtras} min
                      </span>
                      {e.slaMin != null
                        ? <span className="suave">SLA {e.slaMin} min</span>
                        : <span className="suave">equipe do próprio escritório</span>}
                    </div>
                    <div className="suave text-[12.5px]">
                      <L para={`devedores/ficha/?d=${e.devedorId}`}>{nomeDev(e.devedorId)}</L>
                      {' '}· {moedaCurta(e.valorEnvolvido)}
                      {e.assumidaPor && <> · com {e.assumidaPor}</>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Secao>
        </div>

        <div>
          <ListaDocs
            docs={aAssinar}
            titulo="Para o advogado assinar"
            rotuloAcao="Assinar (demonstração)"
            rotuloFeito="assinada"
            devedorNome={nomeDev}
          />
          <ListaDocs
            docs={autorizacoes}
            titulo="Negativação e protesto — autorizar título a título"
            rotuloAcao="Autorizar (demonstração)"
            rotuloFeito="autorizada"
            devedorNome={nomeDev}
          />
          <ListaDocs
            docs={dossies}
            titulo="Dossiês prontos para o judicial"
            rotuloAcao="Enviar ao fluxo judicial (demonstração)"
            rotuloFeito="encaminhado"
            devedorNome={nomeDev}
          />

          <Secao titulo={`Conformidade — bloqueios recentes (${bloqueios.length})`}>
            <ul className="space-y-2.5 text-[13px]">
              {bloqueios.slice(0, 10).map((b) => (
                <li key={b.id}>
                  <span className="chip chip-sinal mb-0.5">
                    <span className="glifo" aria-hidden="true">⊘</span>
                    {b.regra}
                  </span>
                  <div className="suave">{b.detalhe} · {dataBr(b.em)}</div>
                </li>
              ))}
            </ul>
          </Secao>
        </div>
      </div>
    </>
  );
}
