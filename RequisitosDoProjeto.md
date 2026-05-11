# 📄 Requisitos do Projeto: OtakuTime

## 🎯 Requisitos Funcionais (O que o sistema faz)

* **Autenticação e Perfil:**
  * O utilizador deve poder criar conta, fazer login e gerir a sua sessão de forma segura.

* **Descoberta e Pesquisa:**
  * O sistema deve permitir a pesquisa de Animes e Mangas por título ou filtragem por género (via API AniList).
  * O sistema deve gerar recomendações personalizadas com recurso a IA, baseadas no histórico do utilizador ou através de *prompts* diretos (ex: "Quero um anime de desporto parecido com Haikyuu").

* **Gestão de Biblioteca (Tracking):**
  * O utilizador deve poder adicionar, atualizar e remover conteúdos da sua lista pessoal.
  * O utilizador deve poder atribuir diferentes estados de acompanhamento (ex: A ver/Lendo, Planeado, Concluído, Pausado, Desistiu).
  * O utilizador deve poder definir uma **prioridade (ex: 1 a 10)** para cada item, permitindo ordenar a sua biblioteca pelo que deseja ler/ver primeiro.
  * O sistema deve permitir incrementar/editar o número de episódios ou capítulos vistos/lidos.

* **Painel de Informações (Detalhes):**
  * O sistema deve exibir metadados ricos para cada conteúdo: tipo, capa, sinopse, data de lançamento, número total de episódios/capítulos, e quantidade atualmente disponível.
  * O sistema deve calcular ou extrair (via API ou LLM) as datas de lançamento de futuros episódios/capítulos.

* **Calendário Pessoal:**
  * O sistema deve disponibilizar uma vista de calendário que cruze os conteúdos que o utilizador está a acompanhar com as respetivas datas de lançamento de novos episódios.

## ⚙️ Requisitos Não Funcionais (Como o sistema funciona)

* **Arquitetura do Sistema:** * Frontend desenvolvido em React (com Tailwind CSS para a interface).
  * Backend desenvolvido em NestJS.
  * Comunicação entre frontend e backend via API REST.

* **Persistência de Dados:**
  * Os dados globais de animes/mangas e as listas dos utilizadores devem ser armazenados numa base de dados relacional (SQLite), gerida através do ORM Prisma.

* **Gestão de Recursos Excluídos (Regra de Negócio):**
  * Quando um utilizador remove um conteúdo da sua lista, a relação entre o utilizador e o conteúdo é destruída (ou ocultada via *soft delete* para manter o histórico de episódios vistos), mas o registo principal do Anime/Manga permanece na base de dados do sistema para otimização de consultas futuras.