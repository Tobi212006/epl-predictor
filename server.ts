import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface PendingCall {
  resolve: (val: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class PythonEngineBridge {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private readyPromise: Promise<void> | null = null;
  private pending = new Map<number, PendingCall>();
  private nextId = 1;

  private ensureStarted(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const child = spawn('python3', ['-u', '-m', 'backend.worker'], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: process.cwd() },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.proc = child;

      let isReady = false;
      const rl = readline.createInterface({ input: child.stdout });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const msg = JSON.parse(trimmed);
          if (!isReady && msg.ready) {
            isReady = true;
            resolve();
            return;
          }
          if (msg.id && this.pending.has(msg.id)) {
            const call = this.pending.get(msg.id)!;
            clearTimeout(call.timer);
            this.pending.delete(msg.id);
            if (msg.ok) {
              call.resolve(msg.data);
            } else {
              call.reject(new Error(msg.error || 'Python worker error'));
            }
          }
        } catch (err) {
          console.error('[py-worker parse error]', trimmed, err);
        }
      });

      child.stderr.on('data', (chunk) => {
        console.error('[py-worker stderr]', chunk.toString());
      });

      child.on('exit', (code) => {
        console.warn(`[py-worker] exited with code ${code}; resetting bridge`);
        for (const [, call] of this.pending) {
          clearTimeout(call.timer);
          call.reject(new Error('Python worker restarted unexpectedly'));
        }
        this.pending.clear();
        this.proc = null;
        this.readyPromise = null;
        if (!isReady) {
          reject(new Error(`Python worker exited before ready (code ${code})`));
        }
      });
    });

    return this.readyPromise;
  }

  async call<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.ensureStarted();
    if (!this.proc || !this.proc.stdin.writable) {
      this.readyPromise = null;
      await this.ensureStarted();
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Python action '${action}' timed out`));
      }, 30000);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.proc!.stdin.write(JSON.stringify({ id, action, params }) + '\n');
    });
  }
}

const pyBridge = new PythonEngineBridge();

// Simple in-memory TTL cache for read endpoints
const cache = new Map<string, { expires: number; data: unknown }>();
function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}
function setCached(key: string, data: unknown, ttlMs = 30000): void {
  cache.set(key, { expires: Date.now() + ttlMs, data });
}

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const configured = process.env.ADMIN_API_TOKEN?.trim();
  if (!configured) {
    next();
    return;
  }
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${configured}`) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized: valid ADMIN_API_TOKEN Bearer token required.' });
}

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'EPL Tactical Intelligence API',
    version: '1.2.0',
    description: 'Probabilistic EPL match prediction engine (Python Poisson + Dixon-Coles), manager tactical profiles, canonical 5-phase snapshots, and scenario simulations.',
  },
  paths: {
    '/api/v1/data/status': { get: { summary: 'Data provider freshness, demo status, and setup instructions' } },
    '/api/v1/data/refresh': { post: { summary: 'Trigger provider sync and model retraining' } },
    '/api/v1/standings': { get: { summary: 'Current EPL league table with optional xG metrics' } },
    '/api/v1/fixtures': { get: { summary: 'Paginated fixture list with model probabilities' } },
    '/api/v1/teams/compare': { get: { summary: 'Side-by-side club comparison with Home/Away splits and tactical profiles' } },
    '/api/v1/teams/{id}': { get: { summary: 'Club roster, current appointment, tactical profile, and recent form' } },
    '/api/v1/managers': { get: { summary: 'All active EPL manager tactical summaries' } },
    '/api/v1/managers/{id}/tactics': { get: { summary: 'Dated manager profile, 5-phase canonical snapshots, and sources' } },
    '/api/v1/matches/{id}/prediction': { get: { summary: '1X2 distribution, expected goals, top scorelines, and explainability' } },
    '/api/v1/matches/predict-pair': { post: { summary: 'Compute custom Home vs Away probability distribution in Python' } },
    '/api/v1/matches/{id}/flow': { get: { summary: '0-30 / 31-60 / 61-90+ conditional match-flow scenarios' } },
    '/api/v1/matches/{id}/passing': { get: { summary: 'Formation coordinates and optional demo passing analysis for a fixture' } },
    '/api/v1/teams/{id}/passing': { get: { summary: 'Formation coordinates and optional demo passing analysis for a club' } },
    '/api/v1/managers/clash': { get: { summary: 'Manager vs Manager tactical comparison and mismatch analysis' } },
    '/api/v1/scenarios/simulate': { post: { summary: 'What-if tactical & squad availability simulation' } },
    '/api/v1/tactics/snapshots': { post: { summary: 'Persist analyst node coordinate edits' } },
    '/api/v1/methodology': { get: { summary: 'Model versions, chronological backtest metrics, calibration bins, and limitations' } },
  },
};

