'use client';

// Visão do coordenador (escritório ativo): tempos de resposta, carga por
// pessoa, devoluções ao escritório e as travas de conformidade por regra.

import { L } from '../../../lib/raiz';
import { Carregando, useDados } from '../../../lib/contexto';
import { BarraLinha, Kpi, Secao } from '../../../lib/ui';
import { duracao, moedaCurta } from '@sentinella/dados';

export default function Coordenacao() {
  const { dados, indice, escritorioId } = useDados();
  if (!dados || !indice) return <Carregando />;

  const excecoes = dados.excecoes;
  const atendidas = excecoes.filter((e) => e.tempoAteAssumirMin != null);
  const tempoMedio = atendidas.length
    ? atendidas.reduce((s, e) => s + (e.tempoAteAssumirMin ?? 0), 0) / atendidas.length
    : 0;
  const dentroSla = dados.escritorio.slaMin != null
    ? atendidas.filter((e) => (e.tempoAteAssumirMin ?? 0) <= (e.slaMin ?? Infinity)).length
    : atendidas.length;
  const devolvidas = excecoes.filter((e) => e.estado === 'devolvida ao escritório');
  const resolvidas = excecoes.filter((e) => e.estado === 'resolvida');

  const porPessoa = new Map<string, number>();
  for (const e of excecoes) {
    if (e.assumidaPor) porPessoa.set(e.assumidaPor, (porPessoa.get(e.assumidaPor) ?? 0) + 1);
  }
  const cargas = [...porPessoa.entries()].sort((a, b) => b[1] - a[1]);
  const maiorCarga = Math.max(1, ...cargas.map(([, n]) => n));

  const porRegra = new Map<string, number>();
  for (const b of dados.bloqueios) porRegra.set(b.regra, (porRegra.get(b.regra) ?? 0) + 1);
  const regras = [...porRegra.entries()].sort((a, b) => b[1] - a[1]);
  const maiorRegra = Math.max(1, ...regras.map(([, n]) => n));

  const analistasDoEsc = indice.analistas.filter((a) => a.escritorioIds.includes(escritorioId));

  return (
    <>
      <p className="text-[13px]"><L para="console/">← Fila de exceções</L></p>
      <h1 className="fonte-titulo mt-2 text-[22px] font-semibold">Coordenação</h1>
      <p className="suave mt-1 text-[13.5px]">
        {dados.escritorio.slaMin != null
          ? <>Mesa Sentinella · turnos: {analistasDoEsc.map((a) => `${a.nome} ${a.turno}`).join(' · ')}</>
          : 'Negociadores do próprio escritório (plano Básico) — a Sentinella acompanha os números.'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Exceções no período" valor={String(excecoes.length)}
          detalhe={`${resolvidas.length} resolvidas`} />
        <Kpi rotulo="Tempo até assumir" valor={duracao(tempoMedio)} destaque
          detalhe={dados.escritorio.slaMin != null ? `SLA ${dados.escritorio.slaMin} min` : 'sem SLA Sentinella'} />
        <Kpi rotulo="Dentro do SLA"
          valor={atendidas.length ? `${Math.round((dentroSla / atendidas.length) * 100)}%` : '—'}
          detalhe={`${dentroSla} de ${atendidas.length}`} />
        <Kpi rotulo="Devolvidas ao escritório" valor={String(devolvidas.length)}
          detalhe="fora de alçada ou decisão do advogado" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Carga por pessoa">
          {cargas.map(([nome, n]) => (
            <BarraLinha key={nome} rotulo={nome} valorTexto={`${n} exceções`} fracao={n / maiorCarga} />
          ))}
          {cargas.length === 0 && <p className="suave text-[13px]">Sem atendimentos no período.</p>}
        </Secao>

        <Secao titulo="Travas de conformidade por regra">
          {regras.map(([regra, n]) => (
            <BarraLinha
              key={regra}
              rotulo={regra.split('—')[0].trim().slice(0, 24)}
              valorTexto={`${n}×`}
              fracao={n / maiorRegra}
            />
          ))}
          <p className="suave mt-2 text-[12.5px]">
            Cada barra é uma regra da seção de conformidade agindo antes do envio — o escritório
            vê tudo; nada é silencioso.
          </p>
        </Secao>

        <Secao titulo="Devolvidas ao escritório — últimas">
          <ul className="space-y-2 text-[13.5px]">
            {devolvidas.slice(0, 6).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3">
                <b>{e.motivo}</b>
                <span className="suave">{moedaCurta(e.valorEnvolvido)}</span>
                {e.resolucao && <span className="suave w-full text-[12.5px]">{e.resolucao}</span>}
              </li>
            ))}
            {devolvidas.length === 0 && <li className="suave">Nenhuma devolução no período.</li>}
          </ul>
        </Secao>

        <Secao titulo="Causas das exceções resolvidas">
          <ul className="space-y-2 text-[13.5px]">
            {resolvidas.slice(0, 6).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3">
                <b>{e.motivo}</b>
                {e.causa && <span className="suave">causa: {e.causa}</span>}
              </li>
            ))}
          </ul>
        </Secao>
      </div>
    </>
  );
}
