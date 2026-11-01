/**
 * Neighbourhood plot assignment for multiplayer.
 * Plot 0 is always the local player's home on each client.
 * Remote players get stable plots 1..MAX_REMOTE_PLOTS.
 */

export const MAX_REMOTE_PLOTS = 5; // housePlots.length - 1

/** Lowest free plot in 1..max that is not taken. */
export function allocatePlot(taken: ReadonlySet<number>, max = MAX_REMOTE_PLOTS): number | null {
  for (let p = 1; p <= max; p++) {
    if (!taken.has(p)) return p;
  }
  return null;
}

/** Plots currently held by seats (ignore 0 / invalid). */
export function takenPlots(plots: Iterable<number | null | undefined>): Set<number> {
  const s = new Set<number>();
  for (const p of plots) {
    if (typeof p === 'number' && p >= 1 && p <= MAX_REMOTE_PLOTS) s.add(p);
  }
  return s;
}
