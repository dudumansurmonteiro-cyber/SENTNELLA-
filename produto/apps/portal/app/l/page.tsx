'use client';

// A tela do lojista (§7.3): títulos com multa e juros do contrato, 2ª via,
// Pix, acordo dentro da alçada, informar pagamento, contestar e falar com
// pessoa. Nunca mostra rating nem dados de outros lojistas.
//
// Dois modos de construção:
//  - demonstração (padrão): lê o JSON estático e simula as ações localmente;
//  - real (NEXT_PUBLIC_MODO=real, Fase 2): lê e grava pela API do servidor —
//    acordo, contestação e pagamento informado ficam persistentes no banco,
//    e a 2ª via sai como documento imprimível com os encargos do dia.

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DadosPortal, EntradaPortal } from '@sentinella/dados';
import { dataBr, moeda } from '@sentinella/dados';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const MODO_REAL = process.env.NEXT_PUBLIC_MODO === 'real';

type Entrada = EntradaPortal & { industria: EntradaPortal['industria'] & { pixChave?: string | null } };
type Aviso = { tipo: 'ok' | 'sinal'; texto: string } | null;

function Titular({ entrada }: { entrada: Entrada }) {
  const ficticia = entrada.industria.nome.includes('(fictícia)');
  return (
    <header className="border-b pb-3" style={{ borderColor: 'var(--line-soft)' }}>
      <p className="fonte-titulo text-[17px] font-semibold">
        {entrada.industria.nome.replace(' (fictícia)', '')}
        {ficticia && <span className="chip ml-2">demonstração</span>}
      </p>
      <p className="suave text-[13px]">
        {entrada.lojista.nome} · CNPJ {ficticia ? 'fictício ' : ''}{entrada.lojista.cnpj} · olá,{' '}
        {entrada.lojista.contatoNome.split(' ')[0]}
      </p>
    </header>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';
  const [entrada, setEntrada] = useState<Entrada | null | 'carregando'>('carregando');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [propondo, setPropondo] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState(2);
  const [contestando, setContestando] = useState<string | null>(null);
  const [informado, setInformado] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => {
    if (MODO_REAL) {
      fetch(`/api/portal/${token}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((dados) => setEntrada(dados && !dados.erro ? dados : null))
        .catch(() => setEntrada(null));
    } else {
      fetch(`${BASE}/dados/portal.json`)
        .then((r) => r.json())
        .then((portal: DadosPortal) => setEntrada((portal[token] as Entrada) ?? null))
        .catch(() => setEntrada(null));
    }
  };
  useEffect(carregar, [token]);

  // No modo real, toda ação vai à API e o resultado volta do servidor.
  const agir = async (acao: string, corpo: Record<string, unknown>, aoVivo?: () => void) => {
    if (!MODO_REAL) return null;
    setOcupado(true);
    try {
      const r = await fetch(`/api/portal/${token}/${acao}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await r.json();
      if (!r.ok) {
        setAviso({ tipo: 'sinal', texto: dados.erro ?? 'Não foi possível concluir agora.' });
        return null;
      }
      aoVivo?.();
      carregar();
      return dados as { aprovado?: boolean; mensagem: string };
    } catch {
      setAviso({ tipo: 'sinal', texto: 'Falha de conexão — tente de novo em instantes.' });
      return null;
    } finally {
      setOcupado(false);
    }
  };

  if (entrada === 'carregando')
    return <main className="container-m pt-10 suave">Carregando…</main>;
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

  const proporAcordo = async (numero: string) => {
    if (MODO_REAL) {
      const r = await agir('acordo', { numero, parcelas });
      if (r) setAviso({ tipo: r.aprovado ? 'ok' : 'sinal', texto: r.mensagem });
    } else if (parcelas <= alcada.parcelasMax) {
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

  const segundaVia = (numero: string) => {
    if (MODO_REAL) {
      window.open(`/api/portal/${token}/segunda-via?numero=${encodeURIComponent(numero)}`, '_blank');
    } else {
      setAviso({ tipo: 'ok', texto: `2ª via do título ${numero} gerada — na versão real, o documento com os encargos do dia abre na hora.` });
    }
  };

  const copiarPix = (numero: string) => {
    const chave = entrada.industria.pixChave;
    if (MODO_REAL && !chave) {
      setAviso({ tipo: 'sinal', texto: 'A indústria ainda não cadastrou a chave Pix — use a 2ª via ou fale com uma pessoa.' });
      return;
    }
    const conteudo = MODO_REAL && chave ? chave : `pix-demonstracao-${numero}`;
    try { navigator.clipboard?.writeText(conteudo); } catch {}
    setAviso({
      tipo: 'ok',
      texto: MODO_REAL && chave
        ? `Chave Pix da indústria copiada para o título ${numero}.`
        : `Código Pix do título ${numero} copiado (demonstração).`,
    });
  };

  const jaPaguei = async (numero: string) => {
    if (MODO_REAL) {
      const r = await agir('pagamento', { numero });
      if (r) {
        setInformado((x) => [...x, numero]);
        setAviso({ tipo: 'ok', texto: r.mensagem });
      }
    } else {
      setInformado((x) => [...x, numero]);
      setAviso({ tipo: 'ok', texto: `Pagamento informado para ${numero}. Anexe o comprovante na versão real — a cobrança pausa até a conferência.` });
    }
  };

  const contestar = async (numero: string, motivo: string) => {
    setContestando(null);
    if (MODO_REAL) {
      const r = await agir('contestacao', { numero, motivo });
      if (r) setAviso({ tipo: 'sinal', texto: r.mensagem });
    } else {
      setAviso({
        tipo: 'sinal',
        texto: `Contestação registrada (“${motivo}”). O título ${numero} foi marcado como contestado, o representante comercial foi avisado e um analista acompanha o caso.`,
      });
    }
  };

  const falarComPessoa = async () => {
    if (MODO_REAL) {
      const r = await agir('pessoa', {});
      if (r) setAviso({ tipo: 'ok', texto: r.mensagem });
    } else {
      setAviso({ tipo: 'ok', texto: 'Pedido registrado: uma pessoa da central assume esta conversa. Atendimento humano das 8h às 22h.' });
    }
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
          {t.estado === 'contestado' && <p className="chip chip-sinal mt-1">em análise — contestado</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="botao" disabled={ocupado} onClick={() => segundaVia(t.numero)}>
              2ª via {MODO_REAL ? 'com encargos do dia' : 'do boleto'}
            </button>
            <button className="botao botao-sec" disabled={ocupado} onClick={() => copiarPix(t.numero)}>
              copiar Pix
            </button>
            {t.diasAtraso > 0 && !['acordo', 'contestado'].includes(t.estado) && (
              <button className="botao botao-sec" disabled={ocupado} onClick={() => { setPropondo(t.numero); setAviso(null); }}>
                propor acordo
              </button>
            )}
            {t.estado !== 'contestado' && (
              <button
                className="botao botao-sec"
                disabled={ocupado || informado.includes(t.numero)}
                onClick={() => jaPaguei(t.numero)}
              >
                {informado.includes(t.numero) ? 'pagamento informado' : 'já paguei'}
              </button>
            )}
            {t.estado !== 'contestado' && (
              <button className="botao botao-sec" disabled={ocupado} onClick={() => { setContestando(t.numero); setAviso(null); }}>
                contestar
              </button>
            )}
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
                <button className="botao" disabled={ocupado} onClick={() => proporAcordo(t.numero)}>enviar proposta</button>
                <button className="botao botao-sec" onClick={() => setPropondo(null)}>cancelar</button>
              </div>
            </div>
          )}

          {contestando === t.numero && (
            <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--panel-row)' }}>
              <p className="text-[14px] font-medium">O que aconteceu?</p>
              {['Entrega incompleta ou errada', 'Produto com defeito', 'Valor diferente do combinado'].map((m) => (
                <button key={m} className="botao botao-sec mr-2 mt-2" disabled={ocupado} onClick={() => contestar(t.numero, m)}>
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

      <button className="botao mt-6 w-full" disabled={ocupado} onClick={falarComPessoa}>
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
