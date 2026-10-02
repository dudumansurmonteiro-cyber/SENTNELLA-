# Sentinella — brief v3 para o Claude Code: white label para escritórios de cobrança

> Como usar: salve na raiz do repositório como `CLAUDE.md`, substituindo o v2. Este documento é um **delta**: tudo o que não está aqui continua valendo como no v2 (régua detalhada, modelo de dados, console do analista, direção de design, requisitos técnicos). Onde este arquivo e o v2 divergem, vale este. Tudo entre `[colchetes]` é decisão pendente: aparece como placeholder, nunca é preenchido com valor inventado.

(O brief v2 completo está preservado em `BRIEF-V2.md` neste repositório, incluindo as decisões de 29/09 — preços de volume e lembretes D−20/D−5.)

## 0. O que mudou em relação ao v2

| Antes (v2) | Agora (v3) |
|---|---|
| Cliente: indústria/distribuidora que vende a prazo | Cliente: **escritório de advocacia que faz cobrança** para credores (bancos, varejo, educação, saúde, condomínios, indústria) |
| Marca Sentinella visível para o devedor | **White label**: devedor e credor veem só a marca do escritório; Sentinella aparece apenas no contrato e, discretamente, no rodapé técnico |
| Dois níveis: Sentinella → cliente → lojista | **Três níveis**: Sentinella → escritório → credores do escritório → devedores |
| Etapa jurídica feita por "escritório parceiro" | **O cliente é o escritório**: a régua desemboca no fluxo judicial dele, sem parceiro externo |
| Devedores só pessoa jurídica (lojistas) | Devedores **PJ e pessoa física** — entram todas as regras do CDC para consumidor (seção 3) |
| Régua ancorada no vencimento (D0 = vence) | Régua ancorada na **entrada do título na carteira do escritório**, com variação por faixa de atraso (seção 4) |
| Planos: quem opera é sempre a Sentinella | Planos separam **plataforma** (equipe do escritório opera) de **operação** (analistas Sentinella operam sob a marca do escritório) |
| Preço por faixa de títulos ativos | Preço por **devedores ativos no mês**, sem qualquer participação nos honorários do escritório (seção 5) |
| Portal do lojista | **Portal do devedor** + **portal do credor**, ambos com a marca do escritório |

---

## 1. O que é a Sentinella agora

A Sentinella é a central de cobrança white label dos escritórios de advocacia. O escritório contrata; a IA cobra pelos canais que o escritório define; analistas (do escritório ou da Sentinella) cuidam das exceções e das ligações das 8h às 22h; o escritório acompanha tudo por carteira e por credor; cada credor do escritório ganha um portal para ver sua carteira; cada devedor ganha um portal para pagar ou negociar. Tudo com o nome do escritório.

Frase-síntese (site e todo material):

**Sua marca na frente. Nossa operação atrás.**

O que a Sentinella **não é**:
- Não é escritório de advocacia e não pratica advocacia. Nada que a plataforma gera substitui o ato privativo do advogado: petições, pareceres e notificações assinadas são do escritório.
- Não traz clientes para o escritório. A Sentinella não faz captação de clientela nem recebe nada por credor indicado — isso é vedado pelo Código de Ética da OAB e desqualificaria o escritório.
- Não recebe o dinheiro do devedor. Boletos e Pix são emitidos na conta do credor ou do escritório, conforme o contrato de cada carteira. A Sentinella nunca intermedia pagamento (evita enquadramento como instituição de pagamento junto ao BACEN).
- Não é seguradora. Continuam proibidas as palavras "seguro", "apólice", "cobertura", "garantia total", "100%".

---

## 2. Para quem

Escritórios de advocacia com área de cobrança estruturada, ou escritórios de cobrança com advogados, que operam carteiras de credores terceiros.

Perfil mínimo (abaixo disso, um CRM de cobrança barato resolve):
- A partir de 3.000 devedores ativos sob gestão, ou 3 credores recorrentes.
- Equipe de cobrança de 5 a 80 pessoas (negociadores, atendentes, advogados).
- Dor típica: custo e rotatividade da mesa de cobrança, sistema antigo sem WhatsApp oficial, relatório para o credor feito à mão em planilha, advogado perdendo tempo com negociação que não exige advogado.

