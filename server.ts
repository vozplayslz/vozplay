/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY CORE SERVER
 * REST API (v1) + WebSocket Server + Vite Middleware
 * Dominio: vozplay.ai.slz.br
 */

import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { apiRouter } from './server/apiRouter.js';
import { wsServer } from './server/wsServer.js';
import { db } from './server/db.js';
import { logger } from './server/logger.js';
import { authMiddleware } from './server/auth.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Correlation ID & Request logger for audit and observability
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

  // Auth Middleware
  app.use(authMiddleware);

  // Inicializa banco de dados e hidrata estado (PostgreSQL / In-Memory)
  await db.initDatabase();

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'VozPlay Core Platform',
      domain: 'vozplay.ai.slz.br',
      timestamp: new Date().toISOString()
    });
  });

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
