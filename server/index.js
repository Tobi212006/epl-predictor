import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const token = process.env.FOOTBALL_DATA_TOKEN?.trim();
const cache = new Map();
const cacheTtl = 10 * 60 * 1000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

app.disable("x-powered-by");
app.use(cors({ origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5173"] }));
app.use(express.json({ limit: "32kb" }));

async function provider(pathname, query = "") {
  if (!token) {
    const error = new Error("Add your free football-data.org token to .env to connect real fixtures and standings.");
    error.status = 503;
    throw error;
  }
  const key = pathname + query;
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  const response = await fetch(`https://api.football-data.org/v4${pathname}${query}`, {
    headers: { "X-Auth-Token": token, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 429 ? "The free API request limit was reached. Try again shortly." : response.status === 403 ? "This data is outside the current API plan." : `Football data provider returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  cache.set(key, { data, expires: Date.now() + cacheTtl });
  return data;
}

app.get("/api/v1/status", (_req, res) => res.json({ configured: Boolean(token), provider: "football-data.org", cacheSeconds: cacheTtl / 1000 }));

app.get("/api/v1/fixtures", async (req, res) => {
  try {
    const now = new Date();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || "")) ? String(req.query.from) : now.toISOString().slice(0, 10);
    const fallbackTo = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || "")) ? String(req.query.to) : fallbackTo;
    if (to < from) return res.status(400).json({ error: "The end date must be on or after the start date." });
    const data = await provider("/competitions/PL/matches", `?dateFrom=${from}&dateTo=${to}`);
    res.json({ matches: data.matches || [], source: "football-data.org", updatedAt: new Date().toISOString() });
  } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
});

app.get("/api/v1/standings", async (_req, res) => {
  try {
    const data = await provider("/competitions/PL/standings");
    res.json({ standings: data.standings?.find((table) => table.type === "TOTAL")?.table || [], source: "football-data.org", updatedAt: new Date().toISOString() });
  } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
});

app.get("/api/v1/matches/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Match ID must be numeric." });
  try {
    const data = await provider(`/matches/${req.params.id}`);
    res.json({ match: data, source: "football-data.org", updatedAt: new Date().toISOString() });
  } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("*", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
}

app.listen(port, () => console.log(`Touchline server listening at http://localhost:${port}`));
