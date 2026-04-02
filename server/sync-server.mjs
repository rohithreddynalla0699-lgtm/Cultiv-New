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
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 3747);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');
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
  console.log(`\n  Set in .env.local:`);
  console.log(`    VITE_SYNC_SERVER_URL=http://localhost:${PORT}\n`);
});
