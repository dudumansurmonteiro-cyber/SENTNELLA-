'use client';

// Raiz do app calculada em tempo de execução. O portal pode estar montado em
// qualquer caminho — visualizador de artifacts em /…/portal/, servidor local
// na raiz, next dev — então a raiz vem da própria URL (tudo até o último
// "/portal/"; sem o marcador, é a raiz do site, caso do servidor da Fase 2).

import { useEffect, useState, type ReactNode } from 'react';

const MARCADOR = '/portal/';

export function raizApp(): string {
  if (typeof window === 'undefined') return '';
  const caminho = window.location.pathname;
  const i = caminho.lastIndexOf(MARCADOR);
  if (i >= 0) return caminho.slice(0, i + MARCADOR.length);
  return '/';
}

export function useRaiz(): string | null {
  const [raiz, setRaiz] = useState<string | null>(null);
  useEffect(() => setRaiz(raizApp()), []);
  return raiz;
}

// Link relativo à raiz do app: <L para="l/?t=abc">…</L>
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
