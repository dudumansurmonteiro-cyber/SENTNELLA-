# Produto — Sentinella (v3)

Monorepo do produto do brief v3 (`../CLAUDE.md`): a central de cobrança white
label dos escritórios de advocacia. Hierarquia escritório → credor → carteira
→ devedor → título; régua ancorada na **entrada do título na carteira**
(E+0…E+60) com ajuste por faixa de atraso; regras do CDC e da Lei 14.181
travadas no motor; painel do escritório, console com troca de escritório,
portal do credor e espaço do devedor — tudo com a marca do escritório.
(O brief v2 fica preservado em `../BRIEF-V2.md`; a implementação v2 foi
reaproveitada e reancorada.)

Nenhuma mensagem real é enviada em desenvolvimento: sem fornecedor definido e
sem credenciais, todos os canais operam em modo simulado, e os dados de teste
são sempre fictícios (CPF/CNPJ zerados, DDD 00, e-mails `.exemplo.invalid`).

## Rodar a demonstração (Fase 1 — sem banco)

```bash
npm install
npm run demo    # gera o seed estático e sobe painel (:3001) e portais (:3002)
```

## Rodar a operação (Fase 2 — banco + motor real)

```bash
npm install
npm run banco            # PostgreSQL 16 local (ou use um Postgres seu via .env)
cp .env.exemplo .env     # DATABASE_URL (e credenciais de canal, quando existirem)
npm run db:migrar        # aplica o schema v3 (packages/db/prisma)

npm run gerar:planilhas  # planilhas-modelo/ e dados-exemplo/ (determinístico)
npm run regua:simular    # cadastra o escritório demo, importa as planilhas e
                         # roda o motor real dia a dia por 90 dias
npm run build:real       # exporta do banco + portal em modo real + painel (/painel)
npm run servidor         # http://localhost:3000 — painel, portais e API
```

No dia a dia de um escritório, o ciclo é por **carteira**:

```bash
npm run importar -- ca1 devedores.csv titulos.csv   # §3 já na porta: contato de
                                                    # terceiro é descartado e relatado
npm run regua:tick            # uma vez por dia (ou -- --hoje=AAAA-MM-DD)
npm run assinar               # advogado assina as notificações preparadas
npm run autorizar             # escritório autoriza negativação/protesto (com os
                              # gates: comunicação prévia + prazo, nunca contestado)
npm run baixa -- ca1 pagamentos.csv
npm run rating:recalcular     # mensal
npm run exportar:demo         # banco → JSON para painel e portais
npm run verificar             # testes do motor (26 casos)
```

## As superfícies no servidor (Fase 2)

- `http://localhost:3000/painel/` — painel do escritório + console.
- `http://localhost:3000/d/?t=<token>` — espaço do devedor. Construído com
  `NEXT_PUBLIC_MODO=real`, as ações têm efeito real pela API: acordo dentro da
  alçada com **custo total antes do aceite** (Lei 14.181, grava
  `custoTotalAceitoEm`), contestação que **pausa a régua** e abre exceção,
  pagamento informado (pausa até a conferência da baixa), pedido de não
  contato por canal (a régua respeita; o caso vai ao analista) e falar com
  uma pessoa.
- `http://localhost:3000/c/?t=<token>` — portal do credor (leitura, sempre da
  exportação viva do banco).
- Os tokens de exemplo aparecem em `http://localhost:3000/` e em
  `apps/servidor/dados/exemplos.json`.

## Estrutura

```
apps/painel       # painel do escritório (§6.2) + console com troca de
                  #   escritório ativo (§6.5) — Next.js, white label por CSS vars
apps/portal       # espaço do devedor (§6.4) + portal do credor (§6.3)
                  #   NEXT_PUBLIC_MODO=real → lê e grava pela API (persistente)
apps/servidor     # Fase 2: serve painel/portais construídos + API do espaço
                  #   do devedor + JSONs regenerados do banco (cache curto)
packages/dados    # tipos do domínio, régua da entrada (§4) nos dois eixos,
                  #   rating A–E, formatação pt-BR, PRNG, seed da Fase 1 e
                  #   transporte (dump enxuto + hidratação)
packages/db       # Prisma + PostgreSQL: modelo do §7 (multi-tenant por
                  #   escritorioId, marca ativa, documentos jurídicos),
                  #   centavos, auditoria em toda mudança de estado
packages/motor    # Fase 2: planilhas padrão por carteira, importação com
                  #   descarte de contato de terceiro (§3), tick idempotente
                  #   da régua E+0…E+60, conferência pré-envio, assinatura e
                  #   autorização como atos do escritório, dossiê E+60,
                  #   baixa, acordos com custo total, rating, simulação de
                  #   90 dias e exportação banco → superfícies
planilhas-modelo/ # os três modelos que o escritório preenche (com LEIA-ME)
scripts/          # banco-local.sh, montar-demo, verificadores (uso interno)
```

