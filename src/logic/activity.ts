/** Shared plaza activities: dance circle and parade. */

export type ActivityKind = 'dance' | 'parade';

export interface ActivityDef {
  kind: ActivityKind;
  label: string;
  emoji: string;
  /** How long one activity lasts (seconds). */
  duration: number;
}

export const ACTIVITIES: ActivityDef[] = [
  { kind: 'dance', label: 'Dansefest', emoji: '💃', duration: 20 },
  { kind: 'parade', label: 'Parade', emoji: '🥳', duration: 25 },
];

export const ACTIVITY_BY_KIND = Object.fromEntries(ACTIVITIES.map((a) => [a.kind, a])) as Record<ActivityKind, ActivityDef>;

/** Plaza centre in town coordinates (matches fountain). */
export const PLAZA = { x: 0, z: 0, r: 10 };

export function nearPlaza(x: number, z: number, r = PLAZA.r): boolean {
  return Math.hypot(x - PLAZA.x, z - PLAZA.z) <= r;
}

export interface ActivityPose {
  x: number;
  z: number;
  yaw: number;
  pose: 'dance' | 'walk' | 'wave';
}

/** Local pose while joining an activity, `u` seconds since start, slot index among joiners. */
export function activityPose(kind: ActivityKind, u: number, slot: number): ActivityPose {
  if (kind === 'dance') {
    const ang = u * 1.4 + slot * ((Math.PI * 2) / 8);
    const rad = 4.2;
    return {
      x: PLAZA.x + Math.cos(ang) * rad,
      z: PLAZA.z + Math.sin(ang) * rad,
      yaw: ang + Math.PI / 2,
      pose: 'dance',
    };
  }
  // parade: loop around the fountain
  const t = (u * 0.55 + slot * 0.9) % (Math.PI * 2);
  const rad = 6.5;
  return {
    x: PLAZA.x + Math.cos(t) * rad,
    z: PLAZA.z + Math.sin(t) * rad,
    yaw: t + Math.PI / 2,
    pose: 'walk',
  };
}

export function canStartActivity(opts: {
  inTown: boolean;
  nearPlaza: boolean;
  driving: boolean;
  riding: boolean;
  using: boolean;
  paused: boolean;
}): boolean {
  return opts.inTown && opts.nearPlaza && !opts.driving && !opts.riding && !opts.using && !opts.paused;
}
