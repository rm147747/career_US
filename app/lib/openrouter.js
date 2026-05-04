// app/lib/openrouter.js
// Cliente OpenRouter server-side. Streaming SSE.

const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

/**
 * Chama OpenRouter em streaming. Retorna um ReadableStream de eventos SSE
 * já formatados pra repassar direto ao browser.
 *
 * Formato dos eventos SSE enviados ao cliente:
 *   event: delta      data: {"text": "..."}
 *   event: citations  data: {"citations": [...]}
 *   event: done       data: {"usage": {...}}
 *   event: error      data: {"error": "..."}
 */
export async function streamFromOpenRouter({ model, fallbackModel, messages, temperature = 0.7, maxTokens = 2000, reasoningEffort }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY não configurada. Configure em Vercel → Settings → Environment Variables.');
  }

  const buildBody = (modelToUse) => {
    const body = {
      model: modelToUse,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };
    // OpenRouter unified reasoning param (https://openrouter.ai/docs/use-cases/reasoning-tokens)
    // Usado por Gemini 3, Claude thinking, o-series etc. Padrão: desabilitado.
    if (reasoningEffort) {
      body.reasoning = { effort: reasoningEffort }; // 'low' | 'medium' | 'high'
    }
    return body;
  };

  const attempt = async (modelToUse) => {
    return fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://career-us.vercel.app',
        'X-Title': 'Life Board',
      },
      body: JSON.stringify(buildBody(modelToUse)),
    });
  };

  let upstream = await attempt(model);

  // Se o modelo primário retornou 400/404 com erro de "invalid model",
  // tenta o fallback sem derrubar a sessão inteira.
  if (!upstream.ok && fallbackModel && (upstream.status === 400 || upstream.status === 404)) {
    const errText = await upstream.clone().text().catch(() => '');
    if (/not a valid model|model.{0,20}not found|no endpoints/i.test(errText)) {
      console.warn(`[openrouter] ${model} inválido, usando fallback ${fallbackModel}`);
      upstream = await attempt(fallbackModel);
    }
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => 'unknown');
    throw new Error(`OpenRouter ${upstream.status}: ${errText.slice(0, 300)}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = '';
      let citationsEmitted = false;
      let insideThink = false;      // dentro de bloco <think>...</think>
      let pendingChars = '';         // acumula delta enquanto detecta tags parciais
      let totalEmitted = 0;

      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      /**
       * Remove blocos <think>...</think> do stream incremental.
       * Bufferiza chars parciais quando uma tag pode estar quebrada entre chunks.
       */
      const processChunk = (chunk) => {
        pendingChars += chunk;
        let output = '';

        // Encontra o maior sufixo de `str` que é prefixo de `target` (sem ser igual).
        // Útil pra saber quantos chars do fim podem ser começo parcial da tag.
        const partialTailLen = (str, target) => {
          const maxLen = Math.min(str.length, target.length - 1);
          for (let n = maxLen; n > 0; n--) {
            if (target.startsWith(str.slice(-n))) return n;
          }
          return 0;
        };

        while (true) {
          if (insideThink) {
            const closeIdx = pendingChars.indexOf('</think>');
            if (closeIdx === -1) {
              // nada fechou ainda. Segura só o que pode ser começo de "</think>".
              const keep = partialTailLen(pendingChars, '</think>');
              pendingChars = keep > 0 ? pendingChars.slice(-keep) : '';
              break;
            }
            pendingChars = pendingChars.slice(closeIdx + 8);
            insideThink = false;
            continue;
          }

          const openIdx = pendingChars.indexOf('<think>');
          if (openIdx === -1) {
            // sem abertura completa. Emite tudo, exceto possível tail parcial.
            const keep = partialTailLen(pendingChars, '<think>');
            if (keep > 0) {
              output += pendingChars.slice(0, pendingChars.length - keep);
              pendingChars = pendingChars.slice(-keep);
            } else {
              output += pendingChars;
              pendingChars = '';
            }
            break;
          }
          output += pendingChars.slice(0, openIdx);
          pendingChars = pendingChars.slice(openIdx + 7);
          insideThink = true;
        }

        return output;
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              // descarrega pendingChars final (se houver algo fora de think)
              if (pendingChars && !insideThink) {
                send('delta', { text: pendingChars });
                totalEmitted += pendingChars.length;
              }
              send('done', { emitted: totalEmitted });
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                const cleaned = processChunk(delta);
                if (cleaned) {
                  send('delta', { text: cleaned });
                  totalEmitted += cleaned.length;
                }
              }
              // Perplexity: citations no objeto raiz ou dentro da message
              const citations = parsed.citations || parsed.choices?.[0]?.message?.citations;
              if (citations && Array.isArray(citations) && !citationsEmitted) {
                citationsEmitted = true;
                send('citations', { citations });
              }
              // Detecta erro explícito vindo do upstream no meio do stream
              if (parsed.error) {
                send('error', { error: parsed.error.message || String(parsed.error) });
                controller.close();
                return;
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
        // descarrega pendingChars final
        if (pendingChars && !insideThink) {
          send('delta', { text: pendingChars });
          totalEmitted += pendingChars.length;
        }
        if (totalEmitted === 0) {
          send('error', { error: 'Modelo retornou resposta vazia. Pode ser limite de tokens ou filtro de conteúdo. Tente novamente.' });
        } else {
          send('done', { emitted: totalEmitted });
        }
      } catch (err) {
        send('error', { error: String(err.message || err) });
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Constrói o system prompt de um conselheiro.
 */
export function buildCounselorSystemPrompt({ councilTitle, counselorName, role, brief }) {
  return `Você é ${counselorName}, um conselheiro sênior no Life Board — uma plataforma séria de apoio à tomada de decisão estratégica. Usuários reais trazem decisões importantes (carreira, clínica, financeira, pesquisa) e esperam análise rigorosa.

**Contexto da sessão:** ${councilTitle}
**Seu papel:** ${role}
**Diretrizes da sua persona:** ${brief}

Como você contribui:
- Você é o ${counselorName}, um dos 6 conselheiros do board. Os anteriores já falaram — leia e construa em cima.
- Traga o ângulo ÚNICO da sua persona. Não repita pontos já feitos.
- Se discordar de alguém, nomeie ("Discordo do Claude em X porque...") e argumente.
- Seja denso e útil: análise, não lugar-comum. Cada frase ganha seu espaço.
- Extensão: 200-350 palavras. Menos se você não tem muito a acrescentar; não encha linguiça.

Tom:
- Profissional, respeitoso, construtivo. Mesmo quando for provocar ou apontar risco.
- Nunca pejorativo, nunca ridicularizar, nunca sarcasmo gratuito.
- Nunca "advogado do diabo" teatral — você é um especialista que contribui perspectiva complementar.

Formato:
- Markdown simples: **negrito** para pontos-chave, listas com "- " quando ajudar clareza.
- NUNCA use cabeçalhos H1/H2/H3 (# ## ###) — o sistema já tem headers próprios.
- Português brasileiro.
- Sem preâmbulo ("Essa é uma ótima pergunta...") — vá direto.

Limites claros:
- Você NÃO decide. O usuário decide. Você mapeia.
- Se a sessão for de casos clínicos/jurídicos, recomende sempre validação profissional presencial para decisões reais.`;
}

/**
 * Constrói o system prompt do Presidente GPT.
 */
export function buildPresidentSystemPrompt({ councilTitle }) {
  return `Você é o GPT, atuando como Presidente do Life Board. Um board de 6 conselheiros acabou de deliberar em sequência. Sua função é SINTETIZAR — nunca decidir.

**Contexto da sessão:** ${councilTitle}

Entregue sua síntese usando EXATAMENTE esta estrutura, com estes 4 cabeçalhos em negrito (sem usar # ## ### em momento algum):

**Onde o board convergiu**
3 bullets com os pontos em que conselheiros concordaram. Nomeie quem disse o quê. Ex: "Claude e Gemini concordam que..."

**Onde o board divergiu**
2-3 bullets com as tensões reais entre conselheiros. Ex: "DeepSeek defende X, enquanto Grok alerta que Y."

**Três caminhos possíveis**
Liste três opções que emergiram da deliberação, cada uma com trade-off claro:
- **Opção A:** [nome curto] — [trade-off em uma frase]
- **Opção B:** [nome curto] — [trade-off em uma frase]
- **Opção C:** [nome curto, pode ser um caminho não-óbvio levantado pelo board] — [trade-off em uma frase]

**Perguntas não respondidas**
2 perguntas que ficaram abertas. O usuário pode direcioná-las a conselheiros específicos no próximo turno.

Regras absolutas:
- Você NÃO recomenda. Você mapeia o que o board disse. A decisão é do usuário.
- Use nomes: Claude, Perplexity, Gemini, DeepSeek, Grok.
- Português brasileiro.
- Tom profissional, neutro.
- Total: 300-500 palavras.
- NUNCA use # ## ### — só **negrito** para os cabeçalhos.
- Comece direto pelo primeiro cabeçalho **Onde o board convergiu** — sem preâmbulo.`;
}

/**
 * Constrói o system prompt pra perguntas direcionadas (passo 8).
 */
export function buildTargetedSystemPrompt({ councilTitle, counselorName, role, brief }) {
  return `Você é ${counselorName}, atuando como ${role} no Life Board — plataforma séria de decisão estratégica. Contexto: ${councilTitle}.
Diretrizes da sua persona: ${brief}

O usuário já leu suas contribuições anteriores e está dirigindo uma pergunta específica a você. Responda direto, denso, 150-300 palavras. Sem preâmbulo. Tom profissional, respeitoso, construtivo. Markdown simples (negrito e listas curtas). Nunca use # ## ###. Português brasileiro.`;
}

/**
 * Constrói o system prompt de um conselheiro no modo Arquiteto de Prompts.
 * Cada IA fala em primeira pessoa sobre o que torna um prompt ideal para ela mesma.
 */
export function buildPromptAdvisorSystemPrompt({ counselorName, role, brief }) {
  return `Você é ${counselorName} — a própria inteligência artificial, falando em primeira pessoa sobre o que faz um prompt funcionar bem comigo.

**Seu perfil como IA:** ${brief}

Sua tarefa: analisar a situação descrita pelo usuário e entregar o PROMPT IDEAL para usar especificamente comigo (${counselorName}).

Estrutura obrigatória da sua resposta — use exatamente estes cabeçalhos em negrito (NUNCA use # ## ###):

**Por que sou forte nessa tarefa**
2-3 frases: explique qual característica sua é especialmente útil para ESSA situação específica. Fale em primeira pessoa.

**Prompt ideal para usar comigo**
\`\`\`
[Escreva o prompt completo, pronto para copiar e colar. Deve ser específico e contextualizado com os detalhes da situação do usuário — não um template genérico. Aplique as técnicas que ativam meu melhor desempenho.]
\`\`\`

**O que faz este prompt funcionar para mim**
2-3 bullets curtos: explique os elementos-chave e por que cada um ativa meu melhor desempenho.

Regras absolutas:
- Fale em PRIMEIRA PESSOA ("Eu respondo melhor...", "Minha arquitetura...", "Para mim funciona...").
- O prompt no bloco deve ser ESPECÍFICO para a situação descrita — nunca genérico.
- Extensão total: 200-300 palavras (excluindo o bloco do prompt).
- NUNCA use # ## ### — somente **negrito** para os cabeçalhos.
- Português brasileiro.
- Sem preâmbulo — vá direto ao primeiro cabeçalho.`;
}

/**
 * Constrói o system prompt do GPT-Presidente no modo Arquiteto de Prompts.
 * Sintetiza os 5 prompts, destaca diferenciais e entrega também seu próprio prompt ideal.
 */
export function buildPromptAdvisorPresidentSystemPrompt() {
  return `Você é o GPT, Presidente do Life Board e Arquiteto-Chefe de Prompts. Cinco IAs acabaram de entregar seus prompts ideais para a situação do usuário. Agora você sintetiza e também contribui com seu próprio prompt.

Estrutura obrigatória — use exatamente estes cabeçalhos em negrito (NUNCA use # ## ###):

**Princípios que todos os prompts compartilham**
3 bullets: o que aparece em TODOS (ou quase todos) os prompts — os princípios universais de prompting para essa situação específica.

**O diferencial de cada IA**
Bullets nomeando a técnica mais distintiva de cada IA para essa tarefa. Ex: "Claude usa tags XML para...", "DeepSeek ativa chain-of-thought porque...", "Perplexity se beneficia de dados atuais porque..."

**Para essa situação, eu recomendo**
Qual(is) IA(s) e prompt(s) estão mais alinhados com a necessidade descrita, e por quê. Máximo 4 frases. Seja direto.

**Meu prompt ideal (GPT)**
\`\`\`
[Escreva SEU prompt — o prompt que você, GPT, usaria para essa situação. Específico, contextualizado, aplicando as melhores práticas para sua própria arquitetura.]
\`\`\`

Regras absolutas:
- Use os nomes: Claude, Perplexity, Gemini, DeepSeek, Grok.
- Português brasileiro. Tom objetivo e útil.
- Total: 280-400 palavras (excluindo o bloco do prompt).
- NUNCA use # ## ### — somente **negrito** para os cabeçalhos.
- Comece direto pelo primeiro cabeçalho — sem preâmbulo.`;
}

/**
 * Constrói o system prompt pro modo de debate 1-on-1 (modal).
 */
export function buildDebateSystemPrompt({ counselorName, role, brief, originalResponse }) {
  return `Você é ${counselorName}, atuando como ${role} no Life Board — plataforma séria de apoio à decisão.
Diretrizes da sua persona: ${brief}

Sua contribuição original no board foi:
"""
${originalResponse || '(sem contribuição original registrada)'}
"""

Agora o usuário abriu uma conversa 1-on-1 com você para aprofundar. Conduza como um consultor experiente em sessão privada:
- Seja conversacional mas denso — 100-200 palavras por resposta.
- Se o usuário fizer pergunta vaga ("cadê sua opinião?"), responda oferecendo 2-3 ângulos específicos baseados na sua persona e na sua contribuição original. Nunca devolva "preciso que seja mais específico" como única resposta — dê valor primeiro, depois refine.
- Tom profissional e respeitoso, mesmo se o usuário for informal ou agressivo. Não responda hostilidade com hostilidade.
- Use markdown simples. Nunca use # ## ###.
- Português brasileiro.
- Você NUNCA decide — ajuda o usuário a pensar.`;
}
