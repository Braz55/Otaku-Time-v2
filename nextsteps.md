# Estado do Projeto & Próximos Passos

## ✅ Concluído (Fases Recentes)

### 1. Sorteios Aleatórios Inteligentes (Raffle/Gacha)
Implementámos dois botões de sorteio com ícones e comportamentos distintos no frontend:
* **Sorteio 1: Aleatório Global (AniList):** Localizado na barra de pesquisa (ícone `casino` de dado, usando a cor secundária ativa do tema). Sorteia um rank de popularidade de 1 a 2000 e puxa o resultado correspondente da API GraphQL da AniList, abrindo os detalhes do conteúdo sorteado automaticamente.
* **Sorteio 2: Sorteio Planeado (Biblioteca):** Localizado no cabeçalho da biblioteca (ícone `shuffle`). Filtra os títulos locais em estado `PLANNED` (Planeados) e executa um sorteio probabilístico em cascata:
  1. *Prioridade:* Escolhe a prioridade (1 a 10) usando pesos específicos (Prioridade 1 = 35%, ..., Prioridade 10 = 1%) garantindo que prioridades mais altas tenham muito mais chances, mas prioridades baixas mantenham uma chance não-nula.
  2. *Estado de Publicação:* Define se deve ser um título finalizado (75% de chance para `FINISHED`) ou não finalizado (25% de chance).
  3. *Seleção:* Filtra e seleciona um item aleatório correspondente (com re-sorteio de até 100 tentativas em caso de ausência de correspondências e fallback seguro).

### 2. Resolução de Ecrã Preto no Android (Compatibilidade & Cache)
* **Compatibilidade ES2020:** Ajustado o target de compilação do TypeScript e do Vite para `es2020` de forma a garantir retrocompatibilidade com WebViews e navegadores Android mais antigos.
* **Recuperação de Cache e Loader:** Adicionado um script de interceção em `index.html` para detetar e contornar erros de carregamento de recursos estáticos obsoletos causados pelo cache do navegador móvel após deploys (recarregando a página automaticamente com proteção contra loop), juntamente com um loader premium temporário para evitar ecrãs pretos.

### 3. Simplificação Visual de Perfil & Login
* **Cabeçalho Limpo:** Removidos os contadores e badges de `Animes: X` e `Mangas: Y` do cabeçalho da página de Perfil para um aspeto mais limpo.
* **Remoção de Ferramentas de Diagnóstico:** Removidos o botão e o painel de diagnóstico de IP/Wi-Fi na tela de Login, e ocultado o botão de reset global da biblioteca no Perfil.
* **Remoção de Variáveis Não Usadas:** Limpeza completa no código de variáveis locais e imports para evitar erros com `noUnusedLocals`.

### 4. Correções de Estabilidade e UX
* **Bloqueio do Seletor no Cabeçalho:** O cabeçalho deteta quando o utilizador está na página de detalhes e desativa/bloqueia a troca manual de categoria (Anime/Manga) com cursor de bloqueio e opacidade reduzida, prevenindo inconsistências.
* **Resolução de Crash no Chat da LLM:** Corrigido o crash ao abrir sugestões da biblioteca de manga no chat AI através da padronização e nivelamento (flattening) das respostas do backend `/manga`.
* **Remoção da Verificação de E-mail:** Removido por completo o fluxo de envio de email e validação de registo, passando a permitir registo e login direto.
* **Responsividade Móvel via React Hook:** Substituída a verificação estrita de plataforma nativa pelo hook flexível `useIsMobile`, otimizando a responsividade no browser do telemóvel.

### 5. Sincronização Inteligente Neon DB (Cold Start)
* **Refatoração da Sincronização:** Quando o servidor NestJS acorda de um cold start, verifica a data da última sincronização. Se tiver passado mais de 4 horas, é desencadeada uma sincronização em segundo plano da base de dados Neon DB com a AniList.

### 6. Serviço de Auto-Ping (Keep-Awake)
* **Keep-Awake Dinâmico:** Implementado um serviço que mantém o backend ativo durante 2 horas, acionado automaticamente a partir de ambas as plataformas cliente (Web e Android/Capacitor) para evitar cold starts durante o uso.