Quem decide a compra: sócio responsável pela área de cobrança ou gerente de operações do escritório. Quem usa no dia a dia: coordenador de cobrança, negociadores, advogados da fase judicial. Quem olha o portal do credor: o gestor de crédito do credor.

Concorrência direta (sistemas que esses escritórios já usam): Cobmais, CobCloud, CPJ-Cobrança, Recuperador CRM e similares. São CRMs de cobrança: organizam a carteira, mas **não operam** — a mesa continua sendo gente do escritório ligando. O diferencial da Sentinella é IA nos canais + operação humana opcional + portais white label para credor e devedor.

Primeiro mercado: `[definir — sugestão: escritórios de cobrança de São Paulo e Paraná com carteiras de educação, saúde e condomínios, onde o volume é alto e o ticket é médio]`.

---

## 3. Regras que mudam com devedor pessoa física

Tudo do v2 (horários de ligação, uma ligação por dia, tom sem ameaça, WhatsApp só por API oficial, LGPD) continua. Entram as regras abaixo, obrigatórias no motor da régua e nos textos da IA:

- **CDC, art. 42**: o devedor não pode ser exposto a ridículo nem submetido a constrangimento ou ameaça. **Art. 71** torna crime cobrar com ameaça, coação, constrangimento ou informação falsa. Mensagem que cite consequência que o escritório não vai de fato tomar é informação falsa — a IA só cita protesto, negativação ou ação judicial se a régua daquela carteira realmente chega lá.
- **Terceiros**: nenhum contato com familiares, vizinhos, colegas ou empregador. O devedor PF só é contatado nos números e e-mails dele.
- **Local de trabalho**: sem ligação para o trabalho, salvo se o próprio devedor indicou o número.
- **Negativação (CDC, art. 43, §2º)**: comunicação prévia por escrito ao devedor antes de qualquer inclusão em cadastro de inadimplentes. A régua gera essa comunicação com prova de envio e só libera a negativação depois do prazo.
- **Superendividamento (Lei 14.181/2021)**: sem assédio ou pressão para contratar ou renegociar, atenção especial a idosos e a quem declarar vulnerabilidade; toda proposta de acordo mostra valor total, juros e número de parcelas antes do aceite.
- **Pedido de não contato**: se o devedor pedir para não ser contatado por um canal, o canal é bloqueado para ele e o caso vai ao analista para definir o próximo passo dentro da política do escritório.
- **Contestação de dívida**: se o devedor contestar, a cobrança daquele título pausa automaticamente e abre exceção para o escritório responder. Nunca negativar título contestado sem decisão do escritório.
- **Gravação**: toda ligação avisa a gravação no início; gravações ficam retidas por `[prazo definido pelo escritório, mínimo sugerido 5 anos]`.
- **LGPD com PF**: dado mínimo necessário, base legal registrada por carteira (execução de contrato ou legítimo interesse do credor), política de retenção por carteira, e atendimento a pedidos de titular dentro do prazo legal. A Sentinella é operadora; o escritório e o credor definem entre si quem é o controlador, e isso fica registrado no cadastro da carteira.

Essas regras não são configuráveis pelo escritório. O que o escritório configura é o que está **acima** delas (tom, horários mais restritos, canais).

---

## 4. A régua, reancorada

Escritórios recebem dívidas já vencidas, muitas vezes com 60, 90 ou 180 dias de atraso. Por isso a régua agora tem dois eixos: **E** (dias desde a entrada do título na carteira do escritório) e a **faixa de atraso** em que o título já estava quando entrou.

### Régua base por entrada na carteira

