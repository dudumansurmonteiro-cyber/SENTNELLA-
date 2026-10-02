'use client';

// Visão geral do escritório (§7: recuperação, carteira, pendências do
// advogado e as travas de conformidade em ação).

import { L } from '../lib/raiz';
import { moedaCompacta, moedaCurta, pct } from '@sentinella/dados';
import { Carregando, useDados } from '../lib/contexto';
import { somarAgregados } from '../lib/metricas';
import { BarraLinha, Colunas, Kpi, Secao } from '../lib/ui';

export default function VisaoGeral() {
  const { dados } = useDados();
  if (!dados) return <Carregando />;

  const t = somarAgregados(dados.agregados);
  const honorariosMes = dados.honorarios.reduce((s, h) => s + h.valor, 0);
  const aAssinar = dados.documentos.filter((d) => d.status === 'a assinar').length;
  const autorizacoes = dados.documentos.filter((d) => d.status === 'aguarda autorização').length;
  const dossies = dados.documentos.filter(
    (d) => d.tipo === 'dossiê judicial' && d.status === 'pronto',
  ).length;
  const excecoesAbertas = dados.excecoes.filter((e) => e.estado === 'aberta' || e.estado === 'em atendimento');
  const bloqueiosRecentes = [...dados.bloqueios].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 4);
  const maiorFaixa = Math.max(1, ...t.faixasEntrada.map((f) => f.valor));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="fonte-titulo text-[22px] font-semibold">Visão geral da operação</h1>
        <p className="suave text-[13px]">
          {dados.credores.length} credores · {dados.carteiras.length} carteiras ·{' '}
          {t.qtdDevedores.toLocaleString('pt-BR')} devedores · plano {dados.escritorio.plano}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Recuperado no mês" valor={moedaCompacta(t.recuperadoMes)} destaque />
        <Kpi
          rotulo="Recuperado em 90 dias"
          valor={moedaCompacta(t.recuperadoAcumulado)}
          detalhe={`${pct(t.taxaRecuperacaoPct)} do valor entregue`}
        />
        <Kpi
          rotulo="Em aberto"
          valor={moedaCompacta(t.valorAberto)}
          detalhe={`${(t.qtdTitulos - t.pagosQtd).toLocaleString('pt-BR')} títulos`}
        />
        <Kpi
          rotulo="Acordos vigentes"
          valor={String(t.acordosVigentes)}
          detalhe={`${moedaCompacta(t.previsaoAcordos)} a receber`}
        />
        <Kpi
          rotulo="Honorários do mês"
          valor={moedaCompacta(honorariosMes)}
          detalhe="pela regra de cada credor"
        />
        <Kpi
          rotulo="Score da operação"
          valor={String(dados.score.total)}
          detalhe={`há 3 meses: ${dados.score.evolucao[0]?.valor ?? '—'}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Pendências do advogado" acao={<L para="hoje/" className="text-[13px]">ver o dia →</L>}>
          <ul className="space-y-2 text-[13.5px]">
            <li className="flex items-baseline justify-between gap-3">
              <span>Notificações extrajudiciais aguardando assinatura</span>
              <b className="num">{aAssinar}</b>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span>Negativações e protestos aguardando autorização, título a título</span>
              <b className="num">{autorizacoes}</b>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span>Dossiês prontos para o fluxo judicial</span>
              <b className="num">{dossies}</b>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span>Exceções em aberto {dados.escritorio.slaMin != null && `(SLA ${dados.escritorio.slaMin} min)`}</span>
              <b className="num">{excecoesAbertas.length}</b>
            </li>
          </ul>
          <p className="nota-demo mt-3">
            Nada é negativado, protestado ou encaminhado ao judicial sem a autorização do
            escritório — a plataforma prepara, o advogado decide.
          </p>
        </Secao>

        <Secao titulo="Recuperado por semana">
          <Colunas dados={t.recuperadoPorSemana} formato={moedaCompacta} />
        </Secao>

        <Secao titulo="Entrada na carteira por faixa de atraso">
          {t.faixasEntrada.map((f) => (
            <BarraLinha
              key={f.rotulo}
              rotulo={`${f.rotulo} dias`}
              valorTexto={moedaCompacta(f.valor)}
              fracao={f.valor / maiorFaixa}
            />
          ))}
          <p className="suave mt-2 text-[12.5px]">
            A régua é ancorada na entrada: quem chega com mais de 180 dias de atraso percorre a
            régua curta (E+0 → E+45), direto para as medidas formais.
          </p>
        </Secao>

        <Secao titulo="Conformidade em ação" acao={<L para="hoje/" className="text-[13px]">todas →</L>}>
          {bloqueiosRecentes.length === 0 && <p className="suave text-[13px]">Nenhum bloqueio registrado.</p>}
          <ul className="space-y-2.5 text-[13px]">
            {bloqueiosRecentes.map((b) => (
              <li key={b.id}>
                <span className="chip chip-sinal mb-0.5">
                  <span className="glifo" aria-hidden="true">⊘</span>
                  {b.regra}
                </span>
                <div className="suave">{b.detalhe}</div>
              </li>
            ))}
          </ul>
        </Secao>
      </div>
    </>
  );
}
