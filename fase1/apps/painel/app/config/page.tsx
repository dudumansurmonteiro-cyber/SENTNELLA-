'use client';

// Configurações (§7.2e): canais, alçadas, régua (leitura no Básico/Avançado,
// editável no Max), horários, lista de não-cobrança e exportação CSV real.

import { useState } from 'react';
import { moedaCurta } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { Secao } from '../../lib/ui';

const REGUA_PADRAO = [
  { d: 'D−3', acao: 'Lembrete com boleto ou Pix' },
  { d: 'D0', acao: '“Vence hoje”, com link de pagamento' },
  { d: 'D+3', acao: 'Aviso de atraso com 2ª via' },
  { d: 'D+7', acao: 'Proposta de acordo dentro da alçada' },
  { d: 'D+10', acao: 'Primeira ligação (analista)' },
  { d: 'D+15', acao: 'Segunda ligação e e-mail formal' },
  { d: 'D+30', acao: 'Notificação extrajudicial' },
  { d: 'D+45', acao: 'Protesto/negativação com autorização' },
  { d: 'D+60–90', acao: 'Cobrança judicial (escritório parceiro)' },
];

export default function Config() {
  const { dados } = useDados();
  const [naoCobrar, setNaoCobrar] = useState<string[]>([]);
  const [reguaMax, setReguaMax] = useState<Record<string, string>>({});
  if (!dados) return <Carregando />;
  const c = dados.cliente;
  const editavel = c.plano === 'Max';
  const linhasRegua = c.plano === 'Básico' ? REGUA_PADRAO.slice(0, 6) : REGUA_PADRAO;

  function exportarCsv() {
    const linhas = [
      'lojista;cnpj_ficticio;rating;titulos_abertos;valor_aberto;valor_vencido;maior_atraso_dias',
      ...dados!.lojistas.map((l) =>
        [l.nome, l.cnpj, l.rating, l.titulosAbertos, l.valorAberto, l.valorVencido, l.maiorAtrasoDias].join(';'),
      ),
    ].join('\n');
    const blob = new Blob([linhas], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentinella-lojistas-demonstracao.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Configurações</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Canais de cobrança">
          <p className="text-[13.5px]">
            Habilitados, na ordem de preferência:{' '}
            {c.canais.map((canal, i) => (
              <span key={canal} className="chip mr-1.5">{i + 1}. {canal}</span>
            ))}
          </p>
          <p className="suave mt-2 text-[12.5px]">
            WhatsApp sempre pela API oficial, com caminho para falar com humano. Ligações apenas
            por analistas, dias úteis 8h–20h e sábado 8h–14h.
          </p>
        </Secao>

        <Secao titulo="Alçadas de negociação">
          <ul className="text-[13.5px] leading-7">
            <li>Desconto máximo: <b>{c.alcada.descontoMaxPct}%</b></li>
            <li>Parcelamento máximo: <b>{c.alcada.parcelasMax}x</b></li>
            <li>Prazo máximo: <b>{c.alcada.prazoMaxDias} dias</b></li>
            <li>Sempre vai ao analista acima de: <b>{moedaCurta(c.alcada.valorSempreAnalista)}</b></li>
            <li>Ligação do analista para títulos acima de: <b>{moedaCurta(c.valorLimiteLigacao)}</b></li>
          </ul>
        </Secao>
      </div>

      <Secao
        titulo={`Régua — plano ${c.plano} ${editavel ? '(editável)' : '(somente leitura)'}`}
      >
        <table className="tab">
          <thead><tr><th>Momento</th><th>Ação</th>{editavel && <th>Ajuste (demo)</th>}</tr></thead>
          <tbody>
            {linhasRegua.map((l) => (
              <tr key={l.d}>
                <td className="font-medium">{l.d}</td>
                <td>{reguaMax[l.d] ?? l.acao}</td>
                {editavel && (
                  <td>
                    <input
                      className="campo-select w-full"
                      defaultValue={l.acao}
                      aria-label={`Editar etapa ${l.d}`}
                      onBlur={(e) => setReguaMax((r) => ({ ...r, [l.d]: e.target.value }))}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {c.plano === 'Básico' && (
          <p className="suave mt-2 text-[12.5px]">
            A régua do Básico termina no D+15; títulos além disso ficam como “fora da régua”.
          </p>
        )}
        {editavel && (
          <p className="suave mt-2 text-[12.5px]">
            No Max, cada etapa pode mudar de dia, canal e tom — inclusive réguas diferentes por
            rating (ex.: rating E recebe ligação já no D+3). Ajustes desta demo não persistem.
          </p>
        )}
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Quem não deve ser cobrado">
          <p className="suave mb-2 text-[12.5px]">
            Lojistas em negociação comercial ou estratégicos ficam fora da régua até você liberar.
          </p>
          {dados.lojistas.slice(0, 5).map((l) => (
            <label key={l.id} className="flex items-center gap-2 py-0.5 text-[13.5px]">
              <input
                type="checkbox"
                checked={naoCobrar.includes(l.id)}
                onChange={(e) =>
                  setNaoCobrar((x) => (e.target.checked ? [...x, l.id] : x.filter((i) => i !== l.id)))
                }
              />
              {l.nome}
            </label>
          ))}
          {naoCobrar.length > 0 && (
            <p className="nota-demo mt-2">{naoCobrar.length} lojista(s) pausado(s) nesta demonstração.</p>
          )}
        </Secao>

        <Secao titulo="Integrações e exportação">
          <ul className="text-[13.5px] leading-7">
            <li>ERP: <b>{c.erp}</b>{c.erpIntegrado ? ' — bloqueio de pedidos habilitado' : ''}</li>
            <li>Usuários e permissões: em definição na implantação</li>
            <li>Horários e feriados: calendário nacional</li>
          </ul>
          <button className="botao mt-3" onClick={exportarCsv}>Exportar lojistas em CSV</button>
          <p className="suave mt-2 text-[12.5px]">Relatório mensal em PDF entra na Fase 3.</p>
        </Secao>
      </div>
    </>
  );
}