### 7. Reativação e Expansão de Listas Personalizadas (Coleções Manuais)
* **Navegação Integrada:** Links adicionados ao menu lateral (Desktop) e à barra inferior (Mobile) usando o ícone `format_list_bulleted`.
* **Gestão na Página de Detalhes:** Adicionado botão e modal interativo "GERIR NAS LISTAS" na página de detalhes de cada anime/manga.
* **Pesquisa e Ordenação Manual:** Inclusão de um campo de pesquisa e adição direta de itens da biblioteca na página de detalhes da lista. Drag & Drop (HTML5) para reordenação manual na Web e setas de ordenação para mobilidade.
* **Salvamento Diferido & Bloqueador de Navegação:** Botão "Guardar Alterações" ativado dinamicamente para salvar reordenações/edições de uma só vez. Alerta de navegação implementado usando `window.hasUnsavedChanges` no Layout, botões internos e retrocesso físico Android (Capacitor) para evitar perda de dados sem depender do problemático hook `useBlocker` do React Router.

---

## 🔮 Próximos Passos (Planeamento)

### Passo 1: Transição do Módulo de Anime/Vídeo para a API do TMDB (Estilo TV Time)
Substituir a integração da AniList por uma integração com a API do TMDB para unificar temporadas e expandir a aplicação para séries ocidentais e filmes.
* **Fase 1.1: Adaptações de Base de Dados (Prisma Schema):**
  * Atualizar o model `Anime` para atuar como `TVShow / Movie` do TMDB (ID mapeado para o TMDB, campo `formato` para `'TV'` ou `'MOVIE'`).
  * Adicionar campo JSON `proximosEpisodios` no model `Anime` para guardar as datas de lançamento de todos os episódios futuros da temporada ativa.
  * Modificar `UserAnime` para adicionar os campos `seasonAtual` (Int, padrão 1) e `epAtual` (Int, representando o progresso da temporada ativa).
* **Fase 1.2: Refatoração da API no Backend (NestJS):**
  * Criar um serviço de integração com a API do TMDB para gerir a pesquisa (séries/filmes) e puxar os dados completos de temporadas e episódios.
  * Atualizar a lógica de importação (`/anime/import`) para guardar a série completa e a lista de episódios da temporada ativa.
  * Atualizar o endpoint de incremento de progresso para suportar `season` e `episode` e gerir a conclusão de temporadas.
* **Fase 1.3: Sincronização Inteligente de Lançamentos:**
  * Atualizar o cron job de sincronização externa para correr a cada 12/24 horas e atualizar dados do TMDB (novos episódios, adiamentos, mudança de status).
  * Criar uma verificação local frequente (de hora a hora) que analisa `proximosEpisodios` e gera notificações automaticamente assim que o horário de um episódio passa, sem fazer chamadas de rede externas.
* **Fase 1.4: Refatoração do Frontend (React + Vite):**
  * **Pesquisa & Exploração:** Adaptar para devolver resultados únicos agrupados do TMDB.
  * **Biblioteca:** Exibir apenas 1 card representativo por série com o progresso estruturado (ex: "T2: Ep 3/12").
  * **Página de Detalhes:** Criar um ecrã unificado com o seletor de temporadas e a lista de episódios com checkmarks (estilo TV Time), permitindo acompanhar o progresso episódio a episódio e temporada a temporada.
  * **Calendário:** Mapear a agenda de lançamentos lendo as datas de todos os episódios futuros guardados no campo `proximosEpisodios`.

### Passo 2: Sincronização WebSockets em Tempo Real
Substituir o polling manual de background por uma ligação WebSocket persistente (via Socket.io no NestJS) para atualizar o progresso entre o telemóvel e o PC instantaneamente sempre que houver conexão.

### Passo 3: Estatísticas de Leitura/Visualização Avançadas
Criar um painel de análise gráfica que resuma os géneros mais consumidos, tempo total gasto a assistir/ler e projeções de finalização do backlog atual.