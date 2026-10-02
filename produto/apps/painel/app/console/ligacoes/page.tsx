'use client';

// Agenda de ligações do dia (escritório ativo): janela permitida, gravação
// obrigatória e as reprogramadas pela conformidade.

import { L } from '../../../lib/raiz';
import { Carregando, useDados } from '../../../lib/contexto';
import { ChipAcao, Secao } from '../../../lib/ui';
import { moedaCurta } from '@sentinella/dados';

export default function Ligacoes() {
  const { dados, hoje } = useDados();
  if (!dados) return <Carregando />;

  const doDia = dados.filaHoje
    .filter((a) => a.canal === 'ligação' && a.data === hoje)
    .sort((a, b) => a.estado.localeCompare(b.estado));
  const reprogramadas = doDia.filter((a) => a.estado === 'bloqueada');
  const nomeDev = (id: string) => dados.devedores.find((d) => d.id === id)?.nome ?? id;
  const valorDev = (id: string) => dados.devedores.find((d) => d.id === id)?.valorAberto ?? 0;

  return (
    <>
      <p className="text-[13px]"><L para="console/">← Fila de exceções</L></p>
      <h1 className="fonte-titulo mt-2 text-[22px] font-semibold">Ligações do dia</h1>
      <p className="suave mt-1 text-[13.5px]">
        Dias úteis e sábados, dentro do horário permitido · no máximo uma ligação por devedor por
        dia · todas gravadas ({dados.escritorio.retencaoGravacoesAnos} anos de retenção para o
        escritório).
      </p>

      <Secao titulo={`Agenda (${doDia.length})`}>
        <div className="overflow-x-auto">
          <table className="tab">
            <thead>
              <tr>
                <th>Etapa</th><th>Devedor</th><th className="num">Em aberto</th>
                <th>Situação</th><th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {doDia.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.etapa}</td>
                  <td><L para={`devedores/ficha/?d=${a.devedorId}`}>{nomeDev(a.devedorId)}</L></td>
                  <td className="num">{moedaCurta(valorDev(a.devedorId))}</td>
                  <td><ChipAcao estado={a.estado} /></td>
                  <td className="suave text-[12.5px]">
                    {a.motivoBloqueio ?? a.resultado ?? a.descricao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reprogramadas.length > 0 && (
          <p className="nota-demo mt-3">
            {reprogramadas.length} ligação(ões) fora da janela permitida foram bloqueadas pela
            conformidade e reprogramadas — a trava age antes, não depois.
          </p>
        )}
      </Secao>
    </>
  );
}
