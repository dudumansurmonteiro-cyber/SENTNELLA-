import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portal do lojista — demonstração Sentinella',
  description:
    'Portal do lojista da Sentinella Recebíveis (Fase 1): o lojista vê o que deve, paga ou propõe acordo — demonstração com dados fictícios.',
};

export default function RaizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <footer className="container-m suave pb-8 pt-2 text-[12px]">
          Operado pela Sentinella para a indústria · demonstração com dados fictícios — nenhuma
          cobrança é real e as ações não persistem.
        </footer>
      </body>
    </html>
  );
}
