// ROLE: Pure steering-send policy: edge/zero-snap handling and a 25 ms throttle.
// No DOM, network, timers or game state.

/** 25 ms throttle caps steering at 40 Hz; PING and boost edges share the rest of the server's 50 msg/s budget. */
export const STEERING_SEND_INTERVAL_MS = 25;
/** Ignore jitter below one percent of full deflection so a held mouse does not spam the wire. */
export const STEERING_EPSILON = 0.01;

/**
 * Decide whether the current steering value must be sent now.
 *
 * `force` is a reconnect/respawn snapshot. A zero snap bypasses both the epsilon
 * check and the throttle so releasing the pointer stops the snake even when the
 * last sent value was small. Otherwise the value must have changed and the
 * interval elapsed. Non-finite values are never sent: a `TURN:NaN` frame is
 * rejected by the server and would poison `lastSentTurn` on the client.
 */
export function shouldSendSteering(
  now: number,
  lastSentAt: number,
  turn: number,
  lastSentTurn: number,
  force = false,
): boolean {
  if (force) return true;
  if (!Number.isFinite(turn)) return false;
  if (turn === 0 && lastSentTurn !== 0) return true;
  if (Math.abs(turn - lastSentTurn) <= STEERING_EPSILON) return false;
  if (lastSentAt <= 0) return true;
  return now - lastSentAt >= STEERING_SEND_INTERVAL_MS;
}
