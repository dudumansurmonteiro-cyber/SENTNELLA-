import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Espaço do devedor e portal do credor — demonstração Sentinella',
  description:
    'Portais white label da plataforma Sentinella (Fase 1 do v3): o devedor regulariza com a marca do escritório — custo total antes do aceite, contestação que pausa, atendimento humano; o credor acompanha a carteira. Demonstração com dados fictícios.',
};

// Cada página define seu próprio rodapé: nos portais white label o rodapé é
// do escritório (e "operada por Sentinella" só aparece conforme o plano).
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
      <body>{children}</body>
    </html>
  );
}
