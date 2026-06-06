# 🤖 Otaku Time Pro (v2.5)

**O teu tracker inteligente, híbrido e offline-first de Anime & Manga.**

O **Otaku Time Pro** é um ecossistema completo Fullstack projetado para **registar, organizar e acompanhar o progresso** de todas as tuas obras favoritas. Com uma arquitetura moderna que combina a robustez da nuvem com a flexibilidade offline-first, podes gerir a tua biblioteca no PC ou no telemóvel Android.

A plataforma automatiza fusos horários de lançamentos de episódios, rastreia capítulos em múltiplos portais e apresenta uma interface altamente personalizável e fluida.

🌍 **Aplicações em Produção:**
* **Frontend Web & API:** [https://otaku-time-v2.onrender.com](https://otaku-time-v2.onrender.com)
* **Base de Dados:** Alojada remotamente na nuvem Neon (PostgreSQL)

---

## 🚀 Principais Funcionalidades & Novidades (v2.5)

### ☁️ 1. Ecossistema na Nuvem & Deploy Automatizado (Neon DB + Render)
* **Base de Dados PostgreSQL (Neon DB):** Transição de SQLite local para PostgreSQL remoto, com pool de ligações otimizado e certificados SSL seguros para garantir resiliência e estabilidade.
* **Hospedagem no Render:** O backend em NestJS e o frontend React (SPA) estão alojados no Render com integração contínua (CI/CD) ligada diretamente ao branch `main` do repositório GitHub.

### 🔄 2. Modos Híbridos no Android (Online / Offline-First via Capacitor)
* **Modo Online (Nuvem):** Acesso e escrita direta na base de dados centralizada no Neon DB sempre que houver internet.
* **Modo Offline (Local via Dexie DB):** O telemóvel guarda o teu progresso localmente usando IndexedDB (Dexie DB) para navegação, pesquisa e gestão de biblioteca totalmente offline.
* **Sincronização Bidirecional (Two-Way Sync):** Painel interativo de perfil que permite realizar uma sincronização manual e inteligente (`/sync/twoway`). O servidor NestJS recebe os itens locais e executa operações de `upsert` na nuvem PostgreSQL, fundindo dados mais recentes e sincronizando de volta para o dispositivo.

### 🎲 3. Sorteios Aleatórios Inteligentes (Gacha / Raffle)
* **Sorteio Global (Pesquisa):** Pressiona o botão de dado (`casino`) na barra de pesquisa para sortear uma obra aleatória de popularidade (rank 1 a 2000) diretamente da API AniList.
* **Sorteio Planeado (Biblioteca):** Pressiona o botão de setas cruzadas (`shuffle`) na biblioteca para sortear um título da lista de planeados (`PLANNED`). A seleção utiliza um algoritmo probabilístico em cascata:
  1. *Prioridade (1 a 10):* Obras com maior prioridade/ranking têm pesos substancialmente maiores.
  2. *Status de Publicação:* Prioriza obras terminadas (75% de chance para `FINISHED`) em detrimento de obras em lançamento (25% para `RELEASING`).
  3. *Tentativas com Fallback:* Algoritmo resiliente com até 100 tentativas e fallback seguro.

### 📊 4. Dashboard de Acompanhamento Premium (To-Watch/Read)
* **Vista Dual-Column:** Painel inicial com secções separadas para "VER ASSEGUIR" (Animes) e "LER ASSEGUIR" (Mangas).
* **Optimistic UI:** Atualização imediata do progresso no frontend ao clicar nos botões rápidos "VISTO" ou "LIDO", sincronizando com o servidor em segundo plano para eliminar tempos de espera.
* **Progressão Automática:** Atualização automática para o estado `WATCHING` / `READING` ao mudar o progresso de 0 para 1, e para `COMPLETED` ao atingir o último episódio/capítulo.

### 📅 5. Calendário Pessoal Dinâmico
* Mapeia os lançamentos futuros apenas das obras em estado `RELEASING` presentes na tua lista pessoal.
* Converte automaticamente os timestamps de lançamento originais (Japan Standard Time - JST) obtidos via API AniList para o fuso horário local do utilizador.

### 📚 6. Rastreio de Capítulos Triplo (Manga)
Resolve inconsistências de portais externos através de um sistema de 3 camadas:
* **Plan A (Baka-Updates):** Consulta o MangaUpdates para obter a contagem exata e divisórias de temporadas/especiais.
* **Plan B (MangaDex):** Fallback inteligente com pesquisa por ID AniList ou título aproximado.
* **Plan C (AniList):** Fallback final para obras concluídas.

### 🎨 7. Temas Visuais & Definições do Perfil
* Interface moderna com suporte total a **Modo Escuro (Dark)** e **Modo Claro (Light)** com transições de CSS limpas.
* Seletor de **6 paletas de cores cromáticas**: Roxo Clássico (Padrão), Laranja Shounen (Crunchyroll), Vermelho Akatsuki (Naruto), Verde Mutsu (Mushi-Shi), Roxo Solo Leveling e Azul Visionário (AniList).
* Gestão de preferências do utilizador diretamente no Perfil: idioma preferido (Português/Inglês) e filtro de conteúdos para adultos (NSFW).

### 📱 8. Correção de Ecrã Preto & Compatibilidade Android
* **Compatibilidade ES2020:** O build do frontend Vite e TypeScript foi ajustado para `es2020`, garantindo total compatibilidade com WebViews do Android mais antigos.
* **Cache-Busting & Loader:** Adicionado um script de interceção em `index.html` para limpar recursos estáticos obsoletos guardados em cache após novas atualizações e um ecrã de carregamento animado premium.

---

## 🛠️ Arquitetura do Sistema

```mermaid
flowchart TD
    subgraph Nuvem ["Nuvem & Produção (Render + Neon)"]
        FE_Render["Frontend (Render SPA) \n otaku-time-v2.onrender.com"]
        BE_Render["Backend (Render Web Service) \n api-otaku-time"]
        DB_Neon[(PostgreSQL - Neon DB)]
    end

    subgraph Dispositivo ["Cliente Local (Web & Mobile)"]
        Browser["Navegador Web (Desktop/Mobile)"]
        Capacitor["App Android (Capacitor)"]
        LocalDB[(Dexie DB - IndexedDB)]
    end

    subgraph Fontes_Externas ["Fontes de Dados & Metadados"]
        AniList["AniList GraphQL API"]
        BakaUpdates["Baka-Updates API"]
        MangaDex["MangaDex API"]
    end

    %% Relações de comunicação
    Browser -->|Acede| FE_Render
    Capacitor -->|Carrega WebView| LocalDB
    
    FE_Render -->|Pedidos REST| BE_Render
    Browser -->|Pedidos REST| BE_Render
    Capacitor -->|Sincronização & Cloud Sync| BE_Render
    
    BE_Render ---|"Prisma ORM"| DB_Neon
    
    BE_Render -->|Metadados & Lançamentos| AniList
    BE_Render -->|Capítulos & Temporadas| BakaUpdates
    BE_Render -->|Fallback de Capítulos| MangaDex
```

### Tecnologias Utilizadas

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Backend** | NestJS (v11) | Framework progressivo em Node.js com TypeScript, hospedado no Render |
| **Base de Dados** | PostgreSQL (Neon DB) | Base de dados na nuvem com pooling de conexões e SSL ativo |
| **ORM** | Prisma (v7) | Mapeamento relacional de dados e migrações eficientes |
| **Frontend** | React (v19) + Vite + TailwindCSS (v4) | Interface veloz com sistema de temas, hook `useIsMobile` e CSS moderno |
| **Offline-First** | Dexie DB | Wrapper do IndexedDB para gerir armazenamento local de alta velocidade em mobile |
| **Mobile** | Capacitor (v8) | Empacotamento híbrido para Android WebView com target ES2020 |
| **APIs** | AniList / MangaUpdates / MangaDex | Integrações externas para consulta de metadados, calendário e capítulos |

---

## 📐 Diagrama de Classes (Base de Dados)

```mermaid
classDiagram
    class User {
        +Int id
        +String nome
        +String email
        +String password
        +String preferredLanguage
        +String theme
        +Boolean showAdultContent
        +Int tokenVersion
        +UserAnime[] animes
        +UserManga[] mangas
    }

    class Anime {
        +Int id
        +String titulo
        +String statusLancamento
        +String descricao
        +String generos
        +String capaUrl
        +Int numEpisodiosTotal
        +Int proximoEpisodio
        +DateTime proximoEpisodioData
        +DateTime dataLancamento
        +String temporada
        +Int ano
        +String linksExternos
        +DateTime updatedAt
    }

    class Manga {
        +Int id
        +String titulo
        +String statusLancamento
        +Float numCapitulosTotal
        +String capaUrl
        +String generos
        +String autor
        +String descricao
        +DateTime proximoCapituloData
        +Float proximoCapituloNumero
        +String linksExternos
        +DateTime updatedAt
    }

    class UserAnime {
        +Int id
        +Int epAtual
        +TrackingStatus status
        +Int prioridade
        +String linksPersonalizados
        +Int userId
        +Int animeId
        +DateTime updatedAt
    }

    class UserManga {
        +Int id
        +Float capAtual
        +TrackingStatus status
        +Int prioridade
        +String linksPersonalizados
        +Int userId
        +Int mangaId
        +DateTime updatedAt
    }

    User "1" --> "*" UserAnime : possui
    User "1" --> "*" UserManga : possui
    Anime "1" --> "*" UserAnime : associado
    Manga "1" --> "*" UserManga : associado
```

---

## 📂 Guia de Pastas

```bash
Otaku-Time-v2/
├── prisma/                  # Configuração do PostgreSQL (Neon) e Schema do Prisma
│   └── schema.prisma        # Definição das tabelas relacionais
├── src/                     # Backend NestJS
│   ├── anime/               # Metadados e calendário da AniList
│   ├── manga/               # Integração Baka-Updates, MangaDex e AniList
│   ├── sync/                # Lógica de sincronização bidirecional (/sync/twoway)
│   └── user/ & auth/        # Gestão de utilizadores (login sem necessidade de email)
├── otaku-ui/                # Frontend React + Vite + Capacitor (Tailwind v4)
│   ├── android/             # Projeto nativo Android compilado pelo Capacitor
│   ├── src/                 
│   │   ├── pages/           # Dashboard, Biblioteca, Calendário, Perfil e Detalhes
│   │   ├── services/        
│   │   │   ├── apiBridge.ts # Comunicação entre API, SQLite local e Dexie DB
│   │   │   └── localDb.ts   # Esquema local Dexie DB do IndexedDB
│   │   └── context/         # Estados globais de categoria, temas e navegação
│   └── capacitor.config.ts  # Definições de compilação móvel do Capacitor
```

---

## 🛠️ Instalação e Configuração Local

### Requisitos Prévios
* **Node.js** (v18 ou superior)
* **Android Studio** (para compilação e teste móvel)

---

### 1. Configurar o Servidor (Backend NestJS)

Na pasta raiz do projeto:

1. **Instalar dependências:**
   ```bash
   npm install
   ```
2. **Configurar o ficheiro `.env`:**
   Cria um ficheiro `.env` na raiz do projeto com as seguintes variáveis:
   ```env
   DATABASE_URL="postgresql://utilizador:password@ep-cold-surf.eu-central-1.aws.neon.tech/otakutime?sslmode=require"
   JWT_SECRET="tua_chave_secreta_aqui"
   ```
3. **Gerar o Prisma Client:**
   ```bash
   npx prisma generate
   ```
4. **Aplicar ou sincronizar o Schema com a Base de Dados:**
   ```bash
   npx prisma db push
   ```
5. **Iniciar o backend em modo de desenvolvimento:**
   ```bash
   npm run start:dev
   ```
   *O backend ficará disponível em `http://localhost:3001`.*

---

### 2. Configurar o Cliente (Frontend React)

Navegar para a pasta `otaku-ui`:

1. **Instalar dependências:**
   ```bash
   cd otaku-ui
   npm install
   ```
2. **Configurar o ficheiro `.env` no Frontend (opcional):**
   Podes criar um `.env` dentro da pasta `otaku-ui` ou deixar que use o fallback predefinido no ficheiro `src/config.ts`:
   ```env
   VITE_API_URL="http://localhost:3001"
   ```
3. **Iniciar o servidor Vite:**
   ```bash
   npm run dev
   ```
   *O frontend ficará disponível em `http://localhost:5173`.*

---

### 3. Configurar a Aplicação Móvel (Android/Capacitor)

Para compilar e depurar a aplicação móvel:

1. **Gerar a pasta de build do React:**
   ```bash
   cd otaku-ui
   npm run build
   ```
2. **Sincronizar a build com o projeto Android:**
   ```bash
   npx cap sync
   ```
3. **Abrir o Android Studio para compilar/emular:**
   ```bash
   npx cap open android
   ```
4. **Configurar o ADB Reverse para ligação ao Servidor Local:**
   Se estiveres a depurar no teu telemóvel físico via cabo USB, corre o comando abaixo no terminal da tua máquina de desenvolvimento para permitir que o telemóvel envie pedidos para o teu servidor local:
   ```bash
   adb reverse tcp:3001 tcp:3001
   ```

---

## 💡 Comandos Úteis

* **Visualizar a Base de Dados (Interface Web Prisma Studio):**
  ```bash
  npx prisma studio
  ```
* **Aplicar alterações manuais ao Schema da Base de Dados:**
  ```bash
  npx prisma db push
  ```