'use client';

// Carteiras por credor: desempenho, alçada, encargos e honorários do mês.
// A regra de honorários é informativa, cadastrada pelo escritório — a
// Sentinella não participa do resultado (§5: preço fixo por devedor ativo).

import { useState } from 'react';
import { moedaCompacta, moedaCurta, pct } from '@sentinella/dados';
import type { AgregadosCarteira, Carteira } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { BarraLinha, Secao } from '../../lib/ui';

function Encargos({ c }: { c: Carteira }) {
  if (c.multaPct == null || c.jurosMesPct == null) {
    return <span className="chip">sem encargos cadastrados</span>;
  }
  return (
    <span className="suave">
      multa {pct(c.multaPct)} · juros {String(c.jurosMesPct).replace('.', ',')}% a.m.
    </span>
  );
}

function LinhaCarteira({ c, ag }: { c: Carteira; ag: AgregadosCarteira }) {
  const [aberta, setAberta] = useState(false);
  const taxa = ag.valorEntregue ? (ag.recuperadoAcumulado / ag.valorEntregue) * 100 : 0;
  return (
    <>
      <tr>
        <td>
          <button
            type="button"
            onClick={() => setAberta(!aberta)}
            aria-expanded={aberta}
            className="cursor-pointer text-left font-medium"
            style={{ color: 'var(--link)' }}
          >
            {aberta ? '▾' : '▸'} {c.nome}
          </button>
          <div className="suave text-[12px]">
            {c.tipo} · {c.devedores} · {c.canais.join(', ')}
            {c.multaPct == null && <span className="chip ml-2">sem encargos cadastrados</span>}
          </div>
        </td>
        <td className="num">{ag.qtdDevedores.toLocaleString('pt-BR')}</td>
        <td className="num">{ag.qtdTitulos.toLocaleString('pt-BR')}</td>
        <td className="num">{moedaCompacta(ag.valorEntregue)}</td>
        <td className="num">{moedaCompacta(ag.recuperadoAcumulado)}</td>
        <td className="num">{pct(taxa)}</td>
        <td className="num">{ag.acordosVigentes}</td>
        <td className="num">{ag.score}</td>
      </tr>
      {aberta && (
        <tr>
          <td colSpan={8} style={{ background: 'var(--panel-row)' }}>
            <div className="grid gap-x-8 gap-y-2 px-2 py-2 text-[13px] md:grid-cols-2">
              <div>
                <b>Alçada da IA e dos negociadores:</b> desconto até {pct(c.alcada.descontoMaxPct)},{' '}
                {c.alcada.parcelasMax}x, prazo {c.alcada.prazoMaxDias} dias, entrada mínima{' '}
                {pct(c.alcada.entradaMinPct)}. Acima disso vira exceção para o escritório.
              </div>
              <div>
                <b>Encargos:</b> <Encargos c={c} />
                {c.multaPct == null && (
                  <span className="suave"> — mensagens e portal não mencionam multa nem juros.</span>
                )}
              </div>
              <div>
                <b>Base legal (LGPD):</b> {c.baseLegal} · controlador: {c.controlador}
              </div>
              <div>
                <b>Boleto e Pix:</b> emitidos na {c.contaEmissora} — o dinheiro não passa pela
                Sentinella.
              </div>
              <div className="md:col-span-2">
                <b>Recuperado por semana:</b>
                <div className="mt-1 flex items-end gap-1" aria-hidden="true">
                  {ag.recuperadoPorSemana.map((s) => {
                    const max = Math.max(1, ...ag.recuperadoPorSemana.map((x) => x.valor));
                    return (
                      <i
                        key={s.rotulo}
                        title={`${s.rotulo}: ${moedaCurta(s.valor)}`}
                        style={{
                          display: 'block',
                          width: 26,
                          height: Math.max(3, (s.valor / max) * 42),
                          background: 'var(--primary)',
                          borderRadius: '2px 2px 0 0',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Carteiras() {
  const { dados } = useDados();
  if (!dados) return <Carregando />;

  const honorariosMes = dados.honorarios.reduce((s, h) => s + h.valor, 0);
  const maiorHonorario = Math.max(1, ...dados.honorarios.map((h) => h.valor));

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Carteiras</h1>
      <p className="suave mt-1 text-[13.5px]">
        Cada carteira define alçada, canais, encargos e base legal próprios — a régua respeita o
        que o credor e o escritório cadastraram.
      </p>

      {dados.credores.map((credor) => {
        const carteiras = dados.carteiras.filter((c) => c.credorId === credor.id);
        return (
          <Secao
            key={credor.id}
            titulo={credor.nome}
            acao={
              <span className="suave text-[12.5px]">
                contato: {credor.contatoNome} · honorários {pct(credor.honorariosPct)}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="tab">
                <thead>
                  <tr>
                    <th>Carteira</th>
                    <th className="num">Devedores</th>
                    <th className="num">Títulos</th>
                    <th className="num">Entregue</th>
                    <th className="num">Recuperado</th>
                    <th className="num">Taxa</th>
                    <th className="num">Acordos</th>
                    <th className="num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {carteiras.map((c) => (
                    <LinhaCarteira
                      key={c.id}
                      c={c}
                      ag={dados.agregados.find((a) => a.carteiraId === c.id)!}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>
        );
      })}

      <Secao titulo={`Honorários do mês — ${moedaCurta(honorariosMes)}`}>
        {dados.honorarios.map((h) => {
          const credor = dados.credores.find((c) => c.id === h.credorId)!;
          return (
            <BarraLinha
              key={h.credorId}
              rotulo={credor.nome.replace(' (fictício)', '').replace(' (fictícia)', '')}
              valorTexto={moedaCurta(h.valor)}
              fracao={h.valor / maiorHonorario}
            />
          );
        })}
        <p className="nota-demo mt-3">
          Calculados sobre o recuperado no mês pela regra informativa de cada credor. O repasse é
          acertado entre escritório e credor; a Sentinella cobra preço fixo por devedor ativo e
          não participa de honorários.
        </p>
      </Secao>
    </>
  );
}
