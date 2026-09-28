# Sentinella Recebíveis — brief v2 para o Claude Code

> Como usar: este arquivo substitui o brief anterior e é a fonte de verdade do projeto. Leia inteiro antes de qualquer tarefa. Tudo entre `[colchetes]` é decisão pendente: deve aparecer como placeholder ("sob consulta" / "em definição"), nunca ser preenchido com valor inventado. Os preços da seção 4 são uma proposta conservadora de lançamento e podem ser alterados sem mudar a estrutura.

## 0. O que mudou em relação ao brief v1

| Antes (v1) | Agora (v2) |
|---|---|
| IA gerenciada genérica: atendimento, vendas, cobrança para qualquer empresa | Um produto só: **cobrança B2B operada** para indústrias e distribuidoras que vendem a prazo |
| Planos Operação / Operação Plus | Três planos: **Básico, Avançado e Max** (seção 4) |
| Só o site | Site **+ Painel do cliente + Portal do lojista + Console do analista** (seção 7) |
| Preço "sob consulta" | Preço **tabelado com piso e teto**, conservador (seção 4) |
| Um analista para dez clientes | **Um analista para cada cinco clientes**, 8h às 22h |
| — | **Rating A–E** de cada lojista (seção 6) |
| — | Cliente **escolhe os canais** de cobrança (WhatsApp, SMS, e-mail, carta, ligação) |

A direção de design (paleta, tipografia, o que evitar) continua a do v1 e está resumida na seção 10.

---

## 1. O que é a Sentinella Recebíveis

A Sentinella faz a indústria receber o que vendeu a prazo. Uma IA cobra e atende os lojistas pelo canal que o cliente escolher; uma central humana, das 8h às 22h, cuida de toda exceção e faz as ligações. O cliente acompanha tudo em um painel e o lojista vê suas dívidas em um portal próprio.

Frase-síntese (site e todo material):

**Sua empresa vendeu. A Sentinella faz você receber.**

O que a Sentinella **não é**:
- Não é software que o financeiro do cliente configura e opera sozinho (isso é Neofin, iRecebi). Nós operamos.
- Não é escritório de advocacia. A etapa judicial é feita por escritório parceiro com contrato direto com o cliente (Estatuto da OAB).
- Não é seguradora. Nunca usar "seguro", "apólice", "cobertura", "garantia total" ou "100%".

---

## 2. Para quem

Indústrias e distribuidoras de médio porte que vendem a prazo (duplicata/boleto) para muitos lojistas.

Perfil mínimo do cliente (abaixo disso, um software barato resolve melhor e não vale forçar a venda):
- Faturamento a partir de R$ 35–40 milhões/ano; faixa ideal de R$ 50 a 300 milhões.
- Pelo menos 300 lojistas ativos comprando a prazo, ou cerca de 800 títulos por mês.
- Inadimplência de 2% ou mais acima de 60 dias.
- ERP com API ou exportação de dados (TOTVS Protheus, Sankhya, SAP Business One, Senior, Omie, Bling).

Quem decide a compra: diretor financeiro, controller ou dono. Quem usa o painel no dia a dia: o financeiro. Quem usa o portal: o financeiro do lojista.

Primeiro mercado: polo moveleiro de Arapongas (PR). Setores seguintes: alimentos e bebidas, materiais de construção, autopeças, confecção, distribuição farmacêutica.

---

## 3. A régua base

Esta é a régua padrão da Sentinella. É uma sequência real, então pode receber numeração e linha do tempo no site e no painel. "D" é o dia do vencimento.

