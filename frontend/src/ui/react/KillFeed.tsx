// ROLE: React kill feed. Resolves display names from store items; no game logic.
import { t } from "../../lib/i18n";
import { useGameKillFeed } from "./gameUiStore";

export function KillFeed() {
  const items = useGameKillFeed();

  return (
    <div className="killfeed-panel hud-interactive">
      {items.map((item) => (
        <div key={item.id} className="kill-message">
          <span className="kill-killer">{item.killer ?? t("status.wall")}</span> killed{" "}
          <span className="kill-victim">{item.victim}</span>
        </div>
      ))}
    </div>
  );
}
