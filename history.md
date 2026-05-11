# 🚀 Atualização Estrutural: OtakuTime v2.0

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