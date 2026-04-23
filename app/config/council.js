// app/config/council.js
// Configuração central do Life Board — importada pela API e pela UI.
// Models: OpenRouter slugs (https://openrouter.ai/models) — Abril 2026

export const LLMS = [
  {
    id: 'claude',
    name: 'Claude',
    model: 'anthropic/claude-opus-4.5',
    color: '#D97B4A',
    order: 1,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    // sonar-pro (não reasoning) = citações sem o problema de <think> tags
    model: 'perplexity/sonar-pro',
    color: '#20B8B0',
    order: 2,
    supportsCitations: true,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    // Gemini 3 Pro — flagship atual do Google
    model: 'google/gemini-3-pro',
    color: '#8AB4F8',
    order: 3,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    // DeepSeek V3.2 experimental — melhor custo/benefício
    model: 'deepseek/deepseek-v3.2-exp',
    color: '#6FA8FF',
    order: 4,
  },
  {
    id: 'grok',
    name: 'Grok',
    // Grok 4.20 — mais estável que grok-4, prompt calibrado para ser contra-ponto sério
    model: 'x-ai/grok-4.20',
    color: '#B8B8B8',
    order: 5,
  },
  {
    id: 'gpt',
    name: 'GPT',
    // GPT-5.4 (flagship atual, não requer BYOK como gpt-5 puro)
    model: 'openai/gpt-5.4',
    color: '#19C37D',
    order: 6,
    isPresident: true,
  },
];

