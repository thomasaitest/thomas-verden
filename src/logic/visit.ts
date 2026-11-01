/**
 * Kid-safe house visits: the visitor asks, the owner must accept.
 * No free-text chat — only ask / accept / decline.
 */

export type VisitStatus = 'idle' | 'asking' | 'incoming' | 'inside';

export interface VisitState {
  status: VisitStatus;
  /** Remote playerId of the house owner (when asking or inside). */
  ownerPlayerId: string | null;
  /** Display name of the other party. */
  peerName: string | null;
  /** Socket/remote id of the peer (for replies). */
  peerSocketId: string | null;
  /** When the ask was sent/received (ms). */
  since: number;
}

export function idleVisit(): VisitState {
  return { status: 'idle', ownerPlayerId: null, peerName: null, peerSocketId: null, since: 0 };
}

export function startAsk(ownerPlayerId: string, peerName: string, peerSocketId: string, now: number): VisitState {
  return { status: 'asking', ownerPlayerId, peerName, peerSocketId, since: now };
}

export function receiveAsk(fromPlayerId: string, fromName: string, fromSocketId: string, now: number): VisitState {
  return { status: 'incoming', ownerPlayerId: fromPlayerId, peerName: fromName, peerSocketId: fromSocketId, since: now };
}

export function acceptVisit(s: VisitState, now: number): VisitState {
  if (s.status !== 'asking' && s.status !== 'incoming') return s;
  // Visitor who asked → inside; owner who accepted stays idle (guest comes in).
  if (s.status === 'asking') {
    return { ...s, status: 'inside', since: now };
  }
  return idleVisit();
}

export function declineOrCancel(_s: VisitState): VisitState {
  return idleVisit();
}

/** Asks time out after this many ms. */
export const VISIT_TIMEOUT_MS = 30_000;

export function tickVisit(s: VisitState, now: number): VisitState {
  if ((s.status === 'asking' || s.status === 'incoming') && now - s.since > VISIT_TIMEOUT_MS) {
    return idleVisit();
  }
  return s;
}

export function canAskVisit(opts: {
  inTown: boolean;
  nearFriendDoor: boolean;
  alreadyVisiting: boolean;
  driving: boolean;
  paused: boolean;
}): boolean {
  return opts.inTown && opts.nearFriendDoor && !opts.alreadyVisiting && !opts.driving && !opts.paused;
}
