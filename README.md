# Mentoria Multiagente para Transição Médica aos EUA

Plataforma simples para rodadas de mentoria com 6 LLMs, em ordem fixa:

1. Claude Sonnet
2. Gemini
3. Perplexity
4. Grok
5. DeepSeek
6. GPT (última versão)

Você envia uma pergunta e cada agente responde **em sequência, sem interrupções**. Após o GPT, a palavra volta para você para continuar ou encerrar.

## Como funciona

- Interface web em Streamlit.
- Ordem de fala fixa (não há orquestrador inteligente).
- Cada rodada usa o histórico da conversa para manter contexto.
- Integração padrão via API compatível OpenAI (OpenRouter por padrão), com modelos configuráveis no painel lateral.

## Requisitos

- Python 3.10+
- Chave de API (ex.: OpenRouter)

## Instalação

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Execução

```bash
export OPENROUTER_API_KEY="sua_chave"
streamlit run app.py
```

Abra o navegador no endereço exibido pelo Streamlit (normalmente `http://localhost:8501`).

## Configuração opcional

No painel lateral você pode ajustar:

- Base URL da API
- Nome dos 6 modelos
- Temperatura e máximo de tokens

## Observação

Este projeto oferece mentoria de apoio e organização de pensamento. Não substitui aconselhamento legal, migratório, regulatório (USMLE/ECFMG/state board), nem aconselhamento clínico para pacientes.
