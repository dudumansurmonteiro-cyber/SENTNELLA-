import type { Metadata } from 'next';
import './globals.css';
import { Casca } from '../lib/contexto';

export const metadata: Metadata = {
  title: 'Painel Sentinella — demonstração com dados fictícios',
  description:
    'Painel do cliente da Sentinella Recebíveis (Fase 1): carteira, devedores, eficiência por canal e etapa, operação do dia e console do analista — sobre dados de demonstração.',
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
        <Casca>{children}</Casca>
      </body>
    </html>
  );
}
