// Central humana (§5): um analista para cada cinco clientes, mínimo de dois
// desde o primeiro cliente para cobrir 8h–22h em dois turnos. Na Fase 2 a
// equipe é configuração interna; nomes fictícios enquanto a operação não abre.

export interface AnalistaConfig {
  id: string;
  nome: string;
  turno: '8h–15h' | '15h–22h';
  clienteIds: string[];
}

export const ANALISTAS: AnalistaConfig[] = [
  { id: 'an1', nome: 'Marina Duarte', turno: '8h–15h', clienteIds: ['c1', 'c2', 'c3'] },
  { id: 'an2', nome: 'Rafael Nogueira', turno: '15h–22h', clienteIds: ['c1', 'c2', 'c3'] },
];

export const slaDoPlano = (plano: string): number => (plano === 'Max' ? 5 : 15);
