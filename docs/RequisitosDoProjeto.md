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

* **Suporte Mobile:**
  * A aplicação deve funcionar nativamente em dispositivos móveis (Android via Capacitor), lendo e escrevendo diretamente na base de dados central na nuvem.
  * O sistema deve suportar renderização condicional para otimizar o ecrã móvel (ex: ocultação de filtros de género redundantes na pesquisa), mantendo a integridade da versão Web para PC.

* **Dados Centralizados na Nuvem e Portabilidade:**
  * A biblioteca do utilizador deve estar sempre sincronizada entre dispositivos (Web e Android), já que todos comunicam em tempo real com a mesma base de dados PostgreSQL (Aiven), através da API alojada no Render.
  * O utilizador deve poder exportar a sua biblioteca para um ficheiro JSON de backup e restaurá-la mais tarde.

## ⚙️ Requisitos Não Funcionais (Como o sistema funciona)

* **Arquitetura do Sistema:** 
  * Frontend desenvolvido em React (com Tailwind CSS para a interface) e encapsulado via Capacitor para Android.
  * Backend desenvolvido em NestJS.
  * Comunicação entre frontend e backend via API REST.

* **Persistência de Dados:**
  * Os dados globais de animes/mangas e as listas dos utilizadores devem ser armazenados numa base de dados relacional na nuvem (PostgreSQL no Aiven), gerida através do ORM Prisma.
  * Não existe armazenamento local de dados da biblioteca: tanto a versão Web como a Android comunicam sempre com a base de dados central.

* **Gestão de Recursos Excluídos (Regra de Negócio):**
  * Quando um utilizador remove um conteúdo da sua lista, a relação entre o utilizador e o conteúdo é apagada, mas o registo principal do Anime/Manga permanece na base de dados do sistema para otimização de consultas futuras.