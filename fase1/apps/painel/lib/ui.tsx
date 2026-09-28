'use client';

// Componentes visuais do painel: KPI, selo de rating, chip de status
// (ícone + texto — cor é reforço, nunca a única informação), barras.

import type { EstadoAcao, EstadoTitulo, Letra } from '@sentinella/dados';

export function Kpi({
  rotulo, valor, detalhe, destaque,
}: {
  rotulo: string; valor: string; detalhe?: string; destaque?: boolean;
}) {
  return (
    <div className="cartao px-4 py-3">
      <div className="suave text-[12.5px]">{rotulo}</div>
      <div
        className="fonte-titulo mt-0.5 text-[26px] font-semibold"
        style={destaque ? { color: 'var(--link)' } : undefined}
      >
        {valor}
      </div>
      {detalhe && <div className="suave text-[12.5px]">{detalhe}</div>}
    </div>
  );
}

export function Selo({ letra, titulo }: { letra: Letra; titulo?: string }) {
  return (
    <span className={`selo selo-${letra.toLowerCase()}`} title={titulo ?? `Rating ${letra}`}>
      {letra}
    </span>
  );
}

const GLIFO_ACAO: Record<EstadoAcao, string> = {
  agendada: '○',
  'em andamento': '◔',
  finalizada: '✓',
  'não atendida': '✕',
  pendente: '◷',
  cancelada: '–',
  bloqueada: '⊘',
};

export function ChipAcao({ estado }: { estado: EstadoAcao }) {
  const sinal = estado === 'bloqueada' || estado === 'não atendida';
  return (
    <span className={`chip ${sinal ? 'chip-sinal' : ''}`}>
      <span className="glifo" aria-hidden="true">{GLIFO_ACAO[estado]}</span>
      {estado}
    </span>
  );
}

const GLIFO_TITULO: Partial<Record<EstadoTitulo, string>> = {
  'a vencer': '○',
  vencido: '!',
  'em negociação': '◔',
  acordo: '≡',
  pago: '✓',
  protestado: '§',
  negativado: '§',
  jurídico: '§',
  contestado: '?',
  cancelado: '–',
  'fora da régua': '⊘',
};

export function ChipTitulo({ estado }: { estado: EstadoTitulo }) {
  const sinal = ['contestado', 'fora da régua', 'em negociação'].includes(estado);
  const ok = estado === 'pago';
  return (
    <span className={`chip ${sinal ? 'chip-sinal' : ''} ${ok ? 'chip-ok' : ''}`}>
      <span className="glifo" aria-hidden="true">{GLIFO_TITULO[estado] ?? '·'}</span>
      {estado}
    </span>
  );
}

export function BarraLinha({
  rotulo, valorTexto, fracao,
}: {
  rotulo: string; valorTexto: string; fracao: number;
}) {
  return (
    <div className="flex items-center gap-3 py-1 text-[13px]">
      <span className="suave w-24 shrink-0">{rotulo}</span>
      <div className="barra flex-1" role="img" aria-label={`${rotulo}: ${valorTexto}`}>
        <i style={{ width: `${Math.max(2, Math.min(100, fracao * 100))}%` }} />
      </div>
      <b className="num w-24 shrink-0 font-medium">{valorTexto}</b>
    </div>
  );
}

export function Colunas({
  dados, alturaPx = 96, formato,
}: {
  dados: { rotulo: string; valor: number }[];
  alturaPx?: number;
  formato: (v: number) => string;
}) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="flex items-end gap-3" style={{ height: alturaPx + 34 }}>
      {dados.map((d) => (
        <div key={d.rotulo} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="suave text-[11px]">{formato(d.valor)}</span>
          <div
            role="img"
            aria-label={`${d.rotulo}: ${formato(d.valor)}`}
            style={{
              height: Math.max(3, (d.valor / max) * alturaPx),
              width: '100%',
              maxWidth: 40,
              background: 'var(--primary)',
              borderRadius: '3px 3px 0 0',
            }}
          />
          <span className="suave text-[11.5px]">{d.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

export function Secao({
  titulo, acao, children,
}: {
  titulo: string; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="cartao mt-4 px-4 py-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="fonte-titulo text-[16.5px] font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
