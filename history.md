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