# Sentinella — site

Site da Sentinella, empresa de IA gerenciada para empresas brasileiras: construímos
agentes de inteligência artificial para atendimento, vendas, cobrança e triagem — e
operamos esses agentes com uma central humana das 8h às 22h.

> **Construímos a sua IA. E ficamos operando ela.**

- **`CLAUDE.md`** — o brief completo do site (posicionamento, texto pronto, design,
  requisitos). É a fonte de verdade: qualquer mudança no site começa por ele.
- **`PENDENCIAS.md`** — decisões pendentes antes do deploy. Placeholders aparecem no
  site como "sob consulta" ou "em definição"; nunca inventar valores.

## Stack

[Astro](https://astro.build) + Tailwind CSS, site estático, sem backend próprio.

```bash
npm install     # instalar dependências
npm run dev     # desenvolvimento (http://localhost:4321)
npm run build   # build de produção em dist/
npm run preview # servir o build localmente
```

## Estrutura

```
src/
  layouts/Base.astro          # head, SEO, fontes, header e footer
  components/                 # painel simulado do hero, fluxo de exceção,
                              # tabela de SLA, formulário de contato
  pages/
    index.astro               # página principal
    como-operamos.astro       # quadro operacional completo
    piloto.astro              # projeto-piloto
    privacidade.astro         # política de privacidade (preliminar)
    termos.astro              # stub — em definição
  styles/global.css           # tokens de design e componentes
assets/                       # logo (escudo com olho) em SVG
legado/                       # MVP single-file anterior, mantido como histórico
```

## Deploy

Plataforma em definição (Cloudflare Pages ou Vercel — ver `PENDENCIAS.md`).
Comando de build: `npm run build` · diretório de saída: `dist/`.
