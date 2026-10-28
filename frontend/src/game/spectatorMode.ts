// ROLE: Pure spectator route parsing. Not UI, networking or rendering.
export interface SpectatorMode {
  enabled: boolean;
  debug: boolean;
}

/**
 * `?spectator=true` is the player-facing spectator, while `?spectator=debug`
 * (or the legacy `?debug=true` combination) exposes admin debug panels.
 */
export function resolveSpectatorMode(params: URLSearchParams): SpectatorMode {
  const enabled = params.has("spectator");
  const value = params.get("spectator");
  return {
    enabled,
    debug: enabled && (value === "debug" || params.get("debug") === "true"),
  };
}
