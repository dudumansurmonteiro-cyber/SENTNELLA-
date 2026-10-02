'use client';

// Ficha do devedor: títulos com a trilha completa de contatos, acordos,
// documentos jurídicos, exceções e o rating explicado critério a critério
// (reconstruído de ratingBase — o rating é interno e nunca vai ao devedor).

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { L, useRaiz } from '../../../lib/raiz';
import {
  calcularRating, dataBr, expandirTrilha, moeda, moedaCurta,
} from '@sentinella/dados';
import type { Devedor, Titulo } from '@sentinella/dados';
import { Carregando, useDados } from '../../../lib/contexto';
import { ChipTitulo, Secao, Selo } from '../../../lib/ui';

function ratingDe(d: Devedor) {
  const [titulos, dias, horas, feitas, cumpridas, pctAtraso, exc] = d.ratingBase;
  return calcularRating({
    titulosTotais: titulos ?? 0,
    diasMediosAtrasoPonderado: dias ?? 0,
    horasMediasResposta: horas == null || horas < 0 ? null : horas,
    promessasFeitas: feitas ?? 0,
    promessasCumpridas: cumpridas ?? 0,
    pctTitulosComAtraso: pctAtraso ?? 0,
    excecoesPorTitulo: exc ?? 0,
  });
}

