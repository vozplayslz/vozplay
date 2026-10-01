/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA IN-MEMORY STORAGE PROVIDER
 * Provedor de armazenamento em memória com segregação lógica estrita por tenant.
 * Alta performance, determinismo absoluto e ideal para desenvolvimento, testes e fallback.
 */

import { IMemoryProvider } from './types.js';
import { MemoryItem, MemoryQuery, MemoryScope } from '../types.js';
import { isMemoryExpired } from '../retention/retentionPolicy.js';

export class InMemoryMemoryProvider implements IMemoryProvider {
  public readonly name = 'InMemoryMemoryProvider';
  
  // Mapa de primeiro nível indexado estritamente por tenantId para isolamento total
  private tenantStores = new Map<string, Map<string, MemoryItem>>();
  private available = true;

  public async isAvailable(): Promise<boolean> {
    return this.available;
  }

  public setAvailable(available: boolean): void {
    this.available = available;
  }

  private getTenantMap(tenantId: string, createIfAbsent = false): Map<string, MemoryItem> | undefined {
    let store = this.tenantStores.get(tenantId);
    if (!store && createIfAbsent) {
      store = new Map<string, MemoryItem>();
      this.tenantStores.set(tenantId, store);
    }
    return store;
  }

  public async store(item: MemoryItem): Promise<void> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const store = this.getTenantMap(item.tenantId, true)!;
    // Clona o item para garantir imutabilidade no armazém
    store.set(item.id, JSON.parse(JSON.stringify(item)));
  }

  public async getById(tenantId: string, id: string): Promise<MemoryItem | null> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const store = this.getTenantMap(tenantId, false);
    if (!store) return null;
    const item = store.get(id);
    if (!item) return null;
    return JSON.parse(JSON.stringify(item));
  }

  public async query(query: MemoryQuery): Promise<MemoryItem[]> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const store = this.getTenantMap(query.tenantId, false);
    if (!store) return [];

    const items: MemoryItem[] = [];
    for (const item of store.values()) {
      items.push(JSON.parse(JSON.stringify(item)));
    }
    return items;
  }

  public async update(item: MemoryItem): Promise<void> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const store = this.getTenantMap(item.tenantId, true)!;
    store.set(item.id, JSON.parse(JSON.stringify(item)));
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const store = this.getTenantMap(tenantId, false);
    if (!store) return false;
    return store.delete(id);
  }

  public async deleteByScope(tenantId: string, scope: MemoryScope, identifier?: string): Promise<number> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const store = this.getTenantMap(tenantId, false);
    if (!store) return 0;

    let deletedCount = 0;
    for (const [id, item] of Array.from(store.entries())) {
      let matches = item.scope === scope;
      if (matches && identifier) {
        if (scope === 'session' && item.sessionId !== identifier) matches = false;
        if (scope === 'user' && item.userId !== identifier) matches = false;
        if (scope === 'establishment' && item.establishmentId !== identifier) matches = false;
      }

      if (matches) {
        store.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  public async pruneExpired(tenantId?: string): Promise<number> {
    if (!this.available) throw new Error('InMemoryMemoryProvider indisponível');
    const nowMs = Date.now();
    let prunedCount = 0;

    const tenantsToPrune = tenantId ? [tenantId] : Array.from(this.tenantStores.keys());

    for (const tId of tenantsToPrune) {
      const store = this.getTenantMap(tId, false);
      if (!store) continue;

      for (const [id, item] of Array.from(store.entries())) {
        if (isMemoryExpired(item, nowMs)) {
          store.delete(id);
          prunedCount++;
        }
      }
    }

    return prunedCount;
  }

  public async clear(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.tenantStores.delete(tenantId);
    } else {
      this.tenantStores.clear();
    }
  }

  public getCount(tenantId: string): number {
    const store = this.getTenantMap(tenantId, false);
    return store ? store.size : 0;
  }
}