| Momento | Ação | Canal padrão | Quem faz |
|---|---|---|---|
| E+0 | Boas-vindas à cobrança: "o escritório X está responsável por este débito", com o valor atualizado e opções de pagamento | WhatsApp + e-mail | IA |
| E+2 | Proposta de acordo dentro da alçada da carteira | WhatsApp | IA; exceção vai ao analista |
| E+5 | Primeira ligação | Telefone | Analista |
| E+7 | Reforço com link do portal do devedor | SMS + WhatsApp | IA |
| E+10 | Segunda ligação + e-mail formal registrando contatos | Telefone + e-mail | Analista |
| E+15 | Comunicação prévia de negativação (CDC, art. 43, §2º) | Carta ou e-mail com prova de envio | Modelo do escritório; envio pela plataforma |
| E+20 | Notificação extrajudicial | E-mail com confirmação, carta com AR ou cartório | Redigida e assinada pelo advogado; a plataforma prepara e envia |
| E+30 | Negativação e/ou protesto, com autorização título a título | Birô / cartório eletrônico | Plataforma prepara; escritório autoriza |
| E+45 | Última proposta antes do judicial | WhatsApp + ligação | IA + analista |
| E+60 | Encaminhamento ao fluxo judicial do próprio escritório | Sistema jurídico do escritório | Automático, com dossiê |

### Ajustes por faixa de atraso na entrada

| Faixa de atraso ao entrar | Ajuste |
|---|---|
| Até 30 dias | Régua integral; começa com tom de lembrete |
| 31 a 90 dias | Régua integral; tom de regularização desde o E+0 |
| 91 a 180 dias | Pula o E+7; ligação já no E+3; proposta com desconto maior dentro da alçada |
| Acima de 180 dias | Régua curta: E+0, E+3 (ligação), E+10 (comunicação prévia), E+20 (notificação), E+30 (negativação/protesto), E+45 (judicial) |
| Título antecipado/descontado (PJ) | Mantém a regra do v2: protesto até 30 dias do vencimento, independente da entrada |

### O que o escritório configura

- Alçadas por carteira (desconto, parcelas, prazo, entrada mínima).
- Canais por carteira e por tipo de devedor (PF/PJ).
- Horário mais restrito que o legal, se o credor exigir.
- Textos das mensagens, dentro dos limites da seção 3 (a plataforma bloqueia textos com termos proibidos antes de salvar).
- No plano Max: dia, canal e tom de cada etapa; réguas diferentes por credor, por rating do devedor, por faixa de valor ou por tipo de dívida.

### Dossiê para o judicial

Ao chegar ao E+60 (ou quando o escritório mandar), a plataforma gera o dossiê: título e documentos, cálculo atualizado com memória, histórico completo de contatos com datas e canais, gravações, prova de envio das comunicações, promessas e acordos descumpridos. Exportável em PDF e enviável ao sistema jurídico do escritório.

---

## 5. Os três planos

Todos os planos incluem a plataforma white label completa: IA nos canais, painel do escritório, portal do credor, portal do devedor, console de atendimento, rating A–E, auditoria. O que muda é **quem opera** e **quanto se personaliza**.

### Comparativo

| | Básico — Plataforma | Avançado — Operação | Max — Personalizado |
|---|---|---|---|
| Quem atende exceções e liga | Equipe do próprio escritório, pelo console | Analistas Sentinella sob a marca do escritório, 8h–22h, seg–sex | Analistas Sentinella, time de referência nomeado, todos os dias 8h–22h |
| Régua | Régua Sentinella com os ajustes por faixa de atraso | Idem + ajustes por tipo de dívida (PF/PJ, educação, saúde, condomínio…) | Totalmente configurável por credor, rating, valor e tipo |
| Canais | WhatsApp, SMS, e-mail | + carta com AR, + ligação pelo console com gravação | Idem |
| Comunicação prévia, notificação, protesto, negativação | Plataforma prepara; escritório envia e autoriza | Plataforma prepara e envia; escritório assina e autoriza | Idem |
| Dossiê judicial | PDF | PDF + envio ao sistema jurídico `[integração]` | Idem + campos personalizados |
| Portal do credor | Padrão, com a marca do escritório | Padrão + relatório mensal automático por credor | Personalizável por credor |
| Usuários do escritório inclusos | 5 (adicional por usuário) | 10 | Ilimitados |
| Resposta a exceção (SLA) | — (equipe do escritório) | Até 15 min | Até 5 min |
| Revisão com o escritório | Mensal | Quinzenal | Semanal |

### Preços (proposta conservadora de lançamento — validar com três escritórios antes de publicar)

Cobrança mensal por **devedores ativos no mês** (devedor com ao menos um título em aberto na plataforma). Piso é o menor valor do plano; teto é o maior; acima do teto, excedente por devedor.

