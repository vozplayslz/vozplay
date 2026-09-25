/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY CORE SERVER
 * REST API (v1) + WebSocket Server + Vite Middleware
 * Dominio: vozplay.ai.slz.br
 */

import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { apiRouter } from './server/apiRouter.js';
import { wsServer } from './server/wsServer.js';
import { db } from './server/db.js';
import { pgClient } from './server/pgClient.js';
import { logger } from './server/logger.js';
import { authMiddleware, authService } from './server/auth.js';

// Validação mandatória de ambiente de produção (Requisito 4 e 19)
function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const missingVars: string[] = [];
    if (!process.env.DATABASE_URL) missingVars.push('DATABASE_URL');
    if (!process.env.SUPERVISOR_PASSWORD) missingVars.push('SUPERVISOR_PASSWORD');
    if (!process.env.CONTROLLER_PASSWORD) missingVars.push('CONTROLLER_PASSWORD');

    if (missingVars.length > 0) {
      console.error('================================================================');
      console.error('  [FALHA CRÍTICA DE STARTUP EM PRODUÇÃO]');
      console.error(`  Variáveis obrigatórias ausentes: ${missingVars.join(', ')}`);
      console.error('  Configure-as no arquivo .env ou nas variáveis do container.');
      console.error('  O servidor não será iniciado com segredos indefinidos.');
      console.error('================================================================');
      process.exit(1);
    }
  }
}

async function startServer() {
  validateEnvironment();

  const app = express();
  const PORT = 3000;

  // Limite global rígido de payload para prevenir DoS (Requisito 20)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Headers de Segurança HTTP (Requisito 21)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Rate Limiting em memória para rotas sensíveis (Requisito 22)
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  app.use('/api/v1/auth/login', (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 60000 };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + 60000;
    }

    entry.count++;
    loginAttempts.set(ip, entry);

    if (entry.count > 20) {
      logger.security('Rate limit de tentativas de login excedido', { ip });
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas de autenticação. Aguarde 1 minuto.',
        code: 'TOO_MANY_REQUESTS'
      });
    }

    next();
  });

  // Correlation ID & Request logger estruturado para auditoria e observabilidade (Requisito 16 e 29)
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || ('req-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'));
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (req.path.startsWith('/api/')) {
      logger.info(`[HTTP] ${req.method} ${req.path}`, {
        requestId,
        ip: req.ip,
        method: req.method,
        path: req.path
      });
    }
    next();
  });

  // Auth Middleware (Autenticação exclusivamente via Bearer Token)
  app.use(authMiddleware);

  // Inicializa banco de dados e hidrata estado (PostgreSQL / In-Memory)
  await db.initDatabase();
  await authService.initDefaultCredentials();

  // Endpoint de Liveness (Requisito 28)
  const livenessHandler = (req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      service: 'VozPlay Core Platform',
      domain: 'vozplay.ai.slz.br',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  };
  app.get('/liveness', livenessHandler);
  app.get('/api/liveness', livenessHandler);
  app.get('/api/health', livenessHandler);

  // Endpoint de Readiness (Requisito 28)
  const readinessHandler = async (req: express.Request, res: express.Response) => {
    const isProd = process.env.NODE_ENV === 'production';
    const dbReady = pgClient.isConnected || (!isProd && !process.env.DATABASE_URL);

    if (!dbReady && isProd) {
      return res.status(503).json({
        status: 'not_ready',
        error: 'PostgreSQL indisponível em ambiente de produção',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'ready',
      database: pgClient.isConnected ? 'postgresql_connected' : 'in_memory_ready',
      sessionActive: db.session.status === 'ACTIVE',
      timestamp: new Date().toISOString()
    });
  };
  app.get('/readiness', readinessHandler);
  app.get('/api/readiness', readinessHandler);

  // Mount versioned REST API
  app.use('/api/v1', apiRouter);

  // Create HTTP Server to attach both Express and WebSocket
  const server = http.createServer(app);

  // Initialize WebSocket hub on the HTTP server
  wsServer.init(server);

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`  VOZPLAY PLATAFORMA DE KARAOKÊ (BETA)   `);
    console.log(`  Domínio: vozplay.ai.slz.br            `);
    console.log(`  Servidor ativo em http://0.0.0.0:${PORT} `);
    console.log(`  WebSocket endpoint: ws://0.0.0.0:${PORT}/ws `);
    console.log(`=========================================`);
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar servidor VozPlay:', err);
  process.exit(1);
});
