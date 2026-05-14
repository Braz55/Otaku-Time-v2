# 🌸 OtakuTime v2 - Premium Discovery & AI Companion

OtakuTime v2 é uma plataforma de descoberta e acompanhamento de animes e mangas, elevada por inteligência artificial local para proporcionar uma experiência de "Sommelier" personalizada.

## ✨ Funcionalidades Premium

- **🤖 Companion de IA (Ollama + Llama 3.1):** Um assistente inteligente que conhece a tua biblioteca e sugere obras com base no teu gosto pessoal.
- **⚡ Streaming de Respostas:** Interface de chat fluida com respostas em tempo real via Server-Sent Events (SSE).
- **📝 Auto-Nomeação de Sessões:** Organização inteligente de conversas com títulos gerados por IA.
- **🧭 Discovery Contextual (Varinha Mágica):** Filtra e descobre conteúdos por género ou semelhança com a tua lista atual.
- **🔗 Links Oficiais Integrados:** Acesso direto a plataformas como Lezhin, Tappytoon, MangaPlus e Crunchyroll.
- **📅 Calendário de Lançamentos:** Acompanha quando saem os novos episódios dos animes que estás a ver.
- **📊 Ranking Pessoal:** Define a tua prioridade de visualização com um sistema de ranking real (#1, #2, etc.).

## 🛠️ Stack Tecnológica

- **Backend:** NestJS, Prisma (SQLite), Ollama (Llama 3.1 8B).
- **Frontend:** React, Tailwind CSS, Lucide Icons.
- **APIs:** AniList GraphQL API.

## 🚀 Como Correr

1. **Backend:**
   ```bash
   $ npm install
   $ npx prisma db push
   $ npm run start:dev
   ```

2. **Frontend:**
   ```bash
   $ cd otaku-ui
   $ npm install
   $ npm run dev
   ```

3. **IA (Ollama):**
   Certifica-te de que o Ollama está a correr com o modelo `llama3.1`.

## 📜 Histórico de Versões
Consulta o ficheiro [history.md](./history.md) para ver a evolução detalhada do projeto.

---
*Desenvolvido com ❤️ para a comunidade Otaku.*