## Como a Fase 2 cumpre o brief v3

- **Régua reancorada (§4)** — `passosDaRegua` monta o plano pelos dois eixos:
  dias desde a **entrada na carteira** e faixa de atraso original (até 30 /
  31–90 / 91–180 / >180 com régua curta). Título antecipado de devedor PJ
  mantém protesto em até 30 dias do vencimento. A fila é a tabela
  `AcaoCobranca`, processada por um tick diário idempotente (chave única
  título+etapa+canal+tentativa).
- **Seção 3 travada no motor, não configurável** — contato de terceiro é
  descartado na importação (nunca entra no banco) e telefone de trabalho só
  com indicação do próprio devedor; canal bloqueado pelo devedor bloqueia a
  ação e abre exceção; contestação pausa o título na hora; **negativação só
  com comunicação prévia registrada + prazo** (CDC art. 43 §2º) e nunca em
  título contestado; ligações seg–sáb, uma por dia por devedor; textos passam
  pela conferência de termos vedados, e menção a medida formal só nos
  documentos formais da régua.
- **Atos do escritório são do escritório** — a plataforma prepara; a
  notificação só sai com assinatura do advogado (`assinar`), negativação e
  protesto só com autorização título a título (`autorizar`), e o E+60 gera o
  dossiê (JSON, com histórico completo) marcado como entregue ao judicial.
- **Conferência antes de cada envio** — a mensagem renderizada é verificada
  contra o banco (valores centavo a centavo, datas, parcelas dentro da alçada,
  encargos só com cadastro da carteira); divergência bloqueia e abre exceção.
- **White label em tudo** — toda ação, mensagem e documento registra a
  `marcaAtiva` (em nome de qual escritório saiu); os portais aplicam a marca
  do escritório; rating nunca aparece ao devedor.
- **Acordos (Lei 14.181)** — as simulações mostram o custo total com os
  encargos embutidos ANTES do aceite, o aceite usa exatamente a mesma base e
  grava `custoTotalAceitoEm`.
- **Canais** — interface de driver por canal; em desenvolvimento tudo é
  simulado; drivers reais ficam atrás de credenciais e fornecedor
  (PENDENCIAS.md).

A simulação (`regua:simular`) usa o motor de produção de ponta a ponta: gera
planilhas, importa por carteira, roda o tick dia a dia por 90 dias e aplica um
modelo determinístico de comportamento dos devedores (respostas, promessas,
acordos, contestações, pagamentos). A exportação (`exportar:demo`) faz o
painel e os portais nascerem do banco real.

## Decisões registradas

- **Fila por tabela + cron** no lugar de BullMQ/Redis — alternativa prevista
  no brief, com idempotência garantida por chave única.
- **A demonstração publicada precisa funcionar montada em qualquer caminho**:
  painel e portal calculam a raiz do app em tempo de execução
  (`apps/*/lib/raiz.tsx`) e `scripts/relativizar.mjs` torna relativos os
  caminhos dos assets antes de publicar.
- **`apps/site` não existe**: o site público segue no Webflow, por decisão de
  produto.
- **Ações do painel/console continuam demonstrativas na interface**; na Fase
  2 a escrita persistente está no espaço do devedor (API) e nos comandos do
  motor (`assinar`, `autorizar`, `tick`, `baixa`). O console ganha escrita na
  Fase 3.
- **Portal do credor é leitura** (relatório vivo); o relatório mensal
  automático por credor entra na Fase 3 com os canais reais.
