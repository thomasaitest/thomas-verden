/**
 * Adaptive render budget. Tiers are chosen from real frame time so a slow
 * device sheds lights, shadows and distant trees before the game becomes
 * unplayable. This is not a claim about any particular phone.
 */
export interface RenderBudget {
  tier: 0 | 1 | 2;
  /** Upper cap passed to Math.min(devicePixelRatio, cap). */
  pixelRatioCap: number;
  shadows: boolean;
  bloom: boolean;
  /** Dynamic façade lights kept visible. */
  maxLights: number;
  /** Metres. Trees farther than this swap to a low canopy. */
  treeLod: number;
}

export function budgetForTier(tier: 0 | 1 | 2): RenderBudget {
  if (tier <= 0) return { tier: 0, pixelRatioCap: 0.85, shadows: false, bloom: false, maxLights: 1, treeLod: 24 };
  if (tier === 1) return { tier: 1, pixelRatioCap: 1, shadows: false, bloom: false, maxLights: 3, treeLod: 36 };
  return { tier: 2, pixelRatioCap: 1.25, shadows: true, bloom: true, maxLights: 4, treeLod: 52 };
}

/**
 * Move one tier toward the frame-time target.
 * Slow frames step down immediately once `badRun` is long enough.
 * Fast frames step up only while `tier` is still under `ceiling` (HQ raises the ceiling).
 */
export function nextTier(
  tier: 0 | 1 | 2,
  badRun: number,
  goodRun: number,
  ceiling: 0 | 1 | 2,
): 0 | 1 | 2 {
  const cur = Math.max(0, Math.min(ceiling, tier)) as 0 | 1 | 2;
  if (badRun >= 10 && cur > 0) return (cur - 1) as 0 | 1 | 2;
  if (goodRun >= 40 && cur < ceiling) return (cur + 1) as 0 | 1 | 2;
  return cur;
}
