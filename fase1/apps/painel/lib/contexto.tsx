'use client';

// Contexto de dados do painel: carrega o índice e o arquivo do cliente
// selecionado (dados de demonstração gerados pelo seed).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import type { DadosCliente, IndiceSeed } from '@sentinella/dados';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface Ctx {
  indice: IndiceSeed | null;
  dados: DadosCliente | null;
  clienteId: string;
  trocarCliente: (id: string) => void;
  carregando: boolean;
}

const Contexto = createContext<Ctx>({
  indice: null,
  dados: null,
  clienteId: 'c1',
  trocarCliente: () => {},
  carregando: true,
});

export const useDados = () => useContext(Contexto);

const cacheClientes = new Map<string, DadosCliente>();

// Console do analista: carrega os três clientes de uma vez.
export async function carregarTodos(ids: string[]): Promise<DadosCliente[]> {
  return Promise.all(
    ids.map(async (id) => {
      const emCache = cacheClientes.get(id);
      if (emCache) return emCache;
      const d: DadosCliente = await fetch(`${BASE}/dados/${id}.json`).then((r) => r.json());
      cacheClientes.set(id, d);
      return d;
    }),
  );
}

export function Casca({ children }: { children: React.ReactNode }) {
  const [indice, setIndice] = useState<IndiceSeed | null>(null);
  const [clienteId, setClienteId] = useState('c1');
  const [dados, setDados] = useState<DadosCliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const rota = usePathname() ?? '/';

  useEffect(() => {
    fetch(`${BASE}/dados/indice.json`)
      .then((r) => r.json())
      .then(setIndice)
      .catch(() => setIndice(null));
  }, []);

  useEffect(() => {
    let ativo = true;
    const emCache = cacheClientes.get(clienteId);
    if (emCache) {
      setDados(emCache);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    fetch(`${BASE}/dados/${clienteId}.json`)
      .then((r) => r.json())
      .then((d: DadosCliente) => {
        cacheClientes.set(clienteId, d);
        if (ativo) {
          setDados(d);
          setCarregando(false);
        }
      })
      .catch(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const trocarCliente = useCallback((id: string) => setClienteId(id), []);

  const valor = useMemo(
    () => ({ indice, dados, clienteId, trocarCliente, carregando }),
    [indice, dados, clienteId, trocarCliente, carregando],
  );

  const noConsole = rota.includes('/console');

  const abas = [
    { href: '/', rotulo: 'Visão geral' },
    { href: '/devedores/', rotulo: 'Devedores' },
    { href: '/eficiencia/', rotulo: 'Eficiência' },
    { href: '/hoje/', rotulo: 'Hoje' },
    { href: '/config/', rotulo: 'Configurações' },
  ];

  const ativa = (href: string) =>
    href === '/' ? rota === '/' : rota.startsWith(href.replace(/\/$/, ''));

  return (
    <Contexto.Provider value={valor}>
      <header style={{ borderBottom: '1px solid var(--line-soft)', background: 'var(--panel)' }}>
        <div className="container-p flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5">
          <span className="fonte-titulo flex items-center gap-2 text-lg font-semibold">
            <svg width="15" height="20" viewBox="24 0 152 200" aria-hidden="true">
              <path fill="var(--primary)" d="M46 10H154Q166 10 166 22V98Q166 144 100 190Q34 144 34 98V22Q34 10 46 10Z" />
              <path fill="var(--bg)" d="M61 92Q100 59 139 92Q100 125 61 92Z" />
              <circle fill="var(--primary)" cx="100" cy="92" r="14" />
            </svg>
            Sentinella
            <span className="suave text-sm font-normal">{noConsole ? 'console do analista' : 'painel do cliente'}</span>
          </span>
          {!noConsole && indice && (
            <label className="flex items-center gap-2 text-[13px]">
              <span className="suave">Cliente</span>
              <select
                className="campo-select"
                value={clienteId}
                onChange={(e) => trocarCliente(e.target.value)}
                aria-label="Trocar cliente de demonstração"
              >
                {indice.clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.plano}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="chip ml-auto">demonstração · dados fictícios</span>
          <Link href={noConsole ? '/' : '/console/'} className="text-[13px]">
            {noConsole ? 'ir para o painel do cliente' : 'ir para o console do analista'}
          </Link>
        </div>
        {!noConsole && (
          <nav aria-label="Seções do painel" className="container-p flex overflow-x-auto">
            {abas.map((a) => (
              <Link key={a.href} href={a.href} className={`aba ${ativa(a.href) ? 'aba-ativa' : ''}`}>
                {a.rotulo}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="container-p pb-16 pt-6">{children}</main>
      <footer style={{ borderTop: '1px solid var(--line-soft)' }}>
        <div className="container-p suave py-4 text-[12.5px]">
          Fase 1 — demonstração da Sentinella Recebíveis com dados e empresas fictícios. Nenhuma
          mensagem real é enviada; ações desta demo não persistem.
        </div>
      </footer>
    </Contexto.Provider>
  );
}

export function Carregando() {
  return <p className="suave py-10">Carregando os dados de demonstração…</p>;
}
