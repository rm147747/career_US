---
name: stripe-webhook-test
description: Simula eventos Stripe localmente para testar o webhook de billing sem precisar lembrar os comandos
disable-model-invocation: true
---

## Pré-requisitos

1. `stripe` CLI instalado: `brew install stripe/stripe-cli/stripe`
2. Autenticado: `stripe login`
3. Dev server rodando: `npm run dev`

## Passo a passo

### Terminal 1 — escuta e redireciona eventos

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Anote o `whsec_...` que aparece — é o `STRIPE_WEBHOOK_SECRET` para dev local.

### Terminal 2 — dispara o evento de compra

```bash
# Pacote de 10 créditos
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.user_id=<UUID_DO_USUARIO> \
  --add checkout_session:metadata.credits=10 \
  --add checkout_session:payment_status=paid

# Pacote de 50 créditos
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.user_id=<UUID_DO_USUARIO> \
  --add checkout_session:metadata.credits=50 \
  --add checkout_session:payment_status=paid
```

### Verificação no banco

```sql
-- Crédito foi creditado?
SELECT * FROM credits_ledger ORDER BY created_at DESC LIMIT 5;

-- Saldo atual do usuário
SELECT * FROM user_credits WHERE user_id = '<UUID_DO_USUARIO>';
```

## Onde encontrar o UUID do usuário

No Supabase Dashboard → Authentication → Users → copie o `id` do usuário de teste.

## Problemas comuns

- **Signature mismatch**: certifique que `STRIPE_WEBHOOK_SECRET` no `.env.local` é o `whsec_` do `stripe listen`, não do dashboard
- **404 no webhook**: confirme que o middleware.js exclui `/api/billing/webhook` do matcher
- **delta não inserido**: verifique `payment_status=paid` no metadata — o webhook só credita quando `paid`