| Plano | Piso | Teto | Faixas | Implantação |
|---|---|---|---|---|
| Básico | R$ 1.900/mês | R$ 4.900/mês | até 2.000 devedores → piso; 2.001 a 10.000 → teto | R$ 5.000 a R$ 9.000 |
| Avançado | R$ 6.900/mês | R$ 24.900/mês | até 2.000 → piso; 2.001 a 10.000 → teto | R$ 9.000 a R$ 15.000 |
| Max | R$ 29.000/mês | `[sob proposta, com piso]` | a partir de 10.000 devedores ou qualquer volume com time dedicado | R$ 15.000 a R$ 25.000 |

Regras comuns:
- Excedente acima do teto: R$ 0,60 por devedor ativo (Básico) e R$ 2,50 (Avançado).
- Usuário adicional no Básico: R$ 90/mês.
- Custos de terceiros repassados ao custo: tarifas Meta (WhatsApp), SMS, carta, cartório, consulta a birô.
- Implantação: 50% na assinatura, 50% na entrada em produção.
- Contrato de 12 meses, reajuste anual pelo IPCA.
- **Sem participação nos honorários nem nos valores recuperados.** O Código de Ética da OAB veda ao advogado partilhar honorários com não advogado; qualquer remuneração da Sentinella atrelada ao êxito do escritório coloca o escritório em risco disciplinar. A Sentinella cobra por uso da plataforma e por operação, como qualquer fornecedor. `[confirmar redação do contrato com advogado especializado em ética profissional]`
- No site, os preços aparecem como "a partir de" por plano, com a tabela completa abaixo.

Nota interna (não vai ao site): no Avançado, o custo de analistas escala com o volume; a faixa de teto (10.000 devedores) está dimensionada para cerca de 4 analistas em pool compartilhado entre escritórios. Acima disso, só no Max, com time dedicado precificado por proposta. Dimensionamento de referência: um analista para cada 2.500 devedores ativos, com mínimo de dois analistas no pool para cobrir 8h–22h.

---

## 6. As cinco superfícies do produto

### 6.1 Site público (Sentinella, para escritórios)

- **Hero.** Título: *Sua marca na frente. Nossa operação atrás.* Subtítulo: *IA e analistas cobrando pelos canais certos, das 8h às 22h, com painéis para o seu escritório, para os seus clientes e para os devedores — tudo com o nome do seu escritório.* Botão principal: *Pedir diagnóstico da carteira*. Elemento visual: o painel simulado do v1/v2, agora com a marca fictícia "Almeida & Rocha Advogados" e um devedor saindo de "IA" para "analista" e voltando como "acordo fechado".
- **O problema.** *Sua mesa de cobrança liga para quem tem tempo de ligar. A IA fala com todos. Seu advogado entra só quando é caso de advogado.*
- **White label.** O que o credor vê (portal com a marca do escritório), o que o devedor vê (portal com a marca do escritório), o que ninguém vê (Sentinella).
- **A régua.** Linha do tempo da seção 4, com os pontos do E+0 ao E+60 e a marcação de onde o escritório assume o judicial.
- **Os três planos.** Tabela e preços da seção 5.
- **Conformidade.** Uma seção própria: CDC, LGPD, OAB. Dizer claramente o que a plataforma bloqueia (tom, terceiros, horários, negativação sem comunicação prévia) e o que fica com o advogado (assinatura, autorizações, judicial). Para escritório, isso vende mais que velocidade.
- **Perguntas frequentes.** Mínimo dez, incluindo: "Meus clientes vão saber que é a Sentinella?", "Quem assina a notificação?", "Vocês ficam com parte dos honorários?" (resposta: não, nunca), "Posso usar minha própria equipe?", "Como vocês tratam devedor pessoa física?", "Funciona com meu sistema jurídico?", "Quem emite o boleto?", "O que acontece se o devedor contestar?".
- **Contato.** Formulário: nome, escritório, cargo, e-mail, telefone, quantidade de devedores ativos (faixas), quantidade de credores, tipos de carteira (seleção múltipla: educação, saúde, condomínio, varejo, financeiro, indústria, outros), sistema de cobrança atual, sistema jurídico atual.
- Páginas secundárias: `/white-label`, `/regua`, `/planos`, `/conformidade`, `/privacidade`, `/piloto`.
- O site **não** pode conter nada que pareça oferta de clientes ao escritório ("trazemos credores", "indicamos carteiras"). Isso é captação indireta e proíbe o escritório de usar a Sentinella.

