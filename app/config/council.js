// app/config/council.js
// Configuração central do Life Board — importada pela API e pela UI.
// Models: OpenRouter slugs (https://openrouter.ai/models) — Abril 2026

export const LLMS = [
  {
    id: 'claude',
    name: 'Claude',
    model: 'anthropic/claude-opus-4.5',
    fallbackModel: 'anthropic/claude-sonnet-4.5',
    color: '#D97B4A',
    order: 1,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    model: 'perplexity/sonar-pro',
    fallbackModel: 'perplexity/sonar',
    color: '#20B8B0',
    order: 2,
    supportsCitations: true,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    // Gemini 3 Flash Preview: thinking model, mas "flash" = reasoning mais barato/rápido.
    // O "pro-preview" consome reasoning tokens demais e corta respostas.
    model: 'google/gemini-3-flash-preview',
    fallbackModel: 'google/gemini-2.5-pro',
    color: '#8AB4F8',
    order: 3,
    // Flag: modelos thinking do Google precisam de reasoning.effort explícito
    reasoningEffort: 'low',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek/deepseek-v3.2-exp',
    fallbackModel: 'deepseek/deepseek-chat',
    color: '#6FA8FF',
    order: 4,
  },
  {
    id: 'grok',
    name: 'Grok',
    model: 'x-ai/grok-4.20',
    fallbackModel: 'x-ai/grok-4',
    color: '#B8B8B8',
    order: 5,
  },
  {
    id: 'gpt',
    name: 'GPT',
    model: 'openai/gpt-5.4',
    fallbackModel: 'openai/gpt-4o',
    color: '#19C37D',
    order: 6,
    isPresident: true,
  },
];

// 13 conselhos com personas pré-configuradas
export const COUNCILS = [
  {
    id: 'universal',
    icon: 'i-board',
    title: 'Board Universal',
    subtitle: 'Descreva o momento e a dúvida — o board assume de qualquer ângulo',
    tagline: 'adaptativo · 6 lentes · recomendação final',
    decisive: true,
    personas: {
      claude: { role: 'Ética & Experiência Humana', brief: 'Clareza, experiência do usuário, riscos humanos, comunicação e implicações éticas da decisão' },
      perplexity: { role: 'Pesquisa & Evidências', brief: 'Mercado, concorrentes, fatos externos verificáveis e dados atualizados — sempre com fonte' },
      gemini: { role: 'Produto & Ecossistema', brief: 'Integração com ecossistemas, multimodalidade, viabilidade de produto escalável' },
      deepseek: { role: 'Engenharia & Custo', brief: 'Eficiência técnica, custo, arquitetura enxuta e oportunidades de automação' },
      grok: { role: 'Contraponto & Cultura', brief: 'Provocação construtiva, tendências, cultura e a visão não convencional que o consenso ignora' },
      gpt: { role: 'Presidente — Estratégia & Decisão', brief: 'Síntese executiva, estratégia, plano de ação e recomendação final com nível de confiança' },
    },
    userQuestion: 'Descreva o momento e a dúvida: o contexto, a decisão que precisa tomar, as opções na mesa, restrições (tempo, dinheiro, pessoas) e o que você espera obter do board.',
  },
];

export function getCouncil(id) {
  return COUNCILS.find((c) => c.id === id);
}

export function getLLM(id) {
  return LLMS.find((l) => l.id === id);
}
