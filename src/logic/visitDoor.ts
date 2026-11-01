/**
 * Friend-house visit prompts: trigger at the door/nameplate, not the plot centre,
 * so house collision never blocks Besøk.
 */
import { HOUSE_BY_STYLE, type HouseStyle } from './catalog.ts';

/** Match town.ts homeExterior footprint used for door/nameplate placement. */
export function exteriorFootprint(style: HouseStyle | string | null | undefined): { w: number; d: number } {
  const info = HOUSE_BY_STYLE[(style as HouseStyle) in HOUSE_BY_STYLE ? (style as HouseStyle) : 'hytte'] ?? HOUSE_BY_STYLE.hytte;
  const w = Math.min(22, info.w * 0.65);
  const d = Math.min(18, info.d * 0.7);
  return { w: w + 1, d: d + 1 };
}

/** World position of the front door / nameplate post for a plot. */
export function friendDoorPos(
  plot: { x: number; z: number; rot?: number },
  style?: HouseStyle | string | null,
): { x: number; z: number } {
  const rot = plot.rot ?? 0;
  const { d } = exteriorFootprint(style);
  const dist = d / 2 + 2.2;
  return {
    x: plot.x + Math.sin(rot) * dist,
    z: plot.z + Math.cos(rot) * dist,
  };
}

/** Reach for Besøk / locked prompt at a friend's door (independent of house collision). */
export const VISIT_DOOR_RADIUS = 4.5;

/** Own home "Gå inn" zone radius (slightly roomier for small fingers). */
export const HOME_ENTER_RADIUS = 4.5;

/** Valid remote plot indices are 1..length-1; never treat 0 as falsy-skip alone. */
export function isRemotePlot(plot: number | null | undefined, plotCount: number): plot is number {
  return typeof plot === 'number' && Number.isFinite(plot) && plot >= 1 && plot < plotCount;
}

export function nearFriendDoor(
  px: number,
  pz: number,
  plot: { x: number; z: number; rot?: number },
  style: HouseStyle | string | null | undefined,
  radius = VISIT_DOOR_RADIUS,
): boolean {
  const door = friendDoorPos(plot, style);
  return Math.hypot(px - door.x, pz - door.z) < radius;
}
