# Pendências — brief v3 (Sentinella white label)

Decisões abertas do `CLAUDE.md` v3. Enquanto não forem resolvidas, os pontos
abaixo aparecem nas superfícies do produto como "sob consulta" ou "em
definição" — nunca com valores inventados.

## Negócio e jurídico

- [ ] Razão social e CNPJ da Sentinella (rodapé e contratos)
- [ ] **Parecer de ética profissional (OAB)**: terceirização da mesa de cobrança
      falando em nome do escritório, white label e modelo de remuneração
      (`CLAUDE.md` §5 e §11.4) — redação do contrato sem partilha de honorários
- [ ] **Validação dos preços com três escritórios** antes de publicar a tabela
      no site (`CLAUDE.md` §5 e §11.9) — observação: o aceite da Fase 1 (§12.8)
      pede preços "a partir de" no site; decidir a ordem (validar → publicar)
- [ ] Primeiro mercado `[sugestão do brief: escritórios de cobrança de SP e PR
      com carteiras de educação, saúde e condomínios]`
- [ ] Prazo de retenção de gravações por escritório (mínimo sugerido: 5 anos)
- [ ] Teto do plano Max (`[sob proposta, com piso]`)
- [ ] Teto de responsabilidade contratual — definir com advogado
- [ ] Política de privacidade e DPA revisados por advogado
- [ ] Condições do projeto-piloto

## Fornecedores e integrações

- [ ] BSP de WhatsApp (número de cada escritório)
- [ ] E-mail transacional e SMS (domínio e remetente do escritório)
- [ ] **Bancos homologados para emissão de boleto/Pix** na conta do credor ou
      do escritório (a Sentinella nunca intermedia pagamento)
- [ ] Carta com AR / cartório
- [ ] Telefonia: softphone do console com gravação; avaliar integração com a
      discadora do escritório
- [ ] **Assinatura eletrônica** para notificações do advogado
- [ ] Sistemas jurídicos a integrar `[Projuris, Astrea, Advbox, SAJ ADV,
      Legal One — validar APIs]`
- [ ] Enriquecimento de contatos via birô (fornecedor + base legal por carteira)
- [ ] Negativação: convênio Serasa/Boa Vista/SPC do escritório ou do credor
- [ ] Protesto: central eletrônica dos cartórios (procuração e acesso)

## Infraestrutura

- [ ] Domínio próprio e e-mail de domínio próprio
- [ ] Deploy (Vercel ou Cloudflare) e banco gerenciado (PostgreSQL)
- [ ] Analytics com respeito à privacidade (Plausible ou Umami)
- [ ] URL do LinkedIn (rodapé)

## Estado das superfícies

- **Fase 1 do v3 entregue (03/10).** Seed com 3 escritórios fictícios (cores
  próprias), 8 credores, 15 carteiras, 6.000 devedores PF/PJ e 20.000 títulos
  em 90 dias; painel do escritório white label; console com troca de
  escritório (faixa colorida do escritório ativo); espaço do devedor e portal
  do credor com a marca de cada escritório. O v2 completo segue preservado em
  `BRIEF-V2.md`.
- **Demonstração publicada (v3)** — mesma URL de sempre:
  https://claude.ai/artifact/AZcXJ7wAB4rgmXZAEWoP5v (hub com os quatro
  acessos; montagem reproduzível por `produto/scripts/montar-demo.mjs`).
- **Site (Webflow)** — pivô v3 publicado em
  https://eduardos-top-notch-site-488aab.webflow.io : hero "Sua marca na
  frente. Nossa operação atrás.", seção white label, régua E+0→E+60,
  planos por devedores ativos ("a partir de"), seção e página de
  conformidade, FAQ com 12 perguntas, formulário de escritórios, páginas
  /white-label e /conformidade novas, /demo com capturas do v3;
  /portal-do-lojista saiu do ar (rascunho).
- **Fase 2 do v3 (motor real)** — próxima: reancorar schema Prisma e motor
  na hierarquia v3 com os gates do CDC; até lá, `packages/db`, `packages/motor`
  e `apps/servidor` continuam na forma do v2 e os testes antigos não compilam
  contra os tipos novos.
- **Âncoras internas da home** — as seções white label e conformidade
  reutilizam os ids antigos (#painel/#portal/#sla seguem no DOM; a troca
  cosmética de ids foi deixada de lado nesta rodada).

## Nota de vocabulário

Seguem proibidos: "seguro", "apólice", "cobertura", "garantia total", "100%",
"revolucionário", "disruptivo". Novo no v3: **nada que pareça oferta de
clientes ao escritório** ("trazemos credores", "indicamos carteiras") — é
captação indireta, vedada pelo Código de Ética da OAB (`CLAUDE.md` §6.1).
