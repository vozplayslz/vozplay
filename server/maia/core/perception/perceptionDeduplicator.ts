/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PERCEPTION DEDUPLICATOR & DEBOUNCER (PROMPT 05)
 * Previne tempestade de percepções e sobrecarga cognitiva da MaIA.
 * Agrupa rajadas de eventos similares dentro de uma janela de coalescência.
 */

export class PerceptionDeduplicator {
  private lastPerceptionTimestamps = new Map<string, number>();

  // Janelas padrão de resfriamento/coalescência por tipo de evento (em ms)
  private readonly DEFAULT_WINDOWS_MS: Record<string, number> = {
    'karaoke.queue.song_added': 5000,
    'karaoke.reaction.received': 4000,
    'karaoke.queue.updated': 5000,
    'karaoke.presence.code_validated': 10000,
    'karaoke.tv.connected': 15000,
    'karaoke.controller.connected': 15000
  };

  /**
   * Avalia se um evento deve ser debounced (descartado por excesso de repetição recente)
   */
  public shouldDebounce(
    tenantId: string,
    eventType: string,
    entityKey: string = 'general',
    customWindowMs?: number
  ): boolean {
    const windowMs = customWindowMs ?? (this.DEFAULT_WINDOWS_MS[eventType] ?? 2000);
    if (windowMs <= 0) return false;

    const key = `${tenantId}:${eventType}:${entityKey}`;
    const now = Date.now();
    const lastTime = this.lastPerceptionTimestamps.get(key) || 0;

    if (now - lastTime < windowMs) {
      return true; // Coalescido / Debounced
    }

    this.lastPerceptionTimestamps.set(key, now);
    this.purgeOldEntries(now);
    return false;
  }

  /**
   * Limpa chaves antigas periodicamente para evitar vazamento de memória
   */
  private purgeOldEntries(now: number): void {
    if (this.lastPerceptionTimestamps.size > 500) {
      for (const [key, timestamp] of this.lastPerceptionTimestamps.entries()) {
        if (now - timestamp > 60000) {
          this.lastPerceptionTimestamps.delete(key);
        }
      }
    }
  }

  /**
   * Limpa todo o estado do deduplicador
   */
  public clear(): void {
    this.lastPerceptionTimestamps.clear();
  }
}

export const perceptionDeduplicator = new PerceptionDeduplicator();
