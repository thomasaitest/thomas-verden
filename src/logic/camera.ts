/** Orbit camera maths and camera-relative movement. Pure, so it can be tested. */
export interface OrbitCam {
  yaw: number;
  pitch: number;
  dist: number;
}

export const PITCH_MIN = 0.12;
export const PITCH_MAX = 1.35;
export const DIST_MIN = 5;
/** Indoor shoulder cam may sit closer / flatter than plaza orbit. */
export const HOUSE_PITCH_MIN = 0.02;
export const HOUSE_DIST_MIN = 2.4;
export const DRAG_YAW = 0.006;
export const DRAG_PITCH = 0.004;

/** Apply a drag (pixels) and a zoom delta, keeping the camera above the ground and inside distance limits. */
export function orbit(
  cam: OrbitCam,
  dx: number,
  dy: number,
  zoom: number,
  maxDist: number,
  opts?: { minDist?: number; minPitch?: number },
): OrbitCam {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const minDist = opts?.minDist ?? DIST_MIN;
  const minPitch = opts?.minPitch ?? PITCH_MIN;
  return {
    yaw: cam.yaw - dx * DRAG_YAW,
    pitch: clamp(cam.pitch + dy * DRAG_PITCH, minPitch, PITCH_MAX),
    dist: clamp(cam.dist + zoom, minDist, maxDist),
  };
}

/** Where the camera sits relative to its target. */
export function orbitOffset(cam: OrbitCam, dist = cam.dist): { x: number; y: number; z: number } {
  const cp = Math.cos(cam.pitch);
  return { x: Math.sin(cam.yaw) * cp * dist, y: Math.sin(cam.pitch) * dist, z: Math.cos(cam.yaw) * cp * dist };
}

/**
 * Turn stick/keyboard input (x = right, y = down on screen, so forward is y = -1)
 * into a world-space move vector. Forward always points away from the camera.
 */
export function cameraRelative(move: { x: number; y: number }, yaw: number): { x: number; z: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  return { x: fx * -move.y + Math.cos(yaw) * move.x, z: fz * -move.y - Math.sin(yaw) * move.x };
}
