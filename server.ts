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
import { apiRouter } from './server/apiRouter.js';
import { wsServer } from './server/wsServer.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger for audit and debugging
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

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