| Momento | Ação | Canal padrão | Quem faz | Plano |
|---|---|---|---|---|
| D−3 | Lembrete com boleto ou Pix | WhatsApp + e-mail | IA | Básico, Avançado, Max |
| D0 | "Vence hoje" + link de pagamento | WhatsApp + e-mail | IA | Básico, Avançado, Max |
| D+3 | Aviso de atraso + 2ª via atualizada, com multa e juros exatamente como no contrato | WhatsApp + e-mail | IA | Básico, Avançado, Max |
| D+7 | Proposta de acordo dentro da alçada definida pelo cliente | WhatsApp | IA; exceção vai ao analista | Básico, Avançado, Max |
| D+10 | Primeira ligação | Telefone | Analista | Básico, Avançado, Max |
| D+15 | Segunda ligação + e-mail formal registrando o que foi conversado | Telefone + e-mail | Analista | Básico, Avançado, Max |
| D+15 | Bloqueio de novos pedidos (só com ERP integrado e aprovação do cliente) | ERP | Automático | Avançado, Max |
| D+30 | Notificação extrajudicial com prova de recebimento | E-mail com confirmação, carta com AR ou cartório | Modelo redigido pelo escritório parceiro; envio pela Sentinella | Avançado, Max |
| D+45 | Protesto e/ou negativação, com autorização do cliente título a título | Cartório eletrônico (CENPROT) / birô | Sentinella prepara; cliente autoriza | Avançado, Max |
| D+60 a D+90 | Cobrança judicial | Escritório parceiro | Contrato direto cliente–escritório | Avançado, Max |

**O plano Básico termina no D+15.** Títulos que passam de 15 dias no Básico continuam no painel com status "fora da régua" e o cliente recebe uma sugestão de migrar para o Avançado.

Regras que o sistema precisa respeitar (não são opcionais):
- **Duplicata antecipada, descontada ou endossada** perde o direito de regresso se não for protestada em 30 dias (Lei 5.474/68, art. 13, §4º). Para esses títulos a notificação sai no D+15 e o protesto até o D+25. O título precisa ter o campo `antecipado: sim/não`, vindo do ERP ou do banco.
- **Ligações**: dias úteis das 8h às 20h, sábado das 8h às 14h; no máximo uma ligação por dia por devedor; só com o responsável financeiro ou sócio; aviso de gravação no início; registro de cada tentativa.
- **Tom**: sem ameaça, sem constrangimento, sem expor a dívida a terceiros. Avisar sobre protesto, negativação ou ação judicial que o cliente realmente pode tomar não é ameaça.
- **WhatsApp**: só API oficial via provedor homologado (BSP); mensagens fora da janela de 24h são templates aprovados na categoria utilidade, sem tom promocional; sempre há caminho para falar com humano.
- **LGPD**: a Sentinella é operadora; todo cliente assina contrato de tratamento de dados; só contatos da empresa devedora.

---

## 4. Os três planos

### Comparativo

| | Básico | Avançado | Max |
|---|---|---|---|
| Régua | Régua Sentinella fixa até o D+15 | Régua Sentinella completa até o D+90 | O cliente define cada etapa: em quantos dias, por qual canal, com qual tom; pode ter réguas diferentes por rating do lojista ou por faixa de valor |
| Mensagens (IA) | WhatsApp, SMS, e-mail — o cliente escolhe | Idem + carta | Idem |
| Ligações | Analista no D+10 e D+15 | Analista no D+10 e D+15 | Analista nos dias que o cliente definir |
| Etapa jurídica | Não tem | Notificação extrajudicial, protesto, negativação e encaminhamento ao escritório parceiro | Idem |
| Bloqueio de pedidos no ERP | Não | Sim, com aprovação | Sim, com aprovação |
| Central humana | Seg–sex, 8h–22h | Seg–sex, 8h–22h | Todos os dias, 8h–22h |
| Resposta a exceção | Até 15 min | Até 15 min | Até 5 min |
| Analista | Compartilhado | Compartilhado | De referência, nomeado |
| Painel do cliente | Completo | Completo | Completo |
| Portal do lojista | Sim | Sim | Sim |
| Rating A–E | Sim | Sim | Sim + régua por rating |
| Revisão com o cliente | Mensal | Quinzenal | Semanal |
| Relatório | Mensal | Mensal + Score Sentinella | Semanal + Score Sentinella |

### Preços (proposta conservadora de lançamento)

Preço mensal por faixa de títulos ativos no mês. Piso é o menor valor do plano; teto é o maior. Acima do teto, cobra-se excedente por título.

