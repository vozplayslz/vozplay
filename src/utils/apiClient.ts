/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - HTTP API Client & Transparent Auth Interceptor
 * Adiciona headers de RBAC, Bearer Token e isolamento de sessão em requisições
 */

export interface LoginResult {
  success: boolean;
  token?: string;
  role?: string;
  error?: string;
}

const TOKEN_PREFIX = 'vp_token_';

export function getStoredToken(role: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_PREFIX + role.toLowerCase());
}

export function setStoredToken(role: string, token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_PREFIX + role.toLowerCase(), token);
}

export function removeStoredToken(role: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_PREFIX + role.toLowerCase());
}

export async function loginRole(role: 'SUPERVISOR' | 'CONTROLLER' | 'TV' | 'PARTICIPANT', password?: string, extra?: { displayName?: string; participantId?: string }): Promise<LoginResult> {
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        password,
        displayName: extra?.displayName,
        participantId: extra?.participantId
      })
    });
    const data = await res.json();
    if (data && data.success && data.token) {
      setStoredToken(role, data.token);
      return { success: true, token: data.token, role: data.role };
    }
    return { success: false, error: data.error || 'Falha ao autenticar' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro de conexão' };
  }
}

/**
 * Cliente HTTP robusto que injeta automaticamente cabeçalhos de RBAC e sessão.
 * Funciona de forma transparente sem depender de modificações globais no window.fetch.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const options: RequestInit = init ? { ...init } : {};
  const headers = new Headers(options.headers || {});

  if (urlString && urlString.includes('/api/v1/')) {
    // Determina o papel presumido pela rota
    let inferredRole: string | null = null;
    if (
      urlString.includes('/api/v1/supervisor') ||
      urlString.includes('/api/v1/session/start') ||
      urlString.includes('/api/v1/session/pause') ||
      urlString.includes('/api/v1/session/resume') ||
      urlString.includes('/api/v1/session/extend') ||
      urlString.includes('/api/v1/session/end') ||
      urlString.includes('/api/v1/leads') ||
      urlString.includes('/api/v1/establishment/branding')
    ) {
      inferredRole = 'SUPERVISOR';
    } else if (
      urlString.includes('/api/v1/controller') ||
      urlString.includes('/api/v1/player/play') ||
      urlString.includes('/api/v1/player/pause') ||
      urlString.includes('/api/v1/player/next') ||
      urlString.includes('/api/v1/player/volume')
    ) {
      inferredRole = 'CONTROLLER';
    } else if (urlString.includes('/api/v1/tv/')) {
      inferredRole = 'TV';
    } else if (urlString.includes('/api/v1/participant') || urlString.includes('/api/v1/queue/add')) {
      inferredRole = 'PARTICIPANT';
    }

    if (inferredRole) {
      const token = getStoredToken(inferredRole);
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
  }

  options.headers = headers;
  return window.fetch(input, options);
}

/**
 * Inicializador resiliente de compatibilidade.
 * Não altera window.fetch diretamente para evitar 'Cannot set property fetch of #<Window> which has only a getter'
 * em iframes e ambientes sandboxed. O app consome `apiFetch` explicitamente.
 */
export function setupFetchInterceptor(): void {
  // Operação intencionalmente vazia para proteção contra sandbox de iframes com getters de leitura exclusiva.
}
