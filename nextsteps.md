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

### Passo 1: Sincronização WebSockets em Tempo Real
Substituir o polling manual de background por uma ligação WebSocket persistente (via Socket.io no NestJS) para atualizar o progresso entre o telemóvel e o PC instantaneamente sempre que houver conexão.

### Passo 2: Estatísticas de Leitura/Visualização Avançadas
Criar um painel de análise gráfica que resuma os géneros mais consumidos, tempo total gasto a assistir/ler e projeções de finalização do backlog atual.

### Passo 3: Remoção do Chatbot de IA (Otaku Bot)
Para evitar que utilizadores externos gastem tokens ou sobrecarreguem o servidor com chamadas à API de IA, será efetuada a limpeza completa da funcionalidade de IA:
* **Frontend:** Remover a página de chat e respetivas rotas/ícones de navegação.
* **Backend:** Eliminar o `ChatModule`, controllers, services e endpoints `/chat`.
* **Base de Dados:** Limpar as tabelas `ChatSession` e `ChatMessage` do schema Prisma e base de dados.

### Passo 4: Distinção entre Anime Série / Filme e Agregação por Temporadas
Planear e implementar a diferenciação de formatos e o agrupamento de sequelas:
* **Diferenciação de Formato:** Criar uma distinção clara entre séries de TV/OVA/ONA (múltiplos episódios) e filmes/Movies (um único episódio/filme), adaptando os controlos e estatísticas de progresso no frontend e backend.
* **Agregação por Franquia/Temporadas:** Agrupar ou associar títulos relacionados que pertencem à mesma franquia ou a diferentes temporadas (e.g. Temporada 1, Temporada 2, Filmes prequela/sequela), organizando a biblioteca de forma mais agregada e intuitiva.