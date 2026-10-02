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

- **Pivô v3 em andamento.** O v3 (white label para escritórios) foi adotado em
  02/10 como fonte de verdade; o v2 completo está preservado em `BRIEF-V2.md`.
- **Site (Webflow)** — ainda no posicionamento v2 (cobrança para indústrias),
  publicado em https://eduardos-top-notch-site-488aab.webflow.io . O pivô do
  site para o v3 (§6.1: hero "Sua marca na frente...", seção white label,
  conformidade, FAQ de escritórios, formulário novo, /white-label e
  /conformidade) ainda não foi executado.
- **Produto (`produto/`)** — implementação das Fases 1 e 2 do v2 (painel,
  console, portal, motor de régua real sobre PostgreSQL). É a base de código
  sobre a qual a Fase 1 do v3 será construída (hierarquia escritório → credor
  → carteira → devedor, portais white label, console com troca de escritório).
  Demo navegável (dados do v2): https://claude.ai/artifact/AZcXJ7wAB4rgmXZAEWoP5v
- **Registro**: a decisão de 29/09 sobre lembretes D−20/D−5 do v2 está
  documentada em `BRIEF-V2.md`; a régua do v3 é reancorada na entrada da
  carteira (E+0…E+60) e a implementará no formato novo.

## Nota de vocabulário

Seguem proibidos: "seguro", "apólice", "cobertura", "garantia total", "100%",
"revolucionário", "disruptivo". Novo no v3: **nada que pareça oferta de
clientes ao escritório** ("trazemos credores", "indicamos carteiras") — é
captação indireta, vedada pelo Código de Ética da OAB (`CLAUDE.md` §6.1).