### 6.2 Painel do escritório

Herda as cinco áreas do painel do v2 (visão geral, devedores e maiores valores, eficiência por canal e etapa, hoje, configurações) com estas mudanças:

- **Nível de carteira acima de tudo.** Toda tela tem filtro por credor e por carteira; a visão geral soma todas as carteiras e mostra o ranking de carteiras por valor em aberto, por recuperação no mês e por rating médio.
- **Os dez maiores valores em atraso** continuam no topo, agora com a coluna "credor".
- **Faixas de atraso** por tempo desde a entrada e por atraso original, lado a lado.
- **Fila do dia por analista** (do escritório ou da Sentinella) e por carteira: agendado · em andamento · pendente · não atendido · cancelado · finalizado · bloqueado.
- **Pendências do advogado**: notificações a assinar, autorizações de protesto/negativação, contestações a responder, dossiês prontos para o judicial.
- **Honorários a faturar por credor**: cálculo informativo do que o escritório tem a cobrar de cada credor sobre o recuperado no mês, com a regra de cada contrato cadastrada pelo escritório. É só relatório — a Sentinella não participa desse valor.
- **Configurações**: credores e carteiras (regra de honorários, alçadas, canais, base legal LGPD, conta emissora de boleto), usuários e papéis (sócio, advogado, coordenador, negociador, financeiro), marca (logo, cores, nome que aparece nas mensagens e nos portais, número de WhatsApp do escritório), integrações.

### 6.3 Portal do credor (marca do escritório)

O que hoje o escritório manda em planilha mensal, o credor passa a ver quando quiser:

- Carteira entregue: quantidade, valor, faixa de atraso.
- Situação atual por status e por faixa; recuperado no mês e acumulado; acordos vigentes e previsão de recebimento.
- Eficiência por etapa (quanto foi pago depois de cada ponto da régua) — mostra ao credor que o escritório trabalha.
- Rating médio da carteira e distribuição A–E (sem identificar devedores individuais, se o escritório preferir).
- Relatório mensal em PDF, com a marca do escritório.
- O credor **não** vê outras carteiras, outros credores, nem o console.

### 6.4 Portal do devedor (marca do escritório)

Igual ao portal do lojista do v2, com estes ajustes:

- Acesso por link protegido enviado nas mensagens; identificação por CPF/CNPJ + código, sem senha.
- Mostra: quem é o credor original, quem está cobrando (o escritório), títulos em aberto com valor original, encargos conforme contrato e valor atualizado, títulos pagos, acordos e parcelas.
- Ações: 2ª via de boleto, Pix, proposta de acordo dentro da alçada (aceite imediato) ou fora (vai ao analista), informar pagamento com comprovante, contestar título (pausa a cobrança e abre exceção), pedir contato por outro canal, pedir para falar com uma pessoa.
- Toda proposta de acordo mostra o custo total antes do aceite (Lei 14.181/2021).
- Nunca mostra rating, outros devedores, nem dados do escritório além do nome, OAB e contato.

### 6.5 Console de atendimento

É o console do analista do v2, agora usado por duas populações: a equipe do escritório (Básico) ou os analistas Sentinella (Avançado/Max). Diferenças:

- O analista Sentinella trabalha com a identidade do escritório: assinatura nas mensagens, nome do escritório na ligação, roteiro aprovado pelo escritório.
- Um analista Sentinella pode atender vários escritórios; o console troca de "escritório ativo" com troca completa de marca, roteiro e alçadas, e registra em qual escritório cada ação foi feita. Nunca mistura dados.
- Papel "advogado": vê a fila de assinaturas e autorizações, assina notificação (upload do PDF assinado ou assinatura eletrônica `[decidir fornecedor]`), autoriza protesto/negativação em lote por carteira, recebe o dossiê judicial.
- Visão do coordenador do escritório: carga por negociador, SLA, incidentes por causa, acordos por negociador.

