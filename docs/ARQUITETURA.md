# Life Board — Arquitetura de Deliberação e Sistema de Prompts

Documento de referência. Atualizado em 2026-06-11.

## Visão geral

```
Usuário escolhe conselho → configura pergunta → escolhe MODO
    │
    ├── SEQUENCIAL (padrão, livre)
    │   Claude → Perplexity → Gemini → DeepSeek → Grok → GPT
    │   cada um LÊ os anteriores e constrói em cima
    │   GPT preside e sintetiza ao final
    │   7 chamadas em série · ~2-4 min · streaming por conselheiro
    │
    └── PARALELO (novo — arquitetura modificada)
        Claude ┐
        Perplexity ┤
        Gemini     ├── Promise.all — NINGUÉM vê ninguém
        DeepSeek   ┤
        Grok ┘
        → GPT presidente recebe as 5 perspectivas independentes e sintetiza
        6 chamadas simultâneas + 1 síntese · ~1-2 min
```

**Por que dois modos:** o sequencial produz deliberação cumulativa (cada voz
reage às anteriores — bom para refinar uma direção). O paralelo elimina o viés
de ancoragem: convergências que surgem sem influência mútua são sinal forte, e
divergências são genuínas, não reativas. Bom para decisões abertas.

## Endpoints

| Endpoint | Modo | Gate de auth/créditos |
|---|---|---|
| `POST /api/council/deliberate` | Sequencial (1 chamada por conselheiro) | Só quando Supabase configurado; senão modo livre |
| `POST /api/council/parallel` | Paralelo (1 chamada, SSE com todos) | Idem — modo livre sem Supabase |
| `POST /api/council/targeted` | Pergunta dirigida (passo 8) | Livre |
| `POST /api/council/debate` | Debate 1-on-1 | Livre |

**Política de gate (fail-open):** com `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` presentes, os
endpoints de deliberação exigem login e debitam créditos (1/chamada no
sequencial; 7 de uma vez no paralelo). Sem as env vars, rodam em modo livre —
o produto nunca quebra por configuração ausente. O mesmo vale para o
`middleware.js`.

## Sistema de prompts (`app/lib/openrouter.js`)

Todos os prompts são construídos por função, parametrizados pelo conselho
selecionado (`app/config/council.js` — 19 conselhos, cada um com personas
`role`/`brief` por LLM, `boardPrinciples` e `knowledgeBase` opcionais).

| Builder | Usado em | Característica |
|---|---|---|
| `buildCounselorSystemPrompt` | deliberate, parallel | **`parallelMode`**: sequencial instrui "leia os anteriores e construa em cima"; paralelo instrui "resposta independente e completa, tome posição clara" |
| `buildPresidentSystemPrompt` | deliberate, parallel | **`parallelMode`**: informa o presidente se as perspectivas foram cumulativas ou independentes (muda o peso de convergência/divergência) |
| `buildTargetedSystemPrompt` | targeted | Resposta direta 150-300 palavras à pergunta dirigida |
| `buildPromptAdvisorSystemPrompt` (+presidente) | conselho `prompt-advisor` | Cada IA fala em 1ª pessoa sobre prompts ideais para si |
| `buildPersonaBoardSystemPrompt` (+presidente) | conselho `personal-board` | Personas humanas em vez de identidades de LLM |

Invariantes de todos os prompts:
- O board **mapeia, nunca decide** — a decisão é do usuário.
- Síntese do presidente em 4 blocos fixos: convergência / divergência /
  três caminhos com trade-offs / perguntas abertas.
- PT-BR, sem headers `#`, 200-350 palavras por conselheiro.
- Casos clínicos/jurídicos: sempre recomendar validação profissional real.

## Camada comercial (PR #13 — ativa quando o Supabase entrar)

- **Auth:** Supabase SSR; `/auth/signin`, `/auth/signup`, `/auth/callback`;
  middleware protege `/session`, `/dashboard`, `/history` (páginas futuras).
- **Créditos:** ledger append-only `credits_ledger` + view `user_credits`;
  10 créditos grátis no signup (trigger da migration `001_commercial.sql`).
- **Billing:** Stripe Checkout — pacotes 10/50/200 créditos em `/billing`;
  webhook `/api/billing/webhook` credita via service role.
- **UI:** `AuthNav` na home (login/saldo/sair), toggle Sequencial/Paralelo
  no setup do board.

### Checklist para ativar (pendente — exige credenciais do dono)

1. Criar projeto Supabase e rodar `supabase/migrations/001_commercial.sql`
2. Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`
3. Stripe: criar 3 produtos/preços → `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_10/50/200`
4. `NEXT_PUBLIC_APP_URL=https://career-us.vercel.app`
5. Supabase Auth → redirect URL `https://career-us.vercel.app/auth/callback`
