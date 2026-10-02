/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY HTTP SECURITY HEADERS & DEFENSIVE POLICIES (PROMPT 11 - Seção 52 e 53)
 * Headers de proteção contra XSS, Clickjacking, MIME-Sniffing, vazamento de referrer
 * e controle rígido de permissões de hardware.
 */

import { Request, Response, NextFunction } from 'express';

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Prevenção de MIME Sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Proteção de Referrer (não vazar caminhos completos em links externos)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 3. XSS Filter Legado para navegadores compatíveis
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 4. Permissions Policy: microfone habilitado apenas para a própria origem (PWA VozPlay)
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=(), payment=()');

  // 5. HSTS (Strict-Transport-Security) em ambientes HTTPS / Produção
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // 6. Content Security Policy (CSP) compatível com SPA, WebSockets e Assets
  // Permitir self, dados de mídia/áudio e websockets
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://images.unsplash.com https://i.ytimg.com https://img.youtube.com",
    "media-src 'self' data: blob:",
    "connect-src 'self' ws: wss: https: http:",
    "frame-ancestors 'self' https://* http://localhost:*",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
}
