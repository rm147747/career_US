# Mentoria Multiagente para Transição Médica aos EUA (Next.js)

Você estava certa: este projeto agora está em **Next.js**, pronto para deploy na **Vercel**.

## O que a plataforma faz

- Recebe sua pergunta.
- Executa uma rodada de 6 agentes em ordem fixa, sem interrupção:
  1. Claude Sonnet
  2. Gemini
  3. Perplexity
  4. Grok
  5. DeepSeek
  6. GPT
- Após o GPT, a palavra volta para você para continuar ou encerrar.

## Estrutura do projeto

- `package.json`
- `next.config.js`
- `app/page.js` (UI)
- `app/api/mentoring/route.js` (API que faz as 6 chamadas sequenciais)

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Configuração no app

Na própria interface você informa:

- API key
- Base URL (padrão OpenRouter: `https://openrouter.ai/api/v1`)
- Modelos dos 6 agentes (editáveis)
- Temperatura e máximo de tokens

## Deploy na Vercel

1. Suba este repositório no GitHub.
2. Na Vercel, importe o repositório.
3. Deploy padrão de Next.js.

Não há orquestrador: apenas ordem fixa de respostas, como solicitado.
