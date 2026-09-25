# Pendências antes do deploy

Decisões abertas do brief (`CLAUDE.md`, seção 9). Enquanto não forem resolvidas, os
pontos abaixo aparecem no site como "sob consulta" ou "em definição" — nunca com
valores inventados.

## Negócio e jurídico

- [ ] Razão social e CNPJ (rodapé)
- [ ] Preços dos três planos (Construção, Operação, Operação Plus) — hoje "sob consulta"
- [ ] Condições do projeto-piloto (desconto e contrapartidas detalhadas)
- [ ] Teto de responsabilidade contratual — definir com advogado (aparece em /como-operamos)
- [ ] Política de privacidade e Termos de uso revisados por advogado (/privacidade está em versão preliminar; /termos é página-stub)
- [ ] Número de integrações incluídas no plano Construção (tabela de planos)

## Produto e canais

- [ ] Canais suportados além de WhatsApp, chat do site e e-mail (FAQ "Funciona no WhatsApp?")
- [ ] Região e fornecedor de hospedagem dos dados (FAQ LGPD e /privacidade)

## Infraestrutura do site

- [ ] Domínio próprio — trocar `site` em `astro.config.mjs` e a URL do `public/robots.txt` (hoje: `https://sentinella.pages.dev`, provisório)
- [ ] E-mail de domínio próprio (contato, /privacidade) — não usar Gmail
- [ ] Ferramenta de formulário (Web3Forms, Formspree ou Resend) — o código já está pronto para Web3Forms: preencher `CHAVE_ENVIO` em `src/components/FormularioContato.astro`; com a chave vazia, o formulário avisa "envio em configuração"
- [ ] Plataforma de deploy (Cloudflare Pages ou Vercel)
- [ ] Analytics com respeito à privacidade (Plausible ou Umami) — nenhum script instalado ainda
- [ ] URL do LinkedIn (rodapé)

## Nota de vocabulário

A tabela de SLA do brief original usava "Cobertura humana"; como a seção 8 do brief
proíbe a palavra "cobertura" no site (vocabulário de seguro), a linha foi publicada
como "Acompanhamento humano" e o plano Plus como "atendimento 7 dias".
