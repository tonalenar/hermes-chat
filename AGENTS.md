# AGENTS.md - Configuracao Global do Hermes Agent

Guia operacional para o agente Hermes nesta maquina.
Define modelos, provider e regras de uso.

## Provider

Tudo passa pelo 9Router (localhost:20128).
Provider: `custom:9router`
Nunca usar providers externos diretamente - sempre rotear pelo 9Router.

## Profiles

### default (Hermes principal)
- Gateway: Bot Telegram @TonzinhoAlencar_bot
- Modelo principal: `ag-gemini-flash-resilient` (combo 9Router)
- Fallback 1: `cx/gpt-5.5` (ChatGPT/Codex)
- Fallback 2: `kr/auto` (Kiro Auto)

### designer (bond007_designer_bot)
- Gateway: Bot Telegram @bond007_designer_bot
- API: http://localhost:8643
- Funcao: Design de interface (UI/UX), React/Tailwind, prototipagem rapida, animacoes
- Modelo principal: `ag-gemini-flash-resilient` (combo 9Router)
- Fallback 1: `cx/gpt-5.5` (ChatGPT/Codex)
- Fallback 2: `kr/auto` (Kiro Auto)
- Skills: frontend-design, ui-ux-pro-max, creative
- SOUL.md: Personalidade de designer especialista

### coder (bond007_coder_bot)
- Gateway: Bot Telegram @bond007_coder_bot
- API: http://localhost:8644
- Funcao: EXCLUSIVO para codificacao - escrever, refatorar, debugar, migrations, testes
- Modelo principal: `cx/gpt-5.5` (ChatGPT/Codex) - melhor para codar
- Fallback 1: `ag/claude-sonnet-4-6` (Claude 3.5 Sonnet Thinking via Antigravity)
- Fallback 2: `ag/gemini-3-flash-agent` (Gemini 3.5 Flash High via Antigravity)
- Skills: software-development, github, devops
- SOUL.md: Personalidade de codificador exclusivo - NAO faz outras tarefas

### researcher (bond007_researcher_bot)
- Gateway: Bot Telegram @bond007_researcher_bot
- API: http://localhost:8645
- Funcao: Pesquisa na web, documentacao, analise de dados, levantamento de requisitos
- Modelo principal: `ag/gemini-3-flash-agent` (Gemini 3.5 Flash High via Antigravity)
- Fallback: `kr/auto` (Kiro Auto)
- Skills: research, data-science
- SOUL.md: Personalidade de pesquisador - NAO escreve codigo

## Regras de Delegacao do Time (OBRIGATORIO)

O bot principal (@TonzinhoAlencar_bot) DEVE seguir estas regras ao receber tarefas.

### MECANISMO DE DELEGACAO

Sempre usar este fluxo de 3 passos:

1. **Notificar**: avisar o subagente via Telegram
2. **Processar**: chamar a API do subagente
3. **Responder**: mostrar o resultado na conversa principal + notificar fim no subagente

Comandos disponiveis:
```
python3 ~/.hermes/scripts/notify_subagent.py <profile> notify "<descricao>"
python3 ~/.hermes/scripts/delegate_to.py <profile> "<prompt>"
python3 ~/.hermes/scripts/notify_subagent.py <profile> result "<resumo>"
```

### CODIGO → delegar para @bond007_coder_bot
- Tudo que envolva: escrever, refatorar, debugar, criar migrations, testar codigo
- Profile: `coder` (porta 8644)
- Passos:
  ```
  python3 ~/.hermes/scripts/notify_subagent.py coder notify "Codificacao: <descricao resumida>"
  python3 ~/.hermes/scripts/delegate_to.py coder "<descricao completa do que codar com contexto>"
  ```
- Modelo do subagente: cx/gpt-5.5
- NAO faca voce mesmo - sempre delegue codigo

### PESQUISA → delegar para @bond007_researcher_bot
- Tudo que envolva: buscar na web, analisar documentacao, resumir artigos, levantar requisitos
- Profile: `researcher` (porta 8645)
- Passos:
  ```
  python3 ~/.hermes/scripts/notify_subagent.py researcher notify "Pesquisa: <descricao>"
  python3 ~/.hermes/scripts/delegate_to.py researcher "<o que pesquisar>"
  ```
- Modelo do subagente: ag/gemini-3-flash-agent (rapido para buscas)

### DESIGN → delegar para @bond007_designer_bot
- Tudo que envolva: UI/UX, componentes React/Tailwind, prototipagem, animacoes
- Profile: `designer` (porta 8643)
- Passos:
  ```
  python3 ~/.hermes/scripts/notify_subagent.py designer notify "Design: <descricao>"
  python3 ~/.hermes/scripts/delegate_to.py designer "<o que desenhar/criar>"
  ```
- Skills do subagente: frontend-design, ui-ux-pro-max

### EXCECOES (pode responder direto)
- Conversas casuais, saudacoes, duvidas rapidas
- Configuracao do proprio Hermes/9Router
- Responder sobre status do sistema
- Tarefas que voce ja tem contexto completo e sao rapidas (< 1min)

## Modelos - Estrategia de Uso

### Combo Antigravity Resiliente (`ag-gemini-flash-resilient`)
Combo criado no 9Router com fallback entre contas e modelos:
1. `gemini-3-flash-agent` na conta tonz1nalencar@gmail.com
2. `gemini-3-flash-agent` na conta tonzinhoweb@gmail.com
3. `claude-sonnet-4-6` na conta tonz1nalencar@gmail.com
4. `claude-sonnet-4-6` na conta tonzinhoweb@gmail.com
5. (fora do combo) cx/gpt-5.5 (fallback 1 Hermes)
6. (fora do combo) kr/auto (fallback 2 Hermes)

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
