# Próximas Etapas (Roadmap)

## 🎨 Fase 1: Polimento Visual & Mobile (UI v2)
- [x] **Layout Responsivo & Mobile:** Refinar a experiência em dispositivos móveis (Android via Capacitor), com otimização da barra de pesquisa, remoção de filtros redundantes e ajuste do seletor do Calendário.
- [x] **Página de Perfil & Definições:** Centro de controlo premium para gestão de conta e sincronização de dados.
- [ ] **Glassmorphism & Glow:** Aplicar efeitos de transparência e brilho nas bolhas de chat e cards para um aspeto mais moderno e premium.
- [ ] **Micro-interações:** Adicionar animações de hover avançadas e transições suaves entre páginas.

## 🔄 Fase 2: Sincronização & Rastreio Inteligente
- [ ] **Sincronização Cloud/Wi-Fi Automática:** Refinar o fluxo de Two-Way Sync para detetar automaticamente o IP do PC ou sincronizar em segundo plano via WebSockets.
- [ ] **Scraper Engine:** Implementar serviço que combina o Ollama com pesquisa web para detetar o último capítulo lançado de forma automática.
- [ ] **Notificações de Dashboard:** Criar um sistema de alertas no dashboard para avisar o utilizador quando houver capítulos novos de mangas da sua lista.

## ✅ Concluído Recentemente (Maio 17)
- [x] **Otimização Android Native:** Remoção de filtros de género em mobile via `Capacitor.isNativePlatform()`.
- [x] **Página de Perfil Premium (`/profile`):** Monitorização de armazenamento Dexie DB e seleção de modos de ligação (Wi-Fi, USB, Cloud).
- [x] **Motor Two-Way Sync (NestJS):** Endpoint `POST /sync/twoway` com lógica de fusão via `upsert` no Prisma.
- [x] **Streaming de Chat (SSE):** Respostas em tempo real do Bot.
- [x] **Auto-nomeação de Conversas:** Títulos gerados automaticamente por IA.