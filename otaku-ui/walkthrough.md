# Walkthrough: Navegador Multi-Separadores Android Integrado

Implementámos com sucesso o navegador integrado premium (in-app browser) exclusivo para a plataforma Android no **Otaku-Time** com funcionalidades de usabilidade avançada, sandbox e atalhos de biblioteca personalizados.

---

## 🛠️ Alterações Efetuadas

### 1. 📱 Plugin Nativo Android (`MangaWebViewPlugin.java`)
Refatorámos o plugin nativo de Java de forma a torná-lo num navegador completo de múltiplos separadores:
* **Classe `WebTab`:** Estrutura interna para associar cada instância de `WebView` ao seu respetivo URL e título atual.
* **Barra Superior (Chrome-like Toolbar):**
  * **Botão Home (⌂):** Carrega a página inicial local (`https://local.otakutime.home`) no separador ativo.
  * **Barra de Endereço (`EditText`):** Campo editável para navegar para URLs ou pesquisar no Google.
  * **Espaçamento e Usabilidade:** Aumentámos o tamanho dos ícones (`21px` e `16px`) e margens físicas (`15px` nas laterais) dos botões da barra superior (`☆`, `✕` e `[N]`), garantindo um espaçamento de `30px` entre eles para evitar cliques indesejados.
* **Bloqueio de Redirecionamentos e Anúncios:**
  * **Sandbox de Navegação:** Bloqueia automaticamente redirecionamentos para hosts suspeitos e redes de anúncios.
  * **Exceção para Google:** Se a página atual for de pesquisa do Google (`google.com`, `google.pt`, etc.), o navegador permite livremente navegar para os links de resultados clicados pelo utilizador.
* **Associação à Biblioteca Nativa com Algoritmo de Sugestões:**
  * Ao favoritar um site (clicar na estrela `☆`), a app exibe um diálogo nativo perguntando se deseja associar o favorito a algum manga ou anime.
  * Se aceitar, abre um **Diálogo Premium de Seleção de Biblioteca** escuro (`#111827`) com barra de pesquisa.
  * **Algoritmo de Correspondência Inteligente (Smart Matching):** O nativo analisa o URL da página (ex: `/manga/solo-leveling-capitulo-1`) e extrai um candidato limpo (`"solo leveling"`).
  * **Cálculo de Pontuação (Word Scoring):** Pontua todos os mangas e animes da biblioteca com base nas palavras em comum. Itens que tenham correspondência aparecem no topo da lista.
  * **Secções no Diálogo:** Agrupa os resultados sob uma secção roxa de `"Sugestões de Associação"` e os restantes sob `"Todos os Conteúdos"`. A digitação de pesquisa oculta os cabeçalhos para manter os resultados diretos.
  * A escolha comunica-se com o React em segundo plano (`onAssociateBookmark`) para salvar o link no servidor.
* **Favoritos com Títulos Descritivos:**
  * A app guarda o título real da página como display name do favorito, em vez de apenas extrair o domínio base.
* **Exclusão de Favoritos Associados na Home:**
  * Atalhos rápidos que já estejam associados a algum manga ou anime na biblioteca são ocultados da grelha inicial do browser.
* **Separadores Não Persistentes:**
  * Removemos a persistência de separadores abertos de uma sessão para a outra para manter o desempenho limpo e focar nos atalhos diretos da biblioteca.

### 2. ⚛️ Frontend React (`Layout.tsx` & `DetailsPage.tsx`)
* **Isolamento por Utilizador:**
  * O ID do utilizador ativo (`user?.id` ou `"guest"`) é passado ao browser nativo para separar e proteger as listas de favoritos entre diferentes contas.
* **Botão de Atalho "LER NO SEPARADOR" / "ASSISTIR NO SEPARADOR":**
  * Na página de detalhes, se o conteúdo possuir links personalizados associados, exibe-se um botão proeminente.
  * Clicar no botão abre diretamente o navegador nativo. Se houver mais do que 1 link associado, abre um menu inferior premium permitindo escolher a fonte de leitura.

---

## 🧪 Como Testar no Dispositivo/Emulador

Para testar as alterações no teu ambiente local no Android:

1. **Compilar o Frontend:**
   * Executa o build de produção na pasta `otaku-ui`:
     ```powershell
     npm run build
     ```
2. **Sincronizar com o Android:**
   * Atualiza os ficheiros nativos no projeto Android:
     ```powershell
     npx cap sync android
     ```
3. **Instalar e Correr:**
   * Abre a pasta no Android Studio ou executa a compilação e instala-a no smartphone Android.