function LinhaTitulo({ t, hoje }: { t: Titulo; hoje: string }) {
  const [aberta, setAberta] = useState(false);
  const passos = hoje ? expandirTrilha(t.trilha, hoje) : [];
  return (
    <>
      <tr>
        <td>
          <button
            type="button"
            onClick={() => setAberta(!aberta)}
            aria-expanded={aberta}
            className="cursor-pointer font-medium"
            style={{ color: 'var(--link)' }}
          >
            {aberta ? '▾' : '▸'} {t.numero}
          </button>
        </td>
        <td className="num">{moeda(t.valorOriginal)}</td>
        <td className="num">{moeda(t.valorAtualizado)}</td>
        <td className="num">{dataBr(t.entradaCarteira)}</td>
        <td className="num">{t.atrasoOriginal} d</td>
        <td><ChipTitulo estado={t.estado} /></td>
        <td>{t.etapaAtual}</td>
      </tr>
      {aberta && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--panel-row)' }}>
            <div className="px-2 py-2">
              <b className="text-[12.5px]">Trilha de contatos (régua da entrada)</b>
              {passos.length === 0 && <p className="suave text-[13px]">Sem contatos registrados.</p>}
              <ul className="mt-1 space-y-1 text-[13px]">
                {passos.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <b className="w-12">{p.etapa}</b>
                    <span className="suave w-16">{dataBr(p.data)}</span>
                    <span className="w-20">{p.canal}</span>
                    <span className={p.codigo === 'blq' ? 'sinal-txt' : undefined}>{p.resultado}</span>
                  </li>
                ))}
              </ul>
              {t.comunicacaoPreviaEm && (
                <p className="suave mt-2 text-[12.5px]">
                  Comunicação prévia de negativação enviada em {dataBr(t.comunicacaoPreviaEm)} com
                  prova de envio (CDC, art. 43, §2º) — negativação só após o prazo.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Conteudo() {
  const { dados, hoje } = useDados();
  const params = useSearchParams();
  const raiz = useRaiz();
  const id = params.get('d');
  if (!dados) return <Carregando />;
  const dev = dados.devedores.find((x) => x.id === id);
  if (!dev) {
    return (
      <p className="py-8">
        Devedor não encontrado. <L para="devedores/">Voltar aos devedores</L>
      </p>
    );
  }

  const carteira = dados.carteiras.find((c) => c.id === dev.carteiraId)!;
  const credor = dados.credores.find((c) => c.id === dev.credorId)!;
  const titulos = dados.titulos
    .filter((t) => t.devedorId === dev.id)
    .sort((a, b) => b.entradaCarteira.localeCompare(a.entradaCarteira));
  const acordos = dados.acordos.filter((a) => a.devedorId === dev.id);
  const documentos = dados.documentos
    .filter((d) => d.devedorId === dev.id)
    .sort((a, b) => b.geradoEm.localeCompare(a.geradoEm));
  const excecoes = dados.excecoes.filter((e) => e.devedorId === dev.id);
  const rating = ratingDe(dev);
  const urlPortal =
    dev.token && raiz
      ? `${raiz.slice(0, raiz.lastIndexOf('painel/'))}portal/d/?t=${dev.token}`
      : null;

  return (
    <>
      <p className="text-[13px]"><L para="devedores/">← Devedores</L></p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="fonte-titulo text-[22px] font-semibold">{dev.nome}</h1>
        <Selo letra={dev.rating} titulo={`Rating ${dev.rating} (interno)`} />
        {dev.canaisBloqueados.length > 0 && (
          <span className="chip chip-sinal">
            <span className="glifo" aria-hidden="true">⊘</span>
            pediu não contato: {dev.canaisBloqueados.join(', ')}
          </span>
        )}
        {dev.vulneravel && (
          <span className="chip chip-sinal">
            <span className="glifo" aria-hidden="true">!</span>
            vulnerabilidade declarada (Lei 14.181)
          </span>
        )}
      </div>
      <p className="suave mt-1 text-[13.5px]">
        {dev.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'} · {dev.doc} · {dev.cidade} ·
        carteira “{carteira.nome}” de {credor.nome}
      </p>
      <p className="mt-1 text-[13.5px]">
        <b>{dev.titulosAbertos}</b> título(s) em aberto somando <b>{moedaCurta(dev.valorAberto)}</b>
        {dev.titulosAbertos > 0 && <> · há {dev.diasDesdeEntrada} dias na carteira</>}
        {urlPortal && (
          <>
            {' '}· <a href={urlPortal}>espaço do devedor (como ele vê) ↗</a>
          </>
        )}
      </p>

      <Secao titulo={`Rating ${rating.letra} · ${rating.total} pontos — interno, nunca mostrado ao devedor`}>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Critério</th>
                <th className="num">Peso</th>
                <th>Leitura no período</th>
                <th className="num">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {rating.detalhe.map((c) => (
                <tr key={c.rotulo}>
                  <td>{c.rotulo}</td>
                  <td className="num">{c.peso}%</td>
                  <td>{c.valor}</td>
                  <td className="num">{c.pontos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo={`Títulos (${titulos.length})`}>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Número</th>
                <th className="num">Original</th>
                <th className="num">Atualizado</th>
                <th className="num">Entrada</th>
                <th className="num">Atraso na entrada</th>
                <th>Situação</th>
                <th>Etapa</th>
              </tr>
            </thead>
            <tbody>
              {titulos.map((t) => <LinhaTitulo key={t.id} t={t} hoje={hoje} />)}
            </tbody>
          </table>
        </div>
        {carteira.multaPct == null && (
          <p className="nota-demo mt-3">
            Carteira sem encargos cadastrados: valores cobrados sem multa nem juros — e as
            mensagens não os mencionam.
          </p>
        )}
      </Secao>

      {acordos.length > 0 && (
        <Secao titulo={`Acordos (${acordos.length})`}>
          <ul className="space-y-2 text-[13.5px]">
            {acordos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3">
                <b>{moeda(a.valorTotal)}</b>
                <span className="suave">
                  em {a.parcelas}x · custo total com {moedaCurta(a.jurosEmbutidos)} de encargos,
                  mostrado antes do aceite
                </span>
                <span>{a.parcelasPagas}/{a.parcelas} parcelas pagas</span>
                <span className="chip">{a.status}</span>
                <span className="suave">origem: {a.origem} · {dataBr(a.criadoEm)}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {documentos.length > 0 && (
        <Secao titulo={`Documentos jurídicos (${documentos.length})`}>
          <ul className="space-y-1.5 text-[13.5px]">
            {documentos.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-baseline gap-x-3">
                <b>{doc.tipo}{doc.subtipo ? ` (${doc.subtipo})` : ''}</b>
                <span className={`chip ${doc.status === 'a assinar' || doc.status === 'aguarda autorização' ? 'chip-sinal' : ''}`}>
                  {doc.status}
                </span>
                <span className="suave">{dataBr(doc.geradoEm)} · {moedaCurta(doc.valor)}</span>
                {doc.assinadoPor && <span className="suave">assinado por {doc.assinadoPor}</span>}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {excecoes.length > 0 && (
        <Secao titulo={`Exceções (${excecoes.length})`}>
          <ul className="space-y-1.5 text-[13.5px]">
            {excecoes.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3">
                <span>{e.motivo}</span>
                <span className="chip">{e.estado}</span>
                {e.resolucao && <span className="suave">{e.resolucao}</span>}
              </li>
            ))}
          </ul>
        </Secao>
      )}
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
