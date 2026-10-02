'use client';

// Home da demonstração dos portais: na vida real ninguém chega aqui — o
// devedor recebe um link protegido no nome do escritório, e o credor recebe
// o acesso do seu portal. Aqui oferecemos os acessos de exemplo do seed.

import { L, raizApp } from '../lib/raiz';
import { useEffect, useState } from 'react';

interface Exemplos {
  hoje: string;
  tokensDevedor: { token: string; devedor: string; escritorio: string }[];
  tokensCredor: { token: string; credor: string; escritorio: string }[];
}

export default function Home() {
  const [exemplos, setExemplos] = useState<Exemplos | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    fetch(`${raizApp()}dados/exemplos.json`).then((r) => r.json()).then(setExemplos);
  }, []);

  return (
    <main className="container-m pt-10 pb-16">
      <p className="fonte-titulo flex items-center gap-2 text-lg font-semibold">
        <svg width="15" height="20" viewBox="24 0 152 200" aria-hidden="true">
          <path fill="var(--primary)" d="M46 10H154Q166 10 166 22V98Q166 144 100 190Q34 144 34 98V22Q34 10 46 10Z" />
          <path fill="var(--bg)" d="M61 92Q100 59 139 92Q100 125 61 92Z" />
          <circle fill="var(--primary)" cx="100" cy="92" r="14" />
        </svg>
        Portais — demonstração
      </p>
      <h1 className="fonte-titulo mt-3 text-[24px] font-semibold leading-tight">
        O espaço do devedor e o portal do credor, com a marca de cada escritório.
      </h1>
      <p className="suave mt-2">
        Na operação real, o devedor recebe um link protegido por WhatsApp ou e-mail, em nome do
        escritório que cuida do débito — sem senha para decorar. O credor recebe o acesso do seu
        portal de acompanhamento. Nesta demonstração, todos os dados são fictícios.
      </p>

      <div className="cartao mt-6 p-4">
        <h2 className="fonte-titulo text-[16px] font-semibold">Entrar como devedor</h2>
        <p className="suave mt-1 text-[12.5px]">Cada acesso abre com a marca do escritório responsável.</p>
        {!exemplos && <p className="suave mt-2 text-[13.5px]">Carregando…</p>}
        {exemplos?.tokensDevedor.map((e) => (
          <p key={e.token} className="border-b py-2 text-[14.5px]" style={{ borderColor: 'var(--line-soft)' }}>
            <L para={`d/?t=${e.token}`}>{e.devedor}</L>
            <span className="suave block text-[12.5px]">cobrança em nome de {e.escritorio}</span>
          </p>
        ))}
      </div>

      <div className="cartao mt-4 p-4">
        <h2 className="fonte-titulo text-[16px] font-semibold">Entrar como credor</h2>
        <p className="suave mt-1 text-[12.5px]">
          Acompanhamento da carteira entregue ao escritório, com relatório mensal.
        </p>
        {exemplos?.tokensCredor.map((e) => (
          <p key={e.token} className="border-b py-2 text-[14.5px]" style={{ borderColor: 'var(--line-soft)' }}>
            <L para={`c/?t=${e.token}`}>{e.credor.replace(' (fictícia)', '').replace(' (fictício)', '')}</L>
            <span className="suave block text-[12.5px]">atendido por {e.escritorio}</span>
          </p>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (token.trim()) window.location.href = `${raizApp()}d/?t=${token.trim()}`;
        }}
      >
        <input
          className="campo"
          placeholder="Ou cole um código de acesso"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          aria-label="Código de acesso do link recebido"
        />
        <button className="botao" type="submit">entrar</button>
      </form>

      <p className="nota mt-5">
        O espaço do devedor mostra apenas os débitos daquela pessoa com aquele credor — nunca
        dados de terceiros, nunca classificações internas. E sempre dá para falar com uma pessoa.
      </p>
    </main>
  );
}