| Plano | Piso | Teto | Faixas | Implantação |
|---|---|---|---|---|
| Básico | R$ 2.900/mês | R$ 4.500/mês | até 500 títulos → piso; 501 a 1.500 → teto | R$ 6.000 a R$ 10.000 |
| Avançado | R$ 6.500/mês | R$ 9.500/mês | até 1.500 → piso; 1.501 a 5.000 → teto | R$ 12.000 a R$ 20.000 |
| Max | R$ 11.000/mês | R$ 15.000/mês | até 5.000 → piso; 5.001 a 10.000 → teto | R$ 20.000 a R$ 30.000 |

Regras comuns:
- Excedente acima do teto: R$ 2,00 por título.
- Implantação: 50% na assinatura, 50% na entrada em produção. O valor dentro da faixa depende do ERP (conector pronto → piso; ERP novo ou muito customizado → teto).
- Taxa de sucesso `[decidir: 3% sobre valores recuperados com mais de 30 dias de atraso, nos planos Avançado e Max]`.
- Custos de terceiros repassados ao custo: tarifas da Meta (WhatsApp), SMS, carta, cartório.
- Contrato de 12 meses, reajuste anual pelo IPCA.
- No site, os preços aparecem como "a partir de R$ 2.900/mês" por plano, com a tabela completa abaixo. Não usar "sob consulta" onde há preço.

Nota interna (não vai ao site): o Básico opera com margem fina — com um analista para cinco clientes, impostos e IA, sobra pouco. Ele existe como porta de entrada; a meta comercial é migrar cada cliente Básico para Avançado em até 6 meses, usando o painel como argumento ("veja o que está parado depois do D+15").

---

## 5. Como operamos

**Central humana.** Um analista para cada cinco clientes, com mínimo de dois analistas desde o primeiro cliente para cobrir 8h–22h (dois turnos). O analista não fica olhando tela: o sistema classifica cada conversa e cada título, e o humano atua nas exceções e nas ligações programadas.

**Gatilhos de exceção** (a conversa sai da IA e vai ao analista):
- Lojista pede para falar com pessoa.
- Sinal de irritação ou contestação (produto com defeito, entrega, valor discordado).
- Pedido de acordo fora da alçada.
- Título acima do valor-limite definido pelo cliente.
- IA sem resposta confiável, ou repetindo a mesma resposta.
- Qualquer mensagem que citaria valor, data, desconto ou juros diferentes do que está no ERP é **bloqueada antes do envio** e vai ao analista (conferência automática contra o ERP).

**O que o analista faz:** assume em até 15 min (5 no Max), resolve ou aciona o representante comercial do cliente, registra o incidente com causa; se o caso revelar regra faltando, propõe a mudança e ela entra na régua do cliente.

**Fora do horário (22h–8h):** a IA responde dúvidas simples e envia 2ª via; não fecha acordo, não executa ação irreversível; tudo o mais vai para a fila que o primeiro turno revisa às 8h.

**Ligações:** feitas pelo analista nos dias da régua, só para títulos relevantes (acima de `[R$ valor]` ou lojistas que ignoraram três mensagens). Tentativas não atendidas são registradas e reprogramadas para o dia seguinte, respeitando o limite de uma por dia.

---

## 6. Rating A–E dos lojistas

Cada lojista de cada cliente recebe uma letra, recalculada mensalmente, com base nos últimos 12 meses:

| Critério | Peso | Como medir |
|---|---|---|
| Pontualidade | 40% | Dias médios de atraso ponderados pelo valor |
| Tempo de resposta | 20% | Horas entre o contato da Sentinella e a primeira resposta do lojista |
| Promessas cumpridas | 20% | % de promessas de pagamento pagas na data combinada |
| Frequência de atraso | 10% | % de títulos pagos após o vencimento |
| Exceções geradas | 10% | Contestações e escalonamentos por título |

Escala: **A** (paga antes ou no vencimento, responde no mesmo dia) · **B** · **C** · **D** · **E** (atraso recorrente acima de 30 dias, não responde ou não cumpre promessas). Lojista novo entra como C até ter três títulos de histórico.

Para que serve:
- No painel, o cliente vê o rating ao lado de cada lojista e a distribuição da carteira por letra.
- No Max, o cliente pode ter réguas diferentes por rating (por exemplo, A recebe só lembrete; E recebe ligação já no D+3).
- É o primeiro passo do produto futuro "a quem vender a prazo e quanto".

