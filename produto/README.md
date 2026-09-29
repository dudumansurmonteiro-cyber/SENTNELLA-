# Produto — Sentinella Recebíveis

Monorepo do produto (`../CLAUDE.md` §7 e §11): painel do cliente, console do
analista, portal do lojista e, a partir da Fase 2, o **motor de régua real**
sobre PostgreSQL — importação por planilha, fila de ações com conferência
antes de cada envio, baixa de pagamentos e portal transacional. Nenhuma
mensagem real é enviada em desenvolvimento: sem fornecedor definido e sem
credenciais, todos os canais operam em modo simulado (§12).

## Rodar a demonstração (Fase 1 — sem banco)

```bash
npm install
npm run demo    # gera o seed estático e sobe painel (:3001) e portal (:3002)
```

## Rodar a operação (Fase 2 — banco + motor real)

```bash
npm install
npm run banco            # PostgreSQL 16 local (ou use um Postgres seu via .env)
cp .env.exemplo .env     # DATABASE_URL (e credenciais de canal, quando existirem)
npm run db:migrar        # aplica o schema (packages/db/prisma)

npm run gerar:planilhas  # planilhas-modelo/ e dados-exemplo/ (determinístico)
npm run regua:simular    # importa as planilhas semana a semana e roda o motor
                         # real dia a dia por 90 dias (comportamento simulado)
npm run exportar:demo    # banco → JSON no formato que o painel/portal consomem

npm run build:real       # portal em modo real + painel (basePath /painel)
npm run servidor         # http://localhost:3000 — portal, painel e API
```

No dia a dia de um cliente real, o ciclo é: `importar` (lojistas e títulos) →
`regua:tick` (uma vez por dia, via cron) → `baixa` (pagamentos) →
`rating:recalcular` (mensal). Exemplos:

```bash
npm run importar -- c1 lojistas.csv titulos.csv
npm run regua:tick                       # ou -- --hoje=AAAA-MM-DD
npm run baixa -- c1 pagamentos.csv
npm run rating:recalcular
npm run verificar                        # testes do motor (20 casos)
```

## Estrutura

```
apps/painel       # painel do cliente (§7.2) + console do analista (§7.4) — Next.js
apps/portal       # portal do lojista (§7.3), mobile-first — Next.js
                  #   NEXT_PUBLIC_MODO=real → lê e grava pela API (persistente)
apps/servidor     # Fase 2: serve painel/portal construídos + API do portal
                  #   (acordo, 2ª via com encargos do dia, pagamento informado,
                  #   contestação, falar com pessoa) e JSONs vivos do banco
packages/dados    # tipos do domínio (§8), rating A–E (§6), formatação pt-BR,
                  #   PRNG e o seed estático da Fase 1
packages/db       # Prisma + PostgreSQL: modelo do §8, valores em centavos,
                  #   trilha de auditoria em toda mudança de estado
packages/motor    # Fase 2: planilhas padrão, importação com relatório por
                  #   linha, tick idempotente da régua (§3), conferência
                  #   pré-envio, drivers de canal (simulado por padrão),
                  #   baixa, rating sobre o banco, simulação e exportação
planilhas-modelo/ # os três modelos que o financeiro preenche (com LEIA-ME)
scripts/          # banco-local.sh, servidor estático e capturas (uso interno)
```

## Como a Fase 2 cumpre o brief (§11)

- **Importação CSV** — separador `;` (padrão Excel BR) ou `,`, vírgula decimal,
  datas dd/mm/aaaa; erros relatados linha a linha sem derrubar o arquivo;
  reimportação atualiza por CNPJ/número sem duplicar; título pago não é
  sobrescrito.
- **Motor de régua com fila** — a fila é a tabela `AcaoCobranca`, processada por
  um tick diário idempotente (chave única título+etapa+canal+tentativa), como
  previsto no brief ("BullMQ + Redis **ou cron gerenciado**"). Respeita: Básico
  termina no D+15 ("fora da régua"), duplicata antecipada notifica no D+15 e
  prepara protesto até o D+25 (Lei 5.474/68), bloqueio de pedidos só com ERP
  integrado e aprovação, ligações só em dias úteis/sábados e no máximo uma por
  dia por devedor, lista de não-cobrança, catch-up de carteira que já chega em
  atraso.
- **Conferência antes de cada envio** — a mensagem renderizada é verificada
  contra os dados importados (valores centavo a centavo, datas, multa/juros só
  com cadastro, parcelas dentro da alçada); divergência bloqueia o envio e abre
  exceção para o analista, com auditoria.
- **Canais** — interface de driver por canal; em desenvolvimento tudo é
  simulado (§12); os drivers reais ficam atrás de credenciais e da definição de
  fornecedor (PENDENCIAS.md) — sem isso, o envio cai no simulado e o motivo é
  registrado no resumo do tick.
- **Portal com 2ª via e proposta de acordo** — persistentes pela API: acordo
  dentro da alçada aprovado na hora (fora vira exceção), 2ª via imprimível com
  encargos do dia, pagamento informado pausa a cobrança até a conferência,
  contestação marca o título e avisa; tudo com trilha de auditoria (§8).
- **Baixa por importação** — marca pago, cancela ações futuras, avalia
  promessas (pagar até a data combinada cumpre) e confere os "já paguei".

A simulação (`regua:simular`) usa o motor de produção de ponta a ponta: gera as
planilhas, importa semana a semana, roda o tick dia a dia e aplica um modelo
determinístico de comportamento dos lojistas (respostas, promessas, pagamentos,
contestações). A demonstração publicada nasce desse ciclo via `exportar:demo`.

## Decisões registradas

- **Fase 1 sem banco** (aceite pedia telas sobre dados de demonstração);
  PostgreSQL + Prisma entraram na Fase 2 com o modelo do §8 em
  `packages/db/prisma/schema.prisma`, dinheiro em centavos e auditoria.
- **Fila por tabela + cron** no lugar de BullMQ/Redis — alternativa prevista no
  brief, com idempotência garantida por chave única.
- **Notificação extrajudicial (D+30)** sai por e-mail com confirmação de
  leitura na Fase 2 (canal previsto no §3); carta com AR e o texto definitivo
  do escritório parceiro entram na Fase 3 (pendência registrada).
- **A demonstração publicada precisa funcionar montada em qualquer caminho**
  (o visualizador de artifacts serve os arquivos sob um prefixo próprio):
  painel e portal calculam a raiz do app em tempo de execução
  (`apps/*/lib/raiz.tsx` — âncoras comuns no lugar do `next/link`) e
  `scripts/relativizar.mjs` torna relativos os caminhos absolutos dos assets
  no HTML exportado antes de publicar.
- **`apps/site` ainda não existe**: o site público segue no Webflow, por
  decisão de produto.
- **Ações do painel/console continuam demonstrativas** (aprovar autorização,
  registrar ligação): painel e console ganham escrita na Fase 3; na Fase 2 a
  escrita persistente está no portal do lojista e nos comandos do motor.
