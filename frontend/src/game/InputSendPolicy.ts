// ROLE: Pure steering-send policy: edge/zero-snap handling and a 25 ms throttle.
// No DOM, network, timers or game state.

/** Maximum steering send rate is 40 Hz, below the server's 50 msg/s cap. */
export const STEERING_SEND_INTERVAL_MS = 25;
/** Ignore sub-percent jitter so a held mouse does not spam the wire. */
export const STEERING_EPSILON = 0.01;

/**
 * Decide whether the current steering value must be sent now.
 *
 * `force` is a reconnect/respawn snapshot. A zero snap bypasses the throttle so
 * releasing the mouse stops the snake immediately instead of waiting for the
 * next interval. Otherwise the value must have changed and the interval elapsed.
 */
export function shouldSendSteering(
  now: number,
  lastSentAt: number,
  turn: number,
  lastSentTurn: number,
  force = false,
): boolean {
  if (force) return true;
  if (Math.abs(turn - lastSentTurn) <= STEERING_EPSILON) return false;
  if (turn === 0 && lastSentTurn !== 0) return true;
  if (lastSentAt <= 0) return true;
  return now - lastSentAt >= STEERING_SEND_INTERVAL_MS;
}
