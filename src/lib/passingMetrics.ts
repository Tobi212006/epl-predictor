import type { PassFilterMode, PassingLink, PassingSummary, PlayerNode } from '../types/tactical';

export interface PlayerPassingStats {
  playerId: string;
  attempted: number;
  completed: number;
  incomplete: number;
  completionPct: number;
  keyPasses: number;
  topPartners: Array<{
    partnerId: string;
    partnerName: string;
    passes: number;
    completed: number;
    incomplete: number;
    keyPasses: number;
  }>;
}

export function getFilteredPassWeight(link: PassingLink, filter: PassFilterMode): number {
  switch (filter) {
    case 'completed':
      return link.completed_passes;
    case 'incomplete':
      return link.incomplete_passes;
    case 'key':
      return link.key_passes;
    case 'all':
    default:
      return link.total_passes;
  }
}

export function filterPassingLinks(
  links: PassingLink[],
  filter: PassFilterMode,
  selectedPlayerId: string | null = null,
): PassingLink[] {
  return links.filter((link) => {
    const matchesPlayer =
      !selectedPlayerId || link.from_id === selectedPlayerId || link.to_id === selectedPlayerId;
    if (!matchesPlayer) return false;
    return getFilteredPassWeight(link, filter) > 0;
  });
}

export function computeFilteredSummary(
  links: PassingLink[],
  filter: PassFilterMode,
  selectedPlayerId: string | null = null,
): PassingSummary {
  const active = filterPassingLinks(links, filter, selectedPlayerId);
  const totalPasses = active.reduce((acc, l) => acc + l.total_passes, 0);
  const completedPasses = active.reduce((acc, l) => acc + l.completed_passes, 0);
  const incompletePasses = active.reduce((acc, l) => acc + l.incomplete_passes, 0);
  const keyPasses = active.reduce((acc, l) => acc + l.key_passes, 0);

  const completionPct =
    totalPasses > 0 ? Math.round((completedPasses / totalPasses) * 1000) / 10 : 0;

  let mostConnectedPair: PassingSummary['most_connected_pair'] = null;
  if (active.length > 0) {
    const topLink = [...active].sort(
      (a, b) => getFilteredPassWeight(b, filter) - getFilteredPassWeight(a, filter),
    )[0];
    mostConnectedPair = {
      from_name: topLink.from_name,
      to_name: topLink.to_name,
      total_passes: getFilteredPassWeight(topLink, filter),
      completed_passes: topLink.completed_passes,
    };
  }

  return {
    total_passes: totalPasses,
    completed_passes: completedPasses,
    incomplete_passes: incompletePasses,
    completion_pct: completionPct,
    key_passes: keyPasses,
    most_connected_pair: mostConnectedPair,
  };
}

export function computePlayerPassingStats(
  playerId: string,
  links: PassingLink[],
  players: PlayerNode[],
): PlayerPassingStats {
  const playerLookup = new Map(players.map((p) => [p.id, p]));
  const partnerTotals = new Map<
    string,
    { passes: number; completed: number; incomplete: number; keyPasses: number }
  >();

  let attempted = 0;
  let completed = 0;
  let incomplete = 0;
  let keyPasses = 0;

  for (const link of links) {
    if (link.from_id !== playerId && link.to_id !== playerId) continue;
    const partnerId = link.from_id === playerId ? link.to_id : link.from_id;

    attempted += link.total_passes;
    completed += link.completed_passes;
    incomplete += link.incomplete_passes;
    keyPasses += link.key_passes;

    const existing = partnerTotals.get(partnerId) || {
      passes: 0,
      completed: 0,
      incomplete: 0,
      keyPasses: 0,
    };
    existing.passes += link.total_passes;
    existing.completed += link.completed_passes;
    existing.incomplete += link.incomplete_passes;
    existing.keyPasses += link.key_passes;
    partnerTotals.set(partnerId, existing);
  }

  const topPartners = [...partnerTotals.entries()]
    .map(([partnerId, stats]) => ({
      partnerId,
      partnerName: playerLookup.get(partnerId)?.short_name || partnerId,
      ...stats,
    }))
    .sort((a, b) => b.passes - a.passes)
    .slice(0, 4);

  return {
    playerId,
    attempted,
    completed,
    incomplete,
    completionPct: attempted > 0 ? Math.round((completed / attempted) * 1000) / 10 : 0,
    keyPasses,
    topPartners,
  };
}
