'use client';

// Configurações do escritório: plano e fatura por devedores ativos, marca
// white label, equipe, operação e privacidade. Mudanças aqui são
// demonstrativas e não persistem.

import { useMemo, useState } from 'react';
import { moedaCurta, pct } from '@sentinella/dados';
import type { Plano } from '@sentinella/dados';
import { Carregando, useDados } from '../../lib/contexto';
import { Kpi, Secao } from '../../lib/ui';

// Preços v3 (§5 — proposta conservadora de lançamento, por devedores ativos
// no mês; sem qualquer participação nos honorários do escritório).
const PRECOS: Record<Plano, {
  piso: number; teto: number | null; excedente: number | null;
  usuarios: string; sla: string; revisao: string;
}> = {
  Básico: {
    piso: 1900, teto: 4900, excedente: 0.6,
    usuarios: '5 inclusos · adicional R$ 90/mês', sla: 'equipe do próprio escritório', revisao: 'mensal',
  },
  Avançado: {
    piso: 6900, teto: 24900, excedente: 2.5,
    usuarios: '10 inclusos', sla: 'até 15 min', revisao: 'quinzenal',
  },
  Max: {
    piso: 29000, teto: null, excedente: null,
    usuarios: 'ilimitados', sla: 'até 5 min', revisao: 'semanal',
  },
};

function mensalidade(plano: Plano, ativos: number): { valor: number; faixa: string } {
  const p = PRECOS[plano];
  if (plano === 'Max') return { valor: p.piso, faixa: 'piso do plano · acima do contratado, sob proposta' };
  if (ativos <= 2000) return { valor: p.piso, faixa: 'até 2.000 devedores ativos → piso' };
  if (ativos <= 10000) return { valor: p.teto!, faixa: '2.001 a 10.000 devedores ativos → teto' };
  return {
    valor: p.teto! + (ativos - 10000) * p.excedente!,
    faixa: `acima de 10.000 → teto + R$ ${String(p.excedente).replace('.', ',')} por devedor excedente`,
  };
}

