# Fase 1 — Sentinella Recebíveis

Monorepo da Fase 1 do brief (`../CLAUDE.md`, §11): painel do cliente, console do
analista e portal do lojista, navegáveis sobre **dados de demonstração** — 3
indústrias fictícias, 400 lojistas, 3.000 títulos e 90 dias de operação
simulada pelo motor de régua. Nenhuma mensagem real é enviada (§12).

## Rodar

```bash
npm install
npm run demo    # gera o seed e sobe painel (:3001) e portal (:3002)
```

Comandos separados: `npm run seed` · `npm run dev:painel` · `npm run dev:portal`
· `npm run build` (export estático de ambos).

## Estrutura

```
apps/painel     # painel do cliente (§7.2) + console do analista (§7.4) — Next.js
apps/portal     # portal do lojista (§7.3), mobile-first — Next.js
packages/dados  # tipos do domínio (§8), motor de régua simulado (§3),
                # rating A–E (§6), formatação pt-BR e o seed determinístico
scripts/        # servidor estático e capturas de verificação (uso interno)
```

O seed escreve JSON em `apps/*/public/dados/` (ignorado no git; regenerado a
cada `npm run seed`). O painel e o portal são 100% renderizados no cliente
sobre esses arquivos, o que permite o export estático usado na demonstração
publicada.

## Decisões registradas da Fase 1

- **Sem banco nesta fase.** Os critérios de aceite da Fase 1 pedem telas
  navegáveis sobre dados de demonstração; um gerador determinístico em
  TypeScript cumpre isso e mantém o "sobe com um comando e um seed" literal.
  PostgreSQL + Prisma entram na Fase 2, quando há importação e persistência
  reais (o modelo de dados já está tipado em `packages/dados/src/tipos.ts`).
- **Ações da demo não persistem** (aprovar autorização, fechar acordo,
  registrar ligação): são estado de tela, com aviso visível.
- **`apps/site` ainda não existe**: o site público segue no Webflow, por
  decisão de produto; entra no monorepo quando a migração for decidida.
- Regras do brief exercitadas no seed: Básico para no D+15 ("fora da régua"),
  duplicata antecipada notifica no D+15 e protesta até o D+25, bloqueio de
  pedidos só com ERP integrado, mensagem sem multa quando o cliente não
  cadastrou multa, conferência contra o ERP bloqueando envio divergente.
