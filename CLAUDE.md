# Sentinella — brief para construção do site

> Este arquivo é a fonte de verdade do site. Contém o posicionamento, o modelo operacional, a estrutura do site com o texto pronto, a direção de design e os requisitos técnicos. Tudo entre [colchetes] é decisão pendente que deve ficar visível como placeholder até ser preenchida — nunca inventar valores no lugar. Pendências abertas ficam listadas em `PENDENCIAS.md`.

## 1. O que é a Sentinella

A Sentinella é uma empresa de **IA gerenciada** para empresas brasileiras. Construímos agentes de inteligência artificial para atendimento, vendas, cobrança e triagem — e colocamos sob operação **qualquer IA que trabalhe na empresa**: a que conversa com cliente, a que decide processo (classificar e distribuir leads, priorizar documentos) e a que a própria equipe usa no dia a dia (prompts, respostas, dados que não podem sair). Tudo com uma central humana que acompanha das 8h às 22h, intervém quando a IA não deve decidir sozinha e ajusta o sistema continuamente.

Princípio do escopo: tudo o que a IA fizer pela empresa pode entrar — desde que entre **com monitoramento**.

**Frase-síntese do posicionamento** (usar no site e em todo material):

> Construímos a sua IA. E ficamos operando ela.

O diferencial não é construir — centenas de agências fazem isso. É **não ir embora depois da entrega**. Toda empresa que contrata um agente de IA hoje fica com um sistema que ninguém opera. A Sentinella resolve o problema inteiro.

**O que a Sentinella não é** (e o site não pode sugerir que seja):

- Não é seguradora e não vende seguro. Nunca usar as palavras "seguro", "apólice", "cobertura" ou "garantimos 100%".
- Não é uma plataforma self-service. O cliente não configura nada; nós operamos.
- Não é consultoria. Entregamos sistema funcionando e operação contínua, não relatório.

## 2. Para quem

Empresas de médio porte no Brasil (50 a 1.500 funcionários) que precisam de IA em contato com cliente ou com decisão automatizada, mas não querem contratar e manter um time de IA.

Setores prioritários e o que cada um mais teme:

| Setor | Onde a IA entra | O que o cliente mais teme |
|---|---|---|
| Fintechs e crédito | Atendimento, cobrança, onboarding | Promessa errada ao cliente, cobrança abusiva, bloqueio indevido |
| Healthtechs e clínicas | Triagem, agendamento, acompanhamento | Orientação clínica errada, dado de saúde exposto |
| Varejo e e-commerce | SAC, pós-venda, recomendação | Informação de prazo ou preço errada que vira obrigação (CDC art. 30) |
| Serviços e educação | Qualificação de leads, suporte, matrícula | Lead perdido, aluno mal atendido, tom inadequado |

Quem decide a compra: diretor de operações, head de atendimento/CX, head de risco (fintech) ou diretor médico (saúde). Raramente o CTO. O site fala com quem sente a dor operacional, não com engenheiro.

## 3. Como operamos (quadro operacional)

Este é o núcleo do negócio e a seção mais importante do site. Três etapas, sempre nesta ordem — é uma sequência real, então numeração é apropriada aqui.

### Etapa 1 — Construir (2 a 6 semanas)

- Diagnóstico: mapeamos os fluxos de conversa atuais, os sistemas envolvidos (CRM, WhatsApp, ERP, agenda) e as regras de negócio.
- Desenho: definimos o que o agente pode fazer sozinho, o que precisa de humano, e o tom de voz da marca.
- Construção sobre o núcleo padronizado da Sentinella: mesma plataforma de monitoramento, mesmos processos de intervenção, personalização no tom, nas integrações e nas regras.
- Homologação com conversas reais em ambiente de teste, com o cliente aprovando os casos críticos.
- Entrada em produção gradual (por exemplo, 10% do volume na primeira semana).

Entregáveis: agente em produção, painel de monitoramento, documento de regras de operação, treinamento da equipe do cliente para receber transferências.

### Etapa 2 — Operar (mensal, contínuo)

Central de operação humana das 8h às 22h. Os analistas não ficam olhando tela: o sistema de monitoramento classifica cada conversa e decisão em tempo real e o humano atua só nas exceções.

Gatilhos que transferem a conversa para um analista:

- Cliente pede para falar com humano.
- Sinais de irritação ou frustração.
- Tema sensível: cancelamento, reclamação formal, dados pessoais, saúde, questão jurídica, ameaça.
- Agente sem resposta confiável (baixa confiança) ou repetindo a mesma resposta.
- Ação com valor financeiro ou efeito irreversível acima do limite definido com o cliente.
- Resposta que viola a política escrita do cliente.

