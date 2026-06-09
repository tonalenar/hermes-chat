# Hermes Chat - Plano de Correção Completa

## Problemas Identificados

### 1. Roteamento / Navegação
- Não há navegação entre páginas (tudo em uma única página)
- Sidebar não colapsa em mobile corretamente
- Botão de menu mobile não funciona

### 2. Funcionalidade do Chat
- Quick action buttons (Analyze, Create, Debug, Explain) enviam mensagens mas não mostram o que foi digitado no textarea
- Não há feedback visual enquanto a API responde (pode demorar 30s+)
- Histórico de conversas não persiste entre sessões do browser (localStorage funciona mas não há sync)

### 3. UX/UI Issues
- Botoes quick action com opacity:0 inicial (Framer Motion animation delay)
- Não há indicador de "typing" quando a API esta processando
- Mensagens não renderizam markdown (codigo, links, etc.)
- Não ha botao de "New Chat" funcional no header

### 4. API / Backend
- Rota /api/chat usa child_process.execFile para chamar hermes CLI - lento e pesado
- Timeout de 120s pode causar erros silenciosos
- Não ha streaming de respostas

### 5. Build / Deploy
- PM2 config funciona mas precisa de --update-env apos restart
- Porta 3000 precisa estar liberada no Security Group

## Plano de Correção

### Fase 1: Corrigir Bugs Críticos
1. Corrigir import de deleteConversation (FEITO)
2. Garantir que quick action buttons funcionem
3. Adicionar indicador de loading adequado
4. Corrigir sidebar mobile

### Fase 2: Melhorar UX
1. Renderizar markdown nas mensagens
2. Adicionar botao de copy nas mensagens
3. Melhorar feedback de erro
4. Adicionar animacoes suaves

### Fase 3: Otimizar Backend
1. Melhorar parsing de resposta do Hermes CLI
2. Adicionar timeout handling
3. Considerar streaming de respostas

## Arquivos a Corrigir

- src/app/page.tsx (principal)
- src/components/ui/animated-ai-chat.tsx (input)
- src/components/chat/sidebar.tsx (sidebar)
- src/components/chat/message-bubble.tsx (mensagens)
- src/app/api/chat/route.ts (API)
- src/lib/store.ts (store)
