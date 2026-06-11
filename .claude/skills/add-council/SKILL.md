---
name: add-council
description: Gera um novo bloco de conselho para council.js com personas coerentes para os 6 LLMs
---

Gere um novo bloco de conselho para `app/config/council.js`.

## Input esperado

Peça ao usuário (se não fornecido):
1. Tema do conselho (ex: "Saúde Mental", "Negócios", "Relacionamentos")
2. Público-alvo principal
3. 2-3 tipos de decisão ou dilema que o conselho resolve

## Processo

Antes de gerar, leia os últimos 2 conselhos em `app/config/council.js` para capturar o estilo exato (estrutura de `userQuestion`, tom dos `brief`, padrões de `icon`).

## Formato de output

Gere um bloco JS completo pronto para inserção no array `COUNCILS`:

```js
{
  id: 'kebab-case-id',
  icon: '🎯',  // 1 emoji relevante
  title: 'Título do Conselho',
  subtitle: 'Subtítulo descritivo',
  tagline: 'Frase de 1 linha que descreve o valor',
  userQuestion: 'Pergunta guia que pede o contexto específico necessário para boas respostas (ex: situação atual, o que já tentou, qual o dilema concreto)',
  personas: {
    claude: {
      role: 'Role único com perspectiva específica',
      brief: 'Uma lente concreta e distinta — NÃO genérica'
    },
    perplexity: {
      role: 'Role único com perspectiva específica',
      brief: 'Uma lente concreta e distinta — NÃO genérica'
    },
    gemini: {
      role: 'Role único com perspectiva específica',
      brief: 'Uma lente concreta e distinta — NÃO genérica'
    },
    deepseek: {
      role: 'Role único com perspectiva específica',
      brief: 'Uma lente concreta e distinta — NÃO genérica'
    },
    grok: {
      role: 'Role único com perspectiva específica',
      brief: 'Uma lente concreta e distinta — NÃO genérica'
    },
    gpt: {
      role: 'Presidente',
      brief: 'Sintetiza os 5 ângulos acima em uma decisão acionável, destacando trade-offs centrais'
    }
  }
}
```

## Regras de qualidade

- Cada persona DEVE ter um ângulo genuinamente diferente — teste mentalmente: "esse conselheiro contradiz o outro em algo?"
- `brief` deve especificar a lente, não descrever o que a IA fará (ruim: "analisa o contexto"; bom: "benchmarks de mercado e dados do setor específico")
- `gpt` como Presidente: foca síntese + decisão, NÃO adiciona mais uma opinião
- `userQuestion` deve capturar o contexto que diferencia respostas — não perguntas genéricas

## Entrega

Após gerar o bloco, mostre o output em um code block e pergunte:
1. Quer ajustar alguma persona específica?
2. Quer que eu insira diretamente no arquivo?

Se o usuário quiser inserir, adicione antes da linha `];` no array COUNCILS de `app/config/council.js`.
