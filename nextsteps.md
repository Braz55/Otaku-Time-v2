# Estado do Projeto & Próximos Passos

## ✅ Concluído (Fases Recentes)

### 1. Sorteios Aleatórios Inteligentes -> foram apagados com a nova interfasse

### 2. na aba de search ele n carrega a biblioteca,
 devia ver se o id do anime ou manga ja esta presente na biblioteca

### 3. um anime que esteja em lancamento se marcar o ultimo ep disponivel como visto ele vai marcar como concluido
rever toda a logica de ver quando esta concuido, além disso rever a cena de quando um anime ainda n estreeou lee vai aora que lista, idealmente eria para planead e quando estreasse seria mudado para a ver 

### 4. melhorar o sistema de sincronizacao 
ever tmb as notificacoes, algumas aparecem dupicadas, tipo a dizer que o anime estreou e que o ep 1 saiu

### 5. rever tratamento dos ep espessiais e como sao tratados no lancamento e de maneira geral

### 6. Serviço de Auto-Ping (Keep-Awake)
* **Keep-Awake Dinâmico:** Implementado um serviço que mantém o backend ativo durante 2 horas, acionado automaticamente a partir de ambas as plataformas cliente (Web e Android/Capacitor) para evitar cold starts durante o uso.

### 7. Reativação e Expansão de Listas Personalizadas (Coleções Manuais)
* **Navegação Integrada:** Links adicionados ao menu lateral (Desktop) e à barra inferior (Mobile) usando o ícone `format_list_bulleted`.
* **Gestão na Página de Detalhes:** Adicionado botão e modal interativo "GERIR NAS LISTAS" na página de detalhes de cada anime/manga.
* **Pesquisa e Ordenação Manual:** Inclusão de um campo de pesquisa e adição direta de itens da biblioteca na página de detalhes da lista. Drag & Drop (HTML5) para reordenação manual na Web e setas de ordenação para mobilidade.
* **Salvamento Diferido & Bloqueador de Navegação:** Botão "Guardar Alterações" ativado dinamicamente para salvar reordenações/edições de uma só vez. Alerta de navegação implementado usando `window.hasUnsavedChanges` no Layout, botões internos e retrocesso físico Android (Capacitor) para evitar perda de dados sem depender do problemático hook `useBlocker` do React Router.


### 8. posso separar notificacoes de amnda das de anime

### 9. na pag do up next o primeiro ep de uma nova temporada aparece como sendo o ep seguinte da temporada anterior
ex: hana kimi o ep 1 da temporada 2 aorece como ep 13, para tal rever como a temporada a que o ep faz parte é acrregada  
---

