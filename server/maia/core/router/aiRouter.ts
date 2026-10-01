/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA ADVANCED AI ROUTER (PROMPT 07)
 * Camada central de abstração, decisão, orquestração e resiliência entre a MaIA e os provedores de IA.
 * 
 * Princípios Arquiteturais Mandatórios:
 * 1. A MaIA pergunta: "Qual capacidade preciso?" (AITask) e não "Qual modelo Gemini devo chamar?".
 * 2. Desacoplamento absoluto de SDKs proprietários (Gemini, 9router, OpenAI, etc.).
 * 3. Seleção inteligente baseada em tarefas, perfis (ECONÔMICO, BALANCEADO, ALTA CAPACIDADE) e políticas de tenant.
 * 4. Fallback resiliente em cadeia: Provedor Primário -> Provedor Secundário -> Contingência Local.
 * 5. Circuit Breaker ativo por provedor para evitar tempestades de chamadas e cascatas de erro.
 * 6. Governança estrita de BYOK (Bring Your Own Key) com isolamento lógico multi-tenant e mascaramento seguro.
 * 7. Monitoramento de quotas (RPM, limites diários e orçamento mensal em USD) e telemetria detalhada.
 * 8. Resiliência Seção 54: A indisponibilidade de IA JAMAIS pode derrubar o produto VozPlay.
 * 9. Compatibilidade retroativa completa com os componentes existentes da MaIA Core.
 */

import {
  AITask,
  AIProfile,
  AIModelProfile,
  AIRequest,
  AIResponse,
  AIChunk,
  TenantAIRouterPolicy,
  RouterMetrics,
  TokenUsage,
  ProviderHealth
} from './types.js';
import { OFFICIAL_AI_MODELS, getModelProfile, calculateTokenCost } from './models.js';
import { resolveRoute as scoreAndResolveRoute, RouteResolution } from './scoring.js';
import { AICircuitBreaker } from './circuitBreaker.js';
import { AIQuotaTracker } from './quotaTracker.js';
import { BYOKManager } from './byokManager.js';
import { IAIProvider } from './providers/types.js';
import { GeminiProvider } from './providers/geminiProvider.js';
import { NineRouterProvider } from './providers/nineRouterProvider.js';
import { ContingencyProvider } from './providers/contingencyProvider.js';
import {
  AIRouterError,
  AIAuthError,
  AIRateLimitError,
  AIQuotaExceededError,
  AITimeoutError,
  AIProviderUnavailableError,
  AIModelUnavailableError,
  AIPolicyDeniedError,
  AIInvalidRequestError
} from './errors.js';
import { MaiaCoreAIProvider, MaiaCoreTaskType, AICompletionOptions } from '../types.js';
import { MaiaProviderError } from '../errors.js';
import { randomUUID } from 'crypto';

export type { RouteResolution } from './scoring.js';

export interface RouterFallbackOptions<T> {
  tenantId: string;
  task: MaiaCoreTaskType;
  preferredProviderId: string;
  options?: AICompletionOptions;
  action: (provider: MaiaCoreAIProvider) => Promise<T>;
  localContingency: () => T | Promise<T>;
  fallbackChain?: string[];
}

export class MaiaAIRouter {
  // Provedores IAIProvider modernos
  private modernProviders = new Map<string, IAIProvider>();
  // Provedores legados MaiaCoreAIProvider para retrocompatibilidade
  private legacyProviders = new Map<string, MaiaCoreAIProvider>();

  // Políticas por Tenant
  private tenantPolicies = new Map<string, TenantAIRouterPolicy>();

  // Módulos Auxiliares de Governança e Resiliência
  public readonly circuitBreaker: AICircuitBreaker;
  public readonly quotaTracker: AIQuotaTracker;
  public readonly byokManager: BYOKManager;

