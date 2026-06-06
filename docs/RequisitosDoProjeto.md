# 📄 Requisitos do Projeto: OtakuTime

## 🎯 Requisitos Funcionais (O que o sistema faz)

* **Autenticação, Perfil e Preferências:**
  * O utilizador deve poder criar conta, fazer login e gerir a sua sessão de forma segura.
  * O utilizador deve poder configurar preferências diretamente no seu perfil, incluindo idioma da interface (PT/EN), tema visual (Claro/Escuro), paletas de cores personalizadas e filtragem de conteúdo NSFW (adulto).

* **Descoberta e Pesquisa:**
  * O sistema deve permitir a pesquisa de Animes e Mangas por título ou filtragem por género (via API AniList).

* **Gestão de Biblioteca (Tracking):**
  * O utilizador deve poder adicionar, atualizar e remover conteúdos da sua lista pessoal.
  * O utilizador deve poder atribuir diferentes estados de acompanhamento (ex: A ver/Lendo, Planeado, Concluído, Pausado, Desistiu).
  * O utilizador deve poder definir uma **prioridade (ex: 1 a 10)** para cada item, permitindo ordenar a sua biblioteca pelo que deseja ler/ver primeiro.
  * O sistema deve permitir incrementar/editar o número de episódios ou capítulos vistos/lidos.

* **Painel de Informações (Detalhes):**
  * O sistema deve exibir metadados ricos para cada conteúdo: tipo, capa, sinopse, data de lançamento, número total de episódios/capítulos, e quantidade atualmente disponível.
  * O sistema deve calcular ou extrair (via API) as datas de lançamento de futuros episódios/capítulos.

* **Calendário Pessoal:**
  * O sistema deve disponibilizar uma vista de calendário que cruze os conteúdos que o utilizador está a acompanhar com as respetivas datas de lançamento de novos episódios.

* **Suporte Mobile & Offline-First:**
  * A aplicação deve funcionar nativamente em dispositivos móveis (Android via Capacitor) com armazenamento local (Dexie DB/IndexedDB) para garantir navegação fluida em modo offline.
  * O sistema deve suportar renderização condicional para otimizar o ecrã móvel (ex: ocultação de filtros de género redundantes na pesquisa), mantendo a integridade da versão Web para PC.

* **Sincronização Bidirecional (Two-Way Sync) e Modos de Ligação:**
  * O sistema deve permitir a fusão inteligente de dados entre o armazenamento local móvel e a base de dados principal do servidor via Wi-Fi, Cabo USB ou Cloud.
  * O utilizador móvel deve poder alternar ativamente entre o **Modo Online (Nuvem)** (ligação direta e em tempo real à base de dados PostgreSQL no Render/Neon DB) e o **Modo Offline (Local)** (guardar os dados localmente no Dexie DB).

## ⚙️ Requisitos Não Funcionais (Como o sistema funciona)

* **Arquitetura do Sistema:** 
  * Frontend desenvolvido em React (com Tailwind CSS para a interface) e encapsulado via Capacitor para Android.
  * Backend desenvolvido em NestJS.
  * Comunicação entre frontend e backend via API REST e sincronização em lote.

* **Persistência de Dados:**
  * Os dados globais de animes/mangas e as listas dos utilizadores devem ser armazenados numa base de dados relacional na nuvem (PostgreSQL via Neon DB), gerida através do ORM Prisma.
  * Em dispositivos móveis, no Modo Offline, os dados são geridos localmente via Dexie DB (IndexedDB) antes de serem sincronizados com o servidor. No Modo Online, comunicam em tempo real com a base de dados central.

* **Gestão de Recursos Excluídos (Regra de Negócio):**
  * Quando um utilizador remove um conteúdo da sua lista, a relação entre o utilizador e o conteúdo é destruída (ou ocultada via *soft delete* para manter o histórico de episódios vistos), mas o registo principal do Anime/Manga permanece na base de dados do sistema para otimização de consultas futuras.