O que o analista faz ao receber uma exceção: assume a conversa em até 5 minutos, resolve ou transfere para o time do cliente, registra o incidente com causa, e — quando o caso revela uma falha de regra ou prompt — corrige e documenta a mudança.

Fora do horário (22h às 8h): o agente entra em modo conservador. Responde dúvidas simples, não executa ações críticas, agenda retorno e coloca o restante numa fila que o primeiro turno revisa às 8h.

### Etapa 3 — Evoluir (contínuo)

- Revisão quinzenal com o cliente: o que mudou, o que falhou, o que ajustamos.
- Relatório mensal com volume, taxa de resolução pela IA, exceções por mil conversas, tempo médio de intervenção, incidentes e o **Score Sentinella** — índice de 0 a 100 da saúde da operação, calculado a partir dessas métricas e da conformidade com a política do cliente.
- Ajustes de prompt, regras e integrações incluídos na mensalidade.

### Compromissos de serviço (SLA)

| Compromisso | Plano Operação | Plano Operação Plus |
|---|---|---|
| Acompanhamento humano | 8h–22h, segunda a sexta | 8h–22h, todos os dias |
| Resposta a exceção | até 5 minutos | até 3 minutos |
| Correção de defeito crítico | até 4 horas | até 2 horas |
| Disponibilidade do agente | 99,5% | 99,5% |
| Revisão com o cliente | quinzenal | semanal |
| Analista | compartilhado | dedicado |

Decisão pendente: o acompanhamento de fim de semana no plano base é uma escolha de custo, não de tecnologia. Pode mudar depois de validar com os primeiros clientes.

Nota de vocabulário: o brief original usava "Cobertura humana" nesta tabela; como a seção 8 proíbe a palavra "cobertura" em qualquer lugar do site (vocabulário de seguro), a linha usa "Acompanhamento humano" e o plano Plus usa "atendimento 7 dias".

### Responsabilidade

O que a Sentinella assume por contrato: correção de defeitos sem custo dentro do SLA e ressarcimento de prejuízo direto comprovado até um teto definido em contrato [valor ou múltiplo do contrato — definir com advogado]. No site isso aparece como "responsabilidade contratual com teto definido", nunca como garantia total.

## 4. Modelo comercial

| Item | O que inclui | Preço |
|---|---|---|
| Construção | Etapa 1 completa, um agente, até [N] integrações | projeto fechado, a partir de [R$ X] |
| Operação | Etapa 2 + Etapa 3, plano base | [R$ X] por mês |
| Operação Plus | Atendimento 7 dias, analista dedicado, SLA reduzido | [R$ X] por mês |
| Projeto-piloto | Construção com desconto + 3 meses de operação, em troca de caso de uso divulgável | [condições] |

O site mostra os planos, mas os preços ficam como "sob consulta" até os placeholders serem preenchidos. Não inventar valores.

## 5. Estrutura do site e texto pronto

Site de uma página principal com seções ancoradas, mais três páginas secundárias. Todo o texto está em português do Brasil, sentence case, voz ativa. Usar exatamente o texto definido; não gerar lorem ipsum nem "copy de marketing" adicional.

### Página principal

**Hero**
- Título: Construímos a sua IA. E ficamos operando ela.
- Subtítulo: Agentes de inteligência artificial para atendimento, vendas e cobrança — e monitoramento de qualquer IA da sua operação, com uma central humana acompanhando das 8h às 22h.
- Botão principal: Agendar diagnóstico (abre o formulário de contato)
- Botão secundário: Ver como operamos (âncora para a seção de operação)
- Elemento visual: painel de monitoramento simulado (ver seção 6).

**O problema**
- Título: Toda empresa que contrata um agente de IA fica com um sistema que ninguém opera.
- Texto: A agência entrega, treina duas pessoas e vai embora. Três semanas depois o agente promete um prazo que não existe, um cliente pede para falar com alguém e ninguém vê. A IA não erra por ser ruim. Erra porque ninguém está olhando.

**Como operamos**
- Título: Três etapas. A terceira não termina.
- Conteúdo: as três etapas da seção 3, resumidas em um parágrafo cada, com os gatilhos de exceção listados na etapa 2. Mostrar o fluxo "conversa → classificação → exceção → analista assume → incidente registrado → regra ajustada" como diagrama simples.

**O que o cliente vê**
- Título: Você vê tudo o que a IA fez. E tudo o que a gente fez.
- Texto: Painel com as conversas, as decisões automatizadas, as exceções, quem interveio e por quê. Relatório mensal com o Score Sentinella da sua operação. Sem caixa-preta.

