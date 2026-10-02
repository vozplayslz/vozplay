# Runbook Operacional de Produção — VozPlay & MaIA Karaokê

**Domínio Oficial:** `vozplay.ai.slz.br`  
**Porta Única:** `3000` (HTTP REST + WebSockets)  
**Ambiente de Produção:** Node.js 20 LTS / Docker / PostgreSQL 16  

---

## 1. Visão Geral
Este runbook é o guia operacional canônico para administradores de sistemas, engenheiros de DevOps e equipes de suporte do **VozPlay**. Ele detalha os procedimentos padrão para manutenção preventiva, recuperação de desastres e resolução de incidentes nos subsistemas de Karaokê e na inteligência artificial **MaIA**.

---

## 2. Matriz de Resolução de Falhas

### 2.1 Provedor de IA Indisponível (Gemini / 9router Outage)
* **Sintoma:** Alertas de timeout no AI Router, métricas de latência elevadas no dashboard do Supervisor, status `DEGRADED` em `/api/v1/maia/observability/health`.
* **Comportamento Automático:**
  1. O `CircuitBreaker` abre após 5 falhas consecutivas e redireciona tráfego para a cadeia de fallback configurada.
  2. O `ContingencyProvider` local assume a geração de respostas determinísticas de cortesia.
* **Ação do Operador:**
  - No Painel do Supervisor (`SupervisorView` ➔ Aba "MaIA Karaokê" ➔ "Provedores"):
    - Verificar a chave de contingência ou alternar o provedor ativo de Gemini para 9router (ou vice-versa).
    - Se todos os provedores remotos estiverem fora do ar, desativar temporariamente a MaIA via Feature Flag:
      ```bash
      curl -X POST http://localhost:3000/api/v1/security/feature-flags \
        -H "Authorization: Bearer <TOKEN_SUPERVISOR>" \
        -H "Content-Type: application/json" \
        -d '{"flag": "aiEnabled", "enabled": false}'
      ```
    - O karaokê continuará operando 100% normalmente sem interrupção de música, fila ou notas.

---

### 2.2 Banco de Dados PostgreSQL Indisponível
* **Sintoma:** Endpoint `/readiness` retorna HTTP 503 com `{"status": "not_ready"}`.
* **Comportamento Automático:**
  - O `db.ts` opera com o store relacional em memória sincronizado via `AsyncMutex` atômico. Leituras e escritas imediatas na fila permanecem ativas na memória do processo.
* **Ação do Operador:**
  1. Verificar o container do PostgreSQL:
     ```bash
     docker compose ps db
     docker compose logs --tail=100 db
     ```
  2. Reiniciar o serviço do PostgreSQL:
     ```bash
     docker compose restart db
     ```
  3. Validar se o PostgreSQL está aceitando conexões:
     ```bash
     docker compose exec db pg_isready -U vozplay_user -d vozplay_db
     ```
  4. O servidor VozPlay reconecta automaticamente via pool do `pgClient.ts`.

---

### 2.3 MaIA Indisponível ou Travada
* **Sintoma:** Requisições para `/api/v1/maia/*` retornam erro 500 ou timeout.
* **Ação do Operador:**
  1. Isolar a MaIA sem derrubar o karaokê:
     - Definir `aiEnabled=false` nas Feature Flags.
  2. Consultar o relatório de saúde profunda:
     ```bash
     curl -s http://localhost:3000/api/v1/maia/observability/health | jq .
     ```
  3. Identificar o subsistema com status `UNHEALTHY` (Identity, Context, Tools, Policy, Memory ou Runtime).

---

### 2.4 Camada de Voz Indisponível (Voice Layer)
* **Sintoma:** Desconexão de sessões de voz ou falha no handshake de microfone.
* **Comportamento Automático:**
  - O `CascadeFallbackVoiceProvider` tenta comutação entre Gemini Live ➔ 9router Voice ➔ Contingência Local.
* **Ação do Operador:**
  1. Desativar a camada de voz individualmente via flag:
     ```bash
     curl -X POST http://localhost:3000/api/v1/security/feature-flags \
       -H "Authorization: Bearer <TOKEN_SUPERVISOR>" \
       -H "Content-Type: application/json" \
       -d '{"flag": "voiceEnabled", "enabled": false}'
     ```
  2. O PWA Mobile oculta o ícone de microfone e mantém o catálogo e controle de fila via texto.

---

