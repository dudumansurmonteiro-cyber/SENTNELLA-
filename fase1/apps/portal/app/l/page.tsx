'use client';

// A tela do lojista (§7.3): títulos com multa e juros do contrato, 2ª via,
// Pix, acordo dentro da alçada, informar pagamento, contestar e falar com
// pessoa. Nunca mostra rating nem dados de outros lojistas.

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DadosPortal, EntradaPortal } from '@sentinella/dados';
import { dataBr, moeda } from '@sentinella/dados';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Aviso = { tipo: 'ok' | 'sinal'; texto: string } | null;

function Titular({ entrada }: { entrada: EntradaPortal }) {
  return (
    <header className="border-b pb-3" style={{ borderColor: 'var(--line-soft)' }}>
      <p className="fonte-titulo text-[17px] font-semibold">
        {entrada.industria.nome.replace(' (fictícia)', '')}
        <span className="chip ml-2">demonstração</span>
      </p>
      <p className="suave text-[13px]">
        {entrada.lojista.nome} · CNPJ fictício {entrada.lojista.cnpj} · olá, {entrada.lojista.contatoNome.split(' ')[0]}
      </p>
    </header>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';
  const [portal, setPortal] = useState<DadosPortal | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [propondo, setPropondo] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState(2);
  const [contestando, setContestando] = useState<string | null>(null);
  const [informado, setInformado] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${BASE}/dados/portal.json`).then((r) => r.json()).then(setPortal);
  }, []);

  const entrada = useMemo(() => portal?.[token], [portal, token]);

  if (!portal) return <main className="container-m pt-10 suave">Carregando…</main>;
  if (!entrada) {
    return (
      <main className="container-m pt-10">
        <p>Link não encontrado ou expirado.</p>
        <p className="mt-2 text-[14px]"><Link href="/">Voltar ao início</Link></p>
      </main>
    );
  }

  const alcada = entrada.industria.alcada;
  const totalDevido = entrada.titulosAbertos.reduce((s, t) => s + t.total, 0);
  const vencidos = entrada.titulosAbertos.filter((t) => t.diasAtraso > 0);

  const proporAcordo = (numero: string) => {
    if (parcelas <= alcada.parcelasMax) {
      setAviso({
        tipo: 'ok',
        texto: `Acordo do título ${numero} em ${parcelas}x aprovado na hora — está dentro da alçada combinada com a indústria. O boleto da 1ª parcela chegaria agora no seu WhatsApp.`,
      });
    } else {
      setAviso({
        tipo: 'sinal',
        texto: `Parcelamento em ${parcelas}x passa da alçada. A proposta foi para um analista da central humana — retorno dentro do horário de atendimento (8h às 22h).`,
      });
    }
    setPropondo(null);
  };

  return (
    <main className="container-m pt-6">
      <Titular entrada={entrada} />

      <section className="cartao mt-4 p-4">
        <p className="suave text-[13px]">Total em aberto {vencidos.length ? '(com encargos do contrato)' : ''}</p>
        <p className="fonte-titulo num text-[30px] font-semibold">{moeda(totalDevido)}</p>
        <p className="suave text-[13px]">
          {entrada.titulosAbertos.length} título(s) · {vencidos.length} vencido(s)
        </p>
      </section>

      {aviso && (
        <p className={`nota mt-4 ${aviso.tipo === 'sinal' ? 'sinal-txt' : ''}`} style={aviso.tipo === 'sinal' ? { borderColor: 'var(--signal)' } : undefined}>
          {aviso.texto}
        </p>
      )}

      <h2 className="fonte-titulo mt-6 text-[17px] font-semibold">Títulos em aberto</h2>
      {entrada.titulosAbertos.map((t) => (
        <article key={t.numero} className="cartao mt-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="suave text-[13px]">{t.numero} · venc. {dataBr(t.vencimento)}</span>
            {t.diasAtraso > 0 ? (
              <span className="chip chip-sinal">{t.diasAtraso} dias de atraso</span>
            ) : (
              <span className="chip">a vencer</span>
            )}
          </div>
          <p className="num mt-1 text-[20px] font-semibold">{moeda(t.total)}</p>
          {t.multa != null && t.juros != null ? (
            <p className="suave text-[12.5px]">
              valor original {moeda(t.valor)} + multa {moeda(t.multa)} + juros {moeda(t.juros)} —
              calculados exatamente como no contrato
            </p>
          ) : (
            <p className="suave text-[12.5px]">valor original {moeda(t.valor)}</p>
          )}
          {t.estado === 'acordo' && <p className="chip mt-1">este título está em acordo</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="botao"
              onClick={() =>
                setAviso({ tipo: 'ok', texto: `2ª via do título ${t.numero} gerada — na versão real, o boleto atualizado baixa na hora.` })
              }
            >
              2ª via do boleto
            </button>
            <button
              className="botao botao-sec"
              onClick={() => {
                try { navigator.clipboard?.writeText(`pix-demonstracao-${t.numero}`); } catch {}
                setAviso({ tipo: 'ok', texto: `Código Pix do título ${t.numero} copiado (demonstração).` });
              }}
            >
              copiar Pix
            </button>
            {t.diasAtraso > 0 && t.estado !== 'acordo' && (
              <button className="botao botao-sec" onClick={() => { setPropondo(t.numero); setAviso(null); }}>
                propor acordo
              </button>
            )}
            <button
              className="botao botao-sec"
              disabled={informado.includes(t.numero)}
              onClick={() => {
                setInformado((x) => [...x, t.numero]);
                setAviso({ tipo: 'ok', texto: `Pagamento informado para ${t.numero}. Anexe o comprovante na versão real — a cobrança pausa até a conferência.` });
              }}
            >
              {informado.includes(t.numero) ? 'pagamento informado' : 'já paguei'}
            </button>
            <button className="botao botao-sec" onClick={() => { setContestando(t.numero); setAviso(null); }}>
              contestar
            </button>
          </div>

          {propondo === t.numero && (
            <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--panel-row)' }}>
              <p className="text-[14px] font-medium">Proposta de acordo</p>
              <p className="suave text-[12.5px]">
                Dentro da alçada, a aprovação é na hora; acima dela, um analista humano responde.
              </p>
              <label className="mt-2 flex items-center gap-2 text-[14px]">
                Parcelas:
                <select className="campo w-24" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6, 8].map((p) => <option key={p} value={p}>{p}x</option>)}
                </select>
              </label>
              <div className="mt-2 flex gap-2">
                <button className="botao" onClick={() => proporAcordo(t.numero)}>enviar proposta</button>
                <button className="botao botao-sec" onClick={() => setPropondo(null)}>cancelar</button>
              </div>
            </div>
          )}

          {contestando === t.numero && (
            <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--panel-row)' }}>
              <p className="text-[14px] font-medium">O que aconteceu?</p>
              {['Entrega incompleta ou errada', 'Produto com defeito', 'Valor diferente do combinado'].map((m) => (
                <button
                  key={m}
                  className="botao botao-sec mr-2 mt-2"
                  onClick={() => {
                    setContestando(null);
                    setAviso({
                      tipo: 'sinal',
                      texto: `Contestação registrada (“${m}”). O título ${t.numero} foi marcado como contestado, o representante comercial foi avisado e um analista acompanha o caso.`,
                    });
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}

      {entrada.acordos.length > 0 && (
        <>
          <h2 className="fonte-titulo mt-6 text-[17px] font-semibold">Acordos</h2>
          {entrada.acordos.map((a, i) => (
            <p key={i} className="cartao mt-2 p-3 text-[14px]">
              {moeda(a.valorTotal)} em {a.parcelas}x · {a.parcelasPagas} parcela(s) paga(s) ·{' '}
              {a.status === 'atrasado' ? <span className="sinal-txt">{a.status}</span> : a.status}
            </p>
          ))}
        </>
      )}

      {entrada.titulosPagos.length > 0 && (
        <>
          <h2 className="fonte-titulo mt-6 text-[17px] font-semibold">Pagos recentemente</h2>
          {entrada.titulosPagos.map((t) => (
            <p key={t.numero} className="suave border-b py-2 text-[13.5px]" style={{ borderColor: 'var(--line-soft)' }}>
              {t.numero} · {moeda(t.valor)} · pago em {dataBr(t.pagoEm)} ✓
            </p>
          ))}
        </>
      )}

      <button
        className="botao mt-6 w-full"
        onClick={() =>
          setAviso({ tipo: 'ok', texto: 'Pedido registrado: uma pessoa da central assume esta conversa. Atendimento humano das 8h às 22h.' })
        }
      >
        Falar com uma pessoa
      </button>
    </main>
  );
}

export default function PaginaLojista() {
  return (
    <Suspense fallback={<main className="container-m pt-10 suave">Carregando…</main>}>
      <Conteudo />
    </Suspense>
  );
}
