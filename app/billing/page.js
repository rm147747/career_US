'use client';

import { useEffect, useState } from 'react';

const PACKAGES = [
  { id: 'credits_10',  credits: 10,  price: 'US$ 0,99'  },
  { id: 'credits_50',  credits: 50,  price: 'US$ 3,99'  },
  { id: 'credits_200', credits: 200, price: 'US$ 12,99' },
];

export default function BillingPage() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(null); // packageId em checkout
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBalance(d?.balance ?? null))
      .catch(() => setBalance(null));
  }, []);

  const buy = async (packageId) => {
    setLoading(packageId);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = '/auth/signin?next=/billing';
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Falha ao iniciar checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />

      <section style={{ position: 'relative', zIndex: 10, maxWidth: 920, margin: '0 auto', padding: '80px 32px' }}>
        <a href="/" style={{ fontSize: 14, color: 'var(--text-dim)', textDecoration: 'none' }}>← Voltar</a>

        <div className="mono" style={{ marginTop: 32, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>
          Créditos
        </div>
        <h1 className="serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '12px 0 0' }}>
          Cada deliberação consome créditos.
        </h1>
        <p style={{ marginTop: 16, fontSize: 16, color: 'var(--text-dim)', maxWidth: 560 }}>
          Uma deliberação completa (6 conselheiros + síntese do presidente) consome 7 créditos.
          {balance !== null && (
            <> Seu saldo atual: <strong style={{ color: 'var(--text)' }}>{balance} créditos</strong>.</>
          )}
        </p>

        {error && (
          <div className="glass" style={{ marginTop: 24, borderRadius: 12, padding: 16, borderColor: 'rgba(255,92,122,0.3)', background: 'rgba(255,92,122,0.05)', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {PACKAGES.map((pkg) => (
            <div key={pkg.id} className="glass" style={{ borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="serif" style={{ fontSize: 36 }}>{pkg.credits}</div>
              <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)' }}>
                créditos
              </div>
              <div style={{ fontSize: 18, marginTop: 8 }}>{pkg.price}</div>
              <button
                className="btn-primary"
                style={{ marginTop: 16, padding: '12px 16px' }}
                disabled={loading !== null}
                onClick={() => buy(pkg.id)}
              >
                {loading === pkg.id ? 'Redirecionando…' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
