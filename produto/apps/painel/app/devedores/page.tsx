'use client';

// Devedores do escritório: busca, filtros e a lista paginada (o seed traz
// ~2.000 por escritório, PF e PJ). O rating A–E é interno — devedor nunca vê.

import { useMemo, useState } from 'react';
import { L } from '../../lib/raiz';
import { moedaCurta } from '@sentinella/dados';
import type { Devedor } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { Selo } from '../../lib/ui';

const PAGINA = 80;

export default function Devedores() {
  const { dados } = useDados();
  const [busca, setBusca] = useState('');
  const [carteiraId, setCarteiraId] = useState('todas');
  const [tipo, setTipo] = useState('todos');
  const [rating, setRating] = useState('todos');
  const [situacao, setSituacao] = useState('todas');
  const [limite, setLimite] = useState(PAGINA);

  const lista = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    const filtra = (d: Devedor) => {
      if (carteiraId !== 'todas' && d.carteiraId !== carteiraId) return false;
      if (tipo !== 'todos' && d.tipo !== tipo) return false;
      if (rating !== 'todos' && d.rating !== rating) return false;
      if (situacao === 'em aberto' && d.titulosAbertos === 0) return false;
      if (situacao === 'regularizados' && d.titulosAbertos > 0) return false;
      if (situacao === 'atenção' && !(d.canaisBloqueados.length > 0 || d.vulneravel)) return false;
      if (termo && !`${d.nome} ${d.doc} ${d.cidade}`.toLowerCase().includes(termo)) return false;
      return true;
    };
    return dados.devedores
      .filter(filtra)
      .sort((a, b) => b.valorAberto - a.valorAberto);
  }, [dados, busca, carteiraId, tipo, rating, situacao]);

  if (!dados) return <Carregando />;

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Devedores</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[13px]">
        <input
          type="search"
          className="campo-select min-w-56 flex-1 md:max-w-xs"
          placeholder="Buscar por nome, CPF/CNPJ ou cidade"
          aria-label="Buscar devedor"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimite(PAGINA);
          }}
        />
        <select className="campo-select" value={carteiraId} aria-label="Filtrar por carteira"
          onChange={(e) => { setCarteiraId(e.target.value); setLimite(PAGINA); }}>
          <option value="todas">Todas as carteiras</option>
          {dados.carteiras.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select className="campo-select" value={tipo} aria-label="Filtrar por tipo"
          onChange={(e) => { setTipo(e.target.value); setLimite(PAGINA); }}>
          <option value="todos">PF e PJ</option>
          <option value="PF">Pessoa física</option>
          <option value="PJ">Pessoa jurídica</option>
        </select>
        <select className="campo-select" value={rating} aria-label="Filtrar por rating"
          onChange={(e) => { setRating(e.target.value); setLimite(PAGINA); }}>
          <option value="todos">Rating A–E</option>
          {['A', 'B', 'C', 'D', 'E'].map((l) => (
            <option key={l} value={l}>Rating {l}</option>
          ))}
        </select>
        <select className="campo-select" value={situacao} aria-label="Filtrar por situação"
          onChange={(e) => { setSituacao(e.target.value); setLimite(PAGINA); }}>
          <option value="todas">Todas as situações</option>
          <option value="em aberto">Com títulos em aberto</option>
          <option value="regularizados">Regularizados</option>
          <option value="atenção">Atenção (não contato / vulnerável)</option>
        </select>
        <span className="suave ml-auto">{lista.length.toLocaleString('pt-BR')} devedores</span>
      </div>

      <div className="cartao mt-3 overflow-x-auto">
        <table className="tab">
          <thead>
            <tr>
              <th>Devedor</th>
              <th>Carteira</th>
              <th>Rating</th>
              <th className="num">Títulos abertos</th>
              <th className="num">Em aberto</th>
              <th className="num">Dias na carteira</th>
              <th>Sinais</th>
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, limite).map((d) => {
              const carteira = dados.carteiras.find((c) => c.id === d.carteiraId);
              return (
                <tr key={d.id}>
                  <td>
                    <L para={`devedores/ficha/?d=${d.id}`} className="font-medium">
                      {d.nome}
                    </L>
                    <div className="suave text-[12px]">
                      {d.tipo} · {d.doc} · {d.cidade}
                    </div>
                  </td>
                  <td className="max-w-44 truncate" title={carteira?.nome}>{carteira?.nome}</td>
                  <td><Selo letra={d.rating} titulo={`Rating ${d.rating} · ${d.ratingTotal} pontos (interno)`} /></td>
                  <td className="num">{d.titulosAbertos}</td>
                  <td className="num">{d.valorAberto ? moedaCurta(d.valorAberto) : '—'}</td>
                  <td className="num">{d.titulosAbertos ? d.diasDesdeEntrada : '—'}</td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {d.canaisBloqueados.length > 0 && (
                        <span className="chip chip-sinal" title={`Pediu não contato: ${d.canaisBloqueados.join(', ')}`}>
                          <span className="glifo" aria-hidden="true">⊘</span>
                          não contatar: {d.canaisBloqueados.join(', ')}
                        </span>
                      )}
                      {d.vulneravel && (
                        <span className="chip chip-sinal" title="Declarou situação de vulnerabilidade (Lei 14.181)">
                          <span className="glifo" aria-hidden="true">!</span>
                          vulnerabilidade
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length > limite && (
          <div className="p-3 text-center">
            <button type="button" className="botao botao-sec" onClick={() => setLimite(limite + PAGINA)}>
              Mostrar mais {Math.min(PAGINA, lista.length - limite)} de{' '}
              {(lista.length - limite).toLocaleString('pt-BR')}
            </button>
          </div>
        )}
      </div>

      <p className="nota-demo mt-3">
        O rating é instrumento interno do escritório e do credor — nunca aparece para o devedor
        (§6). Pedidos de não contato e declarações de vulnerabilidade entram como trava da régua.
      </p>
    </>
  );
}
