# Pendências — brief v2 (Sentinella Recebíveis)

Decisões abertas do `CLAUDE.md` v2. Enquanto não forem resolvidas, os pontos abaixo
aparecem nas superfícies do produto como "sob consulta" ou "em definição" — nunca
com valores inventados.

## Negócio e jurídico

- [ ] Razão social e CNPJ (rodapé)
- [ ] Taxa de sucesso — decidir se entra: 3% sobre valores recuperados com mais de
      30 dias de atraso, nos planos Avançado e Max (`CLAUDE.md` §4)
- [ ] Escritório parceiro para a etapa judicial (contrato direto cliente–escritório)
- [ ] Teto de responsabilidade contratual — definir com advogado
- [ ] Política de privacidade e DPA (contrato de tratamento de dados) revisados por
      advogado — /privacidade segue em versão preliminar; /termos é página-stub
- [ ] Valor-limite de título para ligação do analista (`CLAUDE.md` §5)
- [ ] Condições do projeto-piloto (primeiro mercado: polo moveleiro de Arapongas-PR)
- [ ] CENPROT: validar acesso e procuração para protesto eletrônico (com advogado)
- [ ] Texto definitivo da notificação extrajudicial (D+30): modelo redigido pelo
      escritório parceiro (`CLAUDE.md` §3) — a Fase 2 usa um texto provisório
      sóbrio por e-mail, marcado no código (`packages/motor/src/mensagens.ts`)

## Fornecedores e canais

- [ ] BSP de WhatsApp: 360dialog, Gupshup, Twilio ou Zenvia
- [ ] E-mail transacional: Resend ou SES
- [ ] SMS: Zenvia ou Twilio
- [ ] Carta com AR: serviço de carta registrada digital
- [ ] Telefonia do console do analista (softphone com gravação)

Enquanto não houver fornecedor + credenciais, os drivers da Fase 2
(`packages/motor/src/drivers.ts`) mantêm todo envio em modo simulado, mesmo
com `CANAIS_MODO=producao` — o motivo aparece no resumo do tick.

- [ ] Chave Pix de recebimento por cliente (campo `pixChave` no cadastro): sem
      ela, o portal e a 2ª via dizem "não cadastrada — em definição"
- [ ] Emissão de boleto / linha digitável: sai do banco emissor do cliente —
      integração bancária na Fase 3 (a 2ª via da Fase 2 informa isso)

## Infraestrutura

- [ ] Domínio próprio e e-mail de domínio próprio (não usar Gmail)
- [ ] Deploy das aplicações da Fase 1: Vercel ou Cloudflare
- [ ] Banco gerenciado (PostgreSQL)
- [ ] Analytics com respeito à privacidade (Plausible ou Umami)
- [ ] URL do LinkedIn (rodapé)

## Estado das superfícies

- **Site (Webflow)** — já no posicionamento v2 (Sentinella Recebíveis), publicado em
  https://eduardos-top-notch-site-488aab.webflow.io . Capturas reais do painel e do
  portal entram no site quando a Fase 1 existir; renomear o subdomínio é ação manual
  no painel do Webflow.
- **Site Astro deste repositório (`src/`)** — ainda no posicionamento v1; será
  substituído pelo `apps/site` (Next.js) na Fase 1 do v2. A chave `CHAVE_ENVIO`
  (Web3Forms) do formulário v1 fica sem efeito.
- **Painel do cliente, portal do lojista e console do analista** — Fases 1 e 2
  entregues em `produto/`: telas navegáveis + motor de régua real sobre
  PostgreSQL (importação por planilha, fila com conferência pré-envio, baixa
  de pagamentos, portal transacional). Demo navegável em
  https://claude.ai/artifact/AZcXJ7wAB4rgmXZAEWoP5v (o link só abre para
  visitantes depois de compartilhado no menu Share do artifact). Fase 3
  (conector de ERP, ligações com gravação, carta AR, fluxo de autorização no
  painel, relatório PDF, régua editável do Max) por fazer.

## Nota de vocabulário

O brief proíbe "cobertura" (vocabulário de seguro): onde o assunto é horário da
central, usar "central humana seg–sex/todos os dias, 8h–22h" ou "acompanhamento".
