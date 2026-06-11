# Life Board — Strategic AI Council

Conselho estratégico de 6 IAs deliberando em sequência. Você decide.

---

## O que é

Uma plataforma de tomada de decisão estratégica onde 6 LLMs diferentes (Claude, Perplexity, Gemini, DeepSeek, Grok, GPT) deliberam **em sequência** sobre sua pergunta. Cada conselheiro lê as respostas dos anteriores e constrói em cima, refutando ou complementando. O GPT, como **Presidente**, sintetiza as 6 visões em um mapa de decisão — sem nunca tomar a decisão por você.

### 13 conselhos pré-configurados
Carreira, Finanças, Pesquisa, Ensino, Casos Clínicos, Casos Jurídicos, Planejamento, Marketing, Avaliação de Resultados, Soluções de IA, Software, Clube de Leitura, Discussão de Artigos.

### Features principais
- **Deliberação sequencial** com streaming em tempo real (SSE)
- **Presidente sintetizador** (GPT) mapeia convergências, divergências e 3 caminhos possíveis
- **Medidor de divergência** (0-100%) calculado sobre as 6 respostas iniciais
- **Perguntas direcionadas** no passo 8: dirija uma pergunta a conselheiros específicos
- **Debate 1-on-1**: modal de chat com qualquer conselheiro individualmente
- **Anexos em todo fluxo**: PDF, DOCX, PPTX, TXT, MD, CSV, PNG, JPG — texto extraído automaticamente e injetado no prompt
- **Citações** automáticas (via Perplexity Sonar com busca web nativa)
- **Personas editáveis** por tópico (templates, mas você pode ajustar cada conselheiro)

---

## Anexos

Suporte a 9 formatos, com processamento automático:

| Formato | Onde processa | Lib |
|---|---|---|
| PDF | Backend (Node) | `pdf-parse` |
| DOCX | Backend (Node) | `mammoth` |
| PPTX | Backend (Node) | `jszip` + parser XML custom |
| PNG / JPG / WEBP / GIF | Backend (Node) | Claude Vision via OpenRouter (OCR + descrição) |
| TXT / MD / CSV / TSV / JSON | Browser | FileReader nativo |

Limites:
- **20 MB por arquivo**
- **5 arquivos por ação** (pergunta inicial, passo 8, cada mensagem do debate)
- Texto extraído é truncado em 120k caracteres (~30k tokens)

Anexos funcionam em 3 pontos:
1. **Pergunta inicial** (tela de setup) — anexos vão no prompt do board inteiro
2. **Passo 8** (follow-up) — anexos vão pros conselheiros direcionados
3. **Modal de debate 1-on-1** — anexos ficam apenas nessa conversa individual

## Stack

- **Next.js 14** (App Router)
- **Vercel** (deploy)
- **OpenRouter** (única API que roteia pros 6 LLMs)
- **Edge runtime** (API routes com streaming SSE)

Zero deps extras. Só React + Next.

---

## Modelos usados

| Conselheiro | Modelo (OpenRouter slug) | Função |
|---|---|---|
| Claude | `anthropic/claude-opus-4.5` | Primeira voz · análise profunda |
| Perplexity | `perplexity/sonar-reasoning-pro` | Dados atualizados · fontes |
| Gemini | `google/gemini-2.5-pro` | Contraponto · leitura multimodal |
| DeepSeek | `deepseek/deepseek-chat` | Quantificação · raciocínio |
| Grok | `x-ai/grok-4` | Advogado do diabo · provocação |
| **GPT** | `openai/gpt-5` | **Presidente · síntese** |

Para trocar modelos, edite `app/config/council.js`.

---

## Setup

### 1. Variável de ambiente (obrigatória)

Na Vercel → **Settings → Environment Variables**, adicione:

```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxx
```

Pegue sua chave em https://openrouter.ai/keys. Deixe a chave **apenas no servidor** — ela nunca é exposta ao browser.

