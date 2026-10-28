// ROLE: Player-facing spectator HUD (badge, live status, follow controls, leaderboard). Not rendering or networking.
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";
import { useGameLeaderboard, useGameStatus } from "./gameUiStore";
import { Leaderboard } from "./Leaderboard";

export function SpectatorHud() {
  const status = useGameStatus();
  const entries = useGameLeaderboard();
  const [followedId, setFollowedId] = useState<string | null>(null);
  const isLive = status.status === "connected";
  const followed = followedId ? entries.find((entry) => entry.id === followedId) : undefined;

  useEffect(() => {
    const clearFollow = () => setFollowedId(null);
    window.addEventListener("spectator-follow-ended", clearFollow);
    return () => window.removeEventListener("spectator-follow-ended", clearFollow);
  }, []);

  const follow = (id: string) => {
    setFollowedId(id);
    window.dispatchEvent(new CustomEvent("spectator-follow", { detail: id }));
  };

  const showOverview = () => {
    setFollowedId(null);
    window.dispatchEvent(new CustomEvent("spectator-follow", { detail: null }));
  };

  return (
    <>
      <div className="spectator-badge glass-panel">
        <span className="spectator-badge-title">👁 {t("spectator.title")}</span>
        <span className={`spectator-badge-status ${isLive ? "online" : "pending"}`}>
          {isLive ? t("spectator.live") : t("status.connecting")}
        </span>
        {followedId ? (
          <div className="spectator-following">
            <span>
              {t("spectator.following", {
                name: followed?.nickname || followedId.substring(0, 8),
              })}
            </span>
            <button type="button" className="spectator-overview" onClick={showOverview}>
              {t("spectator.overview")}
            </button>
          </div>
        ) : (
          <p className="spectator-hint">{t("spectator.followHint")}</p>
        )}
        <p className="spectator-hint">{t("spectator.hint")}</p>
      </div>
      <Leaderboard limit={10} alwaysOpen plain selectedId={followedId} onSelect={follow} />
    </>
  );
}
