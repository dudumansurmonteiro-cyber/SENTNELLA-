# Sentinella Recebíveis

A Sentinella faz a indústria receber o que vendeu a prazo: uma IA cobra e atende os
lojistas pelo canal que o cliente escolher; uma central humana, das 8h às 22h, cuida
das exceções e faz as ligações. O cliente acompanha tudo em um painel; o lojista vê
suas dívidas em um portal próprio.

> **Sua empresa vendeu. A Sentinella faz você receber.**

- **`CLAUDE.md`** — o brief v2 completo (produto, régua, planos, painel, portal,
  console, dados, fases). É a fonte de verdade: qualquer tarefa começa por ele.
- **`PENDENCIAS.md`** — decisões pendentes; placeholders aparecem como
  "sob consulta" / "em definição", nunca com valores inventados.

## Superfícies do produto (brief v2, §7)

1. **Site público** — publicado no Webflow:
   https://eduardos-top-notch-site-488aab.webflow.io
2. **Painel do cliente + Console do analista** — Fase 1 entregue em `fase1/`
   (`apps/painel`, Next.js)
3. **Portal do lojista** — Fase 1 entregue em `fase1/` (`apps/portal`)

Demonstração navegável das três superfícies (dados fictícios):
https://claude.ai/artifact/AZcXJ7wAB4rgmXZAEWoP5v

Para rodar localmente: `cd fase1 && npm install && npm run demo` — ver
`fase1/README.md` (inclui as decisões registradas da fase, como o seed
determinístico no lugar do banco até a Fase 2).

## Legado v1 neste repositório

`src/` contém o site Astro do posicionamento v1 ("IA gerenciada"), mantido como
referência até o `apps/site` da Fase 1 substituí-lo:

```bash
npm install     # dependências
npm run dev     # http://localhost:4321
npm run build   # build em dist/
```

`legado/` guarda o MVP single-file anterior ao v1.
