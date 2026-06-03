# Próximos passos de implementação/futuras funcionalidades

## Passo 1: A Base de Dados na Nuvem (PostgreSQL)
Abandonar o SQLite (que guarda tudo num ficheiro local) e passar para o PostgreSQL. Como estás a usar o Prisma, a mudança de código é quase nula (só mudas o `provider` no `schema.prisma`).

* **Onde alojar:** Usas o Supabase ou o Neon DB.
* **Como funciona:** Crias uma conta gratuita e eles dão-te um link de ligação (uma Connection String), algo do género: `postgresql://pedro:password@ep-cold-surf.eu-central-1.aws.neon.tech/otakutime`. Colocas isso no teu ficheiro `.env` (variável `DATABASE_URL`) e já está! A base de dados passa a estar na nuvem.

## Passo 2: O Servidor Backend (NestJS)
O teu código NestJS precisa de estar a correr num servidor para ouvir os pedidos da tua app.

* **Onde alojar:** Usas o Render ([render.com](https://render.com)) ou o Railway ([railway.app](https://railway.app)).
* **Como funciona:** Ligas a plataforma ao teu repositório do GitHub. O Render vai ler o teu código NestJS e colocar o servidor no ar automaticamente. Ele dá-te um link público e seguro, por exemplo: `https://api-otakutime.onrender.com`.
* **A Magia:** Sempre que fizeres um `git push` com código novo no GitHub, o Render reconstrói e atualiza o servidor sozinho!

## Passo 3: O Frontend e a App Android
Agora que o teu backend e a base de dados estão a viver na internet, o resto é super fácil.

* **No teu site Web:** Podes alojar a parte visual (React) gratuitamente na Vercel ou no Netlify.
* **Na tua App Android (Capacitor):** Vais ao código onde antes tinhas `http://192.168.1.85:3001` (ou outro IP local) e trocas pela tua nova API online (ex: `https://api-otakutime.onrender.com`).
* **O Resultado:** Quer estejas no ginásio em Vila Real com 5G, quer estejas num café no Porto, a app fala sempre com a nuvem de forma instantânea. Mudas de telemóvel? É só instalar a app, os dados estão todos seguros na nuvem!

---

> [!NOTE]
> Esta transição do "funciona no meu PC" para "funciona na internet para qualquer pessoa" é o que vai dar um peso gigante ao teu portefólio para as candidaturas de mestrado. É o selo de qualidade de que sabes levar um projeto até ao fim.