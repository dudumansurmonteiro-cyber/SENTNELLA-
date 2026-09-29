// Nomes claramente fictícios para lojistas e contatos (§11: nunca CNPJ real).

import { Rnd, escolha, inteiro } from './prng';

const PREFIXOS = [
  'Comercial', 'Bazar', 'Casa', 'Lojas', 'Magazine', 'Depósito', 'Armazém',
  'Ponto', 'Mercado', 'Empório', 'Lar', 'Móveis', 'Decor', 'Center', 'Estilo',
];

const NUCLEOS = [
  'Ipê', 'Aurora', 'Central', 'União', 'Estrela', 'do Vale', 'Horizonte',
  'Primavera', 'Alvorada', 'Bela Vista', 'da Serra', 'Pinheiro', 'Cedro',
  'Jacarandá', 'Colina', 'Norte', 'Girassol', 'Diamante', 'Safira', 'Imperial',
  'Moderno', 'Popular', 'Universo', 'Planalto', 'Andorinha',
];

const SUFIXOS = ['Ltda', 'ME', 'EPP', '& Cia', ''];

const CIDADES = [
  'Arapongas', 'Londrina', 'Maringá', 'Cascavel', 'Apucarana', 'Rolândia',
  'Cambé', 'Toledo', 'Ponta Grossa', 'Sarandi', 'Ibiporã', 'Chapecó',
  'Blumenau', 'Bauru', 'Presidente Prudente',
];

const NOMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gustavo', 'Helena',
  'Igor', 'Júlia', 'Karen', 'Léo', 'Marta', 'Otávio', 'Paula', 'Renato',
  'Sofia', 'Tiago', 'Vera', 'Camila',
];

const SOBRENOMES = [
  'Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Ferraz', 'Gomes',
  'Lima', 'Martins', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ramos',
  'Silveira', 'Teixeira',
];

export function nomeLojista(rnd: Rnd, usados: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const nome = [escolha(rnd, PREFIXOS), escolha(rnd, NUCLEOS), escolha(rnd, SUFIXOS)]
      .filter(Boolean)
      .join(' ');
    if (!usados.has(nome)) {
      usados.add(nome);
      return nome;
    }
  }
  const alt = `Comercial ${inteiro(rnd, 100, 999)} Ltda`;
  usados.add(alt);
  return alt;
}

export const cidade = (rnd: Rnd) => escolha(rnd, CIDADES);
export const nomePessoa = (rnd: Rnd) => `${escolha(rnd, NOMES)} ${escolha(rnd, SOBRENOMES)}`;

// CNPJ visivelmente fictício: começa em 00.000 e não passa por validação.
export function cnpjFicticio(seq: number): string {
  const meio = String(seq).padStart(3, '0');
  const dv = String((seq * 7) % 90 + 10).padStart(2, '0');
  return `00.000.${meio}/0001-${dv}`;
}

export function token(rnd: Rnd): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 10; i++) t += abc[Math.floor(rnd() * abc.length)];
  return t;
}
