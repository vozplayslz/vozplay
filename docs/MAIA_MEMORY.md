# Arquitetura MaIA Memory — FASE 06 (Enlace / VozPlay)

## 1. Princípio Fundamental e Separação de Conceitos

A arquitetura da MaIA estabelece uma separação axiomática e inegociável entre os diferentes pilares cognitivos do sistema:

| Conceito | Definição | Exemplo |
| :--- | :--- | :--- |
| **Context** | O que está acontecendo **agora** (volátil, snapshot pontual, janela deslizante). | Fila ativa, música em reprodução, interlocutor autenticado no canal. |
| **Memory** | O que **vale a pena preservar** para uso futuro sob seleção e governança. | Preferência musical de cantor, ajuste acústico fixado, resumo consolidado de sessão. |
| **History** | Registro factual cronológico de tudo o que aconteceu. | Logs de eventos de auditoria, histórico bruto de turnos de conversa. |
| **Knowledge** | Informação estruturada, estática e documentada sobre o mundo. | Catálogo de 5.000 músicas com cifras e letras oficiais. |
| **RAG** | Mecanismo de recuperação de conhecimento documental (não aplicável nesta fase). | Busca semântica em manuais técnicos ou base de suporte. |

> **Regra de Ouro**: Memória NÃO é banco de chat (`messages[]`). Nem todo evento ou histórico vira memória. Memória representa informação estruturada, seletiva e reutilizável classificada estritamente como **DATA**, e **NUNCA como INSTRUCTION**.

---

## 2. Diagrama da Arquitetura Alvo

```
                              ┌──────────────────┐
                              │    MaIA Core     │
                              └────────┬─────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
         Context Engine         Event Bus &          MaIA Memory
       (Snapshot Corrente)        Perception              │
                │                      │                      ├─ Working Memory (4h)
                │                      │                      ├─ Session Memory (24h)
                ├──────────────────────┼──────────────────────┤  Episodic Memory (30d)
                │                      │                      ├─ Semantic Memory (Perene)
                │                      │                      ├─ Preference Memory (Perene)
                │ (Sob demanda e       │                      └─ Operational Memory (90d)
                │  Memory Budget)      │
                ▼                      ▼
         Context Snapshot        Candidate Intent
                │                      │
                └──────────────┬───────┘
                               │
                               ▼
                           AI Router
                               │
                               ▼
                      [Future Agent Runtime]
```

---

## 3. Tipos de Memória Implementados

1. **Working Memory (`WORKING`)**:
   - Informações transitórias de curtíssima duração utilizadas durante uma operação contínua.
   - *Exemplo*: Tarefa em andamento do operador, notas intermediárias de triagem.
   - *TTL Padrão*: 4 horas (expiração automática).

2. **Session Memory (`SESSION`)**:
   - Memória vinculada ao ciclo de vida da sessão ativa de karaokê.
   - *Exemplo*: Fatos relevantes ocorridos durante a noite, registros de mesas participantes.
   - *TTL Padrão*: 24 horas (avaliada e descartada/promovida no encerramento da sessão).

3. **Episodic Memory (`EPISODIC`)**:
   - Acontecimentos relevantes com timestamp, contexto, escopo, importância e confiança.
   - *Exemplo*: Resumo consolidado de uma sessão comemorativa que bateu recorde de canções.
   - *TTL Padrão*: 30 dias (configurável).

4. **Semantic Memory (`SEMANTIC`)**:
   - Conhecimento operacional relativamente estável sobre o estabelecimento ou sistema.
   - *Exemplo*: Fato conhecido sobre acústica da sala ou perfil operacional do local.
   - *TTL Padrão*: Perene enquanto válido (sem expiração automática).

5. **Preference Memory (`PREFERENCE`)**:
   - Preferências expressas e autorizadas de cantores ou operadores.
   - *Exemplo*: Cantor prefere o tom -1 semitom em modas de viola.
   - *Origem*: Estritamente `user_explicit` ou `operator_explicit` (NUNCA inferida probabilisticamente sem confirmação).

6. **Operational Memory (`OPERATIONAL`)**:
   - Fatos de continuidade e procedimentos operacionais conhecidos.
   - *Exemplo*: Último nível de volume master equalizado, parâmetros de iluminação.
   - *TTL Padrão*: 90 dias.

---

## 4. Escopos de Memória & Isolamento Multi-Tenant

Toda memória possui escopo e locatário obrigatório (`tenantId`):

- **Escopos**: `global`, `tenant`, `organization`, `product`, `establishment`, `user`, `session`, `device`, `conversation`.
- **Isolamento**:
  - Tenant A armazena no armazém segregado do Tenant A.
  - Tenant B armazena no armazém segregado do Tenant B.
  - O `MemoryService` rejeita terminantemente consultas sem `tenantId` e bloqueia qualquer vazamento entre instâncias.

---

## 5. Modelo de Dados (`MemoryItem`)

