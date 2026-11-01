/**
 * Playground equipment you can sit on: swing, slide, seesaw and merry-go-round.
 *
 * Everything here is plain maths in the playground's own frame (x right, z forward, yaw 0 = looking along +z,
 * y up); `three/town.ts` places that frame in the world. The same functions drive the animated meshes and
 * the seat of the avatar, so the avatar can never drift off the thing it sits on.
 */

export type EquipKind = 'swing' | 'slide' | 'seesaw' | 'merry' | 'tramp';
export type SeatPose = 'swing' | 'slide' | 'seesaw' | 'spin' | 'walk' | 'jump';

export interface EquipDef {
  id: string;
  kind: EquipKind;
  label: string;
  /** Middle of the equipment (playground frame). */
  x: number;
  z: number;
  /** You can use it from this far away from its middle. */
  reach: number;
  /** Where you step down: a free spot next to it. */
  exit: { x: number; z: number; yaw: number };
}

export interface Seat {
  /** Where the avatar's feet/origin go. */
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Lean forward (+) / back (-) in the avatar's own frame, in radians. */
  tilt: number;
  pose: SeatPose;
  /** What the camera looks at. */
  focus: { x: number; y: number; z: number };
}

/** The avatar's hips are about this far above its feet, so a sitting avatar's feet origin hangs this far below the seat. */
export const SIT_DROP = 0.9;

// ---- geometry shared with the meshes in town.ts
export const SWING_PIVOT_Y = 5;
export const SWING_ROPE = 3.2;
export const SWING_Z = -3;
export const SWING_XS = [2.8, 5.2];
export const SWING_SEAT_TOP = 0.1;

export const SLIDE = { x: -4, y: 2, z: 0.2, len: 5.6, tilt: 0.62, thick: 0.25 };
export const SEESAW = { x: -4, y: 0.9, z: 5.5, len: 6, thick: 0.25, arm: 2.2 };
export const MERRY = { x: 0, y: 0.6, z: 7.5, radius: 2, thick: 0.3, rider: 1.25 };
export const TRAMP = { x: 4.5, y: 0.35, z: 4.2, radius: 2.2, thick: 0.2 };

export const EQUIPMENT: EquipDef[] = [
  ...SWING_XS.map((x, i): EquipDef => ({ id: `swing${i + 1}`, kind: 'swing', label: 'huska', x, z: SWING_Z, reach: 3.2, exit: { x, z: -0.9, yaw: 0 } })),
  { id: 'slide', kind: 'slide', label: 'sklia', x: SLIDE.x, z: SLIDE.z + 1.2, reach: 4.4, exit: { x: SLIDE.x, z: 3.4, yaw: 0 } },
  { id: 'seesaw', kind: 'seesaw', label: 'vippa', x: SEESAW.x, z: SEESAW.z, reach: 3.6, exit: { x: SEESAW.x, z: 7.1, yaw: Math.PI } },
  { id: 'merry', kind: 'merry', label: 'karusellen', x: MERRY.x, z: MERRY.z, reach: 3.7, exit: { x: MERRY.x, z: 4.2, yaw: Math.PI } },
  { id: 'tramp', kind: 'tramp', label: 'trampolinen', x: TRAMP.x, z: TRAMP.z, reach: 3.2, exit: { x: TRAMP.x, z: TRAMP.z + 3.2, yaw: Math.PI } },
];
export const EQUIP_BY_ID: Record<string, EquipDef> = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));

// ---- motions (u = seconds since you got on)
export const swingAngle = (u: number): number => 0.7 * Math.sin(u * 2.1) * Math.min(1, u / 1.2);
export const seesawAngle = (u: number): number => 0.24 * Math.sin(u * 1.7);
export const merryAngle = (u: number): number => 1.3 * u * Math.min(1, u / 1.5 + 0.2);

/** One round on the slide: wait on top, slide down, sit a moment, walk back up. */
export const SLIDE_CYCLE = { wait: 0.4, down: 1.1, rest: 0.4, up: 1.6 };
const SLIDE_HALF = 2.3; // along the ramp, from its middle

function slidePos(s: number): { x: number; y: number; z: number } {
  // s runs from -SLIDE_HALF (top) to +SLIDE_HALF (bottom) along the ramp; the surface is a hair above the plank
  return { x: SLIDE.x, y: SLIDE.y - s * Math.sin(SLIDE.tilt) + 0.13 * Math.cos(SLIDE.tilt), z: SLIDE.z + s * Math.cos(SLIDE.tilt) + 0.13 * Math.sin(SLIDE.tilt) };
}

