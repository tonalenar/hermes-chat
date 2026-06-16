# AGENTS.md - Configuracao Global do Hermes Agent

Guia operacional para o agente Hermes nesta maquina.
Define modelos, provider e regras de uso.

## Provider

Tudo passa pelo 9Router (localhost:20128).
Provider: `custom:9router`
Nunca usar providers externos diretamente - sempre rotear pelo 9Router.

## Modelos - Estrategia de Uso

### Dia a dia (conversa, pesquisa, tarefas leves)
- Modelo principal: `ag/gemini-3-flash-agent` (Gemini 3.5 Flash High via Antigravity)
- Fallback 1: `kr/auto` (Kiro Auto)
- Fallback 2: `cx/gpt-5.5` (ChatGPT/Codex)

### Codificacao (bond007 coder)
- Modelo principal: `cx/gpt-5.5` (ChatGPT/Codex)
- Fallback 1: `ag/claude-sonnet-4-6` (Claude 3.5 Sonnet Thinking via Antigravity)
- Fallback 2: `ag/gemini-3-flash-agent` (Gemini 3.5 Flash High via Antigravity)

### Pesquisa e Analise (bond007 researcher)
- Modelo principal: `ag/gemini-3-flash-agent` (Gemini 3.5 Flash High via Antigravity)
- Fallback: `kr/auto` (Kiro Auto)

## Modelos Disponiveis no 9Router

### Via Kiro (kr/*)
- kr/auto, kr/auto-thinking
- kr/claude-opus-4.8 (e variantes -thinking, -agentic)
- kr/claude-opus-4.7, kr/claude-sonnet-4.6, kr/claude-sonnet-4.5
- kr/claude-sonnet-4, kr/claude-haiku-4.5
- kr/deepseek-3.2, kr/minimax-m2.5, kr/minimax-m2.1
- kr/glm-5, kr/qwen3-coder-next

### Via NVIDIA NIM
- nvidia/z-ai/glm4.7 (gratuito - dia a dia)
- nvidia/minimaxai/minimax-m2.7
- nvidia/parakeet-ctc-1.1b-asr

## Regras Gerais

1. Respostas em portugues quando o usuario falar em portugues.
2. Tom natural, sem robotismo. Nada de "Claro!", "Certo!", "Entendido!".
3. Direto ao ponto. Sem enrolacao.
4. Sem emoji em codigo, docs ou commits.
5. Commits em portugues, presente do indicativo, sem emoji.
6. Prefixos de commit: feat:, fix:, refactor:, docs:, chore:.
7. Nunca expor secrets, tokens ou PII em logs ou respostas.
8. Para coding, delegar ao Kiro quando possivel:
   `kiro --provider 9router --model kr/claude-opus-4.8`

## Comando CLI para trocar modelo

```bash
# Dia a dia (Mistral Large 3 675B - gratuito via NIM)
hermes config set model.default nvidia/mistralai/mistral-large-3-675b-instruct-2512

# Dia a dia fallback (MiniMax M3 - rapido)
hermes config set model.default nvidia/minimaxai/minimax-m3

# Modo codigo (auto-select)
hermes config set model.default kr/auto

# Modo codigo premium (Opus 4.8)
hermes config set model.default kr/claude-opus-4.8
```

Script automatico: `bash ~/set-default-model.sh` (aplica Mistral Large 3, testa, reinicia gateway)

## Hermes Chat (Vercel)

Deploy: https://hermesai-eight.vercel.app

Acessa o 9Router via ngrok (tunnel público):
- URL: https://kiwi-brutishly-till.ngrok-free.dev/v1
- API Key: sk-6fc83da204aa96dc-kpkeoh-32ff7e78

### Vercel Environment Variables

```
OPENAI_BASE_URL=https://kiwi-brutishly-till.ngrok-free.dev/v1
OPENAI_API_KEY=sk-6fc83da204aa96dc-kpkeoh-32ff7e78
OPENAI_MODEL=kr/claude-sonnet-4.5
```

## Validacao

```bash
hermes config get model.default
hermes config get model.provider
curl -s http://localhost:20128/v1/models | python3 -c "import sys,json; [print(m['id']) for m in json.load(sys.stdin)['data']]"
```