---

## 7. Modelo de dados — o que muda

Nova hierarquia multi-tenant: **Escritório** (tenant) → **Credor** → **Carteira** → **Devedor** → **Título**. Toda tabela de negócio carrega `escritorio_id`; as de carteira para baixo carregam também `credor_id` e `carteira_id`.

Entidades novas ou alteradas:
- **Escritório**: razão social, OAB, marca (logo, cores, nome de exibição), número de WhatsApp, plano, usuários e papéis, política de retenção.
- **Credor**: razão social, contatos, regra de honorários (informativa), usuários do portal do credor.
- **Carteira**: credor, tipo de dívida, alçadas, canais, base legal LGPD, controlador, conta emissora de boleto/Pix, data de entrada, régua aplicada (padrão ou personalizada).
- **Devedor**: PF ou PJ; CPF/CNPJ; contatos próprios (nunca de terceiros); bloqueios de canal; pedidos de não contato; rating.
- **Título**: + `data_entrada_carteira`, `atraso_original`, `contestado`, `comunicacao_previa_enviada_em`.
- **Documento jurídico**: tipo (comunicação prévia, notificação, autorização, dossiê), carteira, títulos, modelo usado, quem assinou, quando, prova de envio.
- **Marca ativa** em cada mensagem, ligação e documento gerado: registro de que foi emitido em nome de qual escritório.

Estados do título ganham `contestado` (pausa a régua) e `judicial` (saiu da régua extrajudicial). Estados da ação e da exceção continuam como no v2.

---

## 8. Integrações

| Sistema / canal | Como | Fase |
|---|---|---|
| Importação de carteiras | CSV/planilha padrão por credor, com validação e deduplicação | 1 |
| WhatsApp | API oficial via BSP `[decidir]`, com o número do escritório; templates de utilidade aprovados por escritório | 2 |
| E-mail e SMS | `[decidir fornecedores]` com domínio e remetente do escritório | 2 |
| Boleto e Pix | Emissão na conta do credor ou do escritório, por carteira, via API bancária `[decidir bancos homologados]` ou importação de arquivo retorno; baixa automática | 2 |
| Carta com AR / cartório | `[decidir]` | 3 |
| Ligação | Softphone no console com gravação e aviso `[decidir]`; integração com discadora do escritório `[avaliar]` | 3 |
| Negativação | Serasa/Boa Vista/SPC pelo convênio do escritório ou do credor | 3 |
| Protesto | Central eletrônica dos cartórios `[validar procuração e acesso]` | 3 |
| Sistema jurídico do escritório | Exportação de dossiê em PDF e JSON na Fase 2; conector com `[Projuris, Astrea, Advbox, SAJ ADV, Legal One — validar APIs]` na Fase 3 | 2 → 3 |
| Enriquecimento de contatos | Consulta a birô para localizar telefones atualizados `[decidir fornecedor e base legal por carteira]` | 3 |

Nenhuma integração real é pré-requisito da Fase 1.

---

## 9. Direção de design — o que muda

Continua tudo do v1/v2 (paleta, tipografia, âmbar só para exceção, nada de robô/cérebro, sem rótulos em caixa alta). Acréscimos:

- **Site da Sentinella** fala com advogado: sóbrio, denso em informação, seção de conformidade com peso visual igual à de planos. Nada de "revolucionário".
- **Portais white label**: a plataforma aplica logo, nome e duas cores do escritório sobre uma base neutra. A base precisa funcionar com qualquer cor primária — testar com três escritórios fictícios de cores diferentes no seed. A Sentinella aparece só como "plataforma operada por" em letra pequena no rodapé, e o escritório pode remover no Max.
- **Console**: ao trocar de escritório ativo, a barra superior muda de cor e nome — o analista nunca pode ter dúvida de em nome de quem está falando.

---

## 10. Fases de construção