export function slideState(u: number): { s: number; pose: SeatPose; yaw: number } {
  const { wait, down, rest, up } = SLIDE_CYCLE;
  const t = u % (wait + down + rest + up);
  if (t < wait) return { s: -SLIDE_HALF, pose: 'slide', yaw: 0 };
  if (t < wait + down) {
    const k = (t - wait) / down;
    return { s: -SLIDE_HALF + 2 * SLIDE_HALF * k * k, pose: 'slide', yaw: 0 };
  }
  if (t < wait + down + rest) return { s: SLIDE_HALF, pose: 'slide', yaw: 0 };
  const k = (t - wait - down - rest) / up;
  return { s: SLIDE_HALF - 2 * SLIDE_HALF * k, pose: 'walk', yaw: Math.PI };
}

export function seatAt(id: string, u: number): Seat {
  const def = EQUIP_BY_ID[id];
  if (!def) throw new Error(`unknown playground equipment: ${id}`);
  switch (def.kind) {
    case 'swing': {
      const a = swingAngle(u);
      const y = SWING_PIVOT_Y - SWING_ROPE * Math.cos(a) + SWING_SEAT_TOP;
      const z = SWING_Z + SWING_ROPE * Math.sin(a);
      return { x: def.x, y: y - SIT_DROP, z, yaw: 0, tilt: -a, pose: 'swing', focus: { x: def.x, y: 2.4, z: SWING_Z + 0.6 } };
    }
    case 'slide': {
      const st = slideState(u);
      const p = slidePos(st.s);
      const sitting = st.pose !== 'walk';
      return { x: p.x, y: p.y - (sitting ? SIT_DROP : 0), z: p.z, yaw: st.yaw, tilt: sitting ? SLIDE.tilt : 0, pose: st.pose, focus: { x: SLIDE.x, y: 2.3, z: SLIDE.z } };
    }
    case 'seesaw': {
      const a = seesawAngle(u);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const surf = SEESAW.thick / 2;
      return {
        x: SEESAW.x + SEESAW.arm * c - surf * s,
        y: SEESAW.y + SEESAW.arm * s + surf * c - SIT_DROP,
        z: SEESAW.z,
        yaw: -Math.PI / 2,
        tilt: a,
        pose: 'seesaw',
        focus: { x: SEESAW.x, y: 1.6, z: SEESAW.z },
      };
    }
    case 'merry': {
      const al = Math.PI / 2 + merryAngle(u);
      return {
        x: MERRY.x + Math.cos(al) * MERRY.rider,
        y: MERRY.y + MERRY.thick / 2 - SIT_DROP,
        z: MERRY.z + Math.sin(al) * MERRY.rider,
        yaw: Math.atan2(-Math.sin(al), Math.cos(al)),
        tilt: 0,
        pose: 'spin',
        focus: { x: MERRY.x, y: 1.6, z: MERRY.z },
      };
    }
    case 'tramp': {
      const hop = Math.abs(Math.sin(u * 3.2));
      const y = TRAMP.y + TRAMP.thick / 2 + hop * 2.4;
      return {
        x: TRAMP.x,
        y: y - (hop < 0.15 ? SIT_DROP * 0.3 : 0),
        z: TRAMP.z,
        yaw: 0,
        tilt: 0,
        pose: hop > 0.2 ? 'jump' : 'walk',
        focus: { x: TRAMP.x, y: 1.8, z: TRAMP.z },
      };
    }
  }
}

// ---- who can use what

/** The equipment closest to a point (in the playground frame) that is within its reach. */
export function nearestEquip(x: number, z: number): EquipDef | null {
  let best: EquipDef | null = null;
  let bestK = Infinity;
  for (const e of EQUIPMENT) {
    const k = Math.hypot(x - e.x, z - e.z) / e.reach;
    if (k <= 1 && k < bestK) {
      best = e;
      bestK = k;
    }
  }
  return best;
}

/** Moving the stick or jumping gets you off; standing still keeps you on. */
export function wantsOff(move: { x: number; y: number }, jumpPressed: boolean): boolean {
  return jumpPressed || Math.hypot(move.x, move.y) > 0.3;
}

/** Can you climb on right now? (not while riding, carrying an animal or flying) */
export function canUse(s: { riding: boolean; holding: boolean; flying: boolean; paused: boolean; driving?: boolean; pramming?: boolean }): boolean {
  return !s.riding && !s.holding && !s.flying && !s.paused && !s.driving && !s.pramming;
}
