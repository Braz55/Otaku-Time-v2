# Próximas Etapas (Roadmap)

## 🎨 Fase 1: Polimento Visual & Personalização (UI v2)
- [x] **Layout Responsivo & Mobile:** Refinar a experiência em dispositivos móveis (Android via Capacitor), com otimização da barra de pesquisa, remoção de filtros redundantes e ajuste do seletor do Calendário.
- [x] **Página de Perfil & Definições:** Centro de controlo premium para gestão de conta, preferências e sincronização de dados.
- [x] **Temas Visuais e Paletas de Cores:** Implementação do Modo Claro (Light Mode) e 6 paletas de cores temáticas para personalização do utilizador.
- [ ] **Glassmorphism & Glow:** Aplicar efeitos de transparência e brilho nas bolhas de chat e cards para um aspeto mais moderno e premium.
- [ ] **Micro-interações:** Adicionar animações de hover avançadas e transições suaves entre páginas.

## 🔄 Fase 2: Sincronização, Nuvem e Conectividade
- [x] **Base de Dados na Nuvem (PostgreSQL):** Transição de SQLite local para PostgreSQL remoto alojado no Neon DB.
- [x] **Servidor em Produção (Render):** Alojamento do backend em NestJS com deploy automatizado através do Render.
- [x] **Modos Híbridos de Ligação:** Adicionada a capacidade de alternar entre o Modo Online (Cloud) e Modo Offline (Dexie DB local) no Android.
- [ ] **Refinamento do AutoSync Releases:** Melhorar logs e tratamentos de erro ao consultar APIs de lançamento.
- [ ] **Scraper Engine:** Implementar serviço que combina o Ollama com pesquisa web para detetar o último capítulo lançado de forma automática.
- [ ] **Notificações de Dashboard:** Criar um sistema de alertas no dashboard para avisar o utilizador quando houver capítulos novos de mangas da sua lista.

## 🔮 Fase 3: Próximas Funcionalidades Planeadas
- [x] **Sorteio Probabilístico Inteligente para Ler/Ver (Raffle):**
  - Implementação de um botão no dashboard para sortear a próxima leitura/visualização da biblioteca do utilizador.
  - Ponderação probabilística em duas etapas:
    1. **Probabilidade de Estado:** Escolha entre obra terminada e não terminada (a probabilidade de sorteio de algo terminado é substancialmente menor, ex: 5%).
    2. **Peso de Prioridade:** Obras com maior prioridade/ranking pessoal recebem pesos significativamente superiores no sorteio (ex: $peso = prioridade^2$).
- [ ] **Remoção Completa do Chatbot de IA (Otaku Bot):**
  - Limpeza total do código de inteligência artificial para evitar gastos de tokens e chamadas externas desnecessárias em produção.
  - Remover componentes frontend (Chat page, rotas, botões de acesso).
  - Remover endpoints backend (`/chat`, `ChatModule`, `ChatController`, `ChatService`).
  - Eliminar tabelas de chat no Prisma schema (`ChatSession`, `ChatMessage`).

## ✅ Concluído Recentemente
- [x] **Otimização Android Native:** Remoção de filtros de género em mobile via `Capacitor.isNativePlatform()`.
- [x] **Página de Perfil Premium (`/profile`):** Monitorização de armazenamento Dexie DB e seleção de modos de ligação (Wi-Fi, USB, Cloud).
- [x] **Remoção de Código de Sincronização Bidirecional:** Removida a lógica `handleTwoWaySync` do backend para garantir integridade e foco no modelo de backups locais/cloud independentes.
- [x] **Streaming de Chat (SSE):** Respostas em tempo real do Bot.
- [x] **Auto-nomeação de Conversas:** Títulos gerados automaticamente por IA.