import type { Match, Standing } from "./types";

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Football data is unavailable.");
  return data;
}

export const api = {
  status: () => get<{ configured: boolean; provider: string }>("/api/v1/status"),
  fixtures: () => get<{ matches: Match[]; source: string }>("/api/v1/fixtures"),
  standings: () => get<{ standings: Standing[]; source: string }>("/api/v1/standings"),
};