O rating nunca é mostrado ao lojista.

---

## 7. Produto: as quatro superfícies

### 7.1 Site público

Mesma estrutura do v1, adaptada ao produto de cobrança:

- **Hero.** Título: *Sua empresa vendeu. A Sentinella faz você receber.* Subtítulo: *Cobrança por IA e analistas humanos, das 8h às 22h, no canal que seus lojistas usam — com um painel que mostra cada real que está na rua.* Botão principal: *Pedir diagnóstico da carteira*. Elemento visual: o painel simulado do v1, agora mostrando um título em atraso saindo de "IA" para "analista" e voltando como "acordo fechado".
- **O problema.** *O financeiro liga para os dez maiores. Os outros trezentos ficam para depois.*
- **A régua.** Linha do tempo da seção 3, com os pontos do D−3 ao D+90 e a marcação de onde cada plano termina.
- **Os três planos.** Tabela comparativa e preços da seção 4.
- **O painel.** Capturas reais do painel (seção 7.2), não ilustrações.
- **O portal do lojista.** Uma captura e três linhas: o lojista vê o que deve, paga ou propõe acordo, fala com uma pessoa.
- **Compromissos.** SLA por plano; "responsabilidade contratual com teto definido".
- **Perguntas frequentes.** Mínimo oito, incluindo: "Vocês cobram de forma agressiva?", "E se o lojista contestar a entrega?", "Funciona com meu ERP?", "Quem faz a parte judicial?", "Como fica a LGPD?", "Posso escolher só WhatsApp?".
- **Contato.** Formulário de diagnóstico: nome, empresa, cargo, e-mail corporativo, telefone, ERP usado, faturamento anual (faixas), quantidade de lojistas ativos (faixas), inadimplência estimada acima de 60 dias (faixas).
- Páginas secundárias: `/regua`, `/planos`, `/portal-do-lojista`, `/privacidade`, `/piloto`.

### 7.2 Painel do cliente

É o produto que o cliente abre todo dia. Cinco áreas, em ordem de importância.

**a) Visão geral**
- Total a receber; total em atraso; recebido no mês; recuperado após atraso no mês.
- Atraso por faixa: 1–7, 8–15, 16–30, 31–60, mais de 60 dias — em valor e em quantidade de títulos.
- Prazo médio de recebimento (DSO); % de títulos pagos até o vencimento; % de promessas cumpridas.
- Score Sentinella da carteira (0–100) e evolução mensal.

**b) Devedores e maiores valores**
- Painel fixo no topo: **os dez maiores valores em atraso**, por lojista, com valor, dias de atraso, rating e etapa da régua em que está. Este é o destaque visual mais forte da tela.
- Lista completa de lojistas com filtros: rating, faixa de atraso, etapa, canal, valor.
- Ficha do lojista: títulos abertos e pagos, histórico de contatos (mensagem, ligação, resposta), promessas, acordos, exceções, rating e por quê.
- Quantos lojistas devem hoje, quanto, e há quanto tempo (distribuição).

**c) Eficiência por canal e por etapa**
- Mensagens: enviadas, entregues, lidas, respondidas, pagas em até 48h após o contato — por canal (WhatsApp, SMS, e-mail, carta) e por etapa da régua (D−3, D0, D+3, D+7…).
- Ligações: realizadas, atendidas, não atendidas, promessas obtidas, promessas cumpridas, pagas em até 7 dias.
- Conversão de cada etapa: quanto foi pago depois de cada ponto da régua. É o que diz ao cliente qual etapa funciona.
- Comparação mês a mês.

**d) Hoje (operação do dia)**
- Ações programadas para hoje: quantas mensagens saem, quantas ligações o analista vai fazer, quantas notificações, quantos protestos aguardam autorização.
- Fila por status: **agendado · em andamento · pendente (aguardando resposta do lojista) · não atendido · cancelado · finalizado**.
- Exceções abertas agora e quem está cuidando.
- Pendências que dependem do cliente: autorizações de protesto, contestações para o representante responder, alçadas a aprovar.

