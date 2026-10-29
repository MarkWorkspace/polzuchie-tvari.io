// ROLE: React kill feed. Resolves display names and environmental causes; no game logic.
import { t } from "../../lib/i18n";
import { useGameKillFeed } from "./gameUiStore";

/**
 * The server sends raw ids for non-player killers: "black_hole" for the event
 * horizon and `tomb_<player>_<n>` for a gravestone. A null killer means the
 * player left the world, so neither case should leak the raw id into the HUD.
 */
export function killCauseLabel(killer: string | null): string {
  if (!killer) return t("status.environment");
  if (killer === "black_hole") return t("status.blackHole");
  if (killer.startsWith("tomb_")) return t("status.tombstone");
  return killer;
}

export function KillFeed() {
  const items = useGameKillFeed();

  return (
    <div className="killfeed-panel hud-interactive">
      {items.map((item) => (
        <div key={item.id} className="kill-message">
          <span className="kill-killer">{killCauseLabel(item.killer)}</span>
          {/* Language-neutral separator: the HUD has no localized verb for
              "killed", and a hardcoded English word looked wrong in RU. */}
          <span className="kill-arrow" aria-hidden="true">
            →
          </span>
          <span className="kill-victim">{item.victim}</span>
        </div>
      ))}
    </div>
  );
}
