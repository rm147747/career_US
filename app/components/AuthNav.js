'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '../lib/supabase';

const hasSupabaseConfig =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AuthNav() {
  const [user, setUser] = useState(null);
  const [supabase, setSupabase] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBalance(d?.balance ?? null))
      .catch(() => setBalance(null));
  }, [user]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;

    let client;
    try {
      client = createBrowserSupabaseClient();
    } catch {
      return;
    }
    setSupabase(client);

    client.auth.getUser()
      .then(({ data }) => setUser(data?.user ?? null))
      .catch(() => setUser(null));

    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <a
          className="chip"
          href="/billing"
          style={{ textDecoration: 'none' }}
          title="Comprar créditos"
        >
          {balance !== null ? `${balance} créditos` : 'créditos'}
        </a>
        <span className="chip hide-mobile" title={user.email}>{user.email}</span>
        <button className="btn-ghost" style={{ fontSize: 14 }} onClick={handleSignOut}>
          Sair
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <a className="btn-ghost" style={{ fontSize: 14, textDecoration: 'none' }} href="/auth/signin">
        Entrar
      </a>
      <a className="btn-primary" style={{ fontSize: 14, textDecoration: 'none' }} href="/auth/signup">
        Criar conta
      </a>
    </div>
  );
}
