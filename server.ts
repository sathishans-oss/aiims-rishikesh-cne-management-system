import 'dotenv/config';
import express from 'express';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db/database';
import worker from './worker/index';
import { Env } from './worker/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite Database with migrations & seed data (D1 compatible)
  const db = await getDb();

  // Parse JSON and form bodies
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Delegate all /api/* routes directly to the Cloudflare Worker implementation
  app.all('/api*', async (req, res) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const url = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const requestInit: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (req.body && Object.keys(req.body).length > 0) {
          requestInit.body = JSON.stringify(req.body);
          if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
          }
        }
      }

      const webRequest = new Request(url, requestInit);

      const env: Env = {
        DB: db as any,
        SESSION_SECRET: process.env.SESSION_SECRET || randomUUID(),
        PASSWORD_PEPPER: process.env.PASSWORD_PEPPER || randomUUID(),
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        GOOGLE_APPS_SCRIPT_URL: process.env.GOOGLE_APPS_SCRIPT_URL,
        GOOGLE_INTEGRATION_SECRET: process.env.GOOGLE_INTEGRATION_SECRET,
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'http://localhost:3000,http://localhost:5173',
        ENVIRONMENT: process.env.ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
        DEV_DEMO_SEED: process.env.DEV_DEMO_SEED || 'false',
        BOOTSTRAP_TOKEN: process.env.BOOTSTRAP_TOKEN
      };

      const ctx = {
        waitUntil(promise: Promise<any>) {
          promise.catch(err => console.error('Worker waitUntil background error:', err));
        },
        passThroughOnException() {}
      };

      const workerResponse = await worker.fetch(webRequest, env, ctx as any);

      res.status(workerResponse.status);

      // Forward headers (including Set-Cookie)
      workerResponse.headers.forEach((val, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          res.setHeader('Set-Cookie', val);
        } else {
          res.setHeader(key, val);
        }
      });

      const bodyText = await workerResponse.text();
      res.send(bodyText);
    } catch (err: any) {
      console.error('Worker invocation error in local dev shim:', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'WORKER_SHIM_ERROR',
          message: err.message || 'Worker execution failed'
        }
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CNE Unified Worker & Vite dev server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
