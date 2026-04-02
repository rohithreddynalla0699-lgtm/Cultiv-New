#!/usr/bin/env node
/**
 * CULTIV Sync Server — optional shared data layer for multi-device support.
 *
 * Usage:
 *   node server/sync-server.mjs
 *
 * Frontend:
 *   Add VITE_SYNC_SERVER_URL=http://localhost:3747 to .env.local
 *   All devices on the same network should use your LAN IP instead of localhost.
 *
 * Endpoints:
 *   GET  /api/state   — full shared state (JSON)
 *   PUT  /api/state   — replace full shared state (JSON body)
 *   GET  /api/events  — Server-Sent Events stream (live sync)
 *   GET  /api/health  — lightweight health response
 *   POST /api/internal-auth — verify owner/store PIN on server
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 3747);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');
const OWNER_PIN = String(process.env.ADMIN_OWNER_PIN ?? '240620').trim();
const STORE_PIN_BY_ID = {
  'store-siddipet': String(process.env.STORE_PIN_SIDDIPET ?? '502103').trim(),
  'store-hyderabad': String(process.env.STORE_PIN_HYDERABAD ?? '500034').trim(),
  'store-warangal': String(process.env.STORE_PIN_WARANGAL ?? '506002').trim(),
};

// ── Persistent state ──────────────────────────────────────────────────────────

let sharedState = {};

if (fs.existsSync(DB_FILE)) {
  try {
    sharedState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    console.log('[sync] Loaded existing state from db.json');
  } catch {
    console.warn('[sync] db.json could not be parsed — starting fresh.');
  }
}

const persistState = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(sharedState, null, 2), 'utf8');
  } catch (err) {
    console.error('[sync] Could not write db.json:', err.message);
  }
};

// ── SSE client registry ───────────────────────────────────────────────────────

const sseClients = new Set();

const broadcast = (data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of [...sseClients]) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
};

// ── CORS ──────────────────────────────────────────────────────────────────────

const applyCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID');
};

// ── Request router ────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  // GET /api/state
  if (req.method === 'GET' && pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sharedState));
    return;
  }

  // GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'sync-server' }));
    return;
  }

  // GET /api/internal-auth (method hint for manual browser checks)
  if (req.method === 'GET' && pathname === '/api/internal-auth') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'Use POST /api/internal-auth with JSON body.' }));
    return;
  }

  // PUT /api/state
  if (req.method === 'PUT' && pathname === '/api/state') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const next = JSON.parse(body);
        if (typeof next !== 'object' || next === null || Array.isArray(next)) {
          throw new Error('Body must be a JSON object.');
        }
        const clientId = req.headers['x-client-id'] ?? null;
        sharedState = {
          ...sharedState,
          ...next,
          _updatedAt: new Date().toISOString(),
          _sourceClientId: clientId,
        };
        persistState();
        broadcast(sharedState);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, _updatedAt: sharedState._updatedAt }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: err.message }));
      }
    });
    return;
  }

  // POST /api/internal-auth
  if (req.method === 'POST' && pathname === '/api/internal-auth') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const mode = String(payload.mode ?? '').trim();
        const pin = String(payload.pin ?? '').trim();
        const isSixDigits = /^\d{6}$/.test(pin);

        if (!isSixDigits) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: 'Enter a valid 6-digit PIN.' }));
          return;
        }

        if (mode === 'owner') {
          if (pin !== OWNER_PIN) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, message: 'Owner PIN did not match.' }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, role: 'admin', message: 'Owner access enabled.' }));
          return;
        }

        if (mode === 'store') {
          const storeId = String(payload.storeId ?? '').trim();
          const expectedPin = STORE_PIN_BY_ID[storeId];

          if (!expectedPin) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, message: 'Select a valid store.' }));
            return;
          }

          if (pin !== expectedPin) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, message: 'Store PIN did not match.' }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, role: 'store', storeId, message: 'Store workspace is ready.' }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: 'Unsupported auth mode.' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: err.message }));
      }
    });
    return;
  }

  // GET /api/events (SSE)
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // Send current state immediately on connect
    res.write(`data: ${JSON.stringify(sharedState)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, message: 'Not found.' }));
});

server.listen(PORT, () => {
  console.log(`\n  CULTIV Sync Server  →  http://localhost:${PORT}`);
  console.log(`  SSE stream          →  http://localhost:${PORT}/api/events`);
  console.log(`  Internal auth       →  http://localhost:${PORT}/api/internal-auth`);
  console.log(`\n  Set in .env.local:`);
  console.log(`    VITE_SYNC_SERVER_URL=http://localhost:${PORT}\n`);
});
