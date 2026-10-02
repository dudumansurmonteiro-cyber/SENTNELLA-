'use client';

// Atendimento de uma exceção: a conversa com o devedor (em nome do
// escritório), o contexto do caso e a alçada da carteira. Respostas aqui são
// demonstrativas e não persistem.

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { L } from '../../../lib/raiz';
import { moeda, moedaCurta, pct } from '@sentinella/dados';
import { Carregando, useDados } from '../../../lib/contexto';
import { Secao, Selo } from '../../../lib/ui';

function Conteudo() {
  const { dados } = useDados();
  const params = useSearchParams();
  const id = params.get('e');
  const [respostas, setRespostas] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  if (!dados) return <Carregando />;

  const e = dados.excecoes.find((x) => x.id === id);
  if (!e) {
    return (
      <p className="py-8">
        Exceção não encontrada. <L para="console/">Voltar à fila</L>
      </p>
    );
  }

  const dev = dados.devedores.find((d) => d.id === e.devedorId)!;
  const carteira = dados.carteiras.find((c) => c.id === e.carteiraId)!;
  const credor = dados.credores.find((c) => c.id === carteira.credorId)!;
  const titulo = e.tituloId ? dados.titulos.find((t) => t.id === e.tituloId) : null;
  const mesaPropria = dados.escritorio.slaMin == null;

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setRespostas([...respostas, t]);
    setTexto('');
  };

  return (
    <>
      <p className="text-[13px]"><L para="console/">← Fila de exceções</L></p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="fonte-titulo text-[20px] font-semibold">{e.motivo}</h1>
        <span className={`chip ${e.estado === 'aberta' ? 'chip-sinal' : ''}`}>{e.estado}</span>
        {e.assumidaPor && <span className="suave text-[13px]">com {e.assumidaPor}</span>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Secao titulo={`Conversa — em nome de ${dados.escritorio.marca.nomeExibicao}`}>
          <ul className="space-y-2.5">
            {e.conversa.map((m, i) => (
              <li
                key={i}
                className="max-w-[85%] rounded-lg px-3 py-2 text-[13.5px]"
                style={
                  m.de === 'devedor'
                    ? { background: 'var(--panel-row)' }
                    : {
                        background: 'var(--primary)', color: 'var(--on-primary)',
                        marginLeft: 'auto',
                      }
                }
              >
                <b className="block text-[11.5px] opacity-80">
                  {m.de === 'devedor' ? dev.nome : m.de === 'IA' ? 'IA (conferida pela conformidade)' : 'analista'}
                  {' '}· há {m.minAtras} min
                </b>
                {m.texto}
              </li>
            ))}
            {respostas.map((r, i) => (
              <li key={`r${i}`} className="max-w-[85%] rounded-lg px-3 py-2 text-[13.5px]"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)', marginLeft: 'auto' }}>
                <b className="block text-[11.5px] opacity-80">você (demonstração · não persiste)</b>
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className="campo-select flex-1"
              placeholder={mesaPropria ? 'Mesa do próprio escritório — envio desabilitado' : 'Responder como o escritório…'}
              aria-label="Resposta ao devedor"
              value={texto}
              disabled={mesaPropria}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && enviar()}
            />
            <button type="button" className="botao" onClick={enviar} disabled={mesaPropria || !texto.trim()}>
              Enviar
            </button>
          </div>
          {e.resolucao && (
            <p className="nota-demo mt-3">
              <b>Resolução:</b> {e.resolucao}
              {e.causa && <> · causa: {e.causa}</>}
            </p>
          )}
        </Secao>

        <div>
          <Secao titulo="Contexto do caso">
            <ul className="space-y-1.5 text-[13.5px]">
              <li>
                <L para={`devedores/ficha/?d=${dev.id}`} className="font-medium">{dev.nome}</L>{' '}
                <Selo letra={dev.rating} titulo="Rating interno — nunca vai ao devedor" />
              </li>
              <li className="suave">{dev.tipo} · {dev.doc} · {dev.cidade}</li>
              <li>{dev.titulosAbertos} título(s) em aberto · {moedaCurta(dev.valorAberto)}</li>
              {titulo && (
                <li>
                  Título {titulo.numero}: {moeda(titulo.valorAtualizado)} · {titulo.estado} ·{' '}
                  {titulo.etapaAtual}
                </li>
              )}
              <li className="suave">
                Carteira “{carteira.nome}” · credor {credor.nome}
              </li>
              {dev.vulneravel && (
                <li>
                  <span className="chip chip-sinal">
                    <span className="glifo" aria-hidden="true">!</span>
                    vulnerabilidade declarada — atenção especial (Lei 14.181)
                  </span>
                </li>
              )}
              {dev.canaisBloqueados.length > 0 && (
                <li>
                  <span className="chip chip-sinal">
                    <span className="glifo" aria-hidden="true">⊘</span>
                    não contatar por {dev.canaisBloqueados.join(', ')}
                  </span>
                </li>
              )}
            </ul>
          </Secao>

          <Secao titulo="Alçada desta carteira">
            <ul className="space-y-1.5 text-[13.5px]">
              <li>Desconto até {pct(carteira.alcada.descontoMaxPct)}</li>
              <li>Até {carteira.alcada.parcelasMax} parcelas · prazo {carteira.alcada.prazoMaxDias} dias</li>
              <li>Entrada mínima {pct(carteira.alcada.entradaMinPct)}</li>
              <li className="suave">
                Fora da alçada? Devolva ao escritório com o resumo do caso — quem decide é o
                advogado.
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="botao botao-sec" disabled={mesaPropria}>
                Propor acordo na alçada (demonstração)
              </button>
              <button type="button" className="botao botao-sinal" disabled={mesaPropria}>
                Devolver ao escritório (demonstração)
              </button>
            </div>
          </Secao>
        </div>
      </div>
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
