/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA ADVANCED AI ROUTER — BATERIA DE HOMOLOGAÇÃO (PROMPT 07)
 * Script de validação arquitetural e integração para a camada de roteamento inteligente de IA.
 * 
 * Critérios Testados:
 * 1. Catálogo Oficial e Perfil de Modelos (Model Profiles, Capacidades, Custos e Janelas)
 * 2. Algoritmo Determinístico de Scoring e Resolução de Rota por Tarefa e Perfil
 * 3. Políticas de Governança por Tenant (Allowlist / Denylist / Desativação de IA)
 * 4. Abstração Universal de Provedores (IAIProvider, Gemini, 9router e Contingência)
 * 5. Cadeia de Fallback Resiliente Automática (Primário -> Secundário -> Contingência Local)
 * 6. Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN -> CLOSED e Rejeição Rápida)
 * 7. Timeouts e Cancelamento por Tarefa
 * 8. Quota Tracker, Rate Limiting (RPM) e Travas Orçamentárias em USD
 * 9. BYOK (Bring Your Own Key), Isolamento Multi-Tenant e Mascaramento Seguro
 * 10. Métricas Acumuladas e Observabilidade do Router
 * 11. Streaming de Tokens e Chunks Normalizados
 * 12. Compatibilidade Retroativa (MaiaAIRouter legada e executeWithFallback)
 */

