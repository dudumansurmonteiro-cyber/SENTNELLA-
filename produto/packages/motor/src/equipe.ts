// Mesa Sentinella (§5): nos planos Avançado e Max, analistas atendem em nome
// do escritório — um analista cobre vários escritórios, e o console troca de
// escritório ativo sem misturar dados. No Básico, a mesa é do próprio
// escritório. Nomes fictícios enquanto a operação não abre.

export interface AnalistaConfig {
  id: string;
  nome: string;
  turno: '8h–15h' | '15h–22h';
  escritorioIds: string[];
}

export const ANALISTAS: AnalistaConfig[] = [
  { id: 'an1', nome: 'Marina Duarte', turno: '8h–15h', escritorioIds: ['e1'] },
  { id: 'an2', nome: 'Rafael Nogueira', turno: '15h–22h', escritorioIds: ['e1'] },
];

export const slaDoPlano = (plano: string): number | null =>
  plano === 'Max' ? 5 : plano === 'Avançado' ? 15 : null;
