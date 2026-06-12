'use client';

import { useEffect, useState } from 'react';

export default function BillingSuccessPage() {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    // O webhook do Stripe credita de forma assíncrona — pequena tolerância antes de ler o saldo.
    const t = setTimeout(() => {
      fetch('/api/credits')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setBalance(d?.balance ?? null))
        .catch(() => setBalance(null));
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />

      <div className="glass" style={{ position: 'relative', zIndex: 10, borderRadius: 16, padding: 48, maxWidth: 440, textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>
          Pagamento confirmado
        </div>
        <h1 className="serif" style={{ fontSize: 32, margin: '16px 0 0' }}>Créditos a caminho.</h1>
        <p style={{ marginTop: 16, fontSize: 15, color: 'var(--text-dim)' }}>
          Seus créditos são adicionados assim que o Stripe confirma o pagamento — normalmente em segundos.
          {balance !== null && (
            <> Saldo atual: <strong style={{ color: 'var(--text)' }}>{balance} créditos</strong>.</>
          )}
        </p>
        <a href="/" className="btn-primary" style={{ display: 'inline-block', marginTop: 32, padding: '12px 24px', textDecoration: 'none' }}>
          Voltar ao conselho
        </a>
      </div>
    </div>
  );
}
