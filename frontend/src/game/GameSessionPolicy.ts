// ROLE: Pure session guards for outbound input and identity resync. No DOM, network or timers.

/** Input may be sent only while connected and while the renderer is healthy. */
export function canSendGameInput(
  isConnected: boolean,
  contextLost: boolean,
  fatalError: boolean,
): boolean {
  return isConnected && !contextLost && !fatalError;
}

/** A repeated FULL (for example RESYNC) must not reset held input for the same player. */
export function isNewPlayerIdentity(previous: string, next: string): boolean {
  return previous !== next;
}
