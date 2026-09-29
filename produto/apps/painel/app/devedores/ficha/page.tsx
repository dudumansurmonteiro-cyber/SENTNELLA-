'use client';

// Ficha do lojista (§7.2b): títulos, contatos, promessas, acordos, exceções
// e o rating explicado critério a critério (§6 / critério de aceite 3).

import { L } from '../../../lib/raiz';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { dataBr, moeda, moedaCurta } from '@sentinella/dados';
import { Carregando, useDados } from '../../../lib/contexto';
import { ChipAcao, ChipTitulo, Secao, Selo } from '../../../lib/ui';

function Conteudo() {
  const { dados } = useDados();
  const params = useSearchParams();
  const id = params.get('l');
  if (!dados) return <Carregando />;
  const lojista = dados.lojistas.find((l) => l.id === id);
  if (!lojista) {
    return (
      <p className="py-8">
        Lojista não encontrado. <L para="devedores/">Voltar aos devedores</L>
      </p>
    );
  }

  const titulos = dados.titulos
    .filter((t) => t.lojistaId === lojista.id)
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  const acoes = dados.acoes
    .filter((a) => a.lojistaId === lojista.id)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 14);
  const promessas = dados.promessas.filter((p) => p.lojistaId === lojista.id);
  const acordos = dados.acordos.filter((a) => a.lojistaId === lojista.id);
  const excecoes = dados.excecoes.filter((e) => e.lojistaId === lojista.id);

  return (
    <>
      <p className="text-[13px]"><L para="devedores/">← Devedores</L></p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="fonte-titulo text-[22px] font-semibold">{lojista.nome}</h1>
        <Selo letra={lojista.rating} />
        <span className="suave text-[13px]">
          {lojista.cidade} · CNPJ fictício {lojista.cnpj} · contato: {lojista.contatoNome} ({lojista.contatoPapel})
        </span>
      </div>
      <p className="suave mt-1 text-[13.5px]">
        {lojista.titulosAbertos} títulos abertos · {moedaCurta(lojista.valorAberto)} em aberto ·{' '}
        {moedaCurta(lojista.valorVencido)} vencidos
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo={`Por que o rating é ${lojista.rating} (${lojista.ratingTotal}/100)`}>
          {lojista.ratingNovo && (
            <p className="nota-demo mb-2">
              Lojista com menos de três títulos de histórico entra como C até formar histórico.
            </p>
          )}
          <table className="tab">
            <thead>
              <tr><th>Critério</th><th className="num">Peso</th><th>Medido</th><th className="num">Pontos</th></tr>
            </thead>
            <tbody>
              {lojista.ratingDetalhe.map((c) => (
                <tr key={c.rotulo}>
                  <td className="font-medium">{c.rotulo}</td>
                  <td className="num suave">{c.peso}%</td>
                  <td className="suave">{c.valor}</td>
                  <td className="num">{c.pontos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="suave mt-2 text-[12.5px]">O rating nunca é mostrado ao lojista.</p>
        </Secao>

        <Secao titulo="Histórico de contatos (mais recentes)">
          <table className="tab">
            <thead><tr><th>Data</th><th>Etapa</th><th>Canal</th><th>Situação</th><th>Resultado</th></tr></thead>
            <tbody>
              {acoes.map((a) => (
                <tr key={a.id}>
                  <td className="suave">{dataBr(a.data)}</td>
                  <td>{a.etapa} <span className="suave">({a.quem})</span></td>
                  <td className="suave">{a.canal}</td>
                  <td><ChipAcao estado={a.estado} /></td>
                  <td className="suave">{a.resultado ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      </div>

      <Secao titulo={`Títulos (${titulos.length})`}>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Número</th><th className="num">Valor</th><th>Vencimento</th>
                <th className="num">Dias de atraso</th><th>Situação</th><th>Etapa</th><th>Pago em</th>
              </tr>
            </thead>
            <tbody>
              {titulos.map((t) => (
                <tr key={t.id}>
                  <td className="suave">{t.numero}{t.antecipado && <span className="chip chip-sinal ml-2">antecipada · protesto até D+25</span>}</td>
                  <td className="num font-medium">{moeda(t.valor)}</td>
                  <td>{dataBr(t.vencimento)}</td>
                  <td className="num">{t.diasAtraso || '—'}</td>
                  <td><ChipTitulo estado={t.estado} /></td>
                  <td className="suave">{t.etapaAtual}</td>
                  <td className="suave">{t.pagoEm ? dataBr(t.pagoEm) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-3">
        <Secao titulo={`Promessas (${promessas.length})`}>
          {promessas.length === 0 && <p className="suave text-[13px]">Nenhuma no período.</p>}
          {promessas.map((p) => (
            <p key={p.id} className="py-0.5 text-[13.5px]">
              para {dataBr(p.para)} —{' '}
              {p.cumprida === null ? <span className="suave">a vencer</span>
                : p.cumprida ? <span style={{ color: 'var(--link)' }}>cumprida ✓</span>
                : <span className="sinal-txt">não cumprida ✕</span>}
            </p>
          ))}
        </Secao>
        <Secao titulo={`Acordos (${acordos.length})`}>
          {acordos.length === 0 && <p className="suave text-[13px]">Nenhum vigente.</p>}
          {acordos.map((a) => (
            <p key={a.id} className="py-0.5 text-[13.5px]">
              {moedaCurta(a.valorTotal)} em {a.parcelas}x · {a.parcelasPagas} pagas ·{' '}
              {a.status === 'atrasado' ? <span className="sinal-txt">{a.status}</span> : a.status}
            </p>
          ))}
        </Secao>
        <Secao titulo={`Exceções (${excecoes.length})`}>
          {excecoes.length === 0 && <p className="suave text-[13px]">Nenhuma registrada.</p>}
          {excecoes.map((e) => (
            <p key={e.id} className="py-0.5 text-[13.5px]">
              {e.motivo} — <span className={e.estado === 'aberta' ? 'sinal-txt' : 'suave'}>{e.estado}</span>
            </p>
          ))}
        </Secao>
      </div>
    </>
  );
}

export default function Ficha() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
