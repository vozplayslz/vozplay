/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PERCEPTION ENGINE (PROMPT 05)
 * Motor central de Percepção da MaIA no ecossistema Enlace.
 * 
 * REGRA FUNDAMENTAL:
 * Percepção NÃO significa autonomia.
 * A MaIA observa eventos do Event Bus, avalia relevância semântica, prioridade,
 * correlaciona com o contexto ativo e formula candidatas a intenção futura.
 * Ela NÃO executa ferramentas, não chama ações no backend e não toma decisões
 * autônomas nesta fase.
 */

import { randomUUID } from 'crypto';
import { DomainEvent } from '../events/types.js';
import { eventBus } from '../events/eventBus.js';
import {
  CandidateIntent,
  MaiaPerceptionRecord,
  PerceptionFilter,
  PerceptionMetrics
} from './types.js';
import { perceptionClassifier, ClassificationResult } from './perceptionClassifier.js';
import { perceptionDeduplicator } from './perceptionDeduplicator.js';
import { perceptionStore, PerceptionStore } from './perceptionStore.js';

export class MaiaPerceptionEngine {
  private isSubscribed: boolean = false;
  private subscriptionId?: string;
  private store: PerceptionStore;

  // Métricas operacionais da camada de percepção
  private metrics: PerceptionMetrics = {
    totalEventsAnalyzed: 0,
    totalPerceptionsCreated: 0,
    totalIgnoredEvents: 0,
    totalDebouncedEvents: 0,
    relevanceCounts: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      IGNORED: 0
    },
    priorityCounts: {
      P0: 0,
      P1: 0,
      P2: 0,
      P3: 0
    },
    categoryCounts: {
      QUEUE: 0,
      PERFORMANCE: 0,
      SESSION: 0,
      AUDIENCE: 0,
      OPERATIONAL: 0,
      SYSTEM: 0
    },
    candidateIntentCounts: {},
    averagePerceptionLatencyMs: 0
  };

  private latencies: number[] = [];

  constructor(options?: { store?: PerceptionStore }) {
    this.store = options?.store || perceptionStore;
  }

  /**
   * Conecta a percepção ao Event Bus universal
   */
  public start(): void {
    if (this.isSubscribed && this.subscriptionId) {
      this.stop();
    }

    const sub = eventBus.subscribe('#', (event: DomainEvent) => {
      this.perceiveEvent(event);
    });

    this.subscriptionId = sub.id;
    this.isSubscribed = true;
  }

  /**
   * Desconecta a percepção do Event Bus
   */
  public stop(): void {
    if (this.subscriptionId) {
      eventBus.unsubscribe({ id: this.subscriptionId });
    }
    this.isSubscribed = false;
    this.subscriptionId = undefined;
  }

  /**
   * Processa e contextualiza um evento de domínio gerando um registro de percepção.
   * Método não-bloqueante e livre de ações autônomas.
   */
  public perceiveEvent(event: DomainEvent): MaiaPerceptionRecord | null {
    const startTime = Date.now();
    this.metrics.totalEventsAnalyzed++;

    const tenantId = event.tenantId || 'default-tenant';
    const eventType = event.type || event.name || 'unspecified.event';

    // 1. Classificação preliminar de relevância semântica
    const classification: ClassificationResult = perceptionClassifier.classify(event);
    this.metrics.relevanceCounts[classification.relevance]++;

    // 2. Se for classificado como IGNORED (ruído/telemetria), descarta
    if (classification.relevance === 'IGNORED') {
      this.metrics.totalIgnoredEvents++;
      return null;
    }

    // 3. Verificação de Coalescência / Debounce temporal
    const entityKey = (event.payload?.queueItemId || event.payload?.musicId || event.payload?.actorId || 'general').toString();
    if (perceptionDeduplicator.shouldDebounce(tenantId, eventType, entityKey)) {
      this.metrics.totalDebouncedEvents++;
      return null;
    }

    // 4. Correlação contextual segura (apenas leitura de estado, sem efeitos colaterais)
    const contextCorrelation = {
      correlationId: event.correlationId,
      actorId: event.userId,
      actorRole: event.metadata?.actorRole as string | undefined,
      activeSinger: event.payload?.participantDisplayName || event.payload?.singerName,
      songTitle: event.payload?.musicTitle || event.payload?.songTitle,
      songArtist: event.payload?.musicArtist || event.payload?.artist,
      queueLength: typeof event.payload?.queueLength === 'number' ? event.payload.queueLength : undefined,
      sessionStatus: event.payload?.sessionStatus as string | undefined
    };

    const latencyMs = Math.max(0, Date.now() - startTime);
    this.recordLatency(latencyMs);

    // 5. Determinação do status para o futuro ciclo do Agent Runtime
    const status = (classification.relevance === 'CRITICAL' || classification.relevance === 'HIGH')
      ? 'QUEUED_FOR_AGENT'
      : 'PERCEIVED';

    // 6. Construção do Registro de Percepção Estruturado
    const perceptionRecord: MaiaPerceptionRecord = {
      id: `perc-${randomUUID()}`,
      eventId: event.id,
      eventType,
      tenantId,
      sessionId: event.sessionId,
      occurredAt: event.occurredAt || new Date().toISOString(),
      perceivedAt: new Date().toISOString(),
      relevance: classification.relevance,
      priority: classification.priority,
      category: classification.category,
      summary: classification.summary,
      reasoning: classification.reasoning,
      candidateIntent: classification.candidateIntent,
      contextCorrelation,
      status,
      latencyMs
    };

    // 7. Armazena no repositório de percepções bounded
    this.store.add(perceptionRecord);

    // 8. Atualização de métricas operacionais
    this.metrics.totalPerceptionsCreated++;
    this.metrics.priorityCounts[classification.priority]++;
    this.metrics.categoryCounts[classification.category]++;
    this.metrics.candidateIntentCounts[classification.candidateIntent] = 
      (this.metrics.candidateIntentCounts[classification.candidateIntent] || 0) + 1;

    // REGRA DE OURO: NENHUMA ferramenta é chamada, NENHUMA ação é executada aqui.
    // A MaIA apenas percebe, classifica e aguarda a camada superior (Agent Runtime).
    return perceptionRecord;
  }

  /**
   * Registra latência para cálculo de média móvel
   */
  private recordLatency(ms: number): void {
    this.latencies.push(ms);
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.metrics.averagePerceptionLatencyMs = Math.round(sum / this.latencies.length);
  }

  /**
   * Consulta percepções recentes de um tenant
   */
  public getRecentPerceptions(
    tenantId: string,
    limit: number = 20,
    filter?: PerceptionFilter
  ): MaiaPerceptionRecord[] {
    return this.store.getRecent(tenantId, limit, filter);
  }

  /**
   * Consulta percepções aguardando consumo do futuro Agent Runtime
   */
  public getPendingPerceptions(tenantId: string): MaiaPerceptionRecord[] {
    return this.store.getPendingForAgent(tenantId);
  }

  /**
   * Retorna as métricas operacionais
   */
  public getMetrics(): PerceptionMetrics {
    return {
      ...this.metrics,
      relevanceCounts: { ...this.metrics.relevanceCounts },
      priorityCounts: { ...this.metrics.priorityCounts },
      categoryCounts: { ...this.metrics.categoryCounts },
      candidateIntentCounts: { ...this.metrics.candidateIntentCounts }
    };
  }

  /**
   * Reinicia as métricas
   */
  public resetMetrics(): void {
    this.metrics = {
      totalEventsAnalyzed: 0,
      totalPerceptionsCreated: 0,
      totalIgnoredEvents: 0,
      totalDebouncedEvents: 0,
      relevanceCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, IGNORED: 0 },
      priorityCounts: { P0: 0, P1: 0, P2: 0, P3: 0 },
      categoryCounts: { QUEUE: 0, PERFORMANCE: 0, SESSION: 0, AUDIENCE: 0, OPERATIONAL: 0, SYSTEM: 0 },
      candidateIntentCounts: {},
      averagePerceptionLatencyMs: 0
    };
    this.latencies = [];
  }

  /**
   * Limpa o estado da percepção (armazém e debounce)
   */
  public clear(tenantId?: string): void {
    this.store.clear(tenantId);
    perceptionDeduplicator.clear();
  }
}

export const maiaPerceptionEngine = new MaiaPerceptionEngine();

// Inicia automaticamente o motor de percepção integrado ao Event Bus
maiaPerceptionEngine.start();
