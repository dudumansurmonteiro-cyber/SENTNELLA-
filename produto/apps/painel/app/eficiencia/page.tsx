'use client';

// Eficiência da régua: por canal, por etapa (E+N), ligações e a carteira
// em casa — tudo somado dos agregados por carteira, com filtro.

import { useMemo, useState } from 'react';
import { moedaCompacta, pct } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { somarAgregados } from '../../lib/metricas';
import { BarraLinha, Colunas, Kpi, Secao } from '../../lib/ui';

export default function Eficiencia() {
  const { dados } = useDados();
  const [carteiraId, setCarteiraId] = useState('todas');

  const t = useMemo(() => {
    if (!dados) return null;
    const ags =
      carteiraId === 'todas'
        ? dados.agregados
        : dados.agregados.filter((a) => a.carteiraId === carteiraId);
    return somarAgregados(ags);
  }, [dados, carteiraId]);

  if (!dados || !t) return <Carregando />;

  const maiorEtapa = Math.max(1, ...t.eficienciaEtapa.map((e) => e.acoes));
  const totalRating = Math.max(1, t.distribuicaoRating.reduce((s, d) => s + d.qtd, 0));
  const maiorCasa = Math.max(1, ...t.faixasCasa.map((f) => f.valor));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="fonte-titulo text-[22px] font-semibold">Eficiência</h1>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="suave">Carteira</span>
          <select
            className="campo-select"
            value={carteiraId}
            onChange={(e) => setCarteiraId(e.target.value)}
            aria-label="Filtrar por carteira"
          >
            <option value="todas">Todas</option>
            {dados.carteiras.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Recuperado em 90 dias" valor={moedaCompacta(t.recuperadoAcumulado)} destaque
          detalhe={`${pct(t.taxaRecuperacaoPct)} do entregue`} />
        <Kpi rotulo="Títulos pagos" valor={t.pagosQtd.toLocaleString('pt-BR')}
          detalhe={`de ${t.qtdTitulos.toLocaleString('pt-BR')}`} />
        <Kpi rotulo="Promessas cumpridas"
          valor={t.promessasFeitas ? pct((t.promessasCumpridas / t.promessasFeitas) * 100) : '—'}
          detalhe={`${t.promessasCumpridas} de ${t.promessasFeitas}`} />
        <Kpi rotulo="Rating médio da base" valor={String(t.ratingMedio)} detalhe="0–100, interno" />
      </div>

      <Secao titulo="Por canal">
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Canal</th>
                <th className="num">Enviadas</th>
                <th className="num">Entregues</th>
                <th className="num">Lidas</th>
                <th className="num">Respondidas</th>
                <th className="num">Pagas em 48h</th>
                <th className="num">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {t.eficienciaCanal.map((c) => (
                <tr key={c.canal}>
                  <td className="font-medium">{c.canal}</td>
                  <td className="num">{c.enviadas.toLocaleString('pt-BR')}</td>
                  <td className="num">{c.entregues.toLocaleString('pt-BR')}</td>
                  <td className="num">{c.lidas ? c.lidas.toLocaleString('pt-BR') : '—'}</td>
                  <td className="num">{c.respondidas.toLocaleString('pt-BR')}</td>
                  <td className="num">{c.pagas48h.toLocaleString('pt-BR')}</td>
                  <td className="num">{c.enviadas ? pct((c.pagas48h / c.enviadas) * 100, 1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="suave mt-2 text-[12.5px]">
          Conversão = títulos pagos em até 48h após o contato ÷ mensagens enviadas no canal.
          Em desenvolvimento todos os canais operam em modo simulado.
        </p>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Por etapa da régua (E = dias desde a entrada)">
          {t.eficienciaEtapa.map((e) => (
            <div key={e.etapa} className="flex items-center gap-3 py-1 text-[13px]">
              <b className="w-12 shrink-0">{e.etapa}</b>
              <div className="barra flex-1" role="img"
                aria-label={`${e.etapa}: ${e.acoes} ações, conversão ${pct(e.conversao, 1)}`}>
                <i style={{ width: `${Math.max(2, (e.acoes / maiorEtapa) * 100)}%` }} />
              </div>
              <span className="num w-20 shrink-0">{e.acoes.toLocaleString('pt-BR')}</span>
              <b className="num w-16 shrink-0">{pct(e.conversao, 1)}</b>
            </div>
          ))}
          <p className="suave mt-2 text-[12.5px]">
            Ações executadas e conversão em pagamento (48h) por etapa — mostra onde a régua
            resolve e onde só as medidas formais destravam.
          </p>
        </Secao>

        <Secao titulo="Ligações dos negociadores">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px]">
            <li className="flex justify-between gap-2"><span>Realizadas</span><b className="num">{t.ligacoes.realizadas.toLocaleString('pt-BR')}</b></li>
            <li className="flex justify-between gap-2"><span>Atendidas</span><b className="num">{t.ligacoes.atendidas.toLocaleString('pt-BR')}</b></li>
            <li className="flex justify-between gap-2"><span>Não atendidas</span><b className="num">{t.ligacoes.naoAtendidas.toLocaleString('pt-BR')}</b></li>
            <li className="flex justify-between gap-2"><span>Promessas obtidas</span><b className="num">{t.ligacoes.promessasObtidas.toLocaleString('pt-BR')}</b></li>
            <li className="flex justify-between gap-2"><span>Promessas cumpridas</span><b className="num">{t.ligacoes.promessasCumpridas.toLocaleString('pt-BR')}</b></li>
            <li className="flex justify-between gap-2"><span>Pagas em 7 dias</span><b className="num">{t.ligacoes.pagasEm7d.toLocaleString('pt-BR')}</b></li>
          </ul>
          <p className="suave mt-2 text-[12.5px]">
            Ligações gravadas e só em janela permitida; fora dela a tentativa é bloqueada e
            reprogramada pela conformidade.
          </p>
        </Secao>

        <Secao titulo="Recuperado por semana">
          <Colunas dados={t.recuperadoPorSemana} formato={moedaCompacta} />
        </Secao>

        <Secao titulo="Carteira em casa (em aberto, por tempo desde a entrada)">
          {t.faixasCasa.map((f) => (
            <BarraLinha key={f.rotulo} rotulo={f.rotulo} valorTexto={moedaCompacta(f.valor)}
              fracao={f.valor / maiorCasa} />
          ))}
          <div className="mt-3 flex items-center gap-2" aria-hidden="true">
            {t.distribuicaoRating.map((d) => (
              <span key={d.letra} className={`selo selo-${d.letra.toLowerCase()}`}
                title={`${d.letra}: ${d.qtd} devedores`}>
                {d.letra}
              </span>
            ))}
            <span className="suave text-[12.5px]">
              {t.distribuicaoRating.map((d) => `${d.letra} ${pct((d.qtd / totalRating) * 100)}`).join(' · ')}
            </span>
          </div>
        </Secao>
      </div>
    </>
  );
}
