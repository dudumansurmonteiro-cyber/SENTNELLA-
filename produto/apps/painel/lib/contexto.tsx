'use client';

// Contexto de dados do painel v3: carrega o índice e o arquivo do escritório
// selecionado (hidratado do formato de transporte), aplica a MARCA do
// escritório como tema (white label) e monta a casca comum — cabeçalho com
// troca de escritório na demonstração, abas do painel e rodapé.

import { usePathname } from 'next/navigation';
import { L, raizApp } from './raiz';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { hidratarDump } from '@sentinella/dados';
import type { DadosEscritorio, IndiceSeed } from '@sentinella/dados';

interface Ctx {
  indice: IndiceSeed | null;
  dados: DadosEscritorio | null;
  escritorioId: string;
  trocarEscritorio: (id: string) => void;
  hoje: string;
  carregando: boolean;
}

const Contexto = createContext<Ctx>({
  indice: null,
  dados: null,
  escritorioId: 'e1',
  trocarEscritorio: () => {},
  hoje: '',
  carregando: true,
});

export const useDados = () => useContext(Contexto);

const cache = new Map<string, DadosEscritorio>();

export async function carregarEscritorio(id: string): Promise<DadosEscritorio> {
  const emCache = cache.get(id);
  if (emCache) return emCache;
  const d = hidratarDump(await fetch(`${raizApp()}dados/${id}.json`).then((r) => r.json()));
  cache.set(id, d);
  return d;
}

export function Casca({ children }: { children: React.ReactNode }) {
  const [indice, setIndice] = useState<IndiceSeed | null>(null);
  const [escritorioId, setEscritorioId] = useState('e1');
  const [dados, setDados] = useState<DadosEscritorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const rota = usePathname() ?? '/';

  useEffect(() => {
    fetch(`${raizApp()}dados/indice.json`)
      .then((r) => r.json())
      .then(setIndice)
      .catch(() => setIndice(null));
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(!cache.has(escritorioId));
    carregarEscritorio(escritorioId)
      .then((d) => {
        if (ativo) {
          setDados(d);
          setCarregando(false);
        }
      })
      .catch(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [escritorioId]);

  const trocarEscritorio = useCallback((id: string) => setEscritorioId(id), []);

  const valor = useMemo(
    () => ({
      indice, dados, escritorioId, trocarEscritorio,
      hoje: indice?.hoje ?? '', carregando,
    }),
    [indice, dados, escritorioId, trocarEscritorio, carregando],
  );

  const noConsole = rota.includes('/console');
  const marca = dados?.escritorio.marca;

  const abas = [
    { para: '', chave: '', rotulo: 'Visão geral' },
    { para: 'carteiras/', chave: 'carteiras', rotulo: 'Carteiras' },
    { para: 'devedores/', chave: 'devedores', rotulo: 'Devedores' },
    { para: 'eficiencia/', chave: 'eficiencia', rotulo: 'Eficiência' },
    { para: 'hoje/', chave: 'hoje', rotulo: 'Hoje' },
    { para: 'config/', chave: 'config', rotulo: 'Configurações' },
  ];

  const ativa = (chave: string) =>
    chave === ''
      ? !['carteiras', 'devedores', 'eficiencia', 'hoje', 'config', 'console'].some((s) =>
          rota.includes(`/${s}`))
      : rota.includes(`/${chave}`);

  return (
    <Contexto.Provider value={valor}>
      {/* White label: fora do console, a cor de marca do escritório vira o
          tema do painel (clara no modo escuro). */}
      {!noConsole && marca && (
        <style>{`
          :root{--primary:${marca.corPrimaria};--link:${marca.corPrimaria};--ok:${marca.corPrimaria}}
          @media (prefers-color-scheme:dark){:root{--primary:${marca.corClara};--link:${marca.corClara};--ok:${marca.corClara};--on-primary:#14211f}}
        `}</style>
      )}
      <header style={{ borderBottom: '1px solid var(--line-soft)', background: 'var(--panel)' }}>
        <div className="container-p flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5">
          {noConsole ? (
            <span className="fonte-titulo flex items-center gap-2 text-lg font-semibold">
              <svg width="15" height="20" viewBox="24 0 152 200" aria-hidden="true">
                <path fill="var(--primary)" d="M46 10H154Q166 10 166 22V98Q166 144 100 190Q34 144 34 98V22Q34 10 46 10Z" />
                <path fill="var(--bg)" d="M61 92Q100 59 139 92Q100 125 61 92Z" />
                <circle fill="var(--primary)" cx="100" cy="92" r="14" />
              </svg>
              Sentinella
              <span className="suave text-sm font-normal">console da operação</span>
            </span>
          ) : (
            <span className="fonte-titulo flex items-center gap-2.5 text-lg font-semibold">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[13px] font-semibold"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {marca?.iniciais ?? '··'}
              </span>
              {marca?.nomeExibicao ?? 'Painel'}
              <span className="suave text-sm font-normal">painel do escritório</span>
            </span>
          )}
          {indice && (
            <label className="flex items-center gap-2 text-[13px]">
              <span className="suave">{noConsole ? 'Escritório ativo' : 'Escritório'}</span>
              <select
                className="campo-select"
                value={escritorioId}
                onChange={(e) => trocarEscritorio(e.target.value)}
                aria-label="Trocar escritório de demonstração"
              >
                {indice.escritorios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.marca.nomeExibicao} · {e.plano}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="chip ml-auto">demonstração · dados fictícios</span>
          <L para={noConsole ? '' : 'console/'} className="text-[13px]">
            {noConsole ? 'ir para o painel do escritório' : 'console da operação (Sentinella)'}
          </L>
        </div>
        {!noConsole && (
          <nav aria-label="Seções do painel" className="container-p flex overflow-x-auto">
            {abas.map((a) => (
              <L key={a.chave} para={a.para} className={`aba ${ativa(a.chave) ? 'aba-ativa' : ''}`}>
                {a.rotulo}
              </L>
            ))}
          </nav>
        )}
        {/* No console, a faixa com a cor do escritório ativo lembra em nome
            de quem toda conversa sai (§7: white label também na operação). */}
        {noConsole && marca && (
          <div style={{ background: marca.corPrimaria, color: '#ffffff' }}>
            <div className="container-p flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[12.5px]">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 place-items-center rounded text-[10.5px] font-semibold"
                style={{ background: '#ffffff', color: marca.corPrimaria }}
              >
                {marca.iniciais}
              </span>
              <b>{marca.nomeExibicao}</b>
              <span style={{ opacity: 0.85 }}>
                · plano {dados?.escritorio.plano} · toda conversa sai em nome deste escritório
                {dados?.escritorio.slaMin != null
                  ? ` · SLA ${dados.escritorio.slaMin} min`
                  : ' · operação da equipe do próprio escritório'}
              </span>
            </div>
          </div>
        )}
      </header>
      <main className="container-p pb-16 pt-6">{children}</main>
      <footer style={{ borderTop: '1px solid var(--line-soft)' }}>
        <div className="container-p suave py-4 text-[12.5px]">
          Demonstração da Sentinella com escritórios, credores e devedores fictícios (90 dias de
          histórico gerados pela régua de entrada). Nenhuma mensagem real é enviada; nesta
          demonstração publicada, as ações não persistem. Plataforma operada pela Sentinella;
          a cobrança é sempre em nome do escritório.
        </div>
      </footer>
    </Contexto.Provider>
  );
}

export function Carregando() {
  return <p className="suave py-10">Carregando os dados de demonstração…</p>;
}