export default function Config() {
  const { dados } = useDados();
  const [mostrarOperadora, setMostrarOperadora] = useState<boolean | null>(null);

  const ativos = useMemo(
    () => dados?.devedores.filter((d) => d.titulosAbertos > 0).length ?? 0,
    [dados],
  );

  if (!dados) return <Carregando />;
  const esc = dados.escritorio;
  const precos = PRECOS[esc.plano];
  const fatura = mensalidade(esc.plano, ativos);
  const operadoraVisivel = mostrarOperadora ?? esc.marca.mostrarOperadora;
  const basesLegais = [...new Set(dados.carteiras.map((c) => c.baseLegal))];

  return (
    <>
      <h1 className="fonte-titulo text-[22px] font-semibold">Configurações</h1>
      <p className="suave mt-1 text-[13.5px]">
        {esc.nome} · OAB {esc.oab} · {esc.cidade}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Plano" valor={esc.plano} detalhe={`revisão ${precos.revisao} com a Sentinella`} />
        <Kpi rotulo="Devedores ativos no mês" valor={ativos.toLocaleString('pt-BR')}
          detalhe="com título em aberto" />
        <Kpi rotulo="Mensalidade" valor={moedaCurta(fatura.valor)} destaque detalhe={fatura.faixa} />
        <Kpi rotulo="Resposta a exceção" valor={precos.sla} detalhe={esc.slaMin == null ? 'negociadores próprios' : 'mesa Sentinella'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Plano e cobrança">
          <ul className="space-y-1.5 text-[13.5px]">
            <li>Piso {moedaCurta(precos.piso)}/mês{precos.teto != null && <> · teto {moedaCurta(precos.teto)}/mês</>}
              {precos.teto == null && <> · teto sob proposta, com piso</>}</li>
            {precos.excedente != null && (
              <li>Excedente acima do teto: R$ {String(precos.excedente).replace('.', ',')} por devedor ativo</li>
            )}
            <li>Usuários do escritório: {precos.usuarios}</li>
            <li>Custos de terceiros repassados ao custo: tarifas de WhatsApp (Meta), SMS, carta, cartório e consulta a birô</li>
            <li>Contrato de 12 meses · reajuste anual pelo IPCA</li>
          </ul>
          <p className="nota-demo mt-3">
            A Sentinella cobra pelo uso da plataforma e da operação — por devedores ativos no mês —
            e não participa de honorários nem dos valores recuperados (vedação do Código de Ética
            da OAB à partilha com não advogados).
          </p>
        </Secao>

        <Secao titulo="Marca (white label)">
          <div className="flex flex-wrap items-center gap-3 text-[13.5px]">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-md text-[15px] font-semibold"
              style={{ background: esc.marca.corPrimaria, color: '#fff' }}
            >
              {esc.marca.iniciais}
            </span>
            <div>
              <b>{esc.marca.nomeExibicao}</b>
              <div className="suave text-[12.5px]">como credores e devedores veem o escritório</div>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-[13.5px]">
            <li className="flex items-center gap-2">
              <i className="inline-block h-4 w-4 rounded" style={{ background: esc.marca.corPrimaria }} aria-hidden="true" />
              Cor da marca {esc.marca.corPrimaria}
              <i className="ml-2 inline-block h-4 w-4 rounded" style={{ background: esc.marca.corClara }} aria-hidden="true" />
              variação clara {esc.marca.corClara} (modo escuro)
            </li>
            <li className="flex flex-wrap items-center gap-2">
              Rodapé “plataforma operada por Sentinella” nos portais:
              <b>{operadoraVisivel ? 'visível' : 'removido'}</b>
              {esc.plano === 'Max' ? (
                <button type="button" className="botao botao-sec" style={{ padding: '2px 10px', fontSize: 12.5 }}
                  onClick={() => setMostrarOperadora(!operadoraVisivel)}>
                  {operadoraVisivel ? 'Remover (demonstração)' : 'Mostrar (demonstração)'}
                </button>
              ) : (
                <span className="chip">remoção disponível no plano Max</span>
              )}
            </li>
          </ul>
        </Secao>

        <Secao titulo={`Equipe do escritório (${esc.usuarios.length})`}>
          <div className="overflow-x-auto">
            <table className="tab">
              <thead>
                <tr><th>Nome</th><th>Papel</th><th>OAB</th></tr>
              </thead>
              <tbody>
                {esc.usuarios.map((u) => (
                  <tr key={u.nome}>
                    <td className="font-medium">{u.nome}</td>
                    <td>{u.papel}</td>
                    <td>{u.oab ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="suave mt-2 text-[12.5px]">
            Assinatura de notificações, autorização de negativação/protesto e envio ao judicial
            são sempre de advogado do escritório.
          </p>
        </Secao>

        <Secao titulo="Operação e privacidade">
          <ul className="space-y-1.5 text-[13.5px]">
            <li>Gravações de ligação retidas por {esc.retencaoGravacoesAnos} anos, acessíveis ao escritório</li>
            <li>Janela de ligações: dias úteis e sábados, dentro do horário permitido — fora dela a
              conformidade bloqueia e reprograma</li>
            <li>Bases legais em uso (LGPD): {basesLegais.join(' · ')}</li>
            <li>Papéis definidos por carteira (controlador: {[...new Set(dados.carteiras.map((c) => c.controlador))].join(' ou ')});
              a Sentinella atua como operadora</li>
            <li>Boleto e Pix emitidos na conta do credor ou do escritório — o dinheiro não passa
              pela Sentinella</li>
            <li>Pedidos de não contato, contestações e declarações de vulnerabilidade travam a
              régua automaticamente (CDC e Lei 14.181)</li>
          </ul>
        </Secao>
      </div>
    </>
  );
}
