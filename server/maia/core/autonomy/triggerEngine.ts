/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AUTONOMY TRIGGER ENGINE (PROMPT 10 - Seções 10, 11, 12, 14 e 15)
 * Motor determinístico de avaliação de gatilhos proativos da MaIA.
 * 
 * Regras Inegociáveis:
 * 1. O LLM NÃO tem autoridade para criar gatilhos persistentes arbitrários.
 * 2. Fluxo obrigatório: Evento -> Perception/Trigger -> Agent Runtime -> Policy Engine -> Tool.
 * 3. Cooldown ativo contra tempestades de eventos e repetições repetitivas.
 * 4. Idempotência estrita por chave de contexto.
 */

import { AutonomyTrigger, AutonomyTriggerContext } from './types.js';
import { MaiaAutonomyCooldownActiveError } from './errors.js';

export class AutonomyTriggerEngine {
  private triggers = new Map<string, AutonomyTrigger>();
  
  // Cooldowns ativos: key = `${tenantId}:${triggerId}:${entityId}` -> timestamp do último disparo
  private cooldowns = new Map<string, number>();

  // Deduplicação de eventos processados dentro de uma janela deslizante
  private processedEvents = new Map<string, number>();
  private readonly deduplicationWindowMs = 60000; // 1 minuto

  /**
   * Registra um gatilho aprovado pelo sistema
   */
  public registerTrigger(trigger: AutonomyTrigger): void {
    this.triggers.set(trigger.id, trigger);
  }

  /**
   * Lista todos os gatilhos registrados
   */
  public listTriggers(): AutonomyTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Obtém um gatilho pelo ID
   */
  public getTrigger(id: string): AutonomyTrigger | undefined {
    return this.triggers.get(id);
  }

  /**
   * Avalia quais gatilhos casam com um evento e contexto específico
   */
  public evaluateTriggers(
    eventType: string,
    ctx: AutonomyTriggerContext,
    eventId?: string
  ): AutonomyTrigger[] {
    // 1. Deduplicação por Event ID (Idempotência - Seção 15)
    if (eventId) {
      const dedupKey = `${ctx.tenantId}:${eventId}`;
      const now = Date.now();
      const lastSeen = this.processedEvents.get(dedupKey);
      if (lastSeen && now - lastSeen < this.deduplicationWindowMs) {
        return []; // Evento já processado
      }
      this.processedEvents.set(dedupKey, now);
      this.cleanOldDeduplications();
    }

    const matched: AutonomyTrigger[] = [];

    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled) continue;
      if (trigger.eventType !== eventType && trigger.eventType !== '#') continue;

      // Avaliação da condição determinística de negócio
      try {
        if (!trigger.condition(ctx)) {
          continue;
        }
      } catch (condErr) {
        console.warn(`[AutonomyTriggerEngine] Erro ao avaliar condição do trigger '${trigger.id}':`, condErr);
        continue;
      }

      // 2. Verificação de Cooldown (Seção 14)
      const entityPart = trigger.deduplicationKeyTemplate ? trigger.deduplicationKeyTemplate(ctx) : 'global';
      const cooldownKey = `${ctx.tenantId}:${trigger.id}:${entityPart}`;
      const now = Date.now();
      const lastFired = this.cooldowns.get(cooldownKey) || 0;

      if (now - lastFired < trigger.cooldownMs) {
        // Cooldown ativo: ignora o disparo repetitivo
        continue;
      }

      matched.push(trigger);
    }

    return matched;
  }

  /**
   * Registra a execução de um gatilho para acionar o cooldown
   */
  public markFired(trigger: AutonomyTrigger, ctx: AutonomyTriggerContext): void {
    const entityPart = trigger.deduplicationKeyTemplate ? trigger.deduplicationKeyTemplate(ctx) : 'global';
    const cooldownKey = `${ctx.tenantId}:${trigger.id}:${entityPart}`;
    this.cooldowns.set(cooldownKey, Date.now());
  }

  private cleanOldDeduplications(): void {
    const now = Date.now();
    for (const [key, ts] of this.processedEvents.entries()) {
      if (now - ts > this.deduplicationWindowMs) {
        this.processedEvents.delete(key);
      }
    }
  }

  /**
   * Limpa cooldowns manualmente (para testes e reset administrativo)
   */
  public resetCooldowns(): void {
    this.cooldowns.clear();
    this.processedEvents.clear();
  }
}

export const autonomyTriggerEngine = new AutonomyTriggerEngine();
