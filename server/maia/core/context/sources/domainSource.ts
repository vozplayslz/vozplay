/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA DOMAIN & QUEUE CONTEXT SOURCE
 * Fornece fatos operacionais do domínio (ex: resumo de fila de karaokê)
 * sem incorporar lógica de negócios ou se tornar um novo serviço de fila.
 */

import {
  IContextSource,
  DomainContext,
  ContextSourceResolutionContext,
  ContextPriorityLevel
} from '../types.js';

export class DomainContextSource implements IContextSource<DomainContext> {
  public readonly name = 'DomainSource';
  public readonly priority: ContextPriorityLevel = 'P2_OPERATIONAL_STATE';

  public resolve(context: ContextSourceResolutionContext): DomainContext {
    const isKaraoke = context.profile === 'participant' || context.profile === 'operator' || context.profile === 'tv';

    return {
      domain: isKaraoke ? 'karaoke' : 'general',
      product: isKaraoke ? 'MaIA Karaokê (VozPlay)' : 'MaIA Enterprise',
      activeLoungeName: 'VozPlay Lounge SLZ',
      queueSummary: isKaraoke ? {
        totalItems: 8,
        queuedCount: 5,
        estimatedWaitTimeMinutes: 20,
        currentSingerName: 'Ana Clara',
        currentSongTitle: 'Evidências'
      } : undefined
    };
  }
}

export const domainContextSource = new DomainContextSource();
