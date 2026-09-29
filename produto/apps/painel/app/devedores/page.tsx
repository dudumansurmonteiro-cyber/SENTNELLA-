'use client';

// Devedores e maiores valores (§7.2b): os dez maiores fixos no topo + lista
// completa de lojistas com filtros.

import { L } from '../../lib/raiz';
import { useMemo, useState } from 'react';
import { moedaCurta } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { dezMaiores } from '../../lib/metricas';
import { Secao, Selo } from '../../lib/ui';

const FAIXAS = [
  { id: 'todas', rotulo: 'qualquer atraso', min: 0, max: 1e9 },
  { id: 'f1', rotulo: '1–15 dias', min: 1, max: 15 },
  { id: 'f2', rotulo: '16–60 dias', min: 16, max: 60 },
  { id: 'f3', rotulo: 'mais de 60', min: 61, max: 1e9 },
];

export default function Devedores() {
  const { dados } = useDados();
  const [rating, setRating] = useState('todos');
  const [faixa, setFaixa] = useState('todas');
  const [soDevendo, setSoDevendo] = useState(true);
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    if (!dados) return [];
    const fx = FAIXAS.find((f) => f.id === faixa)!;
    return dados.lojistas
      .filter((l) => (rating === 'todos' ? true : l.rating === rating))
      .filter((l) => (soDevendo ? l.valorVencido > 0 : true))
      .filter((l) =>
        faixa === 'todas' ? true : l.maiorAtrasoDias >= fx.min && l.maiorAtrasoDias <= fx.max,
      )
      .filter((l) => l.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => b.valorVencido - a.valorVencido);
  }, [dados, rating, faixa, soDevendo, busca]);

  if (!dados) return <Carregando />;
  const top = dezMaiores(dados);

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Devedores</h1>

      <Secao titulo="Os dez maiores valores em atraso">
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>#</th><th>Lojista</th><th className="num">Valor</th>
                <th className="num">Dias de atraso</th><th>Rating</th><th>Etapa da régua</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ titulo, lojista }, i) => (
                <tr key={titulo.id}>
                  <td className="suave">{i + 1}</td>
                  <td><L para={`devedores/ficha/?l=${lojista.id}`}>{lojista.nome}</L></td>
                  <td className="num text-[15px] font-semibold">{moedaCurta(titulo.valor)}</td>
                  <td className="num">{titulo.diasAtraso}</td>
                  <td><Selo letra={lojista.rating} /></td>
                  <td className="suave">{titulo.etapaAtual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo={`Todos os lojistas (${lista.length})`}>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
          <input
            className="campo-select"
            placeholder="Buscar lojista"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar lojista pelo nome"
          />
          <label className="flex items-center gap-1.5">
            <span className="suave">Rating</span>
            <select className="campo-select" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="todos">todos</option>
              {['A', 'B', 'C', 'D', 'E'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="suave">Atraso</span>
            <select className="campo-select" value={faixa} onChange={(e) => setFaixa(e.target.value)}>
              {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={soDevendo} onChange={(e) => setSoDevendo(e.target.checked)} />
            só com valor vencido
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Lojista</th><th>Cidade</th><th>Rating</th>
                <th className="num">Títulos abertos</th><th className="num">Valor em aberto</th>
                <th className="num">Valor vencido</th><th className="num">Maior atraso</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 60).map((l) => (
                <tr key={l.id}>
                  <td><L para={`devedores/ficha/?l=${l.id}`}>{l.nome}</L></td>
                  <td className="suave">{l.cidade}</td>
                  <td><Selo letra={l.rating} /></td>
                  <td className="num">{l.titulosAbertos}</td>
                  <td className="num">{moedaCurta(l.valorAberto)}</td>
                  <td className="num font-medium">{l.valorVencido ? moedaCurta(l.valorVencido) : '—'}</td>
                  <td className="num">{l.maiorAtrasoDias ? `${l.maiorAtrasoDias} d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length > 60 && (
          <p className="suave mt-2 text-[12.5px]">Mostrando 60 de {lista.length} — refine os filtros.</p>
        )}
      </Secao>
    </>
  );
}
