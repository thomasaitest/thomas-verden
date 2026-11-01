/** Who may walk into a house given lock state. Owner is never blocked. */
export function canEnterHouse(opts: { locked: boolean; isOwner: boolean }): boolean {
  if (opts.isOwner) return true;
  return !opts.locked;
}

export function lockLabel(locked: boolean): string {
  return locked ? 'Lås opp 🔓' : 'Lås huset 🔒';
}

/** Short status for nameplates / friend door chrome. */
export function doorLockStatus(locked: boolean): string {
  return locked ? 'Låst 🔒' : 'Åpen 🔓';
}

export function doorPrompt(opts: { locked: boolean; isOwner: boolean; ownerName?: string }): string {
  if (opts.isOwner) return opts.locked ? 'Gå inn (låst) 🏠' : 'Gå inn 🏠';
  if (opts.locked) return `Låst 🔒`;
  return opts.ownerName ? `Besøk ${opts.ownerName} 🏠` : 'Besøk 🏠';
}
