# 🚀 Atualização Estrutural: OtakuTime v2.0

## [2026-05-14] - Chat Premium & Metadata Integration
- **Streaming de Chat (SSE):** Implementada resposta em tempo real do Ollama (Llama 3.1), proporcionando uma experiência de escrita natural.
- **Auto-Nomeação de Sessões:** O Bot agora gera títulos criativos para as conversas baseando-se na primeira mensagem do utilizador.
- **Links Externos Oficiais:** Adicionado suporte para capturar e exibir links da Lezhin, Tappytoon, MangaPlus, etc.
- **Database Schema (v3):** Adicionado campo `linksExternos` aos modelos de Anime e Manga.
- **UI Discovery:** Adicionada barra de pesquisa no seletor da "Minha Lista" e secção de links na vista de detalhes.

## 1. Reestruturação da Base de Dados (N-para-N)
Mudámos a arquitetura de dados para separar o conteúdo global das listas pessoais, garantindo maior escalabilidade e performance.

* **Catálogo Global (Anime/Manga):** A informação geral (título, sinopse, capa, total de episódios) é agora armazenada de forma centralizada usando o ID oficial da AniList. Isto evita duplicados e cria uma "cache" local.
* **Listas Pessoais (UserAnime/UserManga):** Criámos tabelas intermédias (pivô) que guardam apenas o progresso individual (episódio atual, status, data de adição).
* **Gestão de Cache:** Se um utilizador remover um anime da sua lista, a relação desaparece, mas os metadados do anime permanecem no catálogo global para otimizar pesquisas futuras e alimentar o modelo de IA.

## 2. Lógica de Tracking e Automação (Backend)
Implementámos inteligência no lado do servidor para melhorar a experiência de utilização:

* **Estados Oficiais (Enums):** Integração de estados técnicos rígidos: `WATCHING`, `PLANNED`, `COMPLETED`, `PAUSED`, `DROPPED`.
* **Progressão Inteligente:**
    * **Auto-Start:** Ao alterar o progresso de 0 para 1 episódio/capítulo, o status muda automaticamente para "Assistindo" ou "Lendo".
    * **Auto-Complete:** Ao atingir o último episódio disponível, o sistema marca o conteúdo como "Completo".
* **Localização:** O backend agora mapeia os estados técnicos para Português antes de os enviar para a interface.

## 3. Melhorias na Interface e UX (Frontend)
A experiência do utilizador foi refinada para ser mais fluída e intuitiva:

* **Controlo de Progresso:** Adição de botões de incremento `[ + ]` e decremento `[ - ]` diretamente na página de detalhes.
* **Optimistic UI:** A interface atualiza o progresso visualmente de forma instantânea, processando o pedido ao servidor em segundo plano para eliminar a perceção de latência.
* **Vista Unificada:** O componente de detalhes foi adaptado para funcionar tanto para conteúdos já presentes na lista como para novos resultados de pesquisa.

## 4. Ajustes Técnicos e Performance
* **Prisma 7:** Atualização do `schema.prisma` para as novas normas do Prisma 7, centralizando a gestão da base de dados via `prisma.config.ts`.
* **Refatoração de Controllers:** Limpeza de endpoints obsoletos e simplificação da API REST para lidar com os novos objetos aninhados.


# 📅 Atualização: Calendário e Inteligência de Lançamentos

Concluímos a implementação do Passo 2. O **OtakuTime** agora possui funcionalidades avançadas de agendamento e sincronização de datas em tempo real.

## 1. Infraestrutura de Dados
* **Esquema de Base de Dados:** Atualização do Prisma para incluir os campos `proximoEpisodioData` e `proximoEpisodioNumero` na tabela global de Animes.
* **Persistência Local:** Os metadados de lançamento são agora armazenados no SQLite, permitindo consultas rápidas sem dependência constante da API externa.

## 2. Inteligência de Lançamentos (Backend)
* **Integração AniList:** O backend foi configurado para extrair automaticamente o objeto `nextAiringEpisode` (contendo `airingAt` e `episode`) sempre que um conteúdo em lançamento é adicionado.
* **Conversão de Timestamps:** Implementação de lógica para converter os timestamps Unix da API em objetos `DateTime` compatíveis com o fuso horário local.

## 3. Interface: Calendário de Lançamentos (/calendar)
* **Vista Semanal:** Criação de uma nova página de Calendário com design moderno que exibe os próximos 7 dias de lançamentos.
* **Filtro Personalizado:** O calendário é dinâmico e focado no utilizador, exibindo apenas os animes que constam na "Minha Lista" e que possuem o status `RELEASING`.
* **Indicadores Visuais:** Inclusão de contagem de episódios e selos de "Confirmado" para datas obtidas via API oficial.

## 4. Navegação e UX
* **Acesso Rápido:** Adição de um novo botão de Calendário no Header principal, posicionado estrategicamente ao lado das ações de perfil.
* **Navegação Intuitiva:** Interface que permite alternar entre os dias da semana para visualizar o agendamento futuro de forma clara.

