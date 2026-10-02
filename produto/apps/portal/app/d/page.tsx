'use client';

// Espaço do devedor (§7): white label do escritório, credor original sempre
// identificado, custo total de qualquer acordo ANTES do aceite (Lei 14.181),
// contestação que pausa a cobrança, preferências de contato e atendimento
// humano. Rating jamais aparece aqui. Ações são demonstrativas (não persistem).

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { L, raizApp } from '../../lib/raiz';
import { dataBr, moeda } from '@sentinella/dados';
import type { EntradaPortalDevedor, PortalDevedores } from '@sentinella/dados';

const iniciaisDe = (nome: string) =>
  nome
    .split(' ')
    .filter((p) => /^\p{Lu}/u.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

function Confirmacao({ texto }: { texto: string }) {
  return (
    <p className="nota mt-3" role="status">
      <b>✓ {texto}</b> — demonstração: nada é registrado de verdade.
    </p>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';
  const [todos, setTodos] = useState<PortalDevedores | null>(null);
  const [aba, setAba] = useState<'' | 'acordo' | 'paguei' | 'contestar' | 'contato' | 'pessoa'>('');
  const [feito, setFeito] = useState<string | null>(null);
  const [acordoEscolhido, setAcordoEscolhido] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${raizApp()}dados/devedores.json`).then((r) => r.json()).then(setTodos);
  }, []);

  const entrada: EntradaPortalDevedor | undefined = todos?.[token];
  const totalAberto = useMemo(
    () => entrada?.titulosAbertos.reduce((s, t) => s + t.valorAtualizado, 0) ?? 0,
    [entrada],
  );

  if (!todos) return <main className="container-m pt-10"><p className="suave">Carregando…</p></main>;
  if (!entrada) {
    return (
      <main className="container-m pt-10">
        <h1 className="fonte-titulo text-[20px] font-semibold">Link não encontrado</h1>
        <p className="suave mt-2">
          Confira o código recebido, tente um <L para="">acesso de exemplo</L> ou, se o seu acesso
          é de credor, use <L para={`c/?t=${token}`}>o portal do credor</L>.
        </p>
      </main>
    );
  }

  const esc = entrada.escritorio;
  const temEncargos = entrada.titulosAbertos.some((t) => t.encargos != null);
  const contestados = entrada.titulosAbertos.filter((t) => t.estado === 'contestado');
  const marcarFeito = (chave: string) => {
    setFeito(chave);
    setAba('');
  };

  return (
    <>
      {/* Tema do escritório responsável (white label). */}
      <style>{`
        :root{--primary:${esc.corPrimaria};--link:${esc.corPrimaria};--on-primary:#ffffff}
        @media (prefers-color-scheme:dark){:root{--primary:${esc.corClara};--link:${esc.corClara};--on-primary:#14211f}}
      `}</style>

      <header style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
        <div className="container-m flex items-center gap-3 py-3.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[13.5px] font-semibold"
            style={{ background: 'var(--on-primary)', color: 'var(--primary)' }}
          >
            {iniciaisDe(esc.nomeExibicao)}
          </span>
          <div>
            <b className="fonte-titulo block text-[16.5px] leading-tight">{esc.nomeExibicao}</b>
            <span className="text-[12px]" style={{ opacity: 0.85 }}>{esc.oab}</span>
          </div>
        </div>
      </header>

      <main className="container-m pb-16 pt-6">
        <h1 className="fonte-titulo text-[21px] font-semibold leading-tight">
          Olá, {entrada.devedor.nome.split(' ')[0]}.
        </h1>
        <p className="suave mt-1 text-[13.5px]">
          {entrada.devedor.doc} · Este espaço trata do seu débito com{' '}
          <b>{entrada.credorOriginal}</b>, sob responsabilidade do escritório {esc.nomeExibicao}.
        </p>

        <div className="cartao mt-4 p-4">
          <p className="suave text-[12.5px]">Total em aberto hoje</p>
          <p className="fonte-titulo text-[30px] font-semibold" style={{ color: 'var(--link)' }}>
            {moeda(totalAberto)}
          </p>
          <p className="suave text-[12.5px]">
            {entrada.titulosAbertos.length} título(s)
            {temEncargos
              ? ' · valores atualizados conforme o contrato'
              : ' · sem multa nem juros nesta carteira'}
          </p>
          {contestados.length > 0 && (
            <p className="chip chip-sinal mt-2">cobrança pausada no título em análise</p>
          )}
          <div className="nao-imprime mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="botao" onClick={() => marcarFeito('pagar')}>
              Pagar agora (2ª via)
            </button>
            <button type="button" className="botao botao-sec" onClick={() => setAba(aba === 'acordo' ? '' : 'acordo')}>
              Parcelar (ver opções)
            </button>
            <button type="button" className="botao botao-sec" onClick={() => setAba(aba === 'paguei' ? '' : 'paguei')}>
              Já paguei
            </button>
            <button type="button" className="botao botao-sec" onClick={() => setAba(aba === 'pessoa' ? '' : 'pessoa')}>
              Falar com uma pessoa
            </button>
          </div>
          {feito === 'pagar' && (
            <div className="nota mt-3">
              <b>2ª via emitida (demonstração).</b> Boleto e Pix saem com os dados do credor ou do
              escritório — o pagamento cai direto na conta deles, nunca em conta da plataforma. O
              código chegaria aqui e no seu WhatsApp/e-mail.
            </div>
          )}
        </div>

        {aba === 'acordo' && (
          <div className="cartao mt-4 p-4">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Opções de parcelamento</h2>
            <p className="suave mt-1 text-[13px]">
              Aprovadas na hora, dentro do que o credor autorizou. Antes de aceitar, você vê o
              custo total — sem surpresa.
            </p>
            <ul className="mt-3 space-y-2.5">
              {entrada.simulacoes.map((s, i) => (
                <li key={i} className="rounded-lg border p-3" style={{ borderColor: acordoEscolhido === i ? 'var(--primary)' : 'var(--line-soft)' }}>
                  <label className="flex cursor-pointer items-baseline gap-3">
                    <input
                      type="radio"
                      name="acordo"
                      checked={acordoEscolhido === i}
                      onChange={() => setAcordoEscolhido(i)}
                    />
                    <span>
                      <b>{s.parcelas}× de {moeda(s.valorParcela)}</b>
                      <span className="suave block text-[12.5px]">
                        Custo total: <b>{moeda(s.custoTotal)}</b>
                        {s.jurosEmbutidos > 0
                          ? <> — já inclui {moeda(s.jurosEmbutidos)} de encargos do parcelamento</>
                          : <> — sem encargos de parcelamento</>}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="botao mt-3 w-full"
              disabled={acordoEscolhido == null}
              onClick={() => marcarFeito('acordo')}
            >
              {acordoEscolhido == null
                ? 'Escolha uma opção para ver e aceitar'
                : `Aceitar: ${entrada.simulacoes[acordoEscolhido].parcelas}× de ${moeda(entrada.simulacoes[acordoEscolhido].valorParcela)} (total ${moeda(entrada.simulacoes[acordoEscolhido].custoTotal)})`}
            </button>
            <p className="suave mt-2 text-[12px]">
              Condições fora destas? <button type="button" className="underline" onClick={() => setAba('pessoa')}>Fale com uma pessoa</button> — propostas fora da alçada vão para o escritório decidir.
            </p>
          </div>
        )}
        {feito === 'acordo' && <Confirmacao texto="Acordo registrado — a primeira parcela chegaria por boleto/Pix" />}

        {aba === 'paguei' && (
          <div className="cartao mt-4 p-4">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Já pagou?</h2>
            <p className="suave mt-1 text-[13px]">
              Informe quando e como pagou. A cobrança <b>pausa imediatamente</b> até a conferência.
            </p>
            <input className="campo mt-3" placeholder="Ex.: Pix em 28/09, pelo app do banco" aria-label="Como foi o pagamento" />
            <button type="button" className="botao mt-2 w-full" onClick={() => marcarFeito('paguei')}>
              Enviar para conferência
            </button>
          </div>
        )}
        {feito === 'paguei' && <Confirmacao texto="Pagamento informado — cobrança pausada até a conferência" />}

        {aba === 'contestar' && (
          <div className="cartao mt-4 p-4">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Não reconhece este débito?</h2>
            <p className="suave mt-1 text-[13px]">
              Conte o que aconteceu. O título fica <b>em análise e a cobrança pausa</b> até o
              escritório responder.
            </p>
            <textarea className="campo mt-3" rows={3} placeholder="Descreva a divergência" aria-label="Motivo da contestação" />
            <button type="button" className="botao mt-2 w-full" onClick={() => marcarFeito('contestar')}>
              Enviar contestação
            </button>
          </div>
        )}
        {feito === 'contestar' && <Confirmacao texto="Contestação enviada — cobrança pausada até a resposta" />}

        {aba === 'contato' && (
          <div className="cartao mt-4 p-4">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Preferências de contato</h2>
            <p className="suave mt-1 text-[13px]">
              Você pode pedir outro canal ou pedir para não ser contatado por algum deles — a
              régua respeita na hora.
            </p>
            {['WhatsApp', 'SMS', 'e-mail', 'ligação'].map((c) => (
              <label key={c} className="mt-2 flex items-center gap-2 text-[14px]">
                <input type="checkbox" defaultChecked /> aceito contato por {c}
              </label>
            ))}
            <button type="button" className="botao mt-3 w-full" onClick={() => marcarFeito('contato')}>
              Salvar preferências
            </button>
          </div>
        )}
        {feito === 'contato' && <Confirmacao texto="Preferências registradas — valem para os próximos contatos" />}

        {aba === 'pessoa' && (
          <div className="cartao mt-4 p-4">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Falar com uma pessoa</h2>
            <p className="suave mt-1 text-[13px]">
              Uma pessoa do atendimento responde em nome do escritório, em horário comercial. Se
              você estiver passando por uma situação difícil (desemprego, doença, superendividamento),
              diga — há tratamento adequado para isso, previsto em lei.
            </p>
            <input className="campo mt-3" placeholder="Sua mensagem" aria-label="Mensagem para o atendimento" />
            <button type="button" className="botao mt-2 w-full" onClick={() => marcarFeito('pessoa')}>
              Enviar — respondem pelo seu canal preferido
            </button>
          </div>
        )}
        {feito === 'pessoa' && <Confirmacao texto="Mensagem enviada ao atendimento do escritório" />}

        <section className="mt-6">
          <h2 className="fonte-titulo text-[16.5px] font-semibold">Seus títulos</h2>
          {entrada.titulosAbertos.map((t) => (
            <div key={t.numero} className="cartao mt-2.5 p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <b>{moeda(t.valorAtualizado)}</b>
                {t.estado === 'contestado'
                  ? <span className="chip chip-sinal">em análise · pausada</span>
                  : <span className="chip">{t.estado}</span>}
              </div>
              <p className="suave mt-1 text-[12.5px]">
                {t.credor} · título {t.numero} · vencimento original {dataBr(t.vencimentoOriginal)}
              </p>
              {t.encargos != null && (
                <p className="suave text-[12.5px]">
                  {moeda(t.valorOriginal)} + {moeda(t.encargos)} de encargos previstos no contrato
                </p>
              )}
            </div>
          ))}
          <div className="nao-imprime mt-3 flex flex-wrap gap-2 text-[13.5px]">
            <button type="button" className="botao botao-sec" onClick={() => setAba(aba === 'contestar' ? '' : 'contestar')}>
              Não reconheço um débito
            </button>
            <button type="button" className="botao botao-sec" onClick={() => setAba(aba === 'contato' ? '' : 'contato')}>
              Preferências de contato
            </button>
          </div>
        </section>

        {entrada.acordos.length > 0 && (
          <section className="mt-6">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Seus acordos</h2>
            {entrada.acordos.map((a, i) => (
              <div key={i} className="cartao mt-2.5 p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <b>{a.parcelas}× · total {moeda(a.valorTotal)}</b>
                  <span className="chip">{a.status}</span>
                </div>
                <div className="barra mt-2" role="img" aria-label={`${a.parcelasPagas} de ${a.parcelas} parcelas pagas`}>
                  <i style={{ width: `${(a.parcelasPagas / a.parcelas) * 100}%` }} />
                </div>
                <p className="suave mt-1 text-[12.5px]">{a.parcelasPagas} de {a.parcelas} parcelas pagas</p>
              </div>
            ))}
          </section>
        )}

        {entrada.titulosPagos.length > 0 && (
          <section className="mt-6">
            <h2 className="fonte-titulo text-[16.5px] font-semibold">Pagos — tudo certo</h2>
            {entrada.titulosPagos.map((t) => (
              <p key={t.numero} className="border-b py-2 text-[13.5px]" style={{ borderColor: 'var(--line-soft)' }}>
                ✓ {moeda(t.valor)} <span className="suave">· título {t.numero} · pago em {dataBr(t.pagoEm)}</span>
              </p>
            ))}
          </section>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--line-soft)' }}>
        <div className="container-m suave py-4 text-[12px]">
          {esc.nomeExibicao} · {esc.oab} · {esc.contato}
          {esc.mostrarOperadora && <> · plataforma operada por Sentinella</>}
          <br />
          Demonstração com dados fictícios. Pagamentos vão direto para a conta do credor ou do
          escritório. Seus dados são tratados conforme a LGPD; só falamos sobre a dívida com você.
        </div>
      </footer>
    </>
  );
}

export default function PortalDevedor() {
  return (
    <Suspense fallback={<main className="container-m pt-10"><p className="suave">Carregando…</p></main>}>
      <Conteudo />
    </Suspense>
  );
}
