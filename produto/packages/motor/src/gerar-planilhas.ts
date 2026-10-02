// Gera as planilhas da Fase 2:
//  1) planilhas-modelo/ — os três modelos que o financeiro do cliente preenche
//     (lojistas, títulos, pagamentos), com linhas de exemplo fictícias.
//  2) dados-exemplo/ — planilhas completas e determinísticas dos três clientes
//     fictícios (400 lojistas, 3.000 títulos), separadas por semana de emissão,
//     que a simulação importa como um cliente real importaria.
// Nada aqui usa CNPJ real (§11): todos começam com 00.000.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  criarRnd, entre, inteiro, escolha, chance, nomeLojista, nomePessoa, cidade, cnpjFicticio,
} from '@sentinella/dados';
import type { Rnd } from '@sentinella/dados';
import { serializarPlanilha } from './planilhas';
import { addDias, difDias, hojeReal } from './datas';
import { CLIENTES_DEMO } from './clientes';

export const SEMENTE_PADRAO = 20260928;
export const DIAS_DE_SIMULACAO = 90;

const COLUNAS_LOJISTAS = [
  'cnpj', 'razao_social', 'cidade', 'contato_nome', 'contato_papel',
  'whatsapp', 'email', 'telefone', 'nao_cobrar',
];
const COLUNAS_TITULOS = ['numero', 'cnpj_lojista', 'valor', 'emissao', 'vencimento', 'antecipado'];
const COLUNAS_PAGAMENTOS = ['numero_titulo', 'data_pagamento', 'valor_pago'];

const dataBr4 = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};
const valorBr = (centavos: number) =>
  (centavos / 100).toFixed(2).replace('.', ',');

// Contatos visivelmente fictícios: DDD 00 e domínio reservado ".invalid".
const foneFicticio = (rnd: Rnd) => `(00) 9${inteiro(rnd, 1000, 9999)}-${inteiro(rnd, 1000, 9999)}`;
const emailFicticio = (nome: string) =>
  `financeiro@${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.exemplo.invalid`;

export interface PerfilLojista {
  pontual: number; // 0 = sempre atrasa · 1 = sempre em dia
  horasResp: number | null; // null = não responde
}

export interface PlanilhasGeradas {
  raiz: string;
  hoje: string;
  inicio: string;
  porCliente: Record<string, { lojistas: string; titulosPorSemana: string[] }>;
  perfis: Record<string, PerfilLojista>; // por CNPJ
}

