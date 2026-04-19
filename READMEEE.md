# Otaku Time Pro

O teu gestor inteligente de Anime & Manga, alimentado por Inteligência Artificial.

Otaku Time é uma plataforma Fullstack concebida para entusiastas que procuram mais do que uma simples lista. É um ecossistema que organiza, converte fusos horários e utiliza LLMs (Large Language Models) para monitorizar lançamentos, especialmente de obras underground onde a informação é escassa.


## Diferenciais do Projeto
IA-Powered Tracking: Integração com o modelo Llama para extração e limpeza de metadados de transmissões JST (Japan Standard Time).

Smart Timezone Conversion: Converte automaticamente as estreias japonesas para o horário local (Portugal/Brasil), garantindo que nunca perdes um episódio.

Gestão de Prioridades: Sistema de ordenação personalizado para mangas, resolvendo as limitações das plataformas tradicionais.

Arquitetura Moderna: Desenvolvido com uma separação clara entre Backend (NestJS), Frontend (Next.js) e um Microserviço de IA (Python).


## Arquitetura do Sistema
graph LR
    A[Frontend Next.js] -- API Requests --> B[Backend NestJS]
    B -- Data Sync --> C[(PostgreSQL)]
    B -- Prompting --> D[AI Microservice - Llama]
    D -- Parsing --> E[Jikan API]

## Tecnologias Utilizadas
###  Back end
NestJS: Framework Node.js progressiva para construção de aplicações eficientes.

TypeScript: Superset de JavaScript que adiciona tipagem estática.

Prisma ORM: Para gestão de base de dados e consultas seguras.
### IA & Data
Python: Engine para processamento de linguagem natural.

Ollama/Llama 3: Modelo de linguagem local para automação de horários.

Jikan API: Wrapper oficial da base de dados MyAnimeList.

## objetivo de desenvolvimento 
Este projeto foi criado para elevar o nível de acompanhamento de mídia otaku, migrando de uma lógica de scripts simples para uma aplicação escalável e profissional, focada na experiência do utilizador e na precisão de dados.

## Diagramas de classes
:::mermaid
classDiagram
class Manga {
    +String titulo
    +float numCapitulos
    +String capaUrl
    +String statusLancamento
    +String statusLeitura
    +int capAtual
    +List~String~ generos
    +String autor
    +String descricao
    +int priorida
}

class Anime {
    +String titulo
    +String capaUrl
    +String estadoVisualização
    +String statusLancamento
    +List~String~ generos
    +String descricao
    +Date dataLancamento
    +int numTemporadas
    +int numEpisodios
}

class User {
    +String nome
    +String email
    +String password
    +List~Manga~ listaManga
    +List~Anime~ listaAnime
}

User "1" -- "*" Manga : segue
User "1" -- "*" Anime : segue
:::

## guia das pastas
### gerir pastas 
na pasta priasma é onde ocorre as dependencias das tabelas

### modulos
manga/
├── dto/                    # (Data Transfer Objects) Define as regras do que o utilizador envia
│   ├── create-manga.dto.ts # "Para criar um manga, preciso obrigatoriamente do título"
│   └── update-manga.dto.ts # "Para atualizar, o título é opcional"
├── entities/               # A classe que representa o Manga no código
│   └── manga.entity.ts
├── manga.controller.ts     # As ROTAS (Onde o utilizador "bate" com o pedido)
├── manga.module.ts         # O "Cimento" que liga tudo isto
└── manga.service.ts        # A LÓGICA (Onde o código decide o que fazer)

## passo a passo de construcao

1. criar o ambiente : npx @nestjs/cli new .
2. instalar o prima : npm install @prisma/client@6 prisma@6 --save-dev
3. iniciar o prisma : npx prisma init --datasource-provider sqlite
4. criar as tabelas : npx prisma db push
5. gerar os modulos das tabelas usando rest api e Y (substituir pelo nome da tabela): npx @nestjs/cli generate resource manga --no-spec
6. criar a ponte entre as tabelas e a bas e de dados: 6.1 npx @nestjs/cli generate module prisma         
6.2npx @nestjs/cli generate service prisma
7. correr o server: npm run start:dev