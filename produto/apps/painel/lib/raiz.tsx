'use client';

// Raiz do app calculada em tempo de execução. O painel pode estar montado em
// qualquer caminho — visualizador de artifacts, servidor local em /painel,
// next dev na raiz — então nada de basePath fixo: a raiz vem da própria URL
// (tudo até o último "/painel/"), e os links são âncoras comuns.

import { useEffect, useState, type ReactNode } from 'react';

const MARCADOR = '/painel/';

export function raizApp(): string {
  if (typeof window === 'undefined') return '';
  const caminho = window.location.pathname;
  const i = caminho.lastIndexOf(MARCADOR);
  if (i >= 0) return caminho.slice(0, i + MARCADOR.length);
  return '/'; // next dev serve o app na raiz
}

export function useRaiz(): string | null {
  const [raiz, setRaiz] = useState<string | null>(null);
  useEffect(() => setRaiz(raizApp()), []);
  return raiz;
}

// Link relativo à raiz do app: <L para="devedores/">…</L>
export function L({
  para,
  className,
  children,
}: {
  para: string;
  className?: string;
  children: ReactNode;
}) {
  const raiz = useRaiz();
  return (
    <a href={raiz == null ? undefined : raiz + para} className={className}>
      {children}
    </a>
  );
}
