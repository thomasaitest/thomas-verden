/** Pure helpers for seating a remote rider on their pet (no three.js). */

export function ridePetScale(baseScale = 1): number {
  return Math.max(2.2, baseScale * 2);
}

/** Seat height offset when riding a pet (matches local Game avatar placement). */
export function rideSeatOffset(seatY: number, petScale: number): number {
  return seatY * petScale - 0.95;
}
