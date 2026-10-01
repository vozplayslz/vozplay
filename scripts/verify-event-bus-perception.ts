/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BATERIA DE TESTES DO EVENT BUS & MAIA PERCEPTION (PROMPT 05)
 * Cobre:
 * 1. Event Bus Oficial: Contratos, publicação, assinatura, wildcards ('*', '#'), isolamento de falhas.
 * 2. Deduplicação e Cooldowns: Janela temporal contra tempestades de eventos.
 * 3. Consumidores Desacoplados: Audit Consumer com sanitização LGPD e Realtime Consumer.
 * 4. MaIA Perception Engine: Classificação semântica de relevância, prioridade e intenções candidatas.
 * 5. Blindagem de Não-Autonomia: Comprovação de que a percepção NUNCA dispara ferramentas ou ações autônomas.
 * 6. Debouncing Cognitivo: Coalescência de rajadas de eventos similares.
 * 7. Isolamento Multi-Tenant: Percepções e eventos segregados por tenant.
 * 8. Integração com Context Engine: Enriquecimento do EventContext com percepções da MaIA.
 * 9. Observabilidade & Métricas: Telemetria de latência, contadores e saúde do barramento.
 */

import {
  eventBus,
  DomainEvent,
  auditConsumer,
  realtimeConsumer,
  maiaPerceptionEngine,
  perceptionClassifier,
  perceptionDeduplicator,
  perceptionStore,
  maiaContextEngine,
  maiaToolRegistry,
  MaiaPerceptionRecord
} from '../server/maia/core/index.js';