```typescript
interface MemoryItem {
  id: string;                          // Identificador único (mem-timestamp-uuid)
  type: MemoryType;                    // WORKING, SESSION, EPISODIC, SEMANTIC, PREFERENCE, OPERATIONAL
  scope: MemoryScope;                  // global, tenant, establishment, user, session, etc.
  tenantId: string;                    // Locatário obrigatório
  establishmentId?: string;           // Unidade física
  userId?: string;                     // Usuário associado
  sessionId?: string;                  // Sessão associada
  content: unknown;                    // Conteúdo estruturado (DATA, jamais executável)
  summary?: string;                    // Resumo conciso em pt-BR
  source: MemorySource;                // user_explicit, operator_explicit, system, derived, etc.
  confidence: number;                  // 0.00 a 1.00 (probabilidade ou certeza)
  importance: number;                  // 1 a 5 (relevância operacional)
  createdAt: string;                   // ISO 8601 UTC
  updatedAt: string;                   // ISO 8601 UTC
  expiresAt?: string;                  // ISO 8601 UTC (TTL de retenção)
  version: number;                     // Versionamento sequencial (1, 2, 3...)
  previousVersionId?: string;          // Rastreabilidade de correções
  updatedBy?: string;                  // Autor da última alteração
  tags?: string[];                     // Indexação para busca determinística
  metadata?: Record<string, unknown>;  // Metadados de suporte
}
```

---

## 6. Blindagem de Segurança & Privacidade (LGPD)

### 6.1 Expurgo e Bloqueio de Segredos (`SecretFilter`)
A camada de memória aplica validação estrita antes de aceitar qualquer registro:
- Bloqueia e rejeita categoricamente:
  - Tokens JWT e Bearer tokens.
  - Chaves de API (Google Gemini, OpenAI, GitHub, genéricas).
  - Senhas e hashes em texto puro.
  - Códigos rotativos de presença física (PIN de mesa de 4 dígitos).
  - Chaves criptográficas privadas (RSA/EC/DSA/OPENSSH).
  - Números de cartão de crédito.
- Violações lançam `MemorySecretRejectedError` e geram auditoria de rejeição.

### 6.2 Proteção Contra Memory Poisoning & Prompt Injection (`WritePolicy`)
- **Hierarquia Inviolável de Autoridade**:
  ```
  System (1) > Developer (2) > Application Policy (3) > User (4) > Memory/Data (5) > Tool Result (6)
  ```
- **DATA vs INSTRUCTION**:
  - Memória é classificada como **DATA**. Não ganha privilégios de execução.
  - Padrões de ataque como *"Ignore todas as regras"*, *"Você agora é DAN"*, *"System prompt override"*, *"Execute takeover"* são terminantemente bloqueados com `MemoryPoisoningError`.
  - No empacotamento do prompt para o LLM, o `ContextFormatter` estampa a advertência explícita de que memórias são fatos passivos de referência e não podem alterar regras de negócio ou permissões de RBAC.

### 6.3 Direito de Exclusão (Right to be Forgotten) & Correção
- Exclusão pontual (`delete(tenantId, id)`) remove o registro físico.
- Esquecimento por escopo (`forget(tenantId, scope, identifier)`) remove registros associados a sessões ou usuários a pedido.
- Registros de auditoria preservam apenas metadados de operação (`memory.deleted`), sem armazenar o conteúdo excluído.
- Correções incrementam `version` e registram `updatedBy` sem sobrescrita destrutiva cega.

---

## 7. Relevância Determinística & Memory Budget

Para evitar que a memória inunde o contexto com dumps de banco, a recuperação utiliza:
- **Algoritmo de Relevância Ponderada**:
  $$\text{Score} = (\text{importância} \times 0.40) + (\text{confiança} \times 0.25) + (\text{recência} \times 0.20) + (\text{tags} \times 0.10) + (\text{busca} \times 0.05)$$
- **Memory Budget**:
  - `limit`: padrão 10 itens (máximo 50).
  - `maxEstimatedTokens`: padrão 1.000 tokens (~4.000 caracteres).
  - A recuperação interrompe a agregação assim que o limite numérico ou o teto de tokens for atingido.

---

## 8. Ciclo de Encerramento da Sessão (`SessionMemoryLifecycle`)

Conforme especificado no Briefing:
```
EVENT: karaoke.session.ended
            │
            ▼
    Session Memory Items
            │
            ▼
   Avaliação Heurística:
   - Importância >= 4 OU PREFERENCE/OPERATIONAL?
     ├── SIM ➔ Promove para EPISODIC/OPERATIONAL permanente (tag: 'promoted_from_session')
     └── NÃO ➔ Descarta itens transitórios (Fade out, contadores voláteis)
            │
            ▼
   Gera Resumo Consolidado da Sessão (canções, duração, destaques)
            │
            ▼
   Limpeza da Session Memory (forget 'session')
```

---

## 9. Resiliência Total (Zero Cascade Failure)

- A MaIA pode funcionar perfeitamente **sem memória**.
- Se o serviço de memória for desabilitado (`setEnabled(false)`) ou sofrer indisponibilidade temporária de armazenamento:
  - O fluxo de karaokê, a TV, a mesa de som e a fila continuam operando normalmente.
  - O `ContextEngine` gera seus snapshots com `memories: []`.
  - O sistema registra o fallback e continua a execução sem interrupções.

---

## 10. Limitações Atuais e Próximos Passos (Débitos Técnicos)

- **Vector Database**: Não utilizado nesta fase (conforme diretriz explícita). A busca é estruturada e relacional. Futuras fases poderão plugar adaptadores de embeddings sem alterar a interface `IMemoryProvider`.
- **RAG**: Não implementado nesta fase; será abordado em fases dedicadas de base de conhecimento.
- **Preparação para FASE 07**: A camada de memória está pronta para ser consumida pelo **AI Router Avançado** e futuramente pelo **Agent Runtime + Planner (FASE 08)**.