**Onde a IA entra (casos de uso)**
- Atendimento e pós-venda: Responde, resolve e transfere quando precisa — sem deixar ninguém sem resposta.
- Vendas e qualificação: Conversa com o lead, entende o que ele precisa e agenda com o vendedor certo.
- Cobrança e negociação: Lembra, negocia dentro das regras que você definiu e nunca ultrapassa o limite sem um humano aprovar.
- Triagem e agendamento: Coleta o que precisa, direciona e marca. Casos sensíveis vão para uma pessoa em minutos.
- Processos e decisões automatizadas: Acompanhamos a IA que classifica, prioriza e distribui — leads, documentos, pedidos. Saiu da régua que você definiu, um analista revisa e corrige.
- Uso de IA pela sua equipe: Olhamos como o seu time usa IA no dia a dia — prompts, respostas aproveitadas, dados que não podem sair — e orientamos quem usa.

**Compromissos (SLA)**
- Título: O que assumimos por escrito.
- Tabela de SLA da seção 3, seguida de uma linha: Responsabilidade contratual com teto definido. Sem letras miúdas.

**Planos**
- Título: Um projeto para construir. Uma mensalidade para operar.
- Tabela da seção 4 com "sob consulta" onde houver placeholder.

**Por que a Sentinella**
- Não vamos embora depois da entrega.
- Humanos onde a IA não deve decidir sozinha.
- Um núcleo padronizado, testado em todos os clientes, personalizado no que importa para você.
- Seus dados e o seu agente são seus. Se sair, leva tudo.

**Perguntas frequentes (mínimo 6)**
1. A IA vai falar com meus clientes sem supervisão? Não. Ela fala, e a central acompanha em tempo real das 8h às 22h. Fora desse horário, opera em modo conservador e não executa ações críticas.
2. Quanto tempo leva para colocar no ar? Entre duas e seis semanas, dependendo das integrações.
3. E se a IA errar? O analista assume a conversa, resolve e registra o incidente. Se o erro veio de uma regra nossa, corrigimos dentro do SLA e respondemos por prejuízo direto até o teto do contrato.
4. Preciso ter time técnico? Não. Precisamos de alguém do seu lado para aprovar regras e receber transferências.
5. Funciona no WhatsApp? Sim, e também em chat do site, e-mail e telefone [confirmar canais].
6. Como fica a LGPD? Contrato de tratamento de dados, dados hospedados [região/fornecedor], acesso registrado, e o cliente é o controlador.
7. Vocês só operam IA que vocês construíram? Não. Depois de um diagnóstico, colocamos sob monitoramento IA que você já usa — de agente de conversa a automação de processos — e o uso de IA pela sua equipe.

**Contato**
- Título: Vamos começar pelo diagnóstico.
- Formulário: nome, empresa, cargo, e-mail corporativo, telefone, "onde a IA entraria" (seleção com os seis casos de uso), "volume aproximado de conversas por mês" (faixas).
- Botão: Enviar pedido de diagnóstico
- Mensagem após envio: Pedido enviado. Respondemos em até um dia útil.
- E-mail de contato exibido: [e-mail de domínio próprio — não usar Gmail]

**Rodapé**
- Razão social e CNPJ [preencher], cidade, links para Política de privacidade e Termos, LinkedIn [URL].

### Páginas secundárias

- `/como-operamos` — versão completa da seção 3, com o diagrama do fluxo de exceção em destaque e a tabela de SLA.
- `/privacidade` — política de privacidade em conformidade com a LGPD [revisar com advogado].
- `/piloto` — página do projeto-piloto: o que oferecemos, o que pedimos em troca (caso divulgável), quem se qualifica, mesmo formulário de contato.

## 6. Direção de design

O assunto é vigilância operacional: uma sala de controle calma, onde tudo está sendo acompanhado e as exceções acendem. O site deve transmitir isso — sobriedade, atenção, pessoas presentes — e não "startup de IA".

### Tokens

- Fundo: `#F4F6F5` (branco com toque frio)
- Tinta: `#14211F` (verde-petróleo quase preto, para texto)
- Primária: `#0E4A45` (petróleo profundo — botões, links, marcações estruturais)
- Neutro: `#C6CFCB` (linhas, bordas, texto secundário)
- Sinal: `#D99A00` (âmbar) — usado exclusivamente para representar exceções e alertas nos diagramas e no painel simulado. Nunca como decoração, nunca em botão. A cor carrega informação: âmbar significa "um humano entrou aqui".
- Modo escuro: inverter fundo/tinta mantendo a mesma primária e o mesmo âmbar; respeitar `prefers-color-scheme`.

### Tipografia

- Títulos: Bricolage Grotesque (Google Fonts), pesos 500 e 600, tracking levemente negativo em tamanhos grandes.
- Texto: IBM Plex Sans (Google Fonts), 400 e 500, corpo 17px no desktop, altura de linha 1,55, linhas de no máximo 70 caracteres.
- Duas famílias claramente distintas, uma função para cada. Nada de monoespaçada para "dar ar técnico".

