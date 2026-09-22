# Diretrizes do Projeto VozPlay

## 1. Idioma e Comunicação
- Fale, explique, desenvolva e documente sempre em português brasileiro (pt-BR).
- Todo texto voltado ao usuário, mensagens no chat, resumos, documentações de código, rótulos de interface e comentários devem utilizar português do Brasil de forma consistente, elegante e natural.

## 2. Visão Geral da Plataforma VozPlay
O **VozPlay** é uma plataforma profissional de karaokê desenvolvida para bares, restaurantes, lounges e eventos. O sistema adota uma arquitetura full-stack desacoplada e sincronizada em tempo real via WebSockets, atendendo a 5 perfis operacionais distintos:

1. **Participante (PWA Mobile)**: Aplicativo web progressivo responsivo para smartphones. Permite escanear o QR Code da mesa/telão, validar o código rotativo de presença física de 4 dígitos, pesquisar músicas no catálogo com filtros de gênero, escolher a versão (Karaokê, Acústico, Ao Vivo), transpor o tom de -3 a +3 semitons, gerenciar playlist pessoal e disparar reações em tempo real para o telão.
2. **Controlador (Operador de Mesa de Som)**: Mesa de mixagem e controle de fila. Fornece código de presença com validade de 60 segundos, controles de reprodução (Tocar, Pausar, Pular, Volume Master), DJ Soundboard com efeitos sonoros de estúdio (palmas, vinhetas, arerê) e cancelamento justo de participantes ausentes com recálculo automático da fila.
3. **Supervisor / Caixa (Autoridade Geral)**: Painel de gestão administrativa e financeira. Permite iniciar, pausar e prorrogar sessões (+15m, +30m, +60m), aplicar encerramento pontual seguro (evitando overflow de horário), acionar Assunção Emergencial (*Emergency Takeover* com renovação imediata de credenciais), emitir avisos na TV e exportar leads coletados para campanhas de marketing (WhatsApp / LGPD).
4. **TV Telão (Lounge Display)**: Interface 10-foot UI para Smart TVs e projetores. Consome exclusivamente o `TVSessionDTO` (nunca expondo telefones, tokens ou dados sensíveis de clientes), exibe letras sincronizadas, QR Code de conexão no rodapé, painel de reações da plateia ao vivo e telas de transição com pontuação simulada de karaokê (*Voz de Ouro*, *Show de Carisma*).
5. **Acompanhar Minha Vez (Link Público / Tracker)**: Rota pública leve para o cliente monitorar sua posição na fila pelo WhatsApp ou navegador, sem necessidade de login.

## 3. Arquitetura Técnica & Padrões
- **Servidor Core**: Node.js com Express e TypeScript (`server.ts`), atuando como backend REST versionado (`/api/v1/*`) e servidor de WebSockets autoritativo (`wsServer`).
- **Frontend**: React 19 com Vite, Tailwind CSS, Lucide Icons e Framer Motion.
- **Porta & Rede**:
  - A porta de escuta do container é estritamente **3000** (host `0.0.0.0`).
  - Tanto o tráfego HTTP quanto o tráfego WebSocket compartilham a porta 3000.
- **Domínio Oficial**: `vozplay.ai.slz.br`.
- **Banco de Dados**:
  - DDL relacional documentado em `schema.sql` (PostgreSQL 16).
  - Camada de dados em memória (`server/db.ts`) com seeding dinâmico e suporte a persistência SQL.
- **Segurança & Privacidade**:
  - O DTO da TV (`TVSessionDTO`) **JAMAIS** deve conter dados pessoais de participantes (WhatsApp, identificadores internos ou tokens).
  - Códigos de presença possuem expiração máxima de 60 segundos para assegurar a presença física do cantor na mesa de som.

## 4. Módulo de Ajuda & Documentação
- A interface global conta com a **Central de Ajuda & Guia Operacional** (`src/components/common/HelpModal.tsx`), acessível a qualquer momento pelo cabeçalho superior.
- Cobre tutoriais específicos para Participante, Controlador, Supervisor, Telão TV e Guia DevOps de Deploy.

## 5. Diretrizes de Deploy & DevOps
- **Docker Compose**: `docker compose up --build -d` inicializa a aplicação VozPlay e o container PostgreSQL com `schema.sql` montado em `/docker-entrypoint-initdb.d/init.sql`.
- **Build de Produção**: `npm run build` executa o Vite build e empacota o servidor em `dist/server.cjs` via esbuild.
- **Execução**: `npm start` roda `node dist/server.cjs`.
- **Variáveis de Ambiente**: Declaradas obrigatoriamente no `.env.example` (`PORT`, `NODE_ENV`, `DATABASE_URL`, `DOMAIN`).