### 2.5 Fila de Reprodução Travada
* **Sintoma:** A música terminou na TV, mas a fila não avançou para o próximo cantor.
* **Ação do Operador:**
  1. O Controlador da Mesa de Som deve clicar no botão **"Pular / Avançar"** (`karaoke.queue.skip`).
  2. Se a chamada expirou (>30s de ausência do cantor), acionar o cancelamento por ausência:
     - O sistema recalcula automaticamente a fila sem lacunas de índice.
  3. Caso o processo da fila esteja em concorrência, o Supervisor pode acionar:
     ```bash
     POST /api/v1/queue/sync
     ```

---

### 2.6 Tarefa de Agente Travada ou Loop de Autonomia
* **Sintoma:** Agente executando múltiplas chamadas repetitivas de ferramentas.
* **Comportamento Automático:**
  - O `MaiaLoopDetector` aborta a tarefa automaticamente ao atingir 5 passos idênticos, estouro de tempo ou custo.
* **Ação do Operador:**
  1. Acionar a Parada de Emergência Imediata (**MaIA STOP**):
     ```bash
     curl -X POST http://localhost:3000/api/v1/maia/autonomy/emergency-stop \
       -H "Authorization: Bearer <TOKEN_SUPERVISOR>" \
       -H "Content-Type: application/json" \
       -d '{"action": "trigger", "reason": "Intervenção manual do operador"}'
     ```
  2. O `MaiaEmergencyStop` cancela todas as tarefas ativas em nível de infraestrutura, sem depender de resposta do LLM.

---

### 2.7 WebSocket Desconectado ou Instável
* **Sintoma:** Telão da TV ou controles de mesa exibem aviso de desconexão.
* **Ação do Operador:**
  1. Verificar contagem de conexões ativas no endpoint de liveness:
     ```bash
     curl -s http://localhost:3000/liveness
     ```
  2. No navegador da TV / PWA, o cliente tenta reconexão automática exponencial (backoff 1s, 2s, 5s, 10s).
  3. Se o proxy reverso bloquear WebSockets, certificar-se de que os headers `Upgrade` e `Connection` estão habilitados no NGINX/Caddy/Traefik:
     ```nginx
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     ```

---

### 2.8 Container da Aplicação Quebrado / Crash Loop
* **Sintoma:** Container Docker reiniciando ciclicamente.
* **Ação do Operador:**
  1. Inspecionar logs da inicialização:
     ```bash
     docker compose logs --tail=150 app
     ```
  2. Causas frequentes:
     - `SUPERVISOR_PASSWORD` ou `CONTROLLER_PASSWORD` ausentes no `.env` em modo de produção.
     - Porta 3000 em conflito na máquina host.

---

## 3. Procedimentos de Backup e Restauração

### 3.1 Backup Manual do Banco PostgreSQL
```bash
# Executa dump atômico do banco de dados relacional
docker compose exec db pg_dump -U vozplay_user -d vozplay_db -F c -b -v -f /var/lib/postgresql/data/backup_$(date +%Y%m%d_%H%M%S).dump
```

### 3.2 Restauração de Backup (Disaster Recovery)
```bash
# 1. Parar a aplicação web para evitar escritas concorrentes
docker compose stop app

# 2. Restaurar o dump sobre o banco de dados
docker compose exec db pg_restore -U vozplay_user -d vozplay_db --clean --if-exists /var/lib/postgresql/data/backup_ARQUIVO.dump

# 3. Reiniciar a aplicação
docker compose start app
```

---

## 4. Política de Rollback de Versão

Em caso de deploy de versão defeituosa:
1. Reverter a imagem ou container para a versão anterior:
   ```bash
   git checkout tags/v1.1.0  # ou commit estável anterior
   npm run build
   docker compose build app
   docker compose up -d app
   ```
2. Assegurar que o schema do banco não possui migrações destrutivas (o `schema.sql` utiliza exclusivamente `IF NOT EXISTS` e adições não-bloqueantes).

---

## 5. Auditoria de Conformidade e LGPD (Expurgo de Dados)

Quando um participante solicitar formalmente a exclusão de seus dados (Direito ao Esquecimento - LGPD):
1. O Supervisor acessa o endpoint administrativo:
   ```bash
   curl -X POST http://localhost:3000/api/v1/maia/security/lgpd/purge \
     -H "Authorization: Bearer <TOKEN_SUPERVISOR>" \
     -H "Content-Type: application/json" \
     -d '{"participantId": "part-12345", "reason": "Solicitação formal do titular"}'
   ```
2. O `MaiaPrivacyManager` remove memórias do participante no Memory Engine, expurga histórico de conversação e anonimiza o nome na fila histórica.