const ALLOWED_PROVIDERS = new Set(['auto', 'espn', 'football-data', 'demo']);
const ALLOWED_STATUSES = new Set(['ALL', 'SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED']);

let refreshInFlight: Promise<unknown> | null = null;

function parseStrictInt(raw: unknown, name: string, min: number, max: number): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return n;
}

async function createServer() {
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use((err: Error & { type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    next(err);
  });

  app.get('/api/v1/health', async (_req, res) => {
    try {
      const status = await pyBridge.call('data_status');
      res.json({ ok: true, engine: 'python3-poisson-dc', status });
    } catch (err) {
      res.status(503).json({ ok: false, error: (err as Error).message });
    }
  });

  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(OPENAPI_SPEC);
  });

  app.get('/api/v1/data/status', async (_req, res) => {
    try {
      const data = await pyBridge.call('data_status');
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/data/refresh', requireAdminToken, async (req, res) => {
    try {
      const rawProvider = req.body?.provider;
      let provider: string | undefined;
      if (rawProvider !== undefined && rawProvider !== null && rawProvider !== '') {
        if (typeof rawProvider !== 'string' || !ALLOWED_PROVIDERS.has(rawProvider.trim().toLowerCase())) {
          return res.status(400).json({ error: 'Invalid provider. Allowed: auto, espn, football-data, demo.' });
        }
        provider = rawProvider.trim().toLowerCase();
      }
      if (!refreshInFlight) {
        refreshInFlight = pyBridge.call('data_refresh', { provider }).finally(() => {
          refreshInFlight = null;
        });
      }
      const data = await refreshInFlight;
      cache.clear();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/data/live-tick', async (_req, res) => {
    try {
      const data = await pyBridge.call('live_tick');
      cache.clear();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/standings', async (_req, res) => {
    try {
      const hit = getCached('standings');
      if (hit) return res.json(hit);
      const data = await pyBridge.call('standings');
      setCached('standings', data, 30000);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/fixtures', async (req, res) => {
    try {
      const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : undefined;
      if (rawStatus && !ALLOWED_STATUSES.has(rawStatus)) {
        return res.status(400).json({ error: `Invalid fixture status: ${rawStatus}` });
      }
      let matchweek: number | undefined;
      let page: number;
      let limit: number;
      try {
        matchweek = parseStrictInt(req.query.matchweek, 'matchweek', 1, 38);
        page = parseStrictInt(req.query.page, 'page', 1, 500) ?? 1;
        limit = parseStrictInt(req.query.limit, 'limit', 1, 150) ?? 50;
      } catch (valErr) {
        return res.status(400).json({ error: (valErr as Error).message });
      }
      const team_id = typeof req.query.team_id === 'string' && req.query.team_id.trim() ? req.query.team_id.trim() : undefined;

      const cacheKey = `fixtures:${rawStatus}:${matchweek}:${team_id}:${page}:${limit}`;
      const hit = getCached(cacheKey);
      if (hit) return res.json(hit);

      const data = await pyBridge.call('fixtures', { status: rawStatus, matchweek, team_id, page, limit });
      setCached(cacheKey, data, 30000);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/teams/compare', async (req, res) => {
    try {
      const home_team_id = typeof req.query.home === 'string' && req.query.home.trim() ? req.query.home.trim() : 'arsenal';
      const away_team_id = typeof req.query.away === 'string' && req.query.away.trim() ? req.query.away.trim() : 'man-city';
      if (home_team_id === away_team_id) {
        return res.status(400).json({ error: 'Select two distinct clubs to compare.' });
      }
      const cacheKey = `team-compare:${home_team_id}:${away_team_id}`;
      const hit = getCached(cacheKey);
      if (hit) return res.json(hit);
      const data = await pyBridge.call('team_compare', { home_team_id, away_team_id });
      setCached(cacheKey, data, 30000);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/teams/:id', async (req, res) => {
    try {
      const data = await pyBridge.call('team_detail', { team_id: req.params.id });
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/managers', async (_req, res) => {
    try {
      const hit = getCached('managers');
      if (hit) return res.json(hit);
      const data = await pyBridge.call('managers_list');
      setCached('managers', data, 60000);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/managers/clash', async (req, res) => {
    try {
      const home_team_id = typeof req.query.home === 'string' && req.query.home.trim() ? req.query.home.trim() : 'arsenal';
      const away_team_id = typeof req.query.away === 'string' && req.query.away.trim() ? req.query.away.trim() : 'liverpool';
      if (home_team_id === away_team_id) {
        return res.status(400).json({ error: 'Select two distinct teams for Manager Clash.' });
      }
      const data = await pyBridge.call('manager_clash', { home_team_id, away_team_id });
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/managers/:id/tactics', async (req, res) => {
    try {
      const data = await pyBridge.call('manager_tactics', { manager_id: req.params.id });
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/matches/:id/prediction', async (req, res) => {
    try {
      const data = await pyBridge.call('match_prediction', { fixture_id: req.params.id });
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/matches/predict-pair', async (req, res) => {
    try {
      const { home_team_id, away_team_id } = req.body || {};
      if (!home_team_id || !away_team_id || home_team_id === away_team_id) {
        return res.status(400).json({ error: 'Select two distinct teams.' });
      }
      const data = await pyBridge.call('predict_pair', { home_team_id, away_team_id });
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/matches/:id/flow', async (req, res) => {
    try {
      const data = await pyBridge.call('match_flow', { fixture_id: req.params.id });
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/matches/:id/passing', async (req, res) => {
    try {
      const team_side = req.query.team === 'away' ? 'away' : 'home';
      const formation = typeof req.query.formation === 'string' ? req.query.formation.trim() : undefined;
      const include_demo = req.query.demo === 'true' || req.query.demo === '1';
      const data = await pyBridge.call('match_passing', {
        fixture_id: req.params.id,
        team_side,
        formation,
        include_demo,
      });
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/teams/:id/passing', async (req, res) => {
    try {
      const formation = typeof req.query.formation === 'string' ? req.query.formation.trim() : undefined;
      const include_demo = req.query.demo === 'true' || req.query.demo === '1';
      const data = await pyBridge.call('team_passing', {
        team_id: req.params.id,
        formation,
        include_demo,
      });
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/scenarios/simulate', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.home_team_id || !body.away_team_id || body.home_team_id === body.away_team_id) {
        return res.status(400).json({ error: 'Two distinct clubs (home_team_id and away_team_id) are required.' });
      }
      if (body.unavailable_player_ids !== undefined && !Array.isArray(body.unavailable_player_ids)) {
        return res.status(400).json({ error: 'unavailable_player_ids must be an array.' });
      }
      const data = await pyBridge.call('simulate_what_if', body);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/tactics/snapshots', requireAdminToken, async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.team_id || !body.manager_id || !body.phase || !Array.isArray(body.players)) {
        return res.status(400).json({ error: 'Invalid tactical snapshot payload.' });
      }
      const data = await pyBridge.call('save_snapshot', body);
      cache.clear();
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/methodology', async (_req, res) => {
    try {
      const hit = getCached('methodology');
      if (hit) return res.json(hit);
      const data = await pyBridge.call('methodology');
      setCached('methodology', data, 60000);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production bundle not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EPL Tactical Intelligence server running at http://localhost:${PORT}`);
    // Pre-warm Python engine bridge asynchronously
    pyBridge.call('data_status').catch((e) => console.error('Initial Python warm-up error:', e));
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
