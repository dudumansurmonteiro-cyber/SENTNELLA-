# Sentinella

A Sentinella é a central de cobrança **white label** dos escritórios de
advocacia: a IA cobra pelos canais que o escritório define; analistas (do
escritório ou da Sentinella) cuidam das exceções e das ligações das 8h às 22h;
o escritório acompanha tudo por carteira e por credor; cada credor ganha um
portal para ver sua carteira e cada devedor, um portal para pagar ou negociar
— tudo com o nome do escritório.

> **Sua marca na frente. Nossa operação atrás.**

- **`CLAUDE.md`** — o brief v3 (white label para escritórios de cobrança). É a
  fonte de verdade: qualquer tarefa começa por ele. É um **delta** sobre o v2.
- **`BRIEF-V2.md`** — o brief v2 completo (cobrança para indústrias),
  preservado porque o v3 referencia tudo o que não altera.
- **`PENDENCIAS.md`** — decisões pendentes; placeholders aparecem como
  "sob consulta" / "em definição", nunca com valores inventados.

## Estado do projeto

**Pivô v3 adotado em 02/10.** As cinco superfícies do v3 (site, painel do
escritório, portal do credor, portal do devedor, console com troca de
escritório) ainda serão construídas na Fase 1 do v3, sobre a base já
implementada do v2:

- **Site público** — no Webflow, ainda no posicionamento v2:
  https://eduardos-top-notch-site-488aab.webflow.io (pivô para o v3 pendente)
- **`produto/`** — Fases 1 e 2 do v2 entregues: painel + console + portal
  navegáveis, e o motor de régua real sobre PostgreSQL (importação por
  planilha, fila com conferência pré-envio, baixa de pagamentos, portal
  transacional). Ver `produto/README.md`. Essa base evolui para a hierarquia
  do v3 (escritório → credor → carteira → devedor).
- **Demo navegável** (dados fictícios do v2):
  https://claude.ai/artifact/AZcXJ7wAB4rgmXZAEWoP5v

## Legado neste repositório

`src/` contém o site Astro do posicionamento v1 ("IA gerenciada"); `legado/`
guarda o MVP single-file anterior ao v1. Mantidos só como referência.
