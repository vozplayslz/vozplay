# 🎤 VozPlay - Plataforma Profissional de Karaokê Multi-Cliente

> **Domínio Oficial:** [vozplay.ai.slz.br](https://vozplay.ai.slz.br)  
> **Versão:** 1.2.0 (Beta Pro Lounge)  
> **Licença:** Apache-2.0

O **VozPlay** é uma solução completa de karaokê corporativo e comercial desenvolvida sob medida para bares, restaurantes, lounges de entretenimento e eventos corporativos. O sistema opera em uma arquitetura desacoplada e sincronizada em tempo real via WebSockets, conectando clientes, operadores de som, gerência e telões de TV de forma harmônica e sem atritos.

---

## 📑 Índice
1. [Perfis de Acesso & Interfaces](#-perfis-de-acesso--interfaces)
2. [Funcionalidades Principais do Sistema](#-funcionalidades-principais-do-sistema)
3. [Arquitetura Técnica](#-arquitetura-tcnica)
4. [Instalação & Execução Local](#-instalao--execuo-local)
5. [Guia de Deploy (Docker & Cloud Run)](#-guia-de-deploy-docker--cloud-run)
6. [Variáveis de Ambiente](#-variveis-de-ambiente)
7. [Referência da API REST (v1)](#-referncia-da-api-rest-v1)
8. [Protocolo WebSocket em Tempo Real](#-protocolo-websocket-em-tempo-real)
9. [Esquema Relacional PostgreSQL](#-esquema-relacional-postgresql)

---

## 👥 Perfis de Acesso & Interfaces

O VozPlay divide a operação em 5 experiências complementares:

### 1. 📱 Participante (PWA Mobile)
- **Acesso:** Leitura do QR Code de mesa/telão ou navegação direta pelo smartphone.
- **Cadastro Simplificado:** Nome, WhatsApp e consentimento LGPD para campanhas de retorno.
- **Validação de Presença Física:** Exige o código numérico de 4 dígitos visível na mesa do operador ou na TV para enviar pedidos, impedindo fraudes ou pedidos de quem não está presente.
- **Catálogo & Modulação:** Busca com filtros por gênero (Sertanejo, MPB, Rock, Pop, Pagode, etc.) e seleção de versões (Karaokê tradicional, Acústico, Ao Vivo).
- **Ajuste de Tom:** Transposição tonal de **-3 a +3 semitons** para adequar o arranjo à extensão vocal do cantor.
- **Playlist de Rascunho & Histórico:** Criação de rascunhos para pedidos futuros e visualização de músicas já cantadas com notas e badges.
- **Reações ao Vivo:** Envio de emojis interativos (👏 Palmas, 🔥 Energia, ❤️ Amei, 🎤 Show, 🍻 Saúde) que flutuam na tela da TV durante as apresentações.

### 2. 🎛️ Controlador (Operador de Mesa de Som)
- **Código de Presença Dinâmico:** Gera um novo código de 4 dígitos a cada 60 segundos com cronômetro visual decrescente.
- **Gestão da Fila:** Controles de *Tocar*, *Pausar*, *Pular* e *Volume Master* sincronizados instantaneamente com o player da TV.
- **Remoção Justa:** Opção de cancelar músicas de participantes que não comparecerem ao palco, reordenando a fila com recálculo em tempo real.
- **DJ Soundboard:** Efeitos sonoros profissionais para enriquecer as apresentações (Palmas da Plateia, Rimshot, Arerê, Uuuuh, Show, Vinheta VozPlay).
- **Inclusão Manual:** Permite ao operador registrar pedidos de clientes diretamente na mesa de som.

### 3. 🛡️ Supervisor (Gerência / Caixa / Autoridade Geral)
- **Gestão de Horários & Prorrogação:** Acompanhamento do término programado da sessão com prorrogações rápidas (+15m, +30m, +60m).
- **Encerramento Pontual:** Bloqueio de novas adições e cancelamento seguro de pedidos pendentes ao término do horário contratado da casa.
- **Assunção Emergencial (*Emergency Takeover*):** Capacidade de revogar o operador atual em segundos e assumir o controle direto da sessão com renovação forçada dos códigos de presença.
- **Broadcast de Avisos:** Transmissão de comunicados em tempo real na barra de alerta do telão.
- **Marketing & CRM:** Exportação dos dados de contato dos clientes coletados no formulário de entrada para o WhatsApp.
- **Auditoria Completa:** Registro rastreável de todas as ações de operadores, participantes e supervisores.

### 4. 📺 TV Telão (Lounge Display)
- **Experiência 10-foot UI:** Layout otimizado para Smart TVs (Android TV, Tizen, Fire TV, WebOS) e projetores HDMI.
- **Segurança de Dados (`TVSessionDTO`):** Isolamento total de dados privados. O telão exibe apenas o primeiro nome e a inicial do cantor, ocultando telefones ou identificadores internos.
- **Letras Sincronizadas:** Player com reprodução em alta fidelidade e sincronia de volume com a mesa de som.
- **QR Code Permanente:** Exibição contínua do QR Code oficial no rodapé para novos participantes entrarem instantaneamente.
- **Transição Automática & Gamificação:** Telas de intervalo com pontuações simbólicas de karaokê (*Voz de Ouro*, *Afinação Impecável*, *Show de Carisma*) e contagem regressiva para o próximo cantor.

### 5. 🌐 Acompanhar Minha Vez (Tracker Público)
- Link leve e compartilhável via WhatsApp (`/tracker?p=...`).
- Permite que o participante acompanhe quantas músicas faltam e o tempo estimado de espera mesmo estando no bar, na mesa ou no banheiro.

---

## 🛠️ Arquitetura Técnica

```text
               +----------------------------------------------------+
               |                VozPlay Nginx / Proxy               |
               |                Dominio: vozplay.ai.slz.br          |
               +-------------------------+--------------------------+
                                         | Porta 3000
                                         v
               +----------------------------------------------------+
               |              Node.js Express Core (server.ts)      |
               |  - REST API /api/v1/*                              |
               |  - WebSocket Hub /ws (wsServer.ts)                 |
               |  - Vite Middleware (Dev) / Static Dist (Prod)      |
               +-------------------+--------------------+-----------+
                                   |                    |
        +--------------------------+                    +--------------------------+
        |                                                                          |
        v                                                                          v
+-------------------------------+                                        +-------------------+
| Clientes Conectados           |                                        | Banco de Dados    |
| - PWA Mobile (Participante)   |                                        | - PostgreSQL 16   |
| - Mesa de Som (Controlador)   | <======== WebSocket Bi-direcional =====>|   (schema.sql)    |
| - Gerência (Supervisor/Caixa) |          Estado Autoritativo           | - Estado em RAM   |
| - Telão 4K (TV Player)        |                                        |   (server/db.ts)  |
+-------------------------------+                                        +-------------------+
```

---

## 🚀 Instalação & Execução Local

### Pré-requisitos
- Node.js 20+ instalado
- Gerenciador de pacotes npm

### Passos para Desenvolvimento
```bash
# 1. Clone o repositório e acesse a pasta raiz
cd vozplay

# 2. Instale as dependências
npm install

# 3. Inicie o servidor integrado de desenvolvimento (porta 3000)
npm run dev
```

Acesse a aplicação no navegador em: `http://localhost:3000`.

---

## 🐳 Guia de Deploy (Docker & Cloud Run)

A aplicação foi projetada para rodar em containers leves (Alpine Linux) expondo estritamente a porta 3000.

### 1. Execução com Docker Compose
```bash
# 1. Copie o arquivo de variáveis de exemplo
cp .env.example .env

# 2. Suba o container da aplicação e do banco PostgreSQL
docker compose up --build -d

# 3. Verifique os logs dos containers
docker compose logs -f app
```

### 2. Build de Produção Manual
```bash
# Executa o Vite build e compila server.ts para dist/server.cjs
npm run build

# Executa o servidor compilado CommonJS
npm start
```

---

## 🔑 Variáveis de Ambiente

As configurações devem ser declaradas no arquivo `.env`:

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `PORT` | `3000` | Porta única de escuta HTTP e WebSockets |
| `NODE_ENV` | `production` | Modo de execução do ambiente |
| `DOMAIN` | `vozplay.ai.slz.br` | Domínio público base dos QR Codes e links |
| `DATABASE_URL` | `postgresql://vozplay_user:vozplay_secret_pass@localhost:5432/vozplay_db` | String de conexão com o PostgreSQL |

---

## 📡 Referência da API REST (v1)

Todos os endpoints estão sob o prefixo `/api/v1`:

### Sessão & Autenticação
- `GET /api/v1/session` — Dados da sessão ativa e status da TV.
- `POST /api/v1/session/start` — Inicia uma nova sessão de karaokê.
- `POST /api/v1/session/end` — Encerra a sessão atual e descarta pedidos pendentes.
- `POST /api/v1/session/extend` — Prorroga o encerramento em minutos (`{ additionalMinutes: 15 }`).

### Participante
- `POST /api/v1/participants/register` — Cadastro com nome, WhatsApp e opt-in LGPD.
- `GET /api/v1/participants/:id/history` — Histórico de músicas cantadas do participante.
- `GET /api/v1/music` — Busca no catálogo por termo (`q`) e gênero (`genre`).
- `GET /api/v1/playlists/:id` — Recupera a playlist de rascunho do participante.
- `POST /api/v1/playlists/:id/items` — Adiciona música com modulação de tom à playlist.
- `POST /api/v1/queue/request` — Submete música à fila oficial (exige código de presença).
- `POST /api/v1/reactions` — Dispara reação da plateia para o telão (`{ emoji, label }`).

### Controlador (Mesa de Som)
- `GET /api/v1/controller/presence-code` — Consulta código de 4 dígitos e tempo restante.
- `POST /api/v1/controller/play` — Inicia reprodução da próxima música na TV.
- `POST /api/v1/controller/pause` — Pausa a reprodução atual.
- `POST /api/v1/controller/resume` — Retoma a reprodução pausada.
- `POST /api/v1/controller/skip` — Pula a música em execução.
- `POST /api/v1/controller/queue/promote` — Adianta a posição de uma música na fila.
- `POST /api/v1/controller/queue/remove` — Remove participante ausente com justificativa.
- `POST /api/v1/controller/volume` — Ajusta volume master da TV (`{ volume: 85 }`).
- `POST /api/v1/controller/soundboard` — Dispara efeito sonoro (`{ soundType: 'applause' }`).

### Supervisor (Gerência)
- `GET /api/v1/metrics` — Métricas em tempo real (músicas tocadas, tempo médio de espera, leads).
- `GET /api/v1/leads` — Lista de contatos de clientes para campanhas.
- `GET /api/v1/supervisor/audit-logs` — Registro detalhado de logs operacionais.
- `POST /api/v1/supervisor/broadcast-alert` — Transmite aviso de texto na TV.
- `POST /api/v1/supervisor/takeover` — Assume controle emergencial da sessão.
- `GET /api/v1/supervisor/qrcode` — Retorna Data URL do QR Code da unidade.

### TV (Telão)
- `GET /api/v1/tv/session` — DTO sanitizado para exibição pública (`TVSessionDTO`).
- `POST /api/v1/tv/heartbeat` — Heartbeat periódico que indica TV online para a mesa.

---

## ⚡ Protocolo WebSocket em Tempo Real

O servidor WebSocket escuta no mesmo canal HTTP (`/ws` ou raiz da porta 3000) e transmite os seguintes eventos:

| Evento | Origem | Descrição |
| :--- | :--- | :--- |
| `state.sync` | Servidor | Sincronização autoritativa global de fila, sessão e TV |
| `presence.renewed` | Controlador | Notifica renovação do código de 4 dígitos |
| `queue.updated` | Servidor | Atualização em lote da lista de espera |
| `player.state` | Controlador | Mudança de estado (PLAYING, PAUSED, IDLE) |
| `player.volume` | Controlador | Mudança no volume da TV |
| `reaction.sent` | Participante | Emojis flutuantes disparados pela plateia |
| `soundboard.play` | Controlador | Disparo de vinhetas sonoras do operador |
| `session.alert` | Supervisor | Mensagem prioritária exibida no rodapé da TV |
| `controller.revoked` | Supervisor | Notificação de assunção emergencial |

---

## 🗄️ Esquema Relacional PostgreSQL

O arquivo `schema.sql` na raiz do projeto contém o DDL completo para implantação em bancos relacionais:
- `establishments` — Unidades e bares com seus domínios e configurações.
- `devices` — Registro de dispositivos desacoplados (PWA, Android TV, Controlador).
- `users` — Operadores, supervisores e administradores do sistema.
- `sessions` — Sessões de karaokê com controle de vigência e encerramento.
- `presence_codes` — Histórico de códigos de validação de 4 dígitos e expirações.
- `catalog_songs` — Catálogo oficial de músicas, artistas, gêneros e links de vídeo.
- `queue_items` — Fila de reprodução com ordem, tom musical e participante vinculado.
- `audit_logs` — Trilha de auditoria para conformidade e segurança.

---

## 📖 Central de Ajuda na Aplicação

O sistema possui uma central de ajuda interativa acessível diretamente pelo botão **"Ajuda & Guias"** no cabeçalho da aplicação (`HelpModal.tsx`). Nela, qualquer operador, participante ou supervisor pode consultar tutoriais ilustrados com passo a passo prático para cada momento do evento.