1. **Fase 1 — Tudo com dados de demonstração.** Seed com 3 escritórios fictícios (cores diferentes), 8 credores, 15 carteiras de tipos variados (educação, saúde, condomínio, varejo, indústria), 6.000 devedores PF e PJ, 20.000 títulos com faixas de atraso variadas, 90 dias de histórico. Motor de régua simulado com os dois eixos da seção 4 e as regras da seção 3 ativas (bloqueios visíveis no seed). Painel do escritório, portal do credor, portal do devedor, console com troca de escritório, site.
2. **Fase 2 — Operação real.** Importação de carteira, régua com fila, WhatsApp/e-mail/SMS reais, boleto/Pix por carteira, conferência contra a carteira antes de cada envio, dossiê em PDF/JSON, portal do devedor com acordo e contestação funcionando.
3. **Fase 3 — Jurídico e escala.** Assinatura eletrônica, carta com AR, negativação e protesto, ligações com gravação, conector com sistema jurídico, enriquecimento de contatos, relatório mensal automático por credor.

Ordem dentro da Fase 1: seed → painel do escritório → portal do credor → portal do devedor → console → site.

---

## 11. Interpretações que fiz — confirmar ou corrigir

1. **"Escritórios de advocacia que trabalham com cobrança"** = escritórios que cobram **para credores terceiros**. Se a ideia incluir escritórios que cobram os próprios honorários atrasados, é outro produto e precisa de brief próprio.
2. **White label total**: credor e devedor nunca veem a Sentinella, salvo o rodapé técnico removível no Max. O contrato é entre Sentinella e escritório; o escritório é quem responde perante credor e devedor.
3. **O Básico é só plataforma**: a equipe do escritório opera. É o plano que compete de frente com os CRMs de cobrança e por isso é o mais barato.
4. **Analistas Sentinella falam em nome do escritório** nos planos Avançado e Max. Isso exige que o escritório aprove roteiros e supervisione — a plataforma registra essa aprovação. `[confirmar com advogado se há algum limite ético adicional para equipe terceirizada falando em nome do escritório; a prática de mesa de cobrança terceirizada é comum, mas vale o parecer]`
5. **Sem taxa de sucesso** em nenhum plano, pela vedação de partilha de honorários. Se você quiser remuneração variável, o único caminho que eu vejo é por volume operado (devedores ativos, mensagens, ligações), nunca por valor recuperado.
6. **Sentinella não toca no dinheiro.** Boleto e Pix saem na conta do credor ou do escritório.
7. **Devedor PF entra**, com todas as regras da seção 3 travadas no motor. Se você quiser começar só com PJ para simplificar, a seção 3 vira fase 2.
8. **Rating A–E** continua por devedor e ganha média por carteira, visível ao credor.
9. **Preços** são proposta conservadora e precisam de validação com três escritórios antes de ir ao site.

Decisões pendentes além dessas: `[domínio e e-mail]`, `[razão social e CNPJ]`, `[BSP de WhatsApp]`, `[fornecedores de e-mail, SMS, carta, telefonia, assinatura eletrônica]`, `[bancos para emissão de boleto]`, `[sistemas jurídicos a integrar]`, `[parecer sobre ética profissional: terceirização da mesa, white label e modelo de remuneração]`, `[textos de política de privacidade e DPA]`.

---

## 12. Critérios de aceite da Fase 1

1. As três aplicações (site, painel + console, portais) sobem localmente com um comando e um seed.
2. O painel do escritório filtra por credor e carteira, mostra os dez maiores valores com credor, as faixas de atraso nos dois eixos, a fila do dia por status e as pendências do advogado.
3. O portal do credor mostra só a carteira daquele credor, com a marca do escritório, e gera o relatório mensal em PDF.
4. O portal do devedor abre por link, mostra só os títulos daquele devedor, exibe o custo total antes de qualquer aceite e permite contestar (o título entra em `contestado` e a régua pausa).
5. O console troca de escritório ativo com mudança completa de marca, roteiro e alçadas, e cada ação registra em nome de qual escritório foi feita.
6. O motor simulado aplica a régua da seção 4 pelos dois eixos, bloqueia textos com termos proibidos, impede negativação sem comunicação prévia registrada e impede qualquer contato com dado de terceiro.
7. Nenhuma das palavras proibidas aparece; nenhum texto promete trazer clientes ao escritório; todos os `[placeholders]` estão em `PENDENCIAS.md`.
8. Site com Lighthouse acima de 90, seção de conformidade publicada e preços "a partir de".