  // Telemetria e Métricas Acumuladas
  private metrics: RouterMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeoutRequests: 0,
    retriedRequests: 0,
    fallbackRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalEstimatedCostUsd: 0,
    averageLatencyMs: 0,
    requestsByProvider: {},
    requestsByModel: {},
    requestsByTask: {}
  };

  constructor(options?: {
    circuitBreaker?: AICircuitBreaker;
    quotaTracker?: AIQuotaTracker;
    byokManager?: BYOKManager;
  }) {
    this.circuitBreaker = options?.circuitBreaker || new AICircuitBreaker({
      failureThreshold: 5,
      cooldownPeriodMs: 30000,
      successThreshold: 2
    });
    this.quotaTracker = options?.quotaTracker || new AIQuotaTracker();
    this.byokManager = options?.byokManager || new BYOKManager();

    // Inicializa provedores oficiais de fábrica
    this.registerModernProvider(new GeminiProvider());
    this.registerModernProvider(new NineRouterProvider());
    this.registerModernProvider(new ContingencyProvider());
  }

  // ============================================================================
  // 1. REGISTRO E GESTÃO DE PROVEDORES
  // ============================================================================

  /**
   * Registra um provedor moderno que implementa a interface IAIProvider
   */
  public registerModernProvider(provider: IAIProvider): void {
    this.modernProviders.set(provider.id, provider);
  }

  /**
   * Obtém um provedor moderno pelo identificador
   */
  public getModernProvider(id: string): IAIProvider | undefined {
    return this.modernProviders.get(id);
  }

  /**
   * Registra um provedor legado (compatibilidade retroativa com FASE 02)
   */
  public registerProvider(provider: MaiaCoreAIProvider): void {
    this.legacyProviders.set(provider.id, provider);
  }

  /**
   * Obtém um provedor legado pelo identificador
   */
  public getProvider(id: string): MaiaCoreAIProvider | undefined {
    return this.legacyProviders.get(id);
  }

  /**
   * Lista todos os provedores registrados
   */
  public listProviders(): MaiaCoreAIProvider[] {
    return Array.from(this.legacyProviders.values());
  }

  /**
   * Lista os identificadores de todos os provedores modernos ativos
   */
  public listModernProviderIds(): string[] {
    return Array.from(this.modernProviders.keys());
  }

  // ============================================================================
  // 2. POLÍTICAS DE LOCATÁRIO (TENANT POLICIES)
  // ============================================================================

  public setTenantPolicy(policy: TenantAIRouterPolicy): void {
    if (!policy.tenantId) {
      throw new AIInvalidRequestError('tenantId é obrigatório na política de locatário.');
    }
    this.tenantPolicies.set(policy.tenantId, policy);
  }

  public getTenantPolicy(tenantId?: string): TenantAIRouterPolicy | undefined {
    if (!tenantId) return undefined;
    return this.tenantPolicies.get(tenantId);
  }

  // ============================================================================
  // 3. RESOLUÇÃO DE ROTAS (ROUTING ENGINE)
  // ============================================================================

  /**
   * Resolve a melhor rota para uma requisição de IA considerando modelo, tarefa, políticas e perfil
   */
  public resolveRoute(request: AIRequest): RouteResolution {
    const policy = this.getTenantPolicy(request.tenantId);
    const availableProviders = new Set(this.modernProviders.keys());
    return scoreAndResolveRoute(request, policy, availableProviders);
  }

  // ============================================================================
  // 4. EXECUÇÃO PRINCIPAL DE INFERÊNCIA (GENERATE COM RESILIÊNCIA E FALLBACK)
  // ============================================================================

  /**
   * Executa a inferência de IA com seleção de modelo, governança, retry, circuit breaker e fallback em cadeia
   */
  public async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const tenantId = request.tenantId || 'default-tenant';

    // 1. Verificação preliminar de quotas e travas orçamentárias
    this.quotaTracker.assertCanExecute(tenantId);

    // 2. Política do Tenant
    const policy = this.getTenantPolicy(tenantId);
    if (policy && !policy.aiEnabled) {
      throw new AIPolicyDeniedError('Serviço de IA desativado para este tenant.', { tenantId });
    }

    // 3. Recuperação de Credenciais BYOK isoladas por Tenant
    const { apiKey, state: byokState } = this.byokManager.getEffectiveApiKey(tenantId);

    // 4. Resolução da rota primária recomendada
    let primaryRoute: RouteResolution;
    try {
      primaryRoute = this.resolveRoute(request);
    } catch (err: any) {
      // Se nenhum modelo atendeu à política mas contingência está disponível
      if (this.modernProviders.has('contingency')) {
        const contingency = this.modernProviders.get('contingency')!;
        return this.executeContingency(contingency, request, 'Resolução de rota rejeitada pela política');
      }
      throw err;
    }

    // 5. Construção da cadeia de candidatos para fallback
    const candidateChain = this.buildCandidateChain(request, primaryRoute, policy);

    let lastError: any = null;
    const attemptedProviders: string[] = [];

    // 6. Tentativa de execução através da cadeia de provedores
    for (let i = 0; i < candidateChain.length; i++) {
      const candidate = candidateChain[i];
      const providerId = candidate.providerId;
      const modelId = candidate.modelId;
      const provider = this.modernProviders.get(providerId);

      if (!provider) continue;

      attemptedProviders.push(providerId);

      // A. Verificação do Circuit Breaker para este provedor
      try {
        this.circuitBreaker.assertCanCall(providerId);
      } catch (cbError: any) {
        lastError = cbError;
        continue; // Pula para o próximo provedor se o circuito estiver ABERTO
      }

      // B. Execução da chamada com tentativa e retry em caso de falha transitória
      const maxRetries = candidate.isContingency ? 0 : 1;
      let attempt = 0;

      while (attempt <= maxRetries) {
        try {
          if (attempt > 0) {
            this.metrics.retriedRequests++;
            // Pequeno backoff exponencial para falhas transitórias
            await new Promise(r => setTimeout(r, 200 * attempt));
          }

          const response = await provider.generate(request, modelId, apiKey);

          // Sucesso! Registra no Circuit Breaker e na Quota
          this.circuitBreaker.recordSuccess(providerId);

          const latencyMs = Date.now() - startTime;
          const cost = response.usage.estimatedCost || 0;

          this.quotaTracker.recordUsage(
            tenantId,
            response.usage.inputTokens,
            response.usage.outputTokens,
            cost
          );

          // Atualiza métricas acumuladas
          this.recordSuccessMetrics(providerId, modelId, request.task, response.usage, latencyMs, i > 0);

          return {
            ...response,
            fromFallback: i > 0 || candidate.isContingency,
            fallbackChain: attemptedProviders,
            latencyMs
          };
        } catch (err: any) {
          lastError = err;
          attempt++;

          if (err instanceof AITimeoutError) {
            this.metrics.timeoutRequests++;
          }

          // Se não for um erro passível de retry, interrompe as tentativas deste provedor
          if (!err?.isRetryable || attempt > maxRetries) {
            break;
          }
        }
      }

      // Provedor falhou após todas as tentativas: registra no Circuit Breaker
      this.circuitBreaker.recordFailure(providerId, lastError);
    }

    // 7. Se todos os provedores remotos falharam, ativa contingência determinística local
    const contingencyProvider = this.modernProviders.get('contingency');
    if (contingencyProvider) {
      return this.executeContingency(contingencyProvider, request, lastError?.message || 'Blackout de provedores');
    }

    // Falha irrecuperável se contingência estiver desabilitada
    this.metrics.failedRequests++;
    throw new AIProviderUnavailableError(
      'Todos os provedores',
      `Todos os provedores de IA falharam na cadeia: [${attemptedProviders.join(', ')}]. Causa: ${lastError?.message || lastError}`,
      { tenantId }
    );
  }

  // ============================================================================
  // 5. STREAMING DE TOKENS (CHUNK-BY-CHUNK)
  // ============================================================================

  /**
   * Executa a geração em streaming de chunks normalizados
   */
  public async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    const tenantId = request.tenantId || 'default-tenant';
    this.quotaTracker.assertCanExecute(tenantId);

    const { apiKey } = this.byokManager.getEffectiveApiKey(tenantId);
    const route = this.resolveRoute(request);
    const provider = this.modernProviders.get(route.providerId);

    if (!provider || !provider.stream) {
      // Fallback para generate se o provedor não suportar streaming nativo
      const resp = await this.generate(request);
      yield {
        text: resp.content,
        isLast: true,
        finishReason: resp.finishReason,
        usage: resp.usage
      };
      return;
    }

    try {
      this.circuitBreaker.assertCanCall(route.providerId);
      for await (const chunk of provider.stream(request, route.modelId, apiKey)) {
        yield chunk;
      }
      this.circuitBreaker.recordSuccess(route.providerId);
    } catch (err: any) {
      this.circuitBreaker.recordFailure(route.providerId, err);
      // Em caso de falha de streaming, devolve resposta de contingência
      const contingency = this.modernProviders.get('contingency');
      if (contingency) {
        const fallbackResp = await contingency.generate(request, 'contingency-local');
        yield {
          text: fallbackResp.content,
          isLast: true,
          finishReason: 'STOP'
        };
      } else {
        throw err;
      }
    }
  }

  // ============================================================================
  // 6. HEALTH CHECK UNIFICADO
  // ============================================================================

  public async checkHealth(providerId?: string): Promise<Record<string, ProviderHealth>> {
    const results: Record<string, ProviderHealth> = {};
    if (providerId) {
      const p = this.modernProviders.get(providerId);
      if (p) {
        results[providerId] = await p.checkHealth();
      }
      return results;
    }

    for (const [id, provider] of this.modernProviders.entries()) {
      results[id] = await provider.checkHealth();
    }
    return results;
  }

  // ============================================================================
  // 7. TELEMETRIA E MÉTRICAS
  // ============================================================================

  public getMetrics(): RouterMetrics {
    return {
      ...this.metrics,
      requestsByProvider: { ...this.metrics.requestsByProvider },
      requestsByModel: { ...this.metrics.requestsByModel },
      requestsByTask: { ...this.metrics.requestsByTask }
    };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      retriedRequests: 0,
      fallbackRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCostUsd: 0,
      averageLatencyMs: 0,
      requestsByProvider: {},
      requestsByModel: {},
      requestsByTask: {}
    };
  }

  // ============================================================================
  // 8. RETROCOMPATIBILIDADE (FASE 02 & RUNTIME AGENT)
  // ============================================================================

  /**
   * Executa uma ação com fallback automático e contingência local (compatibilidade retroativa)
   */
  public async executeWithFallback<T>(params: RouterFallbackOptions<T>): Promise<{
    result: T;
    usedProviderId: string;
    fallbackOccurred: boolean;
  }> {
    const chain = params.fallbackChain && params.fallbackChain.length > 0
      ? [params.preferredProviderId, ...params.fallbackChain.filter(p => p !== params.preferredProviderId)]
      : [params.preferredProviderId];

    let lastError: any = null;

    for (let i = 0; i < chain.length; i++) {
      const providerId = chain[i];
      const provider = this.legacyProviders.get(providerId);

      if (!provider) {
        continue;
      }

      try {
        const result = await params.action(provider);
        return {
          result,
          usedProviderId: providerId,
          fallbackOccurred: i > 0
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[MaiaAIRouter] Falha no provedor legado '${providerId}' para tarefa '${params.task}': ${err?.message || err}. Tentando próximo provedor na cadeia...`);
      }
    }

    // Se todos os provedores legados falharem, aciona a contingência local
    console.warn(`[MaiaAIRouter] Todos os provedores legados falharam para a tarefa '${params.task}'. Ativando contingência local.`);
    try {
      const contingencyResult = await params.localContingency();
      return {
        result: contingencyResult,
        usedProviderId: 'local_contingency',
        fallbackOccurred: true
      };
    } catch (contingencyErr) {
      throw new MaiaProviderError(
        `Falha irrecuperável em todos os provedores de IA e na contingência local: ${lastError?.message || contingencyErr}`,
        { cause: contingencyErr }
      );
    }
  }

  // ============================================================================
  // MÉTODOS INTERNOS AUXILIARES
  // ============================================================================

  private buildCandidateChain(
    request: AIRequest,
    primaryRoute: RouteResolution,
    policy?: TenantAIRouterPolicy
  ): Array<{ providerId: string; modelId: string; isContingency: boolean }> {
    const chain: Array<{ providerId: string; modelId: string; isContingency: boolean }> = [];

    // Se houver preferência explícita por provedor registrado diferente da rota primária, testa-o primeiro
    if (
      request.providerPreference &&
      this.modernProviders.has(request.providerPreference) &&
      request.providerPreference !== primaryRoute.providerId
    ) {
      chain.push({
        providerId: request.providerPreference,
        modelId: request.modelPreference || 'default',
        isContingency: request.providerPreference === 'contingency'
      });
    }

    // 1. Candidato Primário
    chain.push({
      providerId: primaryRoute.providerId,
      modelId: primaryRoute.modelId,
      isContingency: primaryRoute.providerId === 'contingency'
    });

    // Se o primário já é contingência, não há o que encadear
    if (primaryRoute.providerId === 'contingency') {
      return chain;
    }

    // 2. Candidato Secundário (Gateway alternativo ou Gemini nativo)
    if (primaryRoute.providerId === 'gemini') {
      // Alternativa: 9router se compatível e não desabilitado
      if (
        this.modernProviders.has('9router') &&
        (!policy || !policy.disallowedProviders.includes('9router'))
      ) {
        const altModel = primaryRoute.modelId === 'gemini-3.1-pro-preview'
          ? '9router/gemini-3.1-pro-preview'
          : '9router/gemini-3.8-flash';
        chain.push({ providerId: '9router', modelId: altModel, isContingency: false });
      }
    } else if (primaryRoute.providerId === '9router') {
      // Alternativa: Gemini nativo
      if (
        this.modernProviders.has('gemini') &&
        (!policy || !policy.disallowedProviders.includes('gemini'))
      ) {
        const altModel = primaryRoute.modelId.includes('pro')
          ? 'gemini-3.1-pro-preview'
          : 'gemini-3.8-flash';
        chain.push({ providerId: 'gemini', modelId: altModel, isContingency: false });
      }
    }

    // 3. Provedor de contingência local sempre no fim da cadeia
    if (this.modernProviders.has('contingency')) {
      chain.push({ providerId: 'contingency', modelId: 'contingency-local', isContingency: true });
    }

    return chain;
  }

  private async executeContingency(
    provider: IAIProvider,
    request: AIRequest,
    reason: string
  ): Promise<AIResponse> {
    const res = await provider.generate(request, 'contingency-local');
    this.metrics.fallbackRequests++;
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    return {
      ...res,
      fromFallback: true,
      fallbackChain: ['contingency']
    };
  }

  private recordSuccessMetrics(
    providerId: string,
    modelId: string,
    task: AITask,
    usage: TokenUsage,
    latencyMs: number,
    isFallback: boolean
  ): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    if (isFallback) {
      this.metrics.fallbackRequests++;
    }

    this.metrics.totalInputTokens += usage.inputTokens;
    this.metrics.totalOutputTokens += usage.outputTokens;
    this.metrics.totalEstimatedCostUsd = Number(
      (this.metrics.totalEstimatedCostUsd + (usage.estimatedCost || 0)).toFixed(6)
    );

    // Média móvel ponderada simples de latência
    const prevCount = this.metrics.successfulRequests - 1;
    this.metrics.averageLatencyMs = Math.round(
      (this.metrics.averageLatencyMs * prevCount + latencyMs) / this.metrics.successfulRequests
    );

    this.metrics.requestsByProvider[providerId] = (this.metrics.requestsByProvider[providerId] || 0) + 1;
    this.metrics.requestsByModel[modelId] = (this.metrics.requestsByModel[modelId] || 0) + 1;
    this.metrics.requestsByTask[task] = (this.metrics.requestsByTask[task] || 0) + 1;
  }
}

export const maiaAIRouter = new MaiaAIRouter();