**e) Configurações**
- Canais habilitados (WhatsApp, SMS, e-mail, carta, ligação) e ordem de preferência.
- Alçadas de negociação: desconto máximo, parcelamento máximo, prazo máximo, valor acima do qual sempre vai ao analista.
- Régua: somente leitura no Básico e Avançado; editável no Max (dia, canal, tom e texto de cada etapa; réguas por rating ou faixa de valor).
- Horários e feriados; lista de lojistas que não devem ser cobrados (em negociação comercial, estratégicos).
- Usuários e permissões; integrações (ERP, WhatsApp, e-mail).
- Exportação: CSV e PDF de qualquer tela; relatório mensal em PDF.

### 7.3 Portal do lojista

Interpretação adotada: é o "parecido com a Conta Azul" — uma tela financeira limpa onde **o lojista (devedor)** vê o que deve à indústria. Se a intenção era outra, ajustar aqui.

- Acesso por link protegido enviado no WhatsApp ou e-mail (sem senha), com a marca da indústria; a Sentinella aparece discretamente como operadora.
- O lojista vê: títulos em aberto com vencimento, valor original, multa e juros já calculados, dias de atraso; títulos pagos; acordos vigentes e parcelas.
- Ações: baixar 2ª via de boleto, copiar Pix, propor acordo (dentro da alçada, aprovado na hora pela IA; fora dela, vai ao analista), informar pagamento já feito (anexa comprovante), contestar um título (abre exceção e avisa o representante), falar com uma pessoa.
- Nunca mostra rating, nem dados de outros lojistas, nem o que a indústria deve a terceiros.
- Mobile-first: o financeiro do lojista abre isso no celular.

### 7.4 Console do analista (interno)

Necessário para o um-para-cinco funcionar.

- Fila de exceções com cronômetro do SLA, ordenada por valor e tempo.
- Ao assumir: a conversa inteira, a ficha do lojista, os títulos, a alçada do cliente e as regras da régua na mesma tela. Botões para: responder, fechar acordo dentro da alçada, propor fora da alçada (vai ao cliente aprovar), acionar representante, agendar ligação, registrar incidente com causa, marcar título como contestado.
- Agenda de ligações do dia por cliente, com roteiro de ligação do plano e campo de registro (atendida, não atendida, promessa, data).
- Painel de todos os clientes do analista: exceções abertas, ligações pendentes, títulos parados.
- Visão do coordenador: carga por analista, SLA cumprido, incidentes por causa, sugestões de regra pendentes.

---

## 8. Modelo de dados e estados

Multi-tenant: toda tabela de negócio carrega `cliente_id`. Nunca misturar dados entre clientes.

Entidades principais:
- **Cliente** (a indústria): plano, canais, alçadas, régua, ERP, usuários.
- **Lojista** (o devedor): CNPJ, contatos (financeiro, sócio), rating atual e histórico, lista de bloqueio.
- **Título**: número, valor, vencimento, origem (ERP/CSV), `antecipado`, multa/juros contratuais, status.
- **Ação de cobrança**: título, etapa da régua, canal, data programada, status, resultado (entregue, lido, respondido, atendida, promessa…).
- **Conversa**: canal, mensagens, quem falou (IA, analista, lojista), motivo de exceção.
- **Acordo**: título(s), condições, parcelas, status.
- **Exceção/Incidente**: motivo, quem assumiu, tempo até assumir, resolução, causa, regra sugerida.
- **Autorização**: protesto, negativação, bloqueio — pedido, quem aprovou, quando.

Estados do **título**: `a vencer → vencido → em negociação → acordo → pago | protestado | negativado | jurídico | contestado | cancelado | fora da régua` (este último só no Básico após D+15).

Estados da **ação**: `agendada → em andamento → finalizada | não atendida | pendente | cancelada | bloqueada` (bloqueada = barrada pela conferência contra o ERP).

Estados da **exceção**: `aberta → em atendimento → resolvida | devolvida ao cliente`.

Toda mudança de estado gera registro com data, hora e autor (IA, analista, cliente, lojista, sistema). É a trilha de auditoria que o cliente exporta e que protege a Sentinella.