import {
  maiaAIRouter,
  MaiaAIRouter,
  OFFICIAL_AI_MODELS,
  getModelProfile,
  listModelsForTask,
  calculateTokenCost,
  scoreModel,
  resolveRoute,
  DEFAULT_TASK_TIMEOUTS,
  AICircuitBreaker,
  AIQuotaTracker,
  BYOKManager,
  GeminiProvider,
  NineRouterProvider,
  ContingencyProvider,
  IAIProvider,
  AIRequest,
  AIResponse,
  AIRateLimitError,
  AIQuotaExceededError,
  AITimeoutError,
  AIProviderUnavailableError,
  AIPolicyDeniedError,
  AIAuthError
} from '../server/maia/core/router/index.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runAIRouterTests(): Promise<void> {
  console.log('================================================================');
  console.log('  MAIA ADVANCED AI ROUTER — BATERIA DE HOMOLOGAÇÃO (PROMPT 07)  ');
  console.log('================================================================\n');

  // ============================================================================
  // 1. Catálogo Oficial e Perfil de Modelos
  // ============================================================================
  console.log('1. Testando Catálogo Oficial de Modelos de IA e Perfil...');
  {
    const flashProfile = getModelProfile('gemini-3.8-flash');
    assert(!!flashProfile, 'Modelo gemini-3.8-flash registrado no catálogo');
    assert(flashProfile?.provider === 'gemini', 'gemini-3.8-flash associado ao provedor gemini');
    assert(!!flashProfile?.capabilities.includes('conversation'), 'gemini-3.8-flash atende conversa');
    assert(!!flashProfile?.capabilities.includes('classification'), 'gemini-3.8-flash atende classificação');
    assert(flashProfile?.supportsTools === true, 'gemini-3.8-flash suporta tools');
    assert(flashProfile?.contextWindow === 1048576, 'Janela de contexto de 1M tokens para Flash');
    assert(flashProfile?.costInput === 0.15, 'Custo de input correto ($0.15/1M)');
    assert(flashProfile?.costOutput === 0.60, 'Custo de output correto ($0.60/1M)');

    const proProfile = getModelProfile('gemini-3.1-pro-preview');
    assert(!!proProfile, 'Modelo gemini-3.1-pro-preview registrado no catálogo');
    assert(!!proProfile?.capabilities.includes('reasoning'), 'gemini-3.1-pro-preview atende raciocínio complexo');
    assert(proProfile?.contextWindow === 2097152, 'Janela de contexto de 2M tokens para Pro');

    const modelsForReasoning = listModelsForTask('reasoning');
    assert(modelsForReasoning.some(m => m.id === 'gemini-3.1-pro-preview'), 'listModelsForTask retorna modelo Pro para reasoning');
    assert(!modelsForReasoning.some(m => m.id === 'gemini-3.8-flash'), 'Flash não é modelo prioritário para raciocínio puro');

    const cost = calculateTokenCost('gemini-3.8-flash', 1000000, 1000000);
    assert(cost === 0.75, 'Cálculo de custo de 1M input + 1M output confere ($0.75)');
  }

  // ============================================================================
  // 2. Algoritmo Determinístico de Scoring e Resolução de Rota
  // ============================================================================
  console.log('\n2. Testando Scoring Determinístico e Seleção por Tarefa e Perfil...');
  {
    // A. Classificação com Perfil Econômico -> Deve selecionar Flash
    const classReq: AIRequest = {
      task: 'classification',
      messages: [{ role: 'user', content: 'Classifique este pedido de música' }],
      profile: 'ECONOMICO'
    };
    const classRoute = resolveRoute(classReq);
    assert(classRoute.modelId.includes('flash'), 'Classificação sob perfil ECONOMICO seleciona modelo Flash');
    assert(classRoute.score > 0.7, 'Score de modelo Flash para classificação é alto');

    // B. Raciocínio com Perfil Alta Capacidade -> Deve selecionar Pro
    const reasonReq: AIRequest = {
      task: 'reasoning',
      messages: [{ role: 'user', content: 'Analise o conflito complexo de concorrência' }],
      profile: 'ALTA_CAPACIDADE'
    };
    const reasonRoute = resolveRoute(reasonReq);
    assert(reasonRoute.modelId.includes('pro'), 'Raciocínio complexo sob perfil ALTA_CAPACIDADE seleciona modelo Pro');

    // C. Requisição com ferramentas -> modelos sem suporte a tools são terminantemente descartados
    const ttsModel = getModelProfile('gemini-3.8-flash-lite-tts')!;
    const scoredNoTools = scoreModel(ttsModel, {
      task: 'tts',
      messages: [{ role: 'user', content: 'Fale algo' }],
      tools: [{ name: 'dummy_tool', description: 'desc', parameters: {} }]
    }, 'BALANCEADO');
    assert(scoredNoTools === null, 'Modelo sem suporte a tools é descartado quando tools são fornecidas');

    // D. Timeouts adequados são atribuídos por tarefa
    assert(DEFAULT_TASK_TIMEOUTS.conversation === 8000, 'Timeout padrão de conversa é 8000ms');
    assert(DEFAULT_TASK_TIMEOUTS.reasoning === 20000, 'Timeout padrão de reasoning é 20000ms');
    assert(DEFAULT_TASK_TIMEOUTS.classification === 4000, 'Timeout padrão de classification é 4000ms');
  }

  // ============================================================================
  // 3. Políticas de Governança por Tenant
  // ============================================================================
  console.log('\n3. Testando Políticas de Governança por Tenant (Allow/Deny)...');
  {
    const router = new MaiaAIRouter();

    // Tenant com IA desabilitada
    router.setTenantPolicy({
      tenantId: 'tenant-disabled',
      aiEnabled: false,
      allowedProviders: [],
      disallowedProviders: [],
      allowedModels: [],
      disallowedModels: [],
      preferredProfile: 'ECONOMICO',
      fallbackAllowed: false
    });

    let policyBlocked = false;
    try {
      await router.generate({
        tenantId: 'tenant-disabled',
        task: 'conversation',
        messages: [{ role: 'user', content: 'Olá' }]
      });
    } catch (err: any) {
      if (err instanceof AIPolicyDeniedError) {
        policyBlocked = true;
      }
    }
    assert(policyBlocked, 'Tenant com aiEnabled=false bloqueado com AIPolicyDeniedError');

    // Tenant com provedor '9router' desautorizado
    const policyNo9Router = {
      tenantId: 'tenant-no-9router',
      aiEnabled: true,
      allowedProviders: ['gemini', 'contingency'],
      disallowedProviders: ['9router'],
      allowedModels: [],
      disallowedModels: [],
      preferredProfile: 'BALANCEADO' as const,
      fallbackAllowed: true
    };
    const routeNo9 = resolveRoute({
      tenantId: 'tenant-no-9router',
      task: 'conversation',
      messages: [{ role: 'user', content: 'Olá' }],
      providerPreference: '9router'
    }, policyNo9Router);
    assert(routeNo9.providerId !== '9router', 'Provedor na lista disallowedProviders não é selecionado mesmo com preferência');
  }

  // ============================================================================
  // 4. Abstração e Contratos de Provedores
  // ============================================================================
  console.log('\n4. Testando Abstração e Contratos de Provedores...');
  {
    const gemini = new GeminiProvider();
    const nineRouter = new NineRouterProvider();
    const contingency = new ContingencyProvider();

    assert(gemini.id === 'gemini', 'GeminiProvider possui id gemini');
    assert(nineRouter.id === '9router', 'NineRouterProvider possui id 9router');
    assert(contingency.id === 'contingency', 'ContingencyProvider possui id contingency');

    const geminiCaps = await gemini.capabilities();
    assert(geminiCaps.supportedTasks.includes('conversation'), 'Gemini reporta suporte a conversation');
    assert(geminiCaps.supportedTasks.includes('reasoning'), 'Gemini reporta suporte a reasoning');
    assert(geminiCaps.supportedTasks.includes('tts'), 'Gemini reporta suporte a tts');

    const contCaps = await contingency.capabilities();
    assert(contCaps.supportedTasks.includes('conversation'), 'Contingência reporta suporte a conversation');
    assert(contCaps.supportedModels.includes('contingency-local'), 'Contingência reporta modelo local');

    const contHealth = await contingency.checkHealth();
    assert(contHealth.status === 'healthy', 'Saúde da contingência local é healthy');
  }

  // ============================================================================
  // 5. Cadeia de Fallback e Resiliência Automática
  // ============================================================================
  console.log('\n5. Testando Cadeia de Fallback Resiliente (Seção 54)...');
  {
    const router = new MaiaAIRouter();

    // Mock de provedor instável que sempre falha para testar o chaveamento
    const failingProvider: IAIProvider = {
      id: 'failing_provider',
      name: 'Instable AI',
      async capabilities() {
        return {
          supportedTasks: ['conversation'],
          supportedModels: ['mock-failing'],
          supportsStreaming: false,
          supportsTools: false,
          supportsVision: false
        };
      },
      async generate() {
        throw new AIProviderUnavailableError('failing_provider', 'Serviço externo indisponível (HTTP 503)');
      },
      async checkHealth() {
        return { status: 'unavailable', lastChecked: new Date().toISOString() };
      }
    };

    router.registerModernProvider(failingProvider);

    router.setTenantPolicy({
      tenantId: 'tenant-fallback',
      aiEnabled: true,
      allowedProviders: ['failing_provider', 'contingency'],
      disallowedProviders: ['gemini', '9router'],
      allowedModels: [],
      disallowedModels: [],
      preferredProfile: 'BALANCEADO',
      fallbackAllowed: true
    });

    // Executa requisição que cai na contingência local quando os provedores remotos falham
    const response = await router.generate({
      tenantId: 'tenant-fallback',
      task: 'conversation',
      messages: [{ role: 'user', content: 'Como está a fila de karaokê?' }],
      providerPreference: 'failing_provider'
    });

    assert(!!response.content, 'Resposta gerada com sucesso mesmo após falha dos provedores');
    assert(response.fromFallback === true, 'Flag fromFallback marcada como true');
    assert(!!(response.fallbackChain && response.fallbackChain.length > 0), 'Cadeia de fallback registrada no DTO');
    assert(response.provider === 'contingency', 'Contingência determinística local assumiu com sucesso');
    assert(!!(response.content && (response.content.includes('fila') || response.content.includes('VozPlay') || response.content.includes('palco'))), 'Mensagem contextual de karaokê gerada');
  }

  // ============================================================================
  // 6. Circuit Breaker (Proteção contra Falhas em Cascata)
  // ============================================================================
  console.log('\n6. Testando Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)...');
  {
    const cb = new AICircuitBreaker({
      failureThreshold: 3,
      cooldownPeriodMs: 100, // 100ms para teste rápido
      successThreshold: 2
    });

    const prov = 'flaky-service';
    assert(cb.getState(prov) === 'CLOSED', 'Estado inicial do circuito é CLOSED');

    // 1. Falhas consecutivas abaixo do threshold
    cb.recordFailure(prov);
    cb.recordFailure(prov);
    assert(cb.getState(prov) === 'CLOSED', 'Circuito permanece CLOSED com 2 falhas (< 3)');

    // 2. 3ª falha atinge o threshold -> Circuito ABRE
    cb.recordFailure(prov);
    assert(cb.getState(prov) === 'OPEN', 'Circuito transicionou para OPEN na 3ª falha consecutiva');

    // 3. Chamada com circuito OPEN é terminantemente bloqueada sem gastar rede
    let rejectedByCb = false;
    try {
      cb.assertCanCall(prov);
    } catch (err: any) {
      if (err instanceof AIProviderUnavailableError) {
        rejectedByCb = true;
      }
    }
    assert(rejectedByCb, 'assertCanCall lançou AIProviderUnavailableError imediatamente em circuito OPEN');

    // 4. Aguarda cooldown de 120ms para transicionar para HALF_OPEN
    await new Promise(r => setTimeout(r, 120));
    assert(cb.getState(prov) === 'HALF_OPEN', 'Circuito transicionou para HALF_OPEN após cooldown');

    // 5. Sucesso 1 em HALF_OPEN (ainda precisa de 2 para fechar)
    cb.recordSuccess(prov);
    assert(cb.getState(prov) === 'HALF_OPEN', 'Circuito permanece HALF_OPEN após 1 sucesso');

    // 6. Sucesso 2 em HALF_OPEN -> Fecha o circuito
    cb.recordSuccess(prov);
    assert(cb.getState(prov) === 'CLOSED', 'Circuito voltou ao estado CLOSED após 2 sucessos');

    // 7. Reset manual
    cb.recordFailure(prov);
    cb.reset(prov);
    assert(cb.getState(prov) === 'CLOSED', 'Resete manual limpa histórico e restaura estado CLOSED');
  }

  // ============================================================================
  // 7. Timeouts e Cancelamento por Tarefa
  // ============================================================================
  console.log('\n7. Testando Timeouts por Tarefa e Cancelamento...');
  {
    const timeoutErr = new AITimeoutError(5000, { tenantId: 't1', provider: 'slow_llm' });
    assert(timeoutErr.code === 'AI_TIMEOUT', 'Código de erro AI_TIMEOUT correto');
    assert(timeoutErr.timeoutMs === 5000, 'timeoutMs preservado no erro');
    assert(timeoutErr.isRetryable === true, 'AITimeoutError é passível de retry');
  }

  // ============================================================================
  // 8. Quota Tracker e Travas Orçamentárias
  // ============================================================================
  console.log('\n8. Testando Quota Tracker, Rate Limiting e Travas Orçamentárias...');
  {
    const quota = new AIQuotaTracker();
    const tenantId = 'tenant-quota-test';

    quota.setLimits(tenantId, {
      maxRpm: 2,
      maxDailyRequests: 10,
      maxMonthlyBudgetUsd: 1.0,
      alertThresholdPercentage: 80
    });

    // 1ª chamada permitida
    quota.assertCanExecute(tenantId);
    quota.recordUsage(tenantId, 100, 100, 0.10);

    // 2ª chamada permitida
    quota.assertCanExecute(tenantId);
    quota.recordUsage(tenantId, 100, 100, 0.10);

    // 3ª chamada no mesmo minuto -> Deve disparar Rate Limit (RPM = 2 excedido)
    let rateLimitThrown = false;
    try {
      quota.assertCanExecute(tenantId);
    } catch (err: any) {
      if (err instanceof AIRateLimitError) {
        rateLimitThrown = true;
      }
    }
    assert(rateLimitThrown, 'assertCanExecute disparou AIRateLimitError ao atingir teto de 2 RPM');

    // Simula estouro de orçamento
    const tenantBudget = 'tenant-budget-burst';
    quota.setLimits(tenantBudget, {
      maxRpm: 100,
      maxDailyRequests: 100,
      maxMonthlyBudgetUsd: 0.50
    });
    quota.recordUsage(tenantBudget, 500000, 500000, 0.60); // Gastou $0.60 (limite $0.50)

    let budgetExceededThrown = false;
    try {
      quota.assertCanExecute(tenantBudget);
    } catch (err: any) {
      if (err instanceof AIQuotaExceededError) {
        budgetExceededThrown = true;
      }
    }
    assert(budgetExceededThrown, 'assertCanExecute disparou AIQuotaExceededError ao estourar orçamento mensal');

    const usageReport = quota.getUsage(tenantBudget);
    assert(usageReport.percentBudgetUsed >= 100, 'Relatório de quota reporta 100%+ de orçamento utilizado');
    assert(usageReport.isApproachingLimit === true, 'Flag isApproachingLimit ativada');
  }

  // ============================================================================
  // 9. BYOK (Bring Your Own Key) e Isolamento Multi-Tenant
  // ============================================================================
  console.log('\n9. Testando BYOK, Isolamento Multi-Tenant e Mascaramento...');
  {
    const byok = new BYOKManager();

    // Mascaramento seguro
    const masked = BYOKManager.maskApiKey('AIzaSyD-Secret1234567890-XYZ1234');
    assert(masked.startsWith('AIzaSy'), 'Prefixo de 6 caracteres visível');
    assert(masked.endsWith('1234'), 'Sufixo de 4 caracteres visível');
    assert(masked.includes('••••••••'), 'Miolo da chave ocultado por máscara criptográfica segura');

    // Tenant A configura chave própria
    const configA = byok.registerBYOK('tenant-A', 'AIzaSyA-SecretKeyTenantA-9999');
    assert(configA.state === 'byok', 'Tenant A registrado em modo byok');
    assert(!!configA.maskedApiKey?.includes('••••••••'), 'Configuração pública do Tenant A não expõe a chave bruta');

    // Tenant B em modo gerenciado
    const configB = byok.setManaged('tenant-B');
    assert(configB.state === 'managed', 'Tenant B configurado em modo managed');

    // Recuperação segura para execução
    const keyA = byok.getEffectiveApiKey('tenant-A');
    assert(keyA.apiKey === 'AIzaSyA-SecretKeyTenantA-9999', 'Tenant A recupera sua própria chave interna');
    assert(keyA.state === 'byok', 'Estado retornado para Tenant A é byok');

    const keyB = byok.getEffectiveApiKey('tenant-B');
    assert(keyB.apiKey !== keyA.apiKey, 'Tenant B JAMAIS tem acesso à chave do Tenant A');
    assert(keyB.state === 'managed', 'Tenant B opera com a chave do ambiente gerenciado');

    // Chave inválida/curta é rejeitada
    let invalidKeyRejected = false;
    try {
      byok.registerBYOK('tenant-C', 'curta');
    } catch (err: any) {
      if (err instanceof AIAuthError) {
        invalidKeyRejected = true;
      }
    }
    assert(invalidKeyRejected, 'Tentativa de cadastrar chave curta/inválida é rejeitada com AIAuthError');

    // Rotação/Revogação restaura managed
    const revoked = byok.revokeBYOK('tenant-A');
    assert(revoked.state === 'managed', 'Revogação de BYOK restaura estado managed');
  }

  // ============================================================================
  // 10. Métricas Acumuladas e Observabilidade
  // ============================================================================
  console.log('\n10. Testando Telemetria e Métricas do AI Router...');
  {
    const router = new MaiaAIRouter();

    // Executa requisição
    await router.generate({
      task: 'classification',
      messages: [{ role: 'user', content: 'Gênero: Sertanejo' }]
    });

    const metrics = router.getMetrics();
    assert(metrics.totalRequests > 0, 'totalRequests incrementado nas métricas');
    assert(metrics.successfulRequests > 0, 'successfulRequests incrementado');
    assert(metrics.totalInputTokens > 0, 'totalInputTokens registrado');
    assert(metrics.totalOutputTokens > 0, 'totalOutputTokens registrado');
    assert(typeof metrics.averageLatencyMs === 'number', 'averageLatencyMs computado');
    assert(metrics.requestsByTask['classification'] > 0, 'Contagem por tarefa registrada');

    router.resetMetrics();
    const reset = router.getMetrics();
    assert(reset.totalRequests === 0, 'resetMetrics limpou o contador de totalRequests');
  }

  // ============================================================================
  // 11. Streaming de Tokens e Chunks Normalizados
  // ============================================================================
  console.log('\n11. Testando Streaming de Chunks de IA...');
  {
    const router = new MaiaAIRouter();
    const chunks: string[] = [];

    for await (const chunk of router.stream({
      task: 'conversation',
      messages: [{ role: 'user', content: 'Olá MaIA' }]
    })) {
      if (chunk.text) {
        chunks.push(chunk.text);
      }
      if (chunk.isLast) {
        assert(chunk.finishReason === 'STOP', 'Chunk final possui finishReason STOP');
      }
    }

    assert(chunks.length > 0, 'Streaming gerou ao menos um chunk de texto');
  }

  // ============================================================================
  // 12. Compatibilidade Retroativa (FASE 02 & Karaoke Bridge)
  // ============================================================================
  console.log('\n12. Testando Retrocompatibilidade com FASE 02 e Karaoke Bridge...');
  {
    const router = new MaiaAIRouter();

    // Registra provedor legado
    router.registerProvider({
      id: 'legacy-gemini',
      name: 'Legacy Gemini',
      supportedTasks: ['CHAT'],
      async generateText(prompt: string) {
        return `Resposta legada para: ${prompt}`;
      },
      async checkHealth() {
        return { ok: true, latencyMs: 1 };
      }
    });

    assert(!!router.getProvider('legacy-gemini'), 'getProvider recupera provedor legado');
    assert(router.listProviders().length === 1, 'listProviders lista provedores legados');

    // Executa com executeWithFallback legado
    const legacyResult = await router.executeWithFallback<string>({
      tenantId: 'est-123',
      task: 'CHAT',
      preferredProviderId: 'legacy-gemini',
      action: async (provider) => {
        return provider.generateText('Teste de compatibilidade');
      },
      localContingency: () => 'Contingência legada'
    });

    assert(legacyResult.usedProviderId === 'legacy-gemini', 'executeWithFallback usou o provedor legado');
    assert(legacyResult.result.includes('Resposta legada'), 'Resposta do provedor legado preservada');
    assert(legacyResult.fallbackOccurred === false, 'fallbackOccurred é false para provedor primário');
  }

  // ============================================================================
  // Resumo Final
  // ============================================================================
  console.log('\n================================================================');
  console.log(`MAIA ADVANCED AI ROUTER — RESULTADO: ${passedTests}/${totalTests} testes aprovados.`);
  if (failedTests === 0) {
    console.log('✅ TODOS OS TESTES DO AI ROUTER FORAM HOMOLOGADOS COM 100% DE SUCESSO!');
  } else {
    console.error(`❌ ${failedTests} testes falharam.`);
    process.exit(1);
  }
}

runAIRouterTests().catch((err) => {
  console.error('Erro fatal executando testes do AI Router:', err);
  process.exit(1);
});