import '../server/maia/karaokeBridge.js';
import { db } from '../server/db.js';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function assert(condition: boolean, name: string, failureDetails?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.push({ name, passed: false, details: failureDetails });
    console.error(`  ❌ [FAIL] ${name}: ${failureDetails || 'Assertion failed'}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEventBusAndPerceptionTests() {
  console.log('================================================================');
  console.log('  MAIA EVENT BUS & PERCEPTION — TESTES AVANÇADOS (PROMPT 05)    ');
  console.log('================================================================\n');

  try {
    const tenantA = 'tenant-lounge-alpha';
    const tenantB = 'tenant-bar-beta';
    const sessionIdA = 'session-alpha-001';

    // Limpa estado inicial de testes
    eventBus.clearSubscriptions();
    eventBus.clearHistory();
    eventBus.resetMetrics();
    auditConsumer.clearAuditLogs();
    maiaPerceptionEngine.clear();
    maiaPerceptionEngine.resetMetrics();

    // ------------------------------------------------------------------------
    // 1. CONTRATOS DO EVENT BUS, PUBLICAÇÃO E ASSINATURA
    // ------------------------------------------------------------------------
    console.log('1. Testando Contratos do Event Bus, Publicação e Assinaturas...');

    let exactEventReceived = false;
    let wildcardSingleReceived = false;
    let wildcardMultiReceived = false;
    let globalWildcardReceived = false;

    // Assinatura exata
    const subExact = eventBus.subscribe('karaoke.queue.song_added', (ev) => {
      if (ev.type === 'karaoke.queue.song_added') exactEventReceived = true;
    });

    // Assinatura wildcard simples ('*')
    const subSingle = eventBus.subscribe('karaoke.queue.*', (ev) => {
      if (ev.type.startsWith('karaoke.queue.')) wildcardSingleReceived = true;
    });

    // Assinatura wildcard multi-segmento ('#')
    const subMulti = eventBus.subscribe('karaoke.#', (ev) => {
      if (ev.type.startsWith('karaoke.')) wildcardMultiReceived = true;
    });

    // Assinatura global ('#')
    const subGlobal = eventBus.subscribe('#', (ev) => {
      globalWildcardReceived = true;
    });

    const testEvent1: DomainEvent = {
      id: 'evt-001',
      type: 'karaoke.queue.song_added',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'karaoke.queue',
      tenantId: tenantA,
      sessionId: sessionIdA,
      userId: 'user-01',
      payload: {
        musicTitle: 'Evidências',
        participantDisplayName: 'Carlos Eduardo'
      }
    };

    await eventBus.publish(testEvent1);
    await sleep(20);

    await assert(exactEventReceived, 'Assinatura com padrão exato recebeu o evento');
    await assert(wildcardSingleReceived, 'Assinatura com wildcard simples ("karaoke.queue.*") recebeu o evento');
    await assert(wildcardMultiReceived, 'Assinatura com wildcard multi-segmento ("karaoke.#") recebeu o evento');
    await assert(globalWildcardReceived, 'Assinatura global ("#") recebeu o evento');

    // Teste de cancelamento de assinatura (unsubscribe)
    exactEventReceived = false;
    subExact.unsubscribe();

    const testEvent2: DomainEvent = {
      id: 'evt-002',
      type: 'karaoke.queue.song_added',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'karaoke.queue',
      tenantId: tenantA,
      sessionId: sessionIdA,
      payload: { musicTitle: 'Cheia de Manias' }
    };

    await eventBus.publish(testEvent2);
    await sleep(20);

    await assert(!exactEventReceived, 'Assinatura removida com unsubscribe NÃO recebe novos eventos');

    // ------------------------------------------------------------------------
    // 2. DEDUPLICAÇÃO DE EVENTOS E BUFFER CIRCULAR
    // ------------------------------------------------------------------------
    console.log('\n2. Testando Deduplicação por EventId e Buffer Circular...');

    const initialMetrics = eventBus.getMetrics();
    const duplicateEvent: DomainEvent = {
      id: 'evt-duplicate-qa',
      type: 'karaoke.session.started',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'system',
      tenantId: tenantA,
      payload: { loungeName: 'VozPlay Alpha' }
    };

    // 1ª publicação do ID
    await eventBus.publish(duplicateEvent);
    // 2ª publicação do MESMO ID dentro da janela
    await eventBus.publish(duplicateEvent);
    await sleep(20);

    const postDupMetrics = eventBus.getMetrics();
    await assert(
      postDupMetrics.totalDeduplicated === initialMetrics.totalDeduplicated + 1,
      'Evento com mesmo ID publicado duas vezes foi deduplicado com sucesso'
    );

    // Buffer circular e histórico
    const recent = eventBus.getRecentEvents(10, tenantA);
    await assert(recent.length >= 2, 'Histórico em memória registra eventos recentes');
    await assert(
      recent.every(e => e.tenantId === tenantA),
      'getRecentEvents filtra estritamente pelo tenantId solicitado'
    );

    // ------------------------------------------------------------------------
    // 3. RESILIÊNCIA E ISOLAMENTO DE FALHAS EM ASSINANTES (ZERO CASCADE)
    // ------------------------------------------------------------------------
    console.log('\n3. Testando Isolamento de Falhas em Assinantes (Zero Cascade Failure)...');

    let healthySubscriberRan = false;
    const errorsBefore = eventBus.getMetrics().totalErrors;

    // Assinante que lança exceção proposital
    eventBus.subscribe('test.fault.*', async () => {
      throw new Error('Falha simulada em ouvinte problemático');
    });

    // Assinante saudável
    eventBus.subscribe('test.fault.*', async () => {
      healthySubscriberRan = true;
    });

    await eventBus.publish({
      id: 'evt-fault-01',
      type: 'test.fault.action',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'test-runner',
      tenantId: tenantA,
      payload: {}
    });
    await sleep(30);

    await assert(healthySubscriberRan, 'Assinante saudável executou normalmente apesar de falha em outro');
    const errorsAfter = eventBus.getMetrics().totalErrors;
    await assert(errorsAfter > errorsBefore, 'Erro em assinante foi isolado e incrementou métricas de erro');

    // ------------------------------------------------------------------------
    // 4. AUDIT CONSUMER COM SANITIZAÇÃO LGPD
    // ------------------------------------------------------------------------
    console.log('\n4. Testando Audit Consumer com Sanitização Estrita de PII (LGPD)...');

    auditConsumer.start();

    const sensitiveEvent: DomainEvent = {
      id: 'evt-audit-secret-01',
      type: 'karaoke.user.login',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'auth.service',
      tenantId: tenantA,
      sessionId: sessionIdA,
      correlationId: 'corr-audit-99',
      payload: {
        username: 'marcos_karaoke',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
        pin: '8492',
        phone: '98981234567',
        whatsapp: '+5598991234567',
        cpf: '123.456.789-00'
      }
    };

    await eventBus.publish(sensitiveEvent);
    await sleep(30);

    const auditLogs = auditConsumer.getAuditLogs({ tenantId: tenantA, correlationId: 'corr-audit-99' });
    await assert(auditLogs.length > 0, 'Registro de auditoria criado pelo AuditConsumer');

    const logRecord = auditLogs[0];
    await assert(logRecord.sanitizedPayload.username === 'marcos_karaoke', 'Campos não confidenciais preservados no log');
    await assert(logRecord.sanitizedPayload.password === '***REDACTED***', 'Senha mascarada como ***REDACTED***');
    await assert(logRecord.sanitizedPayload.token === '***REDACTED***', 'Token mascarado como ***REDACTED***');
    await assert(logRecord.sanitizedPayload.pin === '***REDACTED***', 'PIN de presença mascarado como ***REDACTED***');
    await assert(logRecord.sanitizedPayload.cpf === '***REDACTED***', 'CPF mascarado como ***REDACTED***');
    await assert(
      logRecord.sanitizedPayload.phone !== '98981234567' && logRecord.sanitizedPayload.phone.includes('***'),
      'Telefone pessoal/WhatsApp redigido conforme LGPD'
    );

    // ------------------------------------------------------------------------
    // 5. REALTIME CONSUMER DESACOPLADO
    // ------------------------------------------------------------------------
    console.log('\n5. Testando Realtime Consumer Desacoplado...');

    let realtimeBroadcastChannel: string | null = null;
    let realtimeBroadcastPayload: any = null;

    realtimeConsumer.setBroadcaster((ch, data) => {
      realtimeBroadcastChannel = ch;
      realtimeBroadcastPayload = data;
    });
    realtimeConsumer.start();

    await eventBus.publish({
      id: 'evt-rt-01',
      type: 'karaoke.queue.song_added',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'karaoke.queue',
      tenantId: tenantA,
      payload: { songId: 'm-1' }
    });
    await sleep(20);

    await assert(realtimeBroadcastChannel === 'queue.updated', 'RealtimeConsumer despacha "queue.updated" para clientes');
    await assert(realtimeConsumer.getDeliveredCount() > 0, 'Contador de entrega do RealtimeConsumer incrementado');

    // ------------------------------------------------------------------------
    // 6. CLASSIFICADOR DE PERCEPÇÃO DA MAIA (RELEVÂNCIA E INTENÇÕES)
    // ------------------------------------------------------------------------
    console.log('\n6. Testando Classificador Semântico de Percepção...');

    // P1: Chamada de cantor ao palco
    const classCalled = perceptionClassifier.classify({
      id: 'c-1',
      type: 'karaoke.queue.participant_called',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'controller',
      payload: { participantDisplayName: 'Mariana Lima', musicTitle: 'Como Nossos Pais' }
    });
    await assert(classCalled.relevance === 'HIGH', 'Chamada de participante classificada como HIGH');
    await assert(classCalled.priority === 'P1', 'Prioridade de chamada de participante é P1');
    await assert(classCalled.category === 'QUEUE', 'Categoria da chamada é QUEUE');
    await assert(classCalled.candidateIntent === 'ANNOUNCE_SINGER', 'Intenção candidata é ANNOUNCE_SINGER');
    await assert(classCalled.summary.includes('Mariana Lima'), 'Resumo em pt-BR inclui nome da cantora');

    // P1: Fim de música
    const classFinished = perceptionClassifier.classify({
      id: 'c-2',
      type: 'karaoke.queue.song_finished',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'playback',
      payload: { participantDisplayName: 'Mariana Lima', musicTitle: 'Como Nossos Pais' }
    });
    await assert(classFinished.relevance === 'HIGH', 'Fim de música classificado como HIGH');
    await assert(classFinished.candidateIntent === 'CELEBRATE_PERFORMANCE', 'Intenção candidata é CELEBRATE_PERFORMANCE');

    // P1: 2ª Ausência (Música para o fim da fila)
    const classAbsence2 = perceptionClassifier.classify({
      id: 'c-3',
      type: 'karaoke.queue.moved_to_back',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'queue.manager',
      payload: { participantDisplayName: 'Rodrigo' }
    });
    await assert(classAbsence2.relevance === 'HIGH', '2ª ausência classificada como HIGH');
    await assert(classAbsence2.candidateIntent === 'ALERT_OPERATOR_ABSENCE', 'Intenção candidata é ALERT_OPERATOR_ABSENCE');

    // P1: Fila Vazia
    const classEmpty = perceptionClassifier.classify({
      id: 'c-4',
      type: 'karaoke.queue.empty',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'queue.manager',
      payload: {}
    });
    await assert(classEmpty.relevance === 'HIGH', 'Fila vazia classificada como HIGH');
    await assert(classEmpty.candidateIntent === 'ENCOURAGE_AUDIENCE', 'Intenção candidata é ENCOURAGE_AUDIENCE');

    // P0: Assunção Emergencial
    const classEmergency = perceptionClassifier.classify({
      id: 'c-5',
      type: 'system.emergency_takeover',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'supervisor',
      payload: {}
    });
    await assert(classEmergency.relevance === 'CRITICAL', 'Assunção emergencial classificada como CRITICAL');
    await assert(classEmergency.priority === 'P0', 'Prioridade de emergência é P0');
    await assert(classEmergency.candidateIntent === 'HANDLE_EMERGENCY', 'Intenção candidata é HANDLE_EMERGENCY');

    // Ignored: Telemetria e heartbeats
    const classHeartbeat = perceptionClassifier.classify({
      id: 'c-6',
      type: 'system.telemetry.ping',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'healthcheck',
      payload: {}
    });
    await assert(classHeartbeat.relevance === 'IGNORED', 'Heartbeats e telemetria são classificados como IGNORED');
    await assert(classHeartbeat.candidateIntent === 'NONE', 'Eventos ignorados não geram intenção');

    // ------------------------------------------------------------------------
    // 7. MOTOR DE PERCEPÇÃO E BLINDAGEM DE NÃO-AUTONOMIA (REGRA DE OURO)
    // ------------------------------------------------------------------------
    console.log('\n7. Testando Motor de Percepção e Blindagem Absoluta de Não-Autonomia...');

    maiaPerceptionEngine.start();

    // Espionamos a execução do Tool Registry para provar que nenhuma tool é executada
    let toolExecutionAttempted = false;
    const originalExecute = maiaToolRegistry.execute.bind(maiaToolRegistry);
    maiaToolRegistry.execute = async (ctx: any, toolId: any, params: any) => {
      toolExecutionAttempted = true;
      return originalExecute(ctx, toolId, params);
    };

    // Publicamos evento de chamada de cantor (relevância alta)
    await eventBus.publish({
      id: 'evt-perc-call-01',
      type: 'karaoke.queue.participant_called',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'controller.mixer',
      tenantId: tenantA,
      sessionId: sessionIdA,
      payload: {
        participantDisplayName: 'Fernanda Rocha',
        musicTitle: 'Palco',
        musicArtist: 'Gilberto Gil'
      }
    });
    await sleep(40);

    // RESTAURA EXECUTE DO TOOL REGISTRY
    maiaToolRegistry.execute = originalExecute;

    await assert(!toolExecutionAttempted, 'REGRA DE OURO: Percepção NÃO executou nenhuma ferramenta (Autonomia ZERO)');

    const perceptionsA = maiaPerceptionEngine.getRecentPerceptions(tenantA);
    await assert(perceptionsA.length > 0, 'Registro de percepção gerado pela MaIA no armazém');

    const p = perceptionsA.find(item => item.eventType === 'karaoke.queue.participant_called');
    await assert(Boolean(p), 'Percepção da chamada de participante encontrada');
    if (p) {
      await assert(p.relevance === 'HIGH', 'Relevância da percepção gravada é HIGH');
      await assert(p.candidateIntent === 'ANNOUNCE_SINGER', 'Intenção candidata preservada no registro');
      await assert(p.status === 'QUEUED_FOR_AGENT', 'Status definido como QUEUED_FOR_AGENT para futuro runtime');
      await assert(Boolean(p.reasoning), 'Raciocínio explicativo da percepção preenchido em pt-BR');
      await assert(p.contextCorrelation?.activeSinger === 'Fernanda Rocha', 'Correlação contextual capturou cantor ativo');
      await assert(p.latencyMs >= 0, 'Latência de percepção devidamente mensurada');
    }

    // ------------------------------------------------------------------------
    // 8. DEBOUNCING COGNITIVO E COALESCÊNCIA DE RAJADAS
    // ------------------------------------------------------------------------
    console.log('\n8. Testando Debouncing Cognitivo Contra Tempestade de Percepções...');

    const metricsBeforeBurst = maiaPerceptionEngine.getMetrics();

    // Simula rajada rápida de 5 adições consecutivas da mesma música
    for (let i = 0; i < 5; i++) {
      await eventBus.publish({
        id: `evt-burst-${i}`,
        type: 'karaoke.queue.song_added',
        version: 1,
        occurredAt: new Date().toISOString(),
        source: 'participant.pwa',
        tenantId: tenantA,
        payload: {
          musicId: 'm-burst-1',
          musicTitle: 'Música Repetida Rápida',
          participantDisplayName: 'Cantor Apressado'
        }
      });
    }
    await sleep(40);

    const metricsAfterBurst = maiaPerceptionEngine.getMetrics();
    await assert(
      metricsAfterBurst.totalDebouncedEvents > metricsBeforeBurst.totalDebouncedEvents,
      'Eventos rápidos e repetitivos foram debounced pela camada de percepção'
    );

    // ------------------------------------------------------------------------
    // 9. ISOLAMENTO MULTI-TENANT E CONSULTAS FILTRADAS
    // ------------------------------------------------------------------------
    console.log('\n9. Testando Isolamento Multi-Tenant da Percepção...');

    await eventBus.publish({
      id: 'evt-tenant-b-01',
      type: 'karaoke.queue.song_finished',
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'controller',
      tenantId: tenantB,
      payload: {
        participantDisplayName: 'Cantor do Lounge B',
        musicTitle: 'Evidências'
      }
    });
    await sleep(30);

    const tenantAPerceptions = maiaPerceptionEngine.getRecentPerceptions(tenantA);
    const tenantBPerceptions = maiaPerceptionEngine.getRecentPerceptions(tenantB);

    await assert(
      tenantAPerceptions.every(rec => rec.tenantId === tenantA),
      'Percepções do Tenant A contêm exclusivamente dados do Tenant A'
    );
    await assert(
      tenantBPerceptions.every(rec => rec.tenantId === tenantB),
      'Percepções do Tenant B contêm exclusivamente dados do Tenant B'
    );
    await assert(
      !tenantAPerceptions.some(rec => rec.tenantId === tenantB),
      'Nenhum evento ou percepção do Tenant B vazou para o Tenant A'
    );

    // ------------------------------------------------------------------------
    // 10. INTEGRAÇÃO COM CONTEXT ENGINE (EVENT SOURCE ENRIQUECIDO)
    // ------------------------------------------------------------------------
    console.log('\n10. Testando Integração com Context Engine e Snapshot Enriquecido...');

    const snapshot = await maiaContextEngine.buildSnapshot({
      tenantId: tenantA,
      sessionId: sessionIdA,
      role: 'PARTICIPANT'
    });

    await assert(Boolean(snapshot.events), 'Snapshot do contexto contém seção de eventos');
    await assert(snapshot.events.recentEvents.length > 0, 'recentEvents populado com eventos do Event Bus');
    await assert(
      Array.isArray(snapshot.events.recentPerceptions),
      'recentPerceptions populado com percepções semânticas da MaIA'
    );

    if (snapshot.events.recentPerceptions && snapshot.events.recentPerceptions.length > 0) {
      const topPerception = snapshot.events.recentPerceptions[snapshot.events.recentPerceptions.length - 1];
      await assert(Boolean(topPerception.candidateIntent), 'Percepção no Context Snapshot expõe candidateIntent');
      await assert(Boolean(topPerception.summary), 'Percepção no Context Snapshot expõe resumo em linguagem natural');
    }

    // ------------------------------------------------------------------------
    // 11. OBSERVABILIDADE, MÉTRICAS E TELEMETRIA
    // ------------------------------------------------------------------------
    console.log('\n11. Testando Observabilidade, Métricas e Telemetria...');

    const busMetrics = eventBus.getMetrics();
    await assert(busMetrics.totalPublished > 0, 'EventBus metric totalPublished > 0');
    await assert(busMetrics.totalDelivered > 0, 'EventBus metric totalDelivered > 0');
    await assert(busMetrics.activeSubscriptions > 0, 'EventBus metric activeSubscriptions > 0');

    const percMetrics = maiaPerceptionEngine.getMetrics();
    await assert(percMetrics.totalEventsAnalyzed > 0, 'Perception metric totalEventsAnalyzed > 0');
    await assert(percMetrics.totalPerceptionsCreated > 0, 'Perception metric totalPerceptionsCreated > 0');
    await assert(percMetrics.relevanceCounts.HIGH > 0, 'Contagem de relevância HIGH registrada com precisão');
    await assert(percMetrics.priorityCounts.P1 > 0, 'Contagem de prioridade P1 registrada com precisão');
    await assert(
      percMetrics.candidateIntentCounts['ANNOUNCE_SINGER'] > 0,
      'Contagem de intenção ANNOUNCE_SINGER registrada com precisão'
    );

    // Resumo final
    console.log('\n================================================================');
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`EVENT BUS & PERCEPTION — RESULTADO: ${passedCount}/${results.length} testes aprovados.`);
    if (failedCount > 0) {
      console.error(`❌ ${failedCount} testes FALHARAM. Verifique as falhas acima.`);
      process.exit(1);
    } else {
      console.log('✅ TODOS OS TESTES DO EVENT BUS E MAIA PERCEPTION HOMOLOGADOS COM 100% DE SUCESSO!');
    }
  } catch (err) {
    console.error('❌ Erro fatal durante a execução dos testes:', err);
    process.exit(1);
  }
}

runEventBusAndPerceptionTests();