---

## 9. Integrações e canais

| Canal / sistema | Como | Fase |
|---|---|---|
| WhatsApp | API oficial via BSP `[decidir: 360dialog, Gupshup, Twilio ou Zenvia]`; templates de utilidade aprovados; número da indústria | 2 |
| E-mail | Resend ou SES `[decidir]`, com confirmação de leitura onde possível | 2 |
| SMS | Zenvia ou Twilio `[decidir]` | 2 |
| Carta com AR | Serviço de carta registrada digital `[decidir]` | 3 |
| Ligação | Softphone no console do analista com gravação e aviso `[decidir fornecedor]`; voz por IA fica para depois | 3 |
| ERP | Fase 1: importação por CSV/planilha padrão. Fase 2: um conector (Omie ou Bling, pela API aberta). Fase 3: Sankhya, TOTVS Protheus, SAP B1, Senior | 1 → 3 |
| Protesto | Integração com a central eletrônica dos cartórios (CENPROT) `[validar acesso e procuração com advogado]` | 3 |
| Negativação | Pelo convênio do próprio cliente com Serasa/Boa Vista | 3 |
| Pagamento | Leitura de boleto/Pix pelo ERP ou banco do cliente; baixa automática | 2 |

Nenhuma integração real é pré-requisito para a Fase 1 (seção 11): o painel, o portal e o console nascem sobre dados de demonstração.

---

## 10. Direção de design (resumo do v1 + regras para o painel)

- Paleta: fundo `#F4F6F5`, tinta `#14211F`, primária `#0E4A45`, neutro `#C6CFCB`, sinal âmbar `#D99A00` **só para exceções e ações que precisam de humano**. Modo escuro automático.
- Tipografia: Bricolage Grotesque para títulos; IBM Plex Sans para texto e para o painel, com algarismos tabulares nas colunas numéricas.
- O elemento memorável do site continua sendo a sequência do painel no hero, uma vez, respeitando `prefers-reduced-motion`.
- **Painel:** denso mas legível; tabelas com números alinhados à direita e valores em R$ com duas casas; sem cartões arredondados para tudo; bordas só onde encodam estrutura. Os "dez maiores valores" ganham o maior peso visual da tela por tamanho e posição, não por cor.
- **Rating A–E:** letra dentro de um selo com escala de cinco tons neutros e a letra sempre visível — nunca só cor (acessibilidade).
- **Status:** cada status tem um ícone e um texto; cor é reforço, não a única informação.
- Evitar tudo o que o v1 lista: creme com terracota, preto com neon, rótulos em caixa alta, setas em botões, animação em cada seção, gradientes, ícones de robô/cérebro, uma palavra destacada no título.

---

## 11. Requisitos técnicos e fases de construção

**Stack sugerida** (justificar antes de trocar): Next.js (App Router) + TypeScript + Tailwind; PostgreSQL com Prisma; autenticação com papéis (admin Sentinella, analista, cliente, lojista via link protegido); fila de jobs para a régua (BullMQ + Redis ou cron gerenciado); um monorepo com `apps/site`, `apps/painel` (cliente + console do analista) e `apps/portal` (lojista), compartilhando `packages/db` e `packages/ui`. Deploy: Vercel ou Cloudflare `[decidir]`; banco gerenciado `[decidir]`.

**Requisitos gerais:** `lang="pt-BR"` em tudo; mobile-first (portal e site) e desktop-first (painel e console) — testar em 360, 768, 1280, 1440; acessibilidade AA, foco visível, `prefers-reduced-motion`; Lighthouse acima de 90 no site; logs de auditoria em toda mudança de estado; dados de teste nunca com CNPJ real.

**Fases** (cada uma entregável e demonstrável sozinha):

