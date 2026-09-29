# Planilhas padrão da Sentinella (Fase 2)

Formato: CSV separado por **ponto e vírgula** (o padrão do Excel brasileiro;
vírgula também é aceita), codificação UTF-8, valores com **vírgula decimal**
(ex.: 1.234,56) e datas em **dd/mm/aaaa**. A primeira linha é o cabeçalho.
Linhas com erro são relatadas uma a uma e não derrubam o resto do arquivo.

## lojistas.csv
| coluna | obrigatória | observação |
|---|---|---|
| cnpj | sim | 14 dígitos, com ou sem pontuação |
| razao_social | sim | |
| cidade | não | |
| contato_nome | não | responsável financeiro ou sócio (§3: só com eles falamos) |
| contato_papel | não | `financeiro` (padrão) ou `sócio` |
| whatsapp / email / telefone | não | contatos da empresa devedora (LGPD) |
| nao_cobrar | não | `sim` tira o lojista da régua (negociação comercial, estratégicos) |

Reimportar atualiza o lojista pelo CNPJ, sem perder histórico nem rating.

## titulos.csv
| coluna | obrigatória | observação |
|---|---|---|
| numero | sim | identificador único do título no cliente |
| cnpj_lojista | sim | precisa existir na base de lojistas |
| valor | sim | em reais |
| emissao | sim | dd/mm/aaaa |
| vencimento | sim | dd/mm/aaaa, nunca antes da emissão |
| antecipado | não | `sim` quando a duplicata foi antecipada, descontada ou endossada — a régua então notifica no D+15 e prepara o protesto até o D+25 (Lei 5.474/68, art. 13, §4º) |

Reimportar atualiza valor, vencimento e `antecipado` pelo número do título;
títulos pagos não são sobrescritos.

## pagamentos.csv
| coluna | obrigatória | observação |
|---|---|---|
| numero_titulo | sim | |
| data_pagamento | sim | dd/mm/aaaa |
| valor_pago | não | vazio = valor do título |

A baixa marca o título como pago, cancela as ações futuras da régua e avalia
as promessas de pagamento (pagar até a data combinada cumpre a promessa).

Os exemplos acima são fictícios: CNPJs começam com 00.000, telefones usam
DDD 00 e e-mails terminam em .invalid — nada disso existe de verdade.
