/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Async Mutex para Controle de Concorrência
 * Garante atomicidade e impede race conditions em operações críticas da fila
 */

export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(callback: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previousQueue = this.queue;
    this.queue = previousQueue.then(() => waitPromise);

    await previousQueue;
    try {
      return await callback();
    } finally {
      release!();
    }
  }
}