### O elemento memorável (gastar a ousadia aqui e só aqui)

O hero mostra, ao lado do título, um painel de monitoramento simulado: uma coluna de conversas resumidas rolando devagar, todas em estado normal, até que uma delas acende em âmbar ("Cliente pediu para falar com humano"), um analista assume (aparece nome e horário) e a linha volta ao estado normal com a marcação "resolvido · 2 min". Uma única sequência orquestrada no carregamento da página, com duração de uns 8 segundos, depois estática. Reproduz-se uma vez; sem loop chamativo. Deve ser feita em HTML/CSS/JS leve, sem vídeo. Com `prefers-reduced-motion`, mostrar o estado final direto.

### Layout

- Alinhado à esquerda em todo o site; nada centralizado exceto o formulário no mobile.
- Grade assimétrica: texto ocupa 5 de 12 colunas no hero, o painel ocupa 6 à direita.
- Seções separadas por espaço, não por cartões. Usar bordas e linhas apenas onde encodam estrutura (tabelas, o diagrama de fluxo).
- As três etapas de operação são uma sequência real, então podem receber numeração 1-2-3 e uma linha de tempo horizontal no desktop, vertical no mobile.

### O que evitar (são as marcas de site gerado)

- Fundo creme com acento terracota; fundo preto com verde-neon.
- Tudo em cartões arredondados com a mesma sombra cinza.
- Rótulos em caixa alta acima de cada título; setas "→" no fim de botões; pontos-médios separando metadados.
- Animações de entrada em cada seção e hover em cada cartão. Só a sequência do hero se move sozinha.
- Destacar uma única palavra do título em outra cor ou itálico.
- Gradientes decorativos, ícones genéricos de "IA" (cérebro, chip, robô).

## 7. Requisitos técnicos

- Stack: Astro + Tailwind CSS, site estático, um único repositório. Se houver razão forte para outra escolha, explicar antes de começar.
- Deploy: Cloudflare Pages ou Vercel [decidir], com domínio próprio [domínio].
- Idioma: `lang="pt-BR"` em todo o site. Nenhum texto em inglês na interface.
- Formulário de contato: Web3Forms, Formspree ou Resend [decidir], com proteção anti-spam (honeypot + limite de envio) e envio para [e-mail]. Sem depender de backend próprio.
- Mobile-first. Testar em 360px, 768px, 1280px e 1440px.
- Acessibilidade: contraste AA no mínimo, foco visível no teclado, textos alternativos, `prefers-reduced-motion` respeitado, HTML semântico.
- SEO básico: título e descrição por página, Open Graph com imagem, sitemap.xml, robots.txt, favicon.
- Performance: Lighthouse acima de 90 em todas as quatro categorias no mobile. Fontes com `font-display: swap` e subset latino.
- Analytics com respeito à privacidade (Plausible ou Umami) [decidir]; aviso de cookies só se houver cookie não essencial.
- Modo escuro automático via `prefers-color-scheme`, sem botão de alternância.

## 8. O que não fazer

- Não inventar logos de clientes, depoimentos, números de resultado ("reduzimos 40%...") ou "empresas que confiam". Não temos ainda. A página `/piloto` existe justamente para conseguir o primeiro caso.
- Não usar imagens de banco de robôs, cérebros, redes neurais ou pessoas apontando para telas.
- Não usar as palavras "seguro", "apólice", "cobertura", "garantia total" ou "100%".
- Não usar "revolucionário", "disruptivo", "solução completa", "transformação digital".
- Não deixar nenhum texto em inglês, nem em botões.
- Não substituir placeholders por valores inventados. Se um [campo] estiver vazio, ele aparece como "sob consulta" ou "em definição" no site.

## 9. Decisões pendentes antes do deploy

Ver `PENDENCIAS.md` na raiz do repositório.

## 10. Critérios de aceite

O site está pronto quando:

- As três páginas secundárias e todas as seções da principal existem com o texto deste brief, sem lorem ipsum.
- A sequência do painel no hero roda uma vez no carregamento, mostra a exceção em âmbar e o analista assumindo, e respeita `prefers-reduced-motion`.
- O formulário envia de verdade e mostra a mensagem de confirmação definida.
- Lighthouse mobile acima de 90 nas quatro categorias.
- Nenhuma das palavras proibidas da seção 8 aparece em lugar nenhum (fazer busca no build final).
- Todos os [placeholders] ainda não preenchidos aparecem no site como "sob consulta" ou "em definição", e estão listados em `PENDENCIAS.md` na raiz.
- Funciona nos quatro tamanhos de tela e em modo claro e escuro.
