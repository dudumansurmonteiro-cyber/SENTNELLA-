'use client';

// Home do portal: explica o acesso por link e, na demonstração, oferece os
// três acessos de exemplo do seed.

import { L, raizApp } from '../lib/raiz';
import { useEffect, useState } from 'react';

interface Exemplos {
  hoje: string;
  tokensExemplo: { token: string; lojista: string; industria: string }[];
}

export default function Home() {
  const [exemplos, setExemplos] = useState<Exemplos | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    fetch(`${raizApp()}dados/exemplos.json`).then((r) => r.json()).then(setExemplos);
  }, []);

  return (
    <main className="container-m pt-10">
      <p className="fonte-titulo flex items-center gap-2 text-lg font-semibold">
        <svg width="15" height="20" viewBox="24 0 152 200" aria-hidden="true">
          <path fill="var(--primary)" d="M46 10H154Q166 10 166 22V98Q166 144 100 190Q34 144 34 98V22Q34 10 46 10Z" />
          <path fill="var(--bg)" d="M61 92Q100 59 139 92Q100 125 61 92Z" />
          <circle fill="var(--primary)" cx="100" cy="92" r="14" />
        </svg>
        Portal do lojista
      </p>
      <h1 className="fonte-titulo mt-3 text-[24px] font-semibold leading-tight">
        Veja o que a sua loja deve, pague ou proponha um acordo.
      </h1>
      <p className="suave mt-2">
        O acesso chega por um link protegido no seu WhatsApp ou e-mail, enviado pela indústria —
        sem senha para decorar. Nesta demonstração, todos os dados são fictícios.
      </p>

      <div className="cartao mt-6 p-4">
        <h2 className="fonte-titulo text-[16px] font-semibold">Acessos de exemplo</h2>
        {!exemplos && <p className="suave mt-2 text-[13.5px]">Carregando…</p>}
        {exemplos?.tokensExemplo.map((e) => (
          <p key={e.token} className="border-b py-2 text-[14.5px]" style={{ borderColor: 'var(--line-soft)' }}>
            <L para={`l/?t=${e.token}`}>{e.lojista}</L>
            <span className="suave block text-[12.5px]">
              devendo para {e.industria.replace(' (fictícia)', '')}
            </span>
          </p>
        ))}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (token.trim()) window.location.href = `${raizApp()}l/?t=${token.trim()}`;
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
      </div>

      <p className="nota mt-5">
        O portal mostra apenas os títulos da sua loja com aquela indústria. Nada de dados de
        outros lojistas — e você sempre pode falar com uma pessoa.
      </p>
    </main>
  );
}
