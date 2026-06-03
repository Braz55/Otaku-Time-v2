# Próximos passos de implementação/futuras funcionalidades

## Engenharia de Dados & API do MangaUpdates
Criar o script isolado playground-parser.ts: Um ambiente de testes fechado para escreveres a lógica de tratamento de dados (usando Expressões Regulares/RegEx). O objetivo é pegar no texto bruto da API do MangaUpdates (ex: "Vol.1 Ch.45", "Season 2 Ch.1") e organizá-lo direitinho por temporadas, capítulos e especiais, limpando duplicados antes de injetar isso no NestJS.

## Infraestrutura Móvel & Sincronização (Android ↔️ PC)
Script/Teste Isolado de Conectividade: Resolver o bloqueio de comunicação entre o teu telemóvel Android e o servidor local.

Configuração de Rede: Descobrir o teu IPv4 local (ipconfig), configurar o CORS no main.ts do NestJS (origin: '*') e abrir a porta 3001 na Firewall do Windows para o telemóvel conseguir descarregar e sincronizar os teus dados via Wi-Fi.

## Evolução da Base de Dados (Prisma)
Migração Segura: Atualizar o teu schema.prisma para incluir os campos de links personalizados (customLink) e as novas datas dos capítulos como campos opcionais (?).

Correr a Migration: Executar o npx prisma migrate dev para atualizar o SQLite no teu telemóvel sem o risco de apagar ou perder os mangás que já tens lá adicionados.

## Sistema de Backup (Portabilidade)
Exportação Universal em JSON: Criar a rota no NestJS e o botão na interface do Android para gerar um ficheiro .json com a tua lista, estados e progresso, garantindo que os teus dados estão sempre seguros e fáceis de migrar.

## Dockerização (Fase Final)
Criação de Contentores: Quando tudo estiver a funcionar a 100%, criar as imagens Docker e o ficheiro docker-compose.yml para isolar o ecossistema Web e o Processador (Backend), preparando o projeto para um futuro deploy na nuvem e deixando o teu portefólio com um nível super profissional para o ISEP.