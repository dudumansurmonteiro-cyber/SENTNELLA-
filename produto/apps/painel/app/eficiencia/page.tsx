'use client';

// Eficiência por canal e por etapa (§7.2c): funil de mensagens, ligações e a
// conversão de cada ponto da régua.

import { pct } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { conversaoPorEtapa, eficienciaPorCanal, ligacoesResumo } from '../../lib/metricas';
import { BarraLinha, Kpi, Secao } from '../../lib/ui';

export default function Eficiencia() {
  const { dados } = useDados();
  if (!dados) return <Carregando />;
  const canais = eficienciaPorCanal(dados);
  const etapas = conversaoPorEtapa(dados);
  const lig = ligacoesResumo(dados);
  const maxConv = Math.max(1, ...etapas.map((e) => e.conversao));

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Eficiência por canal e etapa</h1>
      <p className="suave mt-1 text-[13.5px]">
        “Pagas em 48h” = títulos pagos em até 48 horas depois daquele contato — é o que diz qual
        etapa da régua funciona para a sua carteira.
      </p>

      <Secao titulo="Mensagens por canal (IA)">
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Canal</th><th className="num">Enviadas</th><th className="num">Entregues</th>
                <th className="num">Lidas</th><th className="num">Respondidas</th>
                <th className="num">Pagas em 48h</th>
              </tr>
            </thead>
            <tbody>
              {canais.map((c) => (
                <tr key={c.canal}>
                  <td className="font-medium">{c.canal}</td>
                  <td className="num">{c.enviadas}</td>
                  <td className="num">{c.entregues}</td>
                  <td className="num">{c.lidas}</td>
                  <td className="num">{c.respondidas}</td>
                  <td className="num font-medium">{c.pagas48h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Conversão por etapa da régua">
          {etapas.map((e) => (
            <BarraLinha
              key={e.etapa}
              rotulo={e.etapa}
              valorTexto={`${pct(e.conversao, 1)} · ${e.pagos48h}/${e.acoes}`}
              fracao={e.conversao / maxConv}
            />
          ))}
        </Secao>

        <Secao titulo="Ligações dos analistas">
          <div className="grid grid-cols-2 gap-3">
            <Kpi rotulo="Realizadas" valor={String(lig.realizadas)} />
            <Kpi rotulo="Atendidas" valor={String(lig.atendidas)} detalhe={`${lig.naoAtendidas} não atendidas`} />
            <Kpi rotulo="Promessas obtidas" valor={String(lig.promessasObtidas)} />
            <Kpi rotulo="Promessas cumpridas" valor={String(lig.promessasCumpridas)} />
          </div>
          <p className="suave mt-2 text-[12.5px]">
            Uma ligação por dia por devedor, dias úteis 8h–20h e sábado 8h–14h, sempre com o
            responsável financeiro — tentativas não atendidas voltam no dia seguinte.
          </p>
        </Secao>
      </div>
    </>
  );
}
