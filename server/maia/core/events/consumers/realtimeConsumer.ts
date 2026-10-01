/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA DOMAIN EVENT REALTIME CONSUMER (PROMPT 05)
 * Consumidor desacoplado que sincroniza eventos do Event Bus com clientes em tempo real.
 * Respeita a segregação de dados: TV display recebe apenas dados públicos/sanitizados.
 */

import { DomainEvent } from '../types.js';
import { eventBus } from '../eventBus.js';

export type RealtimeBroadcastFn = (channel: string, payload: any) => void;

export class RealtimeConsumer {
  private isSubscribed: boolean = false;
  private subscriptionId?: string;
  private deliveredCount: number = 0;
  private broadcastFn?: RealtimeBroadcastFn;

  /**
   * Configura o despachante de broadcast em tempo real (ex: wsServer)
   */
  public setBroadcaster(fn: RealtimeBroadcastFn): void {
    this.broadcastFn = fn;
  }

  public start(): void {
    if (this.isSubscribed && this.subscriptionId) {
      this.stop();
    }

    const sub = eventBus.subscribe('karaoke.#', (event: DomainEvent) => {
      this.handleEvent(event);
    });

    this.subscriptionId = sub.id;
    this.isSubscribed = true;
  }

  public stop(): void {
    if (this.subscriptionId) {
      eventBus.unsubscribe({ id: this.subscriptionId });
    }
    this.isSubscribed = false;
    this.subscriptionId = undefined;
  }

  public handleEvent(event: DomainEvent): void {
    this.deliveredCount++;

    if (!this.broadcastFn) return;

    try {
      if (event.type === 'karaoke.queue.song_added' || event.type === 'karaoke.queue.song_removed') {
        this.broadcastFn('queue.updated', {
          timestamp: event.occurredAt,
          correlationId: event.correlationId
        });
      } else if (event.type === 'karaoke.session.ended') {
        this.broadcastFn('session.status', {
          status: 'ENDED',
          timestamp: event.occurredAt
        });
      }
    } catch {
      // Ignora falhas isoladas de transporte
    }
  }

  public getDeliveredCount(): number {
    return this.deliveredCount;
  }

  public resetCount(): void {
    this.deliveredCount = 0;
  }
}

export const realtimeConsumer = new RealtimeConsumer();
