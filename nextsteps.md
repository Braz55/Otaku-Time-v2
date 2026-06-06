# Próximos passos de implementação/futuras funcionalidades

## ✅ Concluído (Fases Anteriores)

### 1. Base de Dados na Nuvem (PostgreSQL)
Migração concluída com sucesso do SQLite local para o PostgreSQL alojado na nuvem (através do Neon DB). O schema do Prisma foi configurado para utilizar o provider `postgresql` e o pool de conexões foi ajustado.

### 2. Alojamento do Servidor Backend (NestJS)
O backend em NestJS está a correr no Render ([render.com](https://render.com)) de forma totalmente automatizada (deploy automático a cada `git push` no branch `main`).

### 3. Frontend Multi-Tema & App Android
O frontend React foi enriquecido com suporte para múltiplos temas e paletas de cores. A aplicação móvel em Android (via Capacitor) agora inclui um alternador no ecrã de Perfil para escolher dinamicamente entre o **Modo Online (Nuvem)** direto e o **Modo Offline (IndexedDB/Dexie DB)** local.

---

## 🔮 Próximos Passos (Planeamento)

### Passo 1: Funcionalidade de Sorteio Inteligente para Leitura / Visualização (Raffle Probabilístico)
Com o aumento da biblioteca pessoal, os utilizadores acumulam muitas obras no backlog. Esta funcionalidade visa sortear aleatoriamente o próximo anime ou mangá que o utilizador deve ver ou ler, mas de forma inteligente e probabilística em vez de puro acaso.

#### 🎲 Regras e Lógica de Probabilidade do Sorteio:
1. **Filtro de Estado (Terminado vs Não Terminado):**
   - Primeiro, o sistema calcula a probabilidade de escolher entre algo terminado e não terminado.
   - A probabilidade de escolher algo já concluído (`COMPLETED`) deve ser **muito menor** (ex: 5% a 10%), apenas para incentivar re-leitura/re-visualização ocasional. A maior probabilidade deve recair sobre obras não concluídas (ex: `PLANNED`, `WATCHING`, `PAUSED`).
2. **Prioridade & Ranking (Pesos Proporcionais):**
   - Depois de determinar a categoria (concluída ou não), o sistema atribui pesos probabilísticos com base na **Prioridade (1 a 10)** de cada obra na lista do utilizador.
   - Obras com prioridade maior devem ter uma probabilidade proporcionalmente muito superior de serem selecionadas do que obras com prioridade menor.
   - *Exemplo de cálculo de peso:* $Peso = Prioridade^2$, garantindo que itens com prioridade 10 se destaquem significativamente face a itens de prioridade 1.
3. **Outros Ajustes Probabilísticos (Opcional):**
   - **Tempo de abandono:** Dar maior peso a obras não atualizadas ou não abertas há mais tempo para ajudar a limpar o backlog.

#### 🛠️ Sugestão de Implementação:
- **Servidor (NestJS):** Endpoint `GET /media/draw` que calcula os pesos baseados na lista atual de animes/mangás do utilizador e escolhe a obra através de um algoritmo de amostragem ponderada.
- **Frontend (React):** Botão interativo no dashboard ("Sorteio da Sorte") que exibe uma roleta animada antes de mostrar os detalhes do conteúdo selecionado.

---

### Passo 2: Sincronização WebSockets em Tempo Real
Substituir o polling manual de background por uma ligação WebSocket persistente (via Socket.io no NestJS) para atualizar o progresso entre o telemóvel e o PC instantaneamente sempre que houver conexão.