1. **Fase 1 — Site + painel + portal + console com dados de demonstração.** Motor de régua simulado (gera ações agendadas a partir de títulos fictícios), rating calculado sobre os dados de exemplo, todas as telas da seção 7 navegáveis. Seed com 3 clientes fictícios, 400 lojistas, 3.000 títulos e 90 dias de histórico, com nomes claramente fictícios.
2. **Fase 2 — Régua real.** Importação CSV, motor de régua com fila, WhatsApp/e-mail/SMS de verdade, conferência contra os dados importados antes de cada envio, portal com 2ª via e proposta de acordo, baixa de pagamento por importação.
3. **Fase 3 — Operação completa.** Conector de ERP, ligações pelo console com gravação, carta com AR, notificação extrajudicial, fluxo de autorização de protesto/negativação, relatório mensal em PDF, régua editável do Max.

Começar pela Fase 1, na ordem: seed → painel (a, b, d) → portal → console → site.

---

## 12. O que não fazer

- Não inventar clientes, logos, depoimentos ou números de resultado. Os números do site vêm do exemplo de retorno (indústria de R$ 60 milhões) e são apresentados como estimativa.
- Não usar "seguro", "apólice", "cobertura", "garantia total", "100%", "revolucionário", "disruptivo".
- Não deixar texto em inglês na interface (inclusive status: é "pendente", não "pending").
- Não mostrar o rating ao lojista. Não mostrar dados de um cliente para outro.
- Não enviar nenhuma mensagem real a partir de dados de demonstração. Em ambiente de desenvolvimento, todos os canais ficam em modo simulado por padrão.
- Não calcular multa e juros com valores "padrão": sempre a partir do que está cadastrado por cliente. Se não houver cadastro, a mensagem não menciona multa.
- Não substituir `[placeholders]` por valores inventados.

---

## 13. Interpretações que fiz — confirmar ou corrigir

1. O "parecido com a Conta Azul" é o **portal do lojista** (o devedor vê suas dívidas e prazos). Se a intenção era uma visão tipo Conta Azul para a própria indústria, isso já é o painel do cliente (7.2) — avisar para eu fundir.
2. O **painel do cliente está em todos os planos**, inclusive no Básico. A diferença entre planos está na régua, nos canais, na etapa jurídica, na personalização e no SLA — não em esconder informação.
3. O **Básico termina no D+15**, sem notificação, protesto ou jurídico. Títulos além disso ficam visíveis como "fora da régua".
4. **Carta** só no Avançado e no Max, porque na prática é o veículo da notificação extrajudicial.
5. **Ligações são humanas em todos os planos**, feitas pelo analista. Voz por IA fica para uma fase futura.
6. **Central 7 dias por semana** só no Max. Básico e Avançado são seg–sex.
7. Preços por **faixa de títulos ativos no mês**, não por conversas.
8. **Taxa de sucesso** ficou como decisão pendente.
9. Um analista para cinco clientes, com mínimo de dois analistas, é premissa de custo — o console (7.4) existe para que isso se sustente.

Decisões pendentes além dessas: `[domínio e e-mail]`, `[razão social e CNPJ]`, `[BSP de WhatsApp]`, `[fornecedores de e-mail, SMS, carta e telefonia]`, `[valor-limite para ligação]`, `[escritório parceiro]`, `[texto da política de privacidade e do DPA, revisados por advogado]`.

---

## 14. Critérios de aceite

**Fase 1 está pronta quando:**
1. As três aplicações (site, painel com console, portal) sobem localmente com um comando e um seed.
2. O painel mostra as cinco áreas da seção 7.2 com os dados de demonstração, incluindo os dez maiores valores no topo, a fila por status e a eficiência por canal e etapa.
3. O rating A–E é calculado pela fórmula da seção 6 e a ficha do lojista explica a nota.
4. O motor simulado gera as ações da régua da seção 3 respeitando o plano de cada cliente fictício (o Básico para no D+15) e a regra dos títulos antecipados.
5. O portal do lojista abre por link, mostra só os títulos daquele lojista e permite propor acordo dentro da alçada.
6. O console mostra a fila de exceções com cronômetro e permite assumir, resolver e registrar incidente.
7. Nenhuma das palavras proibidas aparece em lugar nenhum; todos os `[placeholders]` estão listados em `PENDENCIAS.md`.
8. Site com Lighthouse acima de 90 e os preços da seção 4 publicados como "a partir de".

**Fase 2 e 3** terão critérios próprios quando a Fase 1 for aprovada.