export function gerarPlanilhas(destino: string, semente = SEMENTE_PADRAO): PlanilhasGeradas {
  const rnd = criarRnd(semente);
  const hoje = hojeReal();
  const inicio = addDias(hoje, -(DIAS_DE_SIMULACAO - 1));

  // ---------------------------------------------------------------- modelos
  const modelo = join(destino, 'planilhas-modelo');
  mkdirSync(modelo, { recursive: true });
  writeFileSync(
    join(modelo, 'lojistas.csv'),
    serializarPlanilha(COLUNAS_LOJISTAS, [
      ['00.000.001/0001-17', 'Comercial Exemplo Ltda', 'Arapongas', 'Ana Almeida', 'financeiro', '(00) 91234-5678', 'financeiro@comercial-exemplo.exemplo.invalid', '(00) 3123-4567', 'não'],
      ['00.000.002/0001-24', 'Bazar Modelo ME', 'Londrina', 'Bruno Barros', 'sócio', '(00) 92345-6789', 'contato@bazar-modelo.exemplo.invalid', '', 'não'],
      ['00.000.003/0001-31', 'Casa Fictícia EPP', 'Maringá', 'Carla Cardoso', 'financeiro', '', 'carla@casa-ficticia.exemplo.invalid', '(00) 3345-6789', 'sim'],
    ]),
  );
  writeFileSync(
    join(modelo, 'titulos.csv'),
    serializarPlanilha(COLUNAS_TITULOS, [
      ['NF-10001', '00.000.001/0001-17', '2.350,00', dataBr4(addDias(hoje, -20)), dataBr4(addDias(hoje, 8)), 'não'],
      ['NF-10002', '00.000.001/0001-17', '1.180,50', dataBr4(addDias(hoje, -35)), dataBr4(addDias(hoje, -7)), 'não'],
      ['NF-10003', '00.000.002/0001-24', '4.920,00', dataBr4(addDias(hoje, -40)), dataBr4(addDias(hoje, -5)), 'sim'],
    ]),
  );
  writeFileSync(
    join(modelo, 'pagamentos.csv'),
    serializarPlanilha(COLUNAS_PAGAMENTOS, [
      ['NF-10002', dataBr4(addDias(hoje, -1)), '1.180,50'],
      ['NF-10001', dataBr4(hoje), ''],
    ]),
  );
  writeFileSync(
    join(modelo, 'LEIA-ME.md'),
    `# Planilhas padrão da Sentinella (Fase 2)

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
| contato_papel | não | \`financeiro\` (padrão) ou \`sócio\` |
| whatsapp / email / telefone | não | contatos da empresa devedora (LGPD) |
| nao_cobrar | não | \`sim\` tira o lojista da régua (negociação comercial, estratégicos) |

Reimportar atualiza o lojista pelo CNPJ, sem perder histórico nem rating.

## titulos.csv
| coluna | obrigatória | observação |
|---|---|---|
| numero | sim | identificador único do título no cliente |
| cnpj_lojista | sim | precisa existir na base de lojistas |
| valor | sim | em reais |
| emissao | sim | dd/mm/aaaa |
| vencimento | sim | dd/mm/aaaa, nunca antes da emissão |
| antecipado | não | \`sim\` quando a duplicata foi antecipada, descontada ou endossada — a régua então notifica no D+15 e prepara o protesto até o D+25 (Lei 5.474/68, art. 13, §4º) |

Reimportar atualiza valor, vencimento e \`antecipado\` pelo número do título;
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
`,
  );

  // ----------------------------------------------------- dados de exemplo
  const raizExemplo = join(destino, 'dados-exemplo');
  const resultado: PlanilhasGeradas = {
    raiz: raizExemplo, hoje, inicio, porCliente: {}, perfis: {},
  };
  const nomesUsados = new Set<string>();
  let seq = 0;
  let seqTitulo = 0;

  for (const clienteDemo of CLIENTES_DEMO) {
    const pasta = join(raizExemplo, clienteDemo.id);
    mkdirSync(pasta, { recursive: true });

    interface LinhaLojista { cnpj: string; linha: string[] }
    const lojistas: LinhaLojista[] = [];
    for (let i = 0; i < clienteDemo.qtdLojistas; i++) {
      const nome = nomeLojista(rnd, nomesUsados);
      const cnpj = cnpjFicticio(++seq);
      const papel = chance(rnd, 0.8) ? 'financeiro' : 'sócio';
      const semResposta = chance(rnd, 0.08);
      resultado.perfis[cnpj] = {
        pontual: rnd(),
        horasResp: semResposta ? null : Math.round(entre(rnd, 2, 60)),
      };
      lojistas.push({
        cnpj,
        linha: [
          cnpj, nome, cidade(rnd), nomePessoa(rnd), papel,
          foneFicticio(rnd), emailFicticio(nome), foneFicticio(rnd),
          chance(rnd, 0.015) ? 'sim' : 'não',
        ],
      });
    }
    const arquivoLojistas = join(pasta, 'lojistas.csv');
    writeFileSync(arquivoLojistas, serializarPlanilha(COLUNAS_LOJISTAS, lojistas.map((l) => l.linha)));

    // Títulos por semana de emissão. Uma parte é "carteira legada": títulos
    // emitidos antes do período, que entram já em atraso na primeira
    // importação — exatamente como um cliente novo chega.
    const semanas = Math.ceil(DIAS_DE_SIMULACAO / 7);
    const porSemana: string[][][] = Array.from({ length: semanas }, () => []);
    for (let i = 0; i < clienteDemo.qtdTitulos; i++) {
      const lojista = escolha(rnd, lojistas);
      const legado = chance(rnd, 0.06);
      const emissao = legado
        ? addDias(inicio, -inteiro(rnd, 5, 35))
        : addDias(inicio, inteiro(rnd, 0, DIAS_DE_SIMULACAO - 4));
      const prazo = escolha(rnd, [28, 28, 35, 35, 42]);
      const vencimento = addDias(emissao, prazo);
      const valorCentavos = Math.round(
        entre(rnd, 380, 9200) * 100 + (chance(rnd, 0.06) ? entre(rnd, 8000, 42000) * 100 : 0),
      );
      const antecipado = clienteDemo.plano !== 'Básico' && chance(rnd, 0.15);
      const numero = `${clienteDemo.id.toUpperCase()}-${4000 + ++seqTitulo}`;
      const semana = legado ? 0 : Math.min(semanas - 1, Math.floor(difDias(emissao, inicio) / 7));
      porSemana[semana].push([
        numero, lojista.cnpj, valorBr(valorCentavos),
        dataBr4(emissao), dataBr4(vencimento), antecipado ? 'sim' : 'não',
      ]);
    }
    const arquivosSemana: string[] = [];
    porSemana.forEach((linhas, i) => {
      if (!linhas.length) return;
      const arquivo = join(pasta, `titulos-semana-${String(i + 1).padStart(2, '0')}.csv`);
      writeFileSync(arquivo, serializarPlanilha(COLUNAS_TITULOS, linhas));
      arquivosSemana.push(arquivo);
    });

    resultado.porCliente[clienteDemo.id] = {
      lojistas: arquivoLojistas,
      titulosPorSemana: arquivosSemana,
    };
  }

  writeFileSync(join(raizExemplo, 'perfis.json'), JSON.stringify(resultado.perfis));
  writeFileSync(
    join(raizExemplo, 'LEIA-ME.md'),
    `# Dados de exemplo (gerados)

Planilhas determinísticas dos três clientes fictícios, geradas por
\`npm run gerar:planilhas\` (semente ${semente}). A simulação
(\`npm run regua:simular\`) importa estes arquivos semana a semana, como um
cliente real importaria, e roda a régua dia a dia. Todos os CNPJs começam com
00.000 e nenhum contato é real. Não editar à mão — o gerador sobrescreve.
`,
  );
  return resultado;
}