# ✨ Atualização Premium: Interface, Ranking e Descoberta

Transformámos o OtakuTime numa plataforma de aspeto "Premium", com foco em personalização e descoberta de conteúdos.

## 1. Redesign Visual Completo (UI/UX)
A interface foi reconstruída com uma estética moderna e minimalista:
*   **Glassmorphism Header:** Barra superior fixa com efeito de desfoque e transparência, mantendo a navegação sempre acessível.
*   **Layout Dinâmico:** Reorganização do cabeçalho com o seletor de Anime/Manga posicionado ao lado do logótipo para uma navegação mais rápida.
*   **Experiência Cinematográfica:** A página de detalhes agora apresenta um fundo dinâmico baseado na capa do conteúdo, com tipografia em negrito e transições suaves.
*   **Cards Premium:** Implementação de cartões com efeitos de elevação (*hover*), badges automáticas e sombras profundas.

## 2. Sistema de Ranking Pessoal
A funcionalidade de prioridade foi evoluída para um sistema de **Ranking Real**:
*   **Top 1, 2, 3...:** Os utilizadores podem agora definir a posição exata de cada item na sua fila de espera (#1, #2, etc.).
*   **Ordenação Automática:** A biblioteca organiza-se agora de forma ascendente (o #1 aparece primeiro), facilitando a gestão do backlog.
*   **Badge de Posição:** Cada capa na biblioteca exibe um selo com a sua posição no ranking pessoal do utilizador.

## 3. Descoberta e Filtros por Género
Expandimos a plataforma para permitir a descoberta de novos conteúdos sem sair do site:
*   **Genre Chips:** Barra horizontal com scroll suave contendo os géneros mais populares da AniList (Ação, Romance, Isekai, etc.).
*   **Pesquisa Híbrida:** Integração de filtros por género que funcionam em conjunto com a categoria selecionada.
*   **Novos Endpoints de Descoberta:** O backend foi atualizado para suportar pesquisas por género, trazendo os conteúdos mais populares de cada categoria via API externa.

## 4. Arquitetura Frontend Robusta
*   **Global Layout:** Implementação de um `Layout` universal que garante a presença do cabeçalho em todas as páginas da aplicação.
*   **MediaContext:** Centralização do estado global (Anime vs Manga e Lista vs Pesquisa), permitindo que a navegação seja fluida e que as preferências do utilizador persistam ao mudar de página.

# 🚀 Atualização: Dashboard de Acompanhamento e Navegação Fluida

A plataforma foi otimizada para o consumo diário, transformando a página inicial num centro de controlo inteligente para o utilizador.

## 1. Novo Dashboard de "Acompanhamento" (To-Watch/Read)
*   **Vista Dual-Column:** Substituímos a vista inicial estática por um painel dinâmico de duas colunas: **"VER ASSEGUIR"** (Anime) e **"LER ASSEGUIR"** (Manga).
*   **Filtro Automático:** O dashboard exibe apenas conteúdos que o utilizador está atualmente a consumir (`WATCHING`) e que possuem progresso pendente.
*   **Ações Instantâneas:** Inclusão de botões "VISTO" e "LIDO" diretamente nos cards do dashboard, permitindo atualizar o progresso com um clique sem sair da página inicial.

## 2. Inteligência de Progresso em Lançamentos
*   **Lógica de Lançamento:** Implementámos um sistema que deteta quando um conteúdo é infinito ou está em lançamento (sem total definido).
*   **Barra de Progresso Dinâmica:** A barra de progresso agora calcula a percentagem com base no **último episódio lançado** (ex: 12 / 24+) em vez de mostrar um erro ou ficar vazia.
*   **Tradução Automática:** Traduzimos todos os estados de lançamento (RELEASING, FINISHED, etc.) para Português na interface.

## 3. Experiência de Navegação Refinada
*   **Navegação Compacta:** Refatoração do Header para incluir botões dedicados de "Início" e "A Minha Lista", permitindo alternar rapidamente entre o dashboard de descobertas e a biblioteca pessoal.
*   **Reset Inteligente:** Configuração de um gatilho de reset global que limpa pesquisas, filtros e estados de visualização sempre que o utilizador clica em "Início", garantindo uma experiência sempre fresca.
*   **Correção de Mismatch de Categoria:** Resolvemos um problema crítico onde clicar num card de Anime no dashboard podia abrir detalhes de um Manga (e vice-versa) se o modo global estivesse incorreto.

## 4. Exploração de APIs Externas (Laboratório)
*   **Integração MangaDex:** Testámos a integração com a MangaDex API usando um sistema de *Smart Match* (validando Autor e Ano) para obter o número exato de capítulos lançados.
*   **Fallback Anime-Planet:** Implementámos um scraper experimental para o site Anime-Planet como fonte secundária de dados.
*   **Decisão de Arquitetura:** Por opção de simplicidade e performance, estas integrações externas foram removidas, mantendo a AniList como fonte única de verdade, mas preservando as melhorias visuais de "Lançando" baseadas nos metadados oficiais.

# 🤖 Atualização: Integração de Inteligência Artificial (Chatbot)

Iniciámos a implementação do assistente virtual inteligente do OtakuTime, utilizando tecnologia de LLM local.

## 1. Infraestrutura IA Local (Ollama)
*   **Conectividade:** Validámos a comunicação com o motor **Ollama** na porta padrão `11434`.
*   **Modelo de Linguagem:** Configuração baseada no **Llama 3.1 8B**, garantindo respostas rápidas e sem custos de API externa.

## 2. Backend: O Motor do Chat (`ChatModule`)
*   **ChatService:** Implementação do serviço central de IA com lógica de *Prompt Engineering*. Definimos um "System Prompt" que molda a personalidade do bot como um especialista Otaku amigável.
*   **Endpoint Seguro:** Criação da rota `POST /chat`, protegida por autenticação JWT, garantindo que apenas utilizadores autorizados acedem ao assistente.
*   **Formatação Markdown:** A IA foi instruída a responder usando Markdown (negritos, listas, tabelas) para facilitar a renderização rica no frontend.

## 3. Próximos Passos (UI/UX)
*   **Interface de Chat:** Criação da página de chat no React com suporte a histórico de mensagens e design "Premium".
*   **Streaming de Respostas:** Implementação de streaming para que as letras apareçam em tempo real.

# 📱 Atualização: Otimização Mobile (Android) & Portabilidade de Dados

Finalizámos a experiência móvel no Android e preparámos toda a infraestrutura para importação/exportação de dados entre plataformas (PC e Telemóvel).

## 1. Otimizações Exclusivas Mobile (Capacitor)
*   **Limpeza de Interface:** Remoção da barra de filtros por género na pesquisa da versão Android para maximizar a área útil de ecrã, mantendo a versão Web/PC intocada via `Capacitor.isNativePlatform()`.
*   **Calendário Responsivo:** Refatoração do seletor de datas no Calendário para um formato compacto adaptado a ecrãs móveis, eliminando problemas de transbordamento horizontal.

## 2. Página de Perfil & Definições (/profile)
*   **Centro de Controlo Premium:** Nova página com design de nível profissional, controlo de preferências de utilizador e gestão de conta.
*   **Gestão de Preferências:** Suporte à personalização de idioma, filtro de conteúdos NSFW e seleção de temas visuais.

## 3. [Removido] Motor de Sincronização Bidirecional (Backend NestJS)
*   **Remoção de Código:** A lógica de sincronização bidirecional em tempo real (`handleTwoWaySync`) foi removida do backend em prol de um modelo resiliente focado em Backups JSON manuais e estabilidade da base de dados.

# ☁️ Atualização: Nuvem PostgreSQL, Deploy Render & Temas Premium [2026-06-06]

Concluímos a transição de um ecossistema estritamente local para um ambiente moderno em nuvem com alta capacidade de personalização.

## 1. Migração para PostgreSQL (Prisma)
*   **Nuvem Ativa:** Atualizámos o provider do Prisma para PostgreSQL no `schema.prisma` e realizámos a migração dos dados locais. A base de dados principal é agora alojada remotamente no **Neon DB**.
*   **Configuração Resiliente:** Configuração de pool de conexões com suporte a certificados SSL auto-assinados, garantindo estabilidade e proteção nos acessos.

## 2. Deploy em Produção (Render)
*   **Backend Autónomo:** O backend NestJS está hospedado no **Render**, configurado com integração contínua (CI/CD) a partir do branch `main` do repositório GitHub.
*   **Robustez no Build:** Scripts de postinstall configurados para gerar automaticamente o Prisma Client durante a compilação remota, eliminando falhas de deploy.

## 3. [Removido] Modos Híbridos de Ligação no Android
*   **Always Online:** A opção de alternar para o modo offline (IndexedDB/Dexie DB) foi descontinuada e removida em prol de um modelo exclusivamente online conectado diretamente à base de dados centralizada no Neon DB, garantindo consistência total do progresso do utilizador.

## 4. Personalização Avançada & Temas Premium
*   **Modo Claro (Light Mode):** Criação de um tema claro para toda a interface gráfica do projeto, oferecendo melhor usabilidade em ambientes iluminados.
*   **Seletor de Paleta Cromática:** Adicionados 6 temas cromáticos distintos para os destaques e botões da UI (Roxo Clássico, Laranja Shounen, Vermelho Akatsuki, Verde Mutsu, Roxo Solo Leveling e Azul Visionário).
*   **Preferências do Utilizador:** Adicionado suporte no perfil para gerir idioma preferido (Português/Inglês) e controlo de exibição de conteúdo adulto (NSFW).