// 13 conselhos com personas pré-configuradas
export const COUNCILS = [
  {
    id: 'career',
    icon: 'i-career',
    title: 'Conselho de Carreira',
    subtitle: 'Decisões de carreira, transições, ofertas, negociação',
    tagline: 'transição · oferta · negociação',
    personas: {
      claude: { role: 'Mentor Sênior', brief: 'Olhar de longo prazo, valores, fit de propósito' },
      perplexity: { role: 'Analista de Mercado', brief: 'Dados de salário, benchmarks, tendências do setor' },
      gemini: { role: 'Recrutador Executivo', brief: 'Como o mercado lê seu perfil, pontos fortes/fracos' },
      deepseek: { role: 'Estrategista', brief: 'Teoria dos jogos, BATNA, cenários A/B/C' },
      grok: { role: 'Visão Contrária', brief: 'Testa pressupostos, aponta riscos que o otimismo natural esconde, sempre construtivo' },
      gpt: { role: 'Presidente', brief: 'Sintetiza as 6 visões em mapa claro de opções e trade-offs' },
    },
    userQuestion: 'Descreva a situação de carreira: oferta atual, alternativas, timeline, restrições pessoais e o que você espera decidir.',
  },
  {
    id: 'finance',
    icon: 'i-finance',
    title: 'Conselho de Finanças',
    subtitle: 'Investimentos, alocação, decisões patrimoniais',
    tagline: 'alocação · risco · patrimônio',
    personas: {
      claude: { role: 'Consultor Patrimonial', brief: 'Alocação estratégica, horizonte, tolerância a risco' },
      perplexity: { role: 'Research Macro', brief: 'Cenário macro, câmbio, juros, dados atualizados' },
      gemini: { role: 'Gestor de Portfólio', brief: 'Construção tática, rebalanceamento, correlações' },
      deepseek: { role: 'Analista Quantitativo', brief: 'Modelagem, risco-retorno, backtest mental' },
      grok: { role: 'Cético Informado', brief: 'Questiona consenso, identifica bolhas, aponta vieses cognitivos' },
      gpt: { role: 'Presidente', brief: 'Consolida em quadro de alocação com prós/contras de cada caminho' },
    },
    userQuestion: 'Descreva sua situação financeira, objetivos, prazos, e a decisão específica que quer tomar.',
  },
  {
    id: 'research',
    icon: 'i-research',
    title: 'Conselho de Pesquisa',
    subtitle: 'Desenho de estudo, hipótese, métodos, publicação',
    tagline: 'hipótese · método · publicação',
    personas: {
      claude: { role: 'PI Sênior', brief: 'Visão de longo prazo da linha de pesquisa, fit programático' },
      perplexity: { role: 'Revisor de Literatura', brief: 'Estado da arte, gaps, trabalhos relacionados' },
      gemini: { role: 'Bioestatístico', brief: 'Desenho, poder, análise, pré-registro' },
      deepseek: { role: 'Metodologista', brief: 'Métodos computacionais, ML, reprodutibilidade' },
      grok: { role: 'Reviewer Crítico', brief: 'Adota a perspectiva do revisor mais rigoroso que avaliará o paper' },
      gpt: { role: 'Presidente', brief: 'Sintetiza visões e mapeia caminhos possíveis de estudo' },
    },
    userQuestion: 'Qual sua pergunta de pesquisa, hipótese, dados disponíveis, e onde está travado?',
  },
  {
    id: 'teaching',
    icon: 'i-teaching',
    title: 'Conselho de Ensino',
    subtitle: 'Aulas, currículo, metodologias ativas, avaliação',
    tagline: 'aula · currículo · avaliação',
    personas: {
      claude: { role: 'Pedagogo', brief: 'Objetivos de aprendizagem, Bloom, scaffolding' },
      perplexity: { role: 'Curador de Conteúdo', brief: 'Evidência mais recente, casos, referências' },
      gemini: { role: 'Designer Instrucional', brief: 'Formato, ritmo, engagement, ferramentas' },
      deepseek: { role: 'Especialista no Tema', brief: 'Profundidade técnica, pontos sutis' },
      grok: { role: 'Perspectiva do Aluno', brief: 'Antecipa pontos de confusão e o que vai engajar o público-alvo' },
      gpt: { role: 'Presidente', brief: 'Sintetiza em esqueleto de aula com alternativas de formato' },
    },
    userQuestion: 'Qual o tema, público-alvo, duração da aula, objetivos de aprendizagem e contexto?',
  },
  {
    id: 'clinical',
    icon: 'i-clinical',
    title: 'Conselho de Casos Clínicos',
    subtitle: 'Discussão de casos, diagnóstico diferencial, conduta',
    tagline: 'DD · conduta · evidência',
    personas: {
      claude: { role: 'Clínico Geral', brief: 'Visão integrativa, fisiopatologia, história clínica' },
      perplexity: { role: 'Guidelines Updates', brief: 'NCCN/ESMO/ASCO mais recentes, trials ativos' },
      gemini: { role: 'Radiologista', brief: 'Interpretação de imagens, achados sutis' },
      deepseek: { role: 'Patologista Molecular', brief: 'IHQ, NGS, biomarcadores, alvos terapêuticos' },
      grok: { role: 'Diagnóstico Diferencial', brief: 'Levanta hipóteses diagnósticas alternativas que podem estar sendo subestimadas' },
      gpt: { role: 'Presidente', brief: 'Sintetiza o caso e mapeia condutas levantadas pelos conselheiros' },
    },
    userQuestion: 'Cole o caso clínico: história, exames, imagens, patologia, dúvida específica. Não inclui dado identificável do paciente.',
  },
  {
    id: 'legal',
    icon: 'i-legal',
    title: 'Conselho de Casos Jurídicos',
    subtitle: 'Contratos, disputas, compliance — sem substituir advogado',
    tagline: 'contrato · risco · jurisprudência',
    personas: {
      claude: { role: 'Advogado Sênior', brief: 'Análise contratual, cláusulas críticas, riscos' },
      perplexity: { role: 'Pesquisa de Jurisprudência', brief: 'Precedentes, súmulas, decisões recentes' },
      gemini: { role: 'Compliance', brief: 'LGPD, regulatório, boas práticas' },
      deepseek: { role: 'Estrategista Negocial', brief: 'Zona de acordo, BATNA, táticas' },
      grok: { role: 'Contraparte Simulada', brief: 'Antecipa os argumentos e táticas que a outra parte pode usar' },
      gpt: { role: 'Presidente', brief: 'Sintetiza visões · não substitui advogado · você decide' },
    },
    userQuestion: 'Descreva o caso, o contrato ou a situação — sem dados pessoais sensíveis.',
  },
  {
    id: 'planning',
    icon: 'i-plan',
    title: 'Planejamento',
    subtitle: 'Semanal, mensal, trimestral, semestral, anual',
    tagline: 'prioridades · OKRs · execução',
    personas: {
      claude: { role: 'Chief of Staff', brief: 'Visão integrada, foco, trade-offs' },
      perplexity: { role: 'Benchmarker', brief: 'Como outros operadores de ponta planejam' },
      gemini: { role: 'Coach de Produtividade', brief: 'Time-blocking, deep work, energia' },
      deepseek: { role: 'Priorizador', brief: 'Custo-benefício, ICE score, o que cortar' },
      grok: { role: 'Pragmatismo', brief: 'Testa se o plano é executável dentro das restrições reais e aponta gargalos' },
      gpt: { role: 'Presidente', brief: 'Sintetiza em esboço de plano com prioridades e trade-offs' },
    },
    userQuestion: 'Qual o horizonte (semana/mês/trimestre/semestre/ano), seus objetivos, seu contexto de carga atual?',
  },
  {
    id: 'marketing',
    icon: 'i-marketing',
    title: 'Ações de Marketing',
    subtitle: 'Campanhas, posicionamento, go-to-market',
    tagline: 'GTM · posicionamento · canais',
    personas: {
      claude: { role: 'Estrategista de Marca', brief: 'Posicionamento, narrativa, diferenciação' },
      perplexity: { role: 'Market Research', brief: 'Concorrentes, tendências, dados de mercado' },
      gemini: { role: 'Growth Lead', brief: 'Canais, funil, CAC/LTV, experimentos' },
      deepseek: { role: 'Data Analyst', brief: 'Métricas, atribuição, priorização de canais' },
      grok: { role: 'Consumidor Externo', brief: 'Avalia a campanha do ponto de vista de quem ainda não conhece a marca' },
      gpt: { role: 'Presidente', brief: 'Sintetiza canais, prazos e métricas propostos pelo board' },
    },
    userQuestion: 'Qual o produto/serviço, ICP, orçamento, objetivo da campanha e prazo?',
  },
  {
    id: 'results',
    icon: 'i-results',
    title: 'Avaliação de Resultados',
    subtitle: 'Retrospectiva mês/trimestre/semestre/ano',
    tagline: 'retro · métricas · aprendizados',
    personas: {
      claude: { role: 'Coach Executivo', brief: 'Reflexão, padrões, crescimento pessoal' },
      perplexity: { role: 'Benchmark Externo', brief: 'Como esses resultados se comparam ao mercado' },
      gemini: { role: 'Analista de Performance', brief: 'O que os números realmente dizem' },
      deepseek: { role: 'Analista de Causa-Raiz', brief: 'Por que aconteceu? Causa vs correlação' },
      grok: { role: 'Auditor Externo', brief: 'Olha os números sem vieses emocionais, aponta o que o otimismo natural esconde' },
      gpt: { role: 'Presidente', brief: 'Sintetiza em 3 wins · 3 losses · 3 hipóteses para sua decisão' },
    },
    userQuestion: 'Cole seus resultados do período, métricas, contexto. O que deu certo, o que não deu?',
  },
  {
    id: 'ai-solutions',
    icon: 'i-ai',
    title: 'Soluções de IA',
    subtitle: 'Desenvolvimento de produtos e agentes de IA',
    tagline: 'agentes · LLMs · arquitetura',
    personas: {
      claude: { role: 'AI Architect', brief: 'Desenho de sistema, multi-agente, guardrails' },
      perplexity: { role: 'AI Trends', brief: 'Últimas releases, benchmarks, SOTA' },
      gemini: { role: 'Prompt Engineer', brief: 'Técnicas de prompting, RAG, avaliação' },
      deepseek: { role: 'ML Engineer', brief: 'Infra, custo, latência, fine-tuning' },
      grok: { role: 'Visão de Produto', brief: 'Avalia se a IA gera valor real ao usuário ou se é complexidade desnecessária' },
      gpt: { role: 'Presidente', brief: 'Sintetiza arquiteturas candidatas e mapeia trade-offs de roadmap' },
    },
    userQuestion: 'Qual o problema, dado disponível, restrições de custo/latência, usuário final?',
  },
  {
    id: 'software',
    icon: 'i-code',
    title: 'Desenvolvimento de Software',
    subtitle: 'Arquitetura, stack, review, debug',
    tagline: 'stack · arquitetura · review',
    personas: {
      claude: { role: 'Tech Lead', brief: 'Arquitetura, trade-offs, dívida técnica' },
      perplexity: { role: 'Library Researcher', brief: 'Libs atuais, alternativas, benchmarks' },
      gemini: { role: 'Code Reviewer', brief: 'Qualidade, testabilidade, segurança' },
      deepseek: { role: 'Systems Engineer', brief: 'Performance, escala, infra' },
      grok: { role: 'Leitor do Código', brief: 'Avalia legibilidade, documentação e quão fácil é para outro dev entender' },
      gpt: { role: 'Presidente', brief: 'Sintetiza opções de stack e implementação com prós/contras' },
    },
    userQuestion: 'Cole o código, a stack, a dúvida ou o problema de arquitetura.',
  },
  {
    id: 'book-club',
    icon: 'i-book',
    title: 'Clube de Leitura',
    subtitle: 'Discussão de livros, ideias, síntese',
    tagline: 'leitura · síntese · conexões',
    personas: {
      claude: { role: 'Filósofo', brief: 'Ideias centrais, implicações, contradições' },
      perplexity: { role: 'Crítico Literário', brief: 'Contexto do autor, recepção, críticas' },
      gemini: { role: 'Escritor', brief: 'Estrutura, estilo, escolhas narrativas' },
      deepseek: { role: 'Historiador das Ideias', brief: 'Conexões com outros autores e correntes' },
      grok: { role: 'Leitor Crítico', brief: 'Questiona a relevância, aponta contradições e ideias superestimadas do livro' },
      gpt: { role: 'Presidente', brief: 'Sintetiza em 3 ideias centrais + 3 aplicações práticas possíveis' },
    },
    userQuestion: 'Qual o livro/capítulo, o que você tirou dele, o que quer discutir?',
  },
  {
    id: 'paper-discussion',
    icon: 'i-paper',
    title: 'Discussão de Artigos',
    subtitle: 'Journal club, análise crítica, significância',
    tagline: 'journal club · crítica · aplicação',
    personas: {
      claude: { role: 'Senior Reviewer', brief: 'Mérito científico, contribuição, limitações' },
      perplexity: { role: 'Citation Tracker', brief: 'Impact, citações, trabalhos que refutam' },
      gemini: { role: 'Metodologista', brief: 'Desenho, análise, estatística' },
      deepseek: { role: 'Reprodutor', brief: 'Dá pra reproduzir? Dados/código disponíveis?' },
      grok: { role: 'Reviewer Crítico', brief: 'Identifica todas as limitações metodológicas e ameaças à validade do estudo' },
      gpt: { role: 'Presidente', brief: 'Sintetiza mérito, limitações e aplicabilidade · você decide' },
    },
    userQuestion: 'Cole o paper ou descreva o estudo, seu campo, e a pergunta específica.',
  },
];

export function getCouncil(id) {
  return COUNCILS.find((c) => c.id === id);
}

export function getLLM(id) {
  return LLMS.find((l) => l.id === id);
}