### 2. Rodar localmente

```bash
npm install
cp .env.example .env.local
# edite .env.local e cole sua OPENROUTER_API_KEY
npm run dev
```

Abra http://localhost:3000.

### 3. Deploy na Vercel

```bash
git add .
git commit -m "Life Board v3"
git push
```

A Vercel faz o deploy automaticamente. **Lembre-se** de configurar a `OPENROUTER_API_KEY` no painel antes do primeiro deploy.

---

## Estrutura do projeto

```
app/
├── layout.js                    # raiz Next.js + fontes
├── globals.css                  # estilos globais (dark, accent ciano)
├── page.js                      # SPA inteira (3 telas + modal)
├── config/
│   └── council.js               # 6 LLMs + 13 conselhos (personas)
├── lib/
│   ├── openrouter.js            # cliente OpenRouter (server) + prompts
│   ├── sse-client.js            # parser SSE (client)
│   └── utils.js                 # markdown + cálculo de divergência
├── components/
│   └── Icons.js                 # SVG inline dos ícones
└── api/council/
    ├── deliberate/route.js      # 1 conselheiro por chamada (6x + president)
    ├── targeted/route.js        # pergunta direcionada (passo 8)
    └── debate/route.js          # chat 1-on-1 (modal)
```

---

## Fluxo técnico

1. **Home** (`screen=home`) — usuário escolhe um dos 13 conselhos
2. **Setup** (`screen=setup`) — usuário edita personas e digita pergunta inicial
3. **Sessão** (`screen=session`) — frontend chama `/api/council/deliberate` **7 vezes em sequência**, uma para cada conselheiro + presidente. Cada chamada recebe as respostas anteriores como contexto.
4. **Passo 8** — após o Presidente, usuário pode:
   - Fazer pergunta direcionada → `/api/council/targeted` (só conselheiros marcados respondem)
   - Abrir debate 1-on-1 com qualquer conselheiro → `/api/council/debate` (modal de chat)
   - Encerrar e decidir

Todas as chamadas usam **streaming SSE**, então o texto aparece em tempo real.

---

## Customização

### Adicionar novo conselho
Abra `app/config/council.js` e adicione um novo objeto ao array `COUNCILS`:

```js
{
  id: 'meu-conselho',
  icon: 'i-plan',
  title: 'Meu Conselho',
  subtitle: '...',
  tagline: '...',
  personas: {
    claude: { role: '...', brief: '...' },
    perplexity: { role: '...', brief: '...' },
    // ... 6 no total
    gpt: { role: 'Presidente', brief: 'Sintetiza...' },
  },
  userQuestion: 'Placeholder da pergunta...',
}
```

### Trocar um modelo
Edite o campo `model` do LLM desejado em `app/config/council.js`. Use qualquer slug da lista em https://openrouter.ai/models.

### Ajustar tom do Presidente
Edite `buildPresidentSystemPrompt` em `app/lib/openrouter.js`. O prompt atual estrutura a síntese em 4 blocos (convergências, divergências, 3 caminhos, perguntas abertas).

---

## Custos estimados (OpenRouter)

Uma sessão completa (7 chamadas, ~1500 tokens in + ~800 tokens out por chamada):
- **Top-tier** (Opus 4.5 + GPT-5): ~$0.50–$1.50 por sessão
- **Equilibrado** (Sonnet + GPT-4o): ~$0.10–$0.30 por sessão

---

## Posicionamento

A tese do Life Board é que **deliberação sequencial produz melhores decisões que comparação paralela**. Ferramentas como Poe, MultipleChat e OpenRouter Chatroom já fazem "pergunta → 6 respostas paralelas". O Life Board é diferente: cada conselheiro **lê os anteriores e constrói em cima**, como uma mesa-redonda de verdade. O Presidente não decide — mapeia. Você decide.

---

**Life Board v3 · 2026**
