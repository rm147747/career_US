import os
from dataclasses import dataclass
from typing import List, Dict

import requests
import streamlit as st


@dataclass
class Agent:
    display_name: str
    model: str


DEFAULT_AGENTS = [
    Agent("Agente 1 — Claude Sonnet", "anthropic/claude-3.5-sonnet"),
    Agent("Agente 2 — Gemini", "google/gemini-1.5-pro"),
    Agent("Agente 3 — Perplexity", "perplexity/llama-3.1-sonar-large-128k-online"),
    Agent("Agente 4 — Grok", "x-ai/grok-2"),
    Agent("Agente 5 — DeepSeek", "deepseek/deepseek-chat"),
    Agent("Agente 6 — GPT", "openai/gpt-4o"),
]

SYSTEM_PROMPT = (
    "Você é um mentor especializado em apoiar médicos em transição para carreira nos EUA. "
    "Responda de forma prática, ética e organizada. "
    "Considere contexto de oncologia, processos seletivos, documentação, comunicação profissional, "
    "estratégia de candidatura e preparação de entrevistas. "
    "Não invente regras regulatórias; quando houver incerteza, destaque validações necessárias."
)


def call_llm(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8501",
        "X-Title": "Mentoria Multiagente EUA",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def init_state() -> None:
    if "history" not in st.session_state:
        st.session_state.history = []


def main() -> None:
    st.set_page_config(page_title="Mentoria Multiagente EUA", layout="wide")
    st.title("Mentoria Multiagente para Mudança aos EUA")
    st.caption("Rodadas fixas: Claude → Gemini → Perplexity → Grok → DeepSeek → GPT")

    init_state()

    with st.sidebar:
        st.header("Configuração")
        api_key = st.text_input(
            "API Key",
            value=os.getenv("OPENROUTER_API_KEY", ""),
            type="password",
            help="Use sua chave OpenRouter ou outro gateway compatível OpenAI.",
        )
        base_url = st.text_input("Base URL", value="https://openrouter.ai/api/v1")

        st.subheader("Modelos (ordem fixa)")
        configured_agents = []
        for idx, agent in enumerate(DEFAULT_AGENTS, start=1):
            model_name = st.text_input(f"Modelo {idx}", value=agent.model)
            configured_agents.append(Agent(agent.display_name, model_name))

        temperature = st.slider("Temperatura", 0.0, 1.0, 0.4, 0.1)
        max_tokens = st.slider("Máx. tokens por resposta", 200, 2000, 700, 50)

        if st.button("Limpar conversa"):
            st.session_state.history = []
            st.rerun()

    st.markdown("### Seu questionamento")
    user_question = st.text_area(
        "Escreva sua pergunta para iniciar a próxima rodada",
        placeholder="Ex.: Como estruturar minha preparação para entrevistas clínicas nos próximos 60 dias?",
        height=110,
    )

    if st.button("Iniciar rodada de mentoria", type="primary"):
        if not api_key.strip():
            st.error("Informe a API key no painel lateral antes de iniciar.")
            st.stop()

        if not user_question.strip():
            st.warning("Digite uma pergunta antes de iniciar.")
            st.stop()

        st.session_state.history.append({"role": "user", "content": user_question.strip()})

        st.markdown("---")
        st.subheader("Rodada atual")

        running_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + st.session_state.history.copy()

        for agent in configured_agents:
            with st.spinner(f"{agent.display_name} está respondendo..."):
                try:
                    answer = call_llm(
                        base_url=base_url,
                        api_key=api_key,
                        model=agent.model,
                        messages=running_messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                except requests.RequestException as exc:
                    answer = f"Erro de conexão/API para {agent.display_name}: {exc}"
                except (KeyError, IndexError, TypeError) as exc:
                    answer = f"Resposta inesperada da API para {agent.display_name}: {exc}"

            st.markdown(f"#### {agent.display_name}")
            st.write(answer)

            running_messages.append({"role": "assistant", "content": f"[{agent.display_name}] {answer}"})
            st.session_state.history.append(
                {"role": "assistant", "content": f"[{agent.display_name}] {answer}"}
            )

        st.success("Rodada concluída. Agora a palavra volta para você.")

    if st.session_state.history:
        st.markdown("---")
        st.subheader("Histórico")
        for msg in st.session_state.history:
            if msg["role"] == "user":
                st.markdown(f"**Você:** {msg['content']}")
            else:
                st.markdown(msg["content"])


if __name__ == "__main__":
    main()
