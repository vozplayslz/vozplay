# Procedimento de Resposta a Incidentes de Segurança e IA — VozPlay / MaIA (Fase 11)

## 1. Visão Geral
Este protocolo estabelece o fluxo oficial de resposta a incidentes operacionais, violações de segurança, oscilações de provedores de IA e abuso na plataforma **VozPlay** e no ecossistema de inteligência **MaIA**.

---

## 2. Matriz de Severidade

| Nível | Classificação | Exemplos de Evento | Tempo de Resposta Alvo |
|---|---|---|---|
| **SEV-1 (Crítica)** | `CRITICAL` | Vazamento de credenciais, tentativa de injeção em banco, indisponibilidade do sistema de fila. | Imediato (< 15 minutos) |
| **SEV-2 (Alta)** | `HIGH` | Outage do Gemini / provedor de IA, loop repetitivo de agente, estouro de rate limit orçamentário. | < 1 hora |
| **SEV-3 (Média)** | `MEDIUM` | Tentativa de bypass por header rejeitada, falha em webhook secundário, latência elevada de voz. | < 4 horas |
| **SEV-4 (Baixa)** | `LOW` | Alerta de sanitização em nome de música, feedback de transcrição de áudio. | Próximo ciclo operacional |

---

## 3. Fluxo de Contenção em 10 Etapas

### Passo 1: Detectar e Notificar
- O alerta é capturado através do `SecurityAuditStore`, logs estruturados ou endpoint `/api/health`.

### Passo 2: Conter o Incidente
- Em caso de anomalia de autonomia ou loop de agente: acionar **`EMERGENCY_STOP`** imediatamente via `POST /api/v1/maia/autonomy/emergency-stop`.
- Em caso de interferência humana na mesa de som: acionar **`HUMAN_TAKEOVER`** via `POST /api/v1/maia/autonomy/human-takeover`.

### Passo 3: Ativar Modo Degradado (Resiliência)
- O sistema VozPlay possui desacoplamento estrutural:
  - Se a IA estiver instável: definir `AI_ENABLED=false` nas Feature Flags. O karaokê (músicas, fila, letras e notas) permanece 100% no ar.
  - Se a camada de voz oscilar: definir `VOICE_ENABLED=false`. A MaIA textual permanece ativa.

### Passo 4: Revogar Credenciais Comprometidas
- Se houver suspeita de vazamento de token de operador:
  - Supervisor aciona `POST /api/v1/supervisor/emergency-takeover`, que invalida instantaneamente todos os tokens de mesa de som e gera um novo PIN de presença de 60s.
  - Em caso de operador individual: excluir via `DELETE /api/v1/supervisor/users/:id`.

### Passo 5: Isolar o Estabelecimento (Multi-Tenant)
- Cada estabelecimento (`establishmentId`) possui barreiras estritas de contexto, store de memória e sessões. Se um tenant sofrer abuso, o bloqueio do `AutonomyCircuitBreaker` isola o tráfego apenas daquele locatário, sem afetar outros bares/lounges.

### Passo 6: Preservar Trilha de Auditoria
- Coletar logs através de `GET /api/v1/maia/autonomy/audit` e `GET /api/v1/security/audit`.
- Os registros armazenam `correlationId`, `actorId`, `action`, `tenantId` e `timestamp`.

### Passo 7: Investigar Causa Raiz (RCA)
- Determinar o vetor (prompt injection, timeout de provedor externo, tentativa de IDOR, falha de rede).

### Passo 8: Corrigir e Aplicar Patch
- Aplicar correção no Tool Registry, Policy Engine ou regras do esquema.

### Passo 9: Validar em Ambiente Controlado
- Executar a bateria automatizada completa:
  - `npm run test:autonomy`
  - `npm run test:voice`
  - `npm run test:integration`
  - `npm run test:hardening`

### Passo 10: Reativar e Rearmar
- Rearmar o sistema via `POST /api/v1/maia/autonomy/emergency-stop` com `action: 'reset'`.
- Registrar relatório de pós-incidente e métricas.
