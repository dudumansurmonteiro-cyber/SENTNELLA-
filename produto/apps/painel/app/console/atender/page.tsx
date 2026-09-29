'use client';

// Atendimento de uma exceção (§7.4): conversa inteira, ficha do lojista,
// títulos, alçada do cliente e as ações do analista na mesma tela.

import { L } from '../../../lib/raiz';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DadosCliente, Mensagem } from '@sentinella/dados';
import { dataBr, moeda, moedaCurta } from '@sentinella/dados';
import { Carregando, carregarTodos } from '../../../lib/contexto';
import { ChipTitulo, Secao, Selo } from '../../../lib/ui';

const CAUSAS = [
  'regra de alçada apertada para o perfil do lojista',
  'divergência de cadastro entre pedido e ERP',
  'lojista sem contato financeiro atualizado',
  'contestação comercial — encaminhada ao representante',
];

function Conteudo() {
  const params = useSearchParams();
  const idExcecao = params.get('e');
  const idCliente = params.get('c') ?? 'c1';
  const [dados, setDados] = useState<DadosCliente | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [registro, setRegistro] = useState<string | null>(null);
  const [causa, setCausa] = useState(CAUSAS[0]);

  useEffect(() => {
    carregarTodos([idCliente]).then(([d]) => setDados(d));
  }, [idCliente]);

  if (!dados) return <Carregando />;
  const excecao = dados.excecoes.find((e) => e.id === idExcecao);
  if (!excecao) {
    return (
      <p className="py-8">
        Exceção não encontrada. <L para="console/">Voltar à fila</L>
      </p>
    );
  }
  const lojista = dados.lojistas.find((l) => l.id === excecao.lojistaId)!;
  const titulos = dados.titulos
    .filter((t) => t.lojistaId === lojista.id && t.estado !== 'pago')
    .sort((a, b) => b.valor - a.valor);
  const alcada = dados.cliente.alcada;
  const conversa = [...excecao.conversa, ...msgs];

  const agir = (r: string) => setRegistro(r);

  return (
    <>
      <p className="text-[13px]"><L para="console/">← Fila de exceções</L></p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="fonte-titulo text-[20px] font-semibold sinal-txt">{excecao.motivo}</h1>
        <span className="suave text-[13px]">
          {dados.cliente.nome} · SLA {excecao.slaMin} min · valor {moedaCurta(excecao.valorEnvolvido)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Secao titulo="Conversa">
          <div className="grid gap-2">
            {conversa.map((m, i) => (
              <div
                key={i}
                className="max-w-[85%] rounded-lg px-3 py-2 text-[13.5px]"
                style={{
                  background: m.de === 'lojista' ? 'var(--panel-row)' : 'var(--signal-bg)',
                  justifySelf: m.de === 'lojista' ? 'start' : 'end',
                  borderLeft: m.de === 'analista' ? '3px solid var(--signal)' : undefined,
                }}
              >
                <span className="suave block text-[11px]">{m.de === 'IA' ? 'IA Sentinella' : m.de}</span>
                {m.texto}
              </div>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!texto.trim()) return;
              setMsgs((m) => [...m, { de: 'analista', texto, minAtras: 0 }]);
              setTexto('');
            }}
          >
            <input
              className="campo-select flex-1"
              placeholder="Responder como analista (demo)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button className="botao" type="submit">enviar</button>
          </form>
        </Secao>

        <div>
          <Secao titulo="Ficha do lojista">
            <p className="flex items-center gap-2 text-[14px] font-medium">
              {lojista.nome} <Selo letra={lojista.rating} />
            </p>
            <p className="suave text-[13px]">
              {lojista.cidade} · contato {lojista.contatoNome} ({lojista.contatoPapel})
            </p>
            <p className="suave text-[13px]">
              {lojista.titulosAbertos} títulos abertos · vencidos {moedaCurta(lojista.valorVencido)}
            </p>
            <p className="mt-1 text-[13px]">
              <L para={`devedores/ficha/?l=${lojista.id}`}>ficha completa no painel</L>
            </p>
          </Secao>

          <Secao titulo="Alçada do cliente">
            <p className="text-[13.5px]">
              desconto até <b>{alcada.descontoMaxPct}%</b> · até <b>{alcada.parcelasMax}x</b> ·
              prazo <b>{alcada.prazoMaxDias} dias</b> · acima de{' '}
              <b>{moedaCurta(alcada.valorSempreAnalista)}</b> só com analista
            </p>
          </Secao>

          <Secao titulo="Títulos em aberto">
            <table className="tab">
              <tbody>
                {titulos.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td className="suave">{t.numero}</td>
                    <td className="num font-medium">{moeda(t.valor)}</td>
                    <td className="suave">venc. {dataBr(t.vencimento)}</td>
                    <td><ChipTitulo estado={t.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        </div>
      </div>

      <Secao titulo="Ações do analista (demonstração — nada persiste)">
        <div className="flex flex-wrap gap-2">
          <button className="botao" onClick={() => agir('Acordo fechado dentro da alçada e registrado no título.')}>
            fechar acordo dentro da alçada
          </button>
          <button className="botao botao-sec" onClick={() => agir('Proposta fora da alçada enviada ao cliente para aprovação.')}>
            propor fora da alçada
          </button>
          <button className="botao botao-sec" onClick={() => agir('Representante comercial acionado com o histórico completo.')}>
            acionar representante
          </button>
          <button className="botao botao-sec" onClick={() => agir('Ligação agendada para amanhã, dentro da janela permitida.')}>
            agendar ligação
          </button>
          <button className="botao botao-sec" onClick={() => agir('Título marcado como contestado; cobrança pausada para este título.')}>
            marcar como contestado
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="suave text-[13px]">Registrar incidente com causa:</span>
          <select className="campo-select" value={causa} onChange={(e) => setCausa(e.target.value)}>
            {CAUSAS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button
            className="botao botao-sinal"
            onClick={() => agir(`Incidente registrado — causa: ${causa}. Se revelar regra faltando, a mudança é proposta à régua do cliente.`)}
          >
            registrar e resolver
          </button>
        </div>
        {registro && <p className="nota-demo mt-3">{registro}</p>}
      </Secao>
    </>
  );
}

export default function Atender() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
