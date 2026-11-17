export type Team = { id: number; name: string; shortName?: string; tla?: string; crest?: string };
export type Match = { id: number; utcDate: string; status: string; matchday?: number; homeTeam: Team; awayTeam: Team; score?: { fullTime?: { home?: number | null; away?: number | null }; halfTime?: { home?: number | null; away?: number | null } } };
export type Standing = { position: number; team: Team; playedGames: number; won: number; draw: number; lost: number; points: number; goalsFor: number; goalsAgainst: number; goalDifference: number };
