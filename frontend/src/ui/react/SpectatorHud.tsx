// ROLE: Player-facing spectator HUD (badge, live status, leaderboard). Not rendering or networking.
import { t } from "../../lib/i18n";
import { useGameStatus } from "./gameUiStore";
import { Leaderboard } from "./Leaderboard";

export function SpectatorHud() {
  const status = useGameStatus();
  const isLive = status.status === "connected";

  return (
    <>
      <div className="spectator-badge glass-panel">
        <span className="spectator-badge-title">👁 {t("spectator.title")}</span>
        <span className={`spectator-badge-status ${isLive ? "online" : "pending"}`}>
          {isLive ? t("spectator.live") : t("status.connecting")}
        </span>
        <p className="spectator-hint">{t("spectator.hint")}</p>
      </div>
      <Leaderboard limit={10} alwaysOpen plain />
    </>
  );